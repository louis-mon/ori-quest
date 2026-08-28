import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

const FICHIER_POSES = 'src/origami/poses.ts';
const CARTES = 'game-design/scenes';
const DECOUPAGES = 'game-design/enigmes';
const HISTOIRE = 'content';

// Bornes de sécurité. Au-delà, ce n'est plus un réglage, c'est une erreur.
const LIMITES = {
  angle: 360,
  pliage: [0, 1],
  echelle: [0.05, 20],
} as const;

// Écriture des poses d'origami depuis l'outil de réglage, qui tourne dans le
// navigateur et n'a aucun moyen d'atteindre le disque.
//
// Ce qui rend la chose sûre : `apply: 'serve'`, donc rien de ceci n'existe dans
// le build ; rien de ce qui arrive n'est écrit tel quel — on ne garde que des
// nombres bornés et on regénère le fichier ; et les modèles doivent déjà
// exister, on met à jour des valeurs sans en inventer.
//
// À savoir : `server.host` est à `true` pour tester depuis un téléphone, donc ce
// point d'entrée est joignable depuis le réseau local.
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
          // Le fichier fait quelques centaines d'octets : au-delà, ce n'est pas
          // l'outil qui parle.
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

// Relance un outil de build quand une source change, et laisse Vite recharger la
// page dans la foulée.
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
    // Le guetteur est global : il voit passer tout le projet, donc le dossier
    // compte autant que l'extension — `.json` ne dit rien à lui seul.
    if (!fichier.includes(dossier) || !fichier.endsWith(extension) || enCours) return;
    enCours = true;
    execFile('node', [script], (err, stdout, stderr) => {
      enCours = false;
      // La sortie porte les avertissements — cible tactile trop petite, numéro
      // de ligne d'une erreur ink — et doit rester visible dans le terminal.
      const sortie = `${stdout}${stderr}`.trim();
      if (sortie) server.config.logger.info(sortie);
      if (err) server.config.logger.error(echec);
    });
  };

  server.watcher.on('change', regenerer);
  server.watcher.on('add', regenerer);
}

// Enregistrer dans Tiled regénère le module du plan, et Vite recharge la page.
// Sans ça, il faut savoir qu'une commande existe — et c'est par là que le plan
// et le jeu se mettent à diverger.
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

// Même raison que pour les plans. `src/generated/story.json` étant importé par
// `main.ts`, le réécrire suffit à déclencher le rechargement ; et comme le
// compilateur sort en erreur SANS écrire, un ink cassé laisse en place la
// dernière version valide.
//
// On guette le dossier et pas le seul `story.ink` : le jour où la narration se
// découpe en `INCLUDE`, les morceaux sont suivis sans rien changer ici.
//
// À savoir : le rechargement restaure la sauvegarde, donc un passage déjà
// franchi ne se rejoue pas sans « Recommencer ».
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

// Même dispositif et mêmes garde-fous que pour les poses : `apply: 'serve'`,
// rien n'est écrit tel quel, et l'énigme doit déjà exister — par son découpage
// ou par son crease pattern. Le nom est validé avant de servir de chemin, donc
// rien ne peut sortir du dossier.
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

      // Le même découpage, seulement examiné : l'éditeur y envoie le travail en
      // cours après chaque coupe. Rien n'est écrit.
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

// On guette le dossier plutôt que le seul fichier qu'on vient d'écrire : une
// énigme corrigée à la main doit se voir sans qu'on sache qu'une commande
// existe. Un découpage invalide laisse en place le dernier module valide.
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

// Un nom d'énigme est un identifiant, et rien d'autre : il sert de chemin.
const NOM_ENIGME = /^[a-z][a-z0-9_]{0,39}$/;

// Alignées sur celles de `tools/lib/decoupage.mjs`.
const LIMITES_DECOUPAGE = {
  grille: [2, 24],
  pieces: [1, 24],
  sommets: [3, 64],
} as const;

// Un découpage relu : que des entiers, et une énigme qui existe.
interface CorpsDecoupage {
  enigme: string;
  fichier: string;
  grille: number;
  pieces: number[][][];
}

// Rien de ce qui arrive n'est conservé tel quel : chaque coordonnée est relue en
// entier borné, et le nom validé avant de servir de chemin. Ce que renvoie cette
// fonction est la seule chose que voient l'écriture et la vérification.
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

// Refabrique le fichier à partir des seuls entiers relus.
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

// Le calcul est celui de `tools/lib/decoupage.mjs`, et c'est tout l'intérêt :
// l'éditeur affiche exactement ce que vérifiera l'import.
//
// L'import passe par une URL calculée : un chemin littéral serait embarqué dans
// la configuration au moment où Vite la compile, alors qu'on veut le module Node
// tel qu'il est sur le disque.
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

// On repart du texte existant, on ne remplace que le bloc de données, et chaque
// nombre est relu et borné au passage.
function rendreFichier(source: string, recu: unknown): string {
  if (typeof recu !== 'object' || recu === null) throw new Error('corps invalide');

  const debut = source.indexOf('export const POSES');
  const accolade = source.indexOf('{', debut);
  const fin = source.indexOf('\n};', accolade);
  if (debut < 0 || fin < 0) throw new Error(`${FICHIER_POSES} : bloc POSES introuvable`);

  // Lus dans le fichier lui-même : l'outil met à jour des valeurs existantes, il
  // n'ajoute pas de modèle.
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
    lignes.push(`  ${nom}: { angles: [${a.join(', ')}], pliage: ${pliage}, echelle: ${echelle} },`);
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
        // Un chunk séparé pour three.js : il n'est chargé que lorsqu'une scène a
        // réellement besoin de la couche origami.
        manualChunks: {
          phaser: ['phaser'],
          three: ['three'],
        },
      },
    },
  },
  server: {
    host: true, // permet de tester depuis un vrai téléphone sur le réseau local
    // Vite ne lit pas `PORT` de lui-même. Le respecter permet de lancer un second
    // serveur pendant qu'un premier tourne, sans lui prendre le 5173.
    port: Number(process.env.PORT) || 5173,
  },
  preview: {
    // Même exposition pour le build de production : c'est celui-là qu'il faut
    // mesurer sur téléphone, le serveur de dev ne dit rien des perfs réelles.
    host: true,
  },
});
