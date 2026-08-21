import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

const FICHIER_POSES = 'src/origami/poses.ts';
const CARTES = 'game-design/scenes';
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
  { extension, script, echec }: { extension: string; script: string; echec: string },
) {
  let enCours = false;

  const regenerer = (fichier: string) => {
    if (!fichier.endsWith(extension) || enCours) return;
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
        extension: '.ink',
        script: 'tools/compile-ink.mjs',
        echec: '[ink] compilation refusée, story.json inchangé',
      });
    },
  };
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
  plugins: [enregistrerPoses(), suivreLesPlans(), suivreLaNarration()],
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
