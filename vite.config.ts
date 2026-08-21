import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

const FICHIER_POSES = 'src/origami/poses.ts';
const CARTES = 'game-design/scenes';
const DECOUPAGES = 'game-design/enigmes';
const HISTOIRE = 'content';

/** Bornes de sécurité. Au-delà, ce n'est plus un réglage, c'est une erreur. */
const LIMITES = {
  angle: 360,
  pliage: [0, 1],
  echelle: [0.05, 20],
} as const;

/**
 * Enregistrement des poses d'origami depuis l'outil de réglage.
 *
 * L'outil tourne dans le navigateur et n'a aucun moyen d'écrire sur le disque ;
 * ce point d'entrée le lui donne, pour **un seul fichier connu d'avance**.
 * Recopier un bloc à la main entre le navigateur et l'éditeur à chaque essai
 * était le vrai coût du réglage.
 *
 * Ce qui rend la chose sûre :
 *
 * - `apply: 'serve'` — n'existe qu'en développement, jamais dans le build ni
 *   dans ce qui part sur itch.io.
 * - **Rien de ce qui arrive n'est écrit tel quel.** On ne garde que des nombres,
 *   bornés, et on regénère le fichier nous-mêmes. Aucun texte venu du réseau ne
 *   se retrouve dans le source.
 * - Les modèles doivent **déjà exister** dans le fichier : on met à jour des
 *   valeurs, on n'en invente pas.
 *
 * À savoir tout de même : `server.host` est à `true` pour pouvoir tester depuis
 * un téléphone, donc ce point d'entrée est joignable depuis le réseau local. Au
 * pire, quelqu'un sur le même wifi change quatre nombres dans un fichier de
 * développement.
 */
function enregistrerPoses(): Plugin {
  return {
    name: 'ori-quest:poses',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__poses', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let corps = '';
        req.on('data', (bout) => {
          corps += bout;
          // Le fichier fait quelques centaines d'octets : au-delà, ce n'est
          // pas l'outil qui parle.
          if (corps.length > 16_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const source = readFileSync(FICHIER_POSES, 'utf8');
            writeFileSync(FICHIER_POSES, rendreFichier(source, JSON.parse(corps)));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, erreur: String(err) }));
          }
        });
      });
    },
  };
}

/**
 * Relance un outil de build quand une source change, et laisse Vite recharger
 * la page dans la foulée.
 *
 * Les deux guetteurs ci-dessous ne diffèrent que par le fichier surveillé, le
 * script à relancer et la phrase à afficher quand ça casse.
 */
function relancerSurChangement(
  server: ViteDevServer,
  {
    dossier,
    extension,
    script,
    echec,
  }: { dossier: string; extension: string; script: string; echec: string },
) {
  let enCours = false;

  const regenerer = (fichier: string) => {
    // Le guetteur est global : il voit passer tout le projet. Le dossier compte
    // donc autant que l'extension — `.json` ne dit rien à lui seul.
    if (!fichier.includes(dossier) || !fichier.endsWith(extension) || enCours) return;
    enCours = true;
    execFile('node', [script], (err, stdout, stderr) => {
      enCours = false;
      // La sortie porte les avertissements — cible tactile trop petite, zone
      // hors cadre, numéro de ligne d'une erreur ink. Elle doit rester visible
      // dans le terminal.
      const sortie = `${stdout}${stderr}`.trim();
      if (sortie) server.config.logger.info(sortie);
      if (err) server.config.logger.error(echec);
    });
  };

  server.watcher.on('change', regenerer);
  server.watcher.on('add', regenerer);
}

/**
 * Les plans de scène suivent Tiled sans qu'on y pense.
 *
 * `npm run scenes` ne tournait qu'au démarrage du serveur : une carte
 * enregistrée dans Tiled pendant une session de travail ne changeait rien à
 * l'écran, et il fallait savoir qu'il existait une commande à relancer. C'est
 * exactement par là que le plan et le jeu se mettent à diverger — on finit par
 * corriger dans le code ce qu'on vient de corriger dans la carte.
 *
 * Enregistrer dans Tiled regénère donc le module du plan, et Vite recharge la
 * page dans la foulée.
 */
