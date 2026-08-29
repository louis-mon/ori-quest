#!/usr/bin/env node
/**
 * Téléverse `dist/` sur itch.io avec butler, le client officiel.
 *
 * La page reste en DRAFT, et rien ici ne peut la rendre publique : butler
 * n'envoie que des builds. Une page itch.io ne devient visible qu'au bouton
 * « Publish » de son tableau de bord, à la main.
 *
 * À faire une fois :
 *   1. installer butler, le client officiel d'itch.io, et le rendre atteignable
 *      depuis le PATH ;
 *   2. `butler login` (ouvre le navigateur, garde la clé pour les fois d'après) ;
 *   3. créer le projet sur itch.io — il naît en Draft.
 *
 * Puis, à chaque version :
 *   npm run build && npm run itch
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mo, RAPPEL_ITCH, SEUIL_ALERTE, tailleDossier, verifierDist } from './lib/dist-itch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// itch.io lit `html` dans le nom du canal et marque le build comme jouable en
// navigateur. Le canal est décidé ici, pas par l'appelant : le jeu n'a qu'une
// plateforme, et un canal mal nommé donne un build téléchargeable au lieu d'un
// jeu qui s'ouvre dans la page.
const CANAL = 'html5';

// Le projet itch.io de ce dépôt, tel qu'il apparaît dans son URL
// (https://louis-mon.itch.io/ori-quest). Il n'y en a qu'un : le demander à
// chaque envoi ne servirait qu'à le taper de travers. Un argument ou `ITCH_CIBLE`
// le remplacent, pour un compte de test.
const CIBLE = 'louis-mon/ori-quest';

const cible = process.argv[2] ?? process.env.ITCH_CIBLE ?? CIBLE;

if (!/^[\w-]+\/[\w-]+$/.test(cible)) {
  console.error(
    `✗ Cible « ${cible} » incomprise : attendu « pseudo/projet », sans canal —\n` +
      `  c'est ce script qui ajoute « :${CANAL} ».`,
  );
  process.exit(1);
}

const erreurs = verifierDist(DIST);
if (erreurs.length) {
  console.error(`✗ ${erreurs.join('\n✗ ')}`);
  process.exit(1);
}

// Sans commit, impossible de ramener un build téléversé à un état du dépôt : la
// version itch.io est le seul endroit où ce lien peut vivre.
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const commit = git('rev-parse', '--short', 'HEAD');
const versionItch = commit ? `${version}+${commit}` : version;

if (git('status', '--porcelain')) {
  console.warn(`⚠ Des modifications ne sont pas commitées : ${versionItch} ne les désignera pas.`);
}

const brut = tailleDossier(DIST);
console.log(`dist/ — ${mo(brut)}, version ${versionItch}`);
if (brut > SEUIL_ALERTE) {
  console.warn(
    `⚠ ${mo(brut)} à télécharger avant de jouer. Au-delà de ~30 Mo le taux\n` +
      `  d'abandon sur mobile grimpe vite — pense aux textures WebP et aux atlas.`,
  );
}

// Le dossier plutôt que le zip : butler ne renvoie que ce qui a changé d'un
// build au suivant, et il fait le zip lui-même.
const args = ['push', DIST, `${cible}:${CANAL}`, '--userversion', versionItch];
console.log(`→ butler ${args.join(' ')}\n`);

const butler = spawnSync('butler', args, { cwd: ROOT, stdio: 'inherit' });

if (butler.error?.code === 'ENOENT') {
  console.error(
    `✗ butler introuvable dans le PATH.\n` +
      `  Une fois installé, \`butler login\` avant le premier envoi.`,
  );
  process.exit(1);
}
if (butler.status !== 0) {
  console.error(
    `\n✗ butler s'est arrêté (code ${butler.status}).\n` +
      `  « no such user/game » : le projet n'existe pas encore sur itch.io, ou\n` +
      `  l'adresse est mal écrite. « unauthorized » : \`butler login\`.`,
  );
  process.exit(butler.status ?? 1);
}

console.log(`
✓ Build envoyé sur ${cible}:${CANAL}.
  État du traitement : butler status ${cible}

La page reste en Draft — butler n'envoie que des fichiers, il ne publie rien.
Tant qu'elle y est, elle ne s'ouvre que connecté avec le compte qui la possède.

${RAPPEL_ITCH}
`);
