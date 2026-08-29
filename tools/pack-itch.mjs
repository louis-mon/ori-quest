#!/usr/bin/env node
/**
 * Prépare le zip à téléverser sur itch.io, pour un envoi à la main depuis le
 * tableau de bord. `npm run itch` fait le même envoi par butler, sans passer par
 * le navigateur.
 *
 * Les contraintes du format sont vérifiées dans tools/lib/dist-itch.mjs.
 */
import { execFileSync } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mo, RAPPEL_ITCH, SEUIL_ALERTE, tailleDossier, verifierDist } from './lib/dist-itch.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ZIP = join(ROOT, 'ori-quest-itch.zip');

const LIMITE_ITCH = 1024 * 1024 * 1024;

const erreurs = verifierDist(DIST);
if (erreurs.length) {
  console.error(`✗ ${erreurs.join('\n✗ ')}`);
  process.exit(1);
}

// `zip` met à jour une archive existante au lieu de la remplacer : un fichier
// supprimé depuis le dernier build resterait dans le zip téléversé.
rmSync(ZIP, { force: true });
execFileSync('zip', ['-r', '-q', ZIP, '.', '-x', '.DS_Store'], { cwd: DIST });

const zippe = statSync(ZIP).size;
const brut = tailleDossier(DIST);

console.log(`✓ ${ZIP.replace(ROOT + '/', '')} — ${mo(zippe)} (${mo(brut)} décompressé)`);

if (zippe > LIMITE_ITCH) {
  console.error(`✗ Au-dessus de la limite itch.io de 1 Go.`);
  process.exit(1);
}
if (brut > SEUIL_ALERTE) {
  console.warn(
    `⚠ ${mo(brut)} à télécharger avant de jouer. Au-delà de ~30 Mo le taux\n` +
      `  d'abandon sur mobile grimpe vite — pense aux textures WebP et aux atlas.`,
  );
}

console.log(`\n${RAPPEL_ITCH}\n`);