function suivreLesPlans(): Plugin {
  return {
    name: 'ori-quest:plans',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(CARTES);
      relancerSurChangement(server, {
        dossier: CARTES,
        extension: '.tmj',
        script: 'tools/import-scene.mjs',
        echec: '[scenes] plan refusé, rien réécrit',
      });
    },
  };
}

/**
 * La narration suit le fichier ink, pour la même raison que les plans.
 *
 * `npm run ink` ne tournait lui aussi qu'au démarrage : on éditait
 * `content/story.ink`, la page ne bougeait pas, et rien ne disait qu'il fallait
 * relancer une commande. Le texte à l'écran restait celui d'avant.
 *
 * `src/generated/story.json` est importé par `main.ts` : le réécrire suffit à
 * déclencher le rechargement. Et comme le compilateur sort en erreur *sans
 * écrire*, un ink cassé laisse en place la dernière version valide — le jeu
 * continue de tourner pendant qu'on corrige, avec le numéro de ligne dans le
 * terminal.
 *
 * On guette le dossier, pas le seul `story.ink` : le jour où la narration se
 * découpe en `INCLUDE`, les morceaux sont suivis sans rien changer ici.
 *
 * À savoir : le rechargement restaure la sauvegarde. Un passage déjà franchi
 * ne se rejoue pas sans « Recommencer ».
 */
function suivreLaNarration(): Plugin {
  return {
    name: 'ori-quest:ink',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(HISTOIRE);
      relancerSurChangement(server, {
        dossier: HISTOIRE,
        extension: '.ink',
        script: 'tools/compile-ink.mjs',
        echec: '[ink] compilation refusée, story.json inchangé',
      });
    },
  };
}

/**
 * Enregistrement du découpage d'une énigme depuis `decoupage.html`.
 *
 * Même dispositif que pour les poses, et pour la même raison : l'outil qui
 * dessine tourne dans le navigateur, et le résultat doit atterrir dans un
 * fichier du dépôt — ici `game-design/enigmes/<nom>.json`, qui fait foi.
 *
 * Mêmes garde-fous : `apply: 'serve'` (rien de ceci n'existe dans le build),
 * **rien n'est écrit tel quel** — on ne garde que des entiers bornés, et le
 * fichier est regénéré par nos soins — et l'énigme doit déjà exister, soit par
 * son découpage, soit par son crease pattern dans `public/assets/enigmes/`. Le
 * nom est validé avant tout usage, donc aucun chemin ne peut sortir du dossier.
 */
function enregistrerDecoupage(): Plugin {
  return {
    name: 'ori-quest:decoupage',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__decoupage', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let corps = '';
        req.on('data', (bout) => {
          corps += bout;
          // Une vingtaine de polygones de quelques sommets : au-delà, ce n'est
          // pas l'éditeur qui parle.
          if (corps.length > 64_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const decoupage = lireCorpsDecoupage(JSON.parse(corps));
            writeFileSync(decoupage.fichier, rendreDecoupage(decoupage));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, erreur: String(err) }));
          }
        });
      });

      /**
       * Le même découpage, mais seulement examiné : l'éditeur y envoie le
       * travail en cours après chaque coupe pour savoir s'il tient encore la
       * promesse d'une solution unique. Rien n'est écrit.
       */
      server.middlewares.use('/__unicite', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let corps = '';
        req.on('data', (bout) => {
          corps += bout;
          if (corps.length > 64_000) req.destroy();
        });
        req.on('end', async () => {
          try {
            const rapport = await analyserDecoupage(lireCorpsDecoupage(JSON.parse(corps)));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, ...(rapport as object) }));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, erreur: String(err) }));
          }
        });
      });
    },
  };
}

/**
 * Les découpages suivent l'éditeur, comme les plans suivent Tiled.
 *
 * On guette le dossier plutôt que le seul fichier qu'on vient d'écrire : une
 * énigme ajoutée à la main, ou un découpage corrigé dans l'éditeur de texte,
 * doit se voir à l'écran sans qu'on ait à savoir qu'une commande existe. Un
 * découpage invalide laisse en place le dernier module valide, l'erreur allant
 * au terminal.
 */
