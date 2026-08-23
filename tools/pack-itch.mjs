#!/usr/bin/env node
/**
 * Prépare le zip à téléverser sur itch.io.
 *
 * Contraintes itch.io vérifiées ici :
 *  - `index.html` doit être à la RACINE du zip, pas dans un sous-dossier ;
 *  - tous les chemins doivent être relatifs (assuré par `base: './'` côté Vite) ;
 *  - viser < 50 Mo pour un temps de chargement décent en 4G.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ZIP = join(ROOT, 'ori-quest-itch.zip');

const WARN_BYTES = 30 * 1024 * 1024;
const FAIL_BYTES = 1024 * 1024 * 1024;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error("✗ dist/index.html absent. Lance `npm run build` d'abord.");
  process.exit(1);
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const absolute = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
if (absolute.length) {
  console.error(
    `✗ Chemins absolus dans index.html : ${absolute.join(', ')}\n` +
      `  itch.io sert le jeu depuis un sous-dossier — ils ne résoudront pas.\n` +
      `  Vérifie que vite.config.ts contient bien \`base: './'\`.`,
  );
  process.exit(1);
}

function totalSize(dir) {
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    bytes += entry.isDirectory() ? totalSize(p) : statSync(p).size;
  }
  return bytes;
}

execFileSync('zip', ['-r', '-q', ZIP, '.', '-x', '.DS_Store'], { cwd: DIST });

const zipped = statSync(ZIP).size;
const raw = totalSize(DIST);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

console.log(`✓ ${ZIP.replace(ROOT + '/', '')} — ${mb(zipped)} (${mb(raw)} décompressé)`);

if (zipped > FAIL_BYTES) {
  console.error(`✗ Au-dessus de la limite itch.io de 1 Go.`);
  process.exit(1);
}
if (raw > WARN_BYTES) {
  console.warn(
    `⚠ ${mb(raw)} à télécharger avant de jouer. Au-delà de ~30 Mo le taux\n` +
      `  d'abandon sur mobile grimpe vite — pense aux textures WebP et aux atlas.`,
  );
}

console.log(`
Sur itch.io, dans les options du fichier :
  • cocher « This file will be played in the browser »
  • cocher « Mobile friendly » (+ orientation souhaitée)
  • activer le bouton plein écran
  • laisser « SharedArrayBuffer support » DÉCOCHÉ (casse Firefox/Safari, inutile ici)
`);