function suivreLesDecoupages(): Plugin {
  return {
    name: 'ori-quest:enigmes',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(DECOUPAGES);
      relancerSurChangement(server, {
        dossier: DECOUPAGES,
        extension: '.json',
        script: 'tools/import-decoupage.mjs',
        echec: '[enigmes] découpage refusé, rien réécrit',
      });
    },
  };
}

/** Un nom d'énigme est un identifiant, et rien d'autre : il sert de chemin. */
const NOM_ENIGME = /^[a-z][a-z0-9_]{0,39}$/;

/** Bornes du découpage, alignées sur celles de `tools/lib/decoupage.mjs`. */
const LIMITES_DECOUPAGE = {
  grille: [2, 24],
  pieces: [1, 24],
  sommets: [3, 64],
} as const;

/** Un découpage relu : que des entiers, et une énigme qui existe. */
interface CorpsDecoupage {
  enigme: string;
  fichier: string;
  grille: number;
  pieces: number[][][];
}

/**
 * Relit ce qu'envoie l'éditeur. **Rien de ce qui arrive n'est conservé tel
 * quel** : chaque coordonnée est relue en entier borné, et le nom d'énigme est
 * validé avant de servir de chemin. Ce que renvoie cette fonction est la seule
 * chose que voient l'écriture et la vérification.
 */
function lireCorpsDecoupage(recu: unknown): CorpsDecoupage {
  if (typeof recu !== 'object' || recu === null) throw new Error('corps invalide');
  const { enigme, grille, pieces } = recu as Record<string, unknown>;

  if (typeof enigme !== 'string' || !NOM_ENIGME.test(enigme)) {
    throw new Error(`nom d'énigme invalide : ${String(enigme)}`);
  }
  const fichier = `${DECOUPAGES}/${enigme}.json`;
  if (!existsSync(fichier) && !existsSync(`public/assets/enigmes/${enigme}/solution.svg`)) {
    throw new Error(`énigme inconnue : ${enigme}`);
  }

  const n = entierBorne(grille, LIMITES_DECOUPAGE.grille, 'grille');
  if (!Array.isArray(pieces) || !borne(pieces.length, LIMITES_DECOUPAGE.pieces)) {
    throw new Error(`nombre de pièces invalide : ${(pieces as unknown[])?.length}`);
  }

  const relues = pieces.map((piece, i) => {
    const points = (piece as { points?: unknown })?.points;
    if (!Array.isArray(points) || !borne(points.length, LIMITES_DECOUPAGE.sommets)) {
      throw new Error(`pièce ${i} : ${(points as unknown[])?.length} sommet(s)`);
    }
    return points.map((p) => {
      const [x, y] = Array.isArray(p) ? p : [];
      return [entierBorne(x, [0, n], `pièce ${i}`), entierBorne(y, [0, n], `pièce ${i}`)];
    });
  });

  return { enigme, fichier, grille: n, pieces: relues };
}

/** Refabrique le fichier à partir des seuls entiers relus. */
function rendreDecoupage(corps: CorpsDecoupage): string {
  const lignes = corps.pieces.map(
    (points) => `    { "points": [${points.map(([x, y]) => `[${x}, ${y}]`).join(', ')}] }`,
  );

  return [
    '{',
    '  "//": "Découpage de l’énigme — écrit par decoupage.html (npm run dev), pas à la main.",',
    `  "grille": ${corps.grille},`,
    '  "pieces": [',
    lignes.join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n');
}

/**
 * Le verdict sur un découpage **pas encore enregistré** : pave-t-il le carré, et
 * une seule disposition donne-t-elle son image ?
 *
 * Le calcul est celui de `tools/lib/decoupage.mjs`, et c'est tout l'intérêt :
 * l'éditeur affiche exactement ce que vérifiera l'import, puis
 * `npm run check-puzzle`. Une seconde implémentation côté navigateur aurait fini
 * par dire autre chose que le jeu.
 *
 * L'import est fait par URL calculée : un chemin littéral serait embarqué dans
 * la configuration au moment où Vite la compile, alors qu'on veut le module
 * Node tel qu'il est sur le disque.
 */
async function analyserDecoupage(corps: CorpsDecoupage): Promise<unknown> {
  const url = pathToFileURL(resolve('tools/lib/decoupage.mjs')).href;
  const { analyser } = (await import(/* @vite-ignore */ url)) as {
    analyser: (
      decoupage: { grille: number; pieces: number[][][] },
      motif: string,
    ) => { etat: string; solutions?: unknown[]; traits?: number };
  };

  const rapport = analyser(
    { grille: corps.grille, pieces: corps.pieces },
    `public/assets/enigmes/${corps.enigme}/solution.svg`,
  );
  return {
    etat: rapport.etat,
    dispositions: rapport.solutions?.length ?? 0,
    traits: rapport.traits ?? 0,
  };
}

const borne = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max;

function entierBorne(valeur: unknown, bornes: readonly [number, number], quoi: string): number {
  if (!Number.isInteger(valeur) || !borne(valeur as number, bornes)) {
    throw new Error(`${quoi} : entier hors bornes (${String(valeur)})`);
  }
  return valeur as number;
}

function nombre(valeur: unknown, min: number, max: number, quoi: string): number {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${quoi} hors bornes : ${String(valeur)}`);
  }
  // Trois décimales : au-delà on enregistrerait du bruit de curseur.
  return Math.round(n * 1000) / 1000;
}

/**
 * Regénère le fichier de poses : on repart du texte existant, on ne remplace
 * que le bloc de données, et chaque nombre est relu et borné au passage.
 */
function rendreFichier(source: string, recu: unknown): string {
  if (typeof recu !== 'object' || recu === null) throw new Error('corps invalide');

  const debut = source.indexOf('export const POSES');
  const accolade = source.indexOf('{', debut);
  const fin = source.indexOf('\n};', accolade);
  if (debut < 0 || fin < 0) throw new Error(`${FICHIER_POSES} : bloc POSES introuvable`);

  // Les modèles connus, lus dans le fichier lui-même : l'outil met à jour des
  // valeurs existantes, il n'ajoute pas de modèle.
  const connus = new Set(
    [...source.slice(accolade, fin).matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]),
  );

  const lignes: string[] = [];
  for (const [nom, pose] of Object.entries(recu as Record<string, unknown>)) {
    if (!connus.has(nom)) throw new Error(`modèle inconnu : ${nom}`);
    const p = pose as Record<string, unknown>;
    const angles = Array.isArray(p.angles) ? p.angles : [];
    if (angles.length !== 3) throw new Error(`${nom} : trois angles attendus`);
    const a = angles.map((v) => Math.round(nombre(v, -LIMITES.angle, LIMITES.angle, nom)));
    const pliage = nombre(p.pliage, ...LIMITES.pliage, `${nom}.pliage`);
    const echelle = nombre(p.echelle, ...LIMITES.echelle, `${nom}.echelle`);
    lignes.push(
      `  ${nom}: { angles: [${a.join(', ')}], pliage: ${pliage}, echelle: ${echelle} },`,
    );
  }
  if (lignes.length !== connus.size) throw new Error('il manque des modèles');

  return `${source.slice(0, accolade + 1)}\n${lignes.join('\n')}${source.slice(fin)}`;
}

export default defineConfig({
  plugins: [
    enregistrerPoses(),
    enregistrerDecoupage(),
    suivreLesPlans(),
    suivreLesDecoupages(),
    suivreLaNarration(),
  ],
  // itch.io sert le jeu depuis un sous-dossier arbitraire : tous les chemins
  // doivent être relatifs, sinon rien ne charge une fois zippé.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Un chunk séparé pour three.js : il n'est chargé que lorsqu'une
        // scène a réellement besoin de la couche origami.
        manualChunks: {
          phaser: ['phaser'],
          three: ['three'],
        },
      },
    },
  },
  server: {
    host: true, // permet de tester depuis un vrai téléphone sur le réseau local
    // Vite ne lit pas `PORT` de lui-même. Le respecter permet de lancer un
    // second serveur pendant qu'un premier tourne, sans lui prendre le 5173.
    port: Number(process.env.PORT) || 5173,
  },
  preview: {
    // Même exposition pour le build de production : c'est celui-là qu'il faut
    // mesurer sur téléphone, le serveur de dev ne dit rien des perfs réelles.
    host: true,
  },
});
