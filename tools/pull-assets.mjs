#!/usr/bin/env node
/**
 * Récupère le dossier de travail de l'artiste vers assets-src/.
 *
 *   npm run assets:pull
 *   npm run assets:pull -- --mirror    # répercute aussi les suppressions amont
 *   npm run assets:pull -- --dry-run   # montre ce qui serait fait, sans écrire
 *
 * Le transport passe par rclone plutôt que par le client de synchro officiel :
 * sur macOS celui-ci se monte dans ~/Library/CloudStorage, protégé par TCC —
 * donc illisible sans accorder l'accès complet au disque — et il expose tout le
 * compte, là où un remote épinglé avec `root_folder_id` ne peut pas remonter
 * au-dessus du dossier partagé.
 *
 * assets-src/ est une zone de transit gitignorée : les sources brutes n'entrent
 * jamais dans le dépôt.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'assets-src');

// Surchargeable pour tester un autre dossier sans toucher au script :
// ORI_ASSETS_REMOTE=autre: npm run assets:pull
const REMOTE = process.env.ORI_ASSETS_REMOTE ?? 'ori-assets:';

const WARN_BYTES = 500 * 1024 * 1024;

const args = process.argv.slice(2);
const mirror = args.includes('--mirror');
const dryRun = args.includes('--dry-run');

function rclone(argv, options = {}) {
  return execFileSync('rclone', argv, { encoding: 'utf8', ...options });
}

try {
  rclone(['version'], { stdio: 'ignore' });
} catch {
  console.error('✗ rclone introuvable.\n' + '  brew install rclone');
  process.exit(1);
}

// rclone accepte `remote:` comme `remote:sous/dossier` : on ne valide que le nom,
// la partie avant les deux-points.
const remoteName = `${REMOTE.split(':')[0]}:`;
// --log-level ERROR : tant que ~/.config/rclone/rclone.conf n'existe pas, rclone
// émet un NOTICE qui s'afficherait avant notre propre diagnostic.
const known = rclone(['listremotes', '--log-level', 'ERROR'])
  .split('\n')
  .map((l) => l.trim());

if (!known.includes(remoteName)) {
  console.error(
    `✗ Remote rclone « ${remoteName} » non configuré.\n` +
      `  Remotes connus : ${known.filter(Boolean).join(', ') || '(aucun)'}\n\n` +
      `  Pour le créer : rclone config\n` +
      `    • type            : drive\n` +
      `    • client_id/secret: laisser vide\n` +
      `    • scope           : drive.readonly (1 = lecture seule)\n` +
      `    • root_folder_id  : l'ID du dossier partagé, soit la portion après\n` +
      `                        /folders/ dans son URL sur drive.google.com\n\n` +
      `  root_folder_id est ce qui cloisonne l'accès : sans lui le remote voit\n` +
      `  tout le Drive, avec lui il ne peut pas sortir du dossier.`,
  );
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });

// `copy` par défaut, purement additif : une suppression accidentelle côté
// artiste ne doit pas effacer ce qu'on a déjà tiré. `--mirror` bascule sur
// `sync`, qui aligne vraiment le local sur l'amont.
const mode = mirror ? 'sync' : 'copy';

const flags = [
  '--exclude',
  '.DS_Store',
  '--exclude',
  'Thumbs.db',
  '--exclude',
  '*.tmp',
  // Spécifique à Drive : les Docs/Sheets natifs n'ont pas de contenu
  // téléchargeable brut et feraient échouer le transfert.
  '--drive-skip-gdocs',
];

if (dryRun) flags.push('--dry-run');
if (process.stdout.isTTY) flags.push('--progress');

console.log(
  `→ ${mode} ${REMOTE} vers ${DEST.replace(ROOT + '/', '')}${dryRun ? ' (à blanc)' : ''}`,
);

try {
  rclone([mode, REMOTE, DEST, ...flags], { stdio: 'inherit', encoding: undefined });
} catch {
  // rclone a déjà détaillé la cause sur stderr.
  console.error('\n✗ Transfert rclone en échec.');
  process.exit(1);
}

if (dryRun) process.exit(0);

// macOS ne distingue pas `Solution.svg` de `solution.svg` : renommé côté Drive,
// le fichier voit son contenu mis à jour mais garde son ancien nom en local, et
// `rclone check` n'y voit rien. D'où la confrontation des noms octet à octet.
function reportCaseDrift() {
  const remote = rclone(['lsf', '-R', '--files-only', REMOTE, '--log-level', 'ERROR'])
    .split('\n')
    .filter(Boolean);

  const localByLower = new Map();
  for (const path of listRelative(DEST)) localByLower.set(path.toLowerCase(), path);

  const drifted = remote
    .map((path) => [path, localByLower.get(path.toLowerCase())])
    .filter(([path, local]) => local && local !== path);

  if (drifted.length === 0) return;

  console.warn(`\n⚠ ${drifted.length} fichier(s) au nom périmé — seule la casse diffère :`);
  for (const [remotePath, localPath] of drifted.slice(0, 10)) {
    console.warn(`    ${localPath}\n  → ${remotePath}`);
  }
  console.warn(
    `  macOS ne distingue pas la casse : le contenu est à jour, le nom non.\n` +
      `  Pour repartir sur des noms exacts : rm -rf assets-src && npm run assets:pull -- --mirror`,
  );
}

// Chemins de fichiers relatifs à `dir`, récursivement.
function listRelative(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listRelative(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function walk(dir) {
  let bytes = 0;
  let files = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walk(p);
      bytes += sub.bytes;
      files += sub.files;
    } else {
      bytes += statSync(p).size;
      files += 1;
    }
  }
  return { bytes, files };
}

const { bytes, files } = existsSync(DEST) ? walk(DEST) : { bytes: 0, files: 0 };
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

console.log(`✓ ${files} fichier(s), ${mb(bytes)} dans assets-src/`);

reportCaseDrift();

if (bytes > WARN_BYTES) {
  console.warn(
    `⚠ ${mb(bytes)} de sources en local. Ce dossier est gitignoré et n'entre\n` +
      `  pas dans le build — mais pense à faire le ménage de temps en temps.`,
  );
}

if (files === 0) {
  console.log(
    "\nRien à récupérer pour l'instant. Si le dossier partagé n'est pas vide,\n" +
      'vérifie que root_folder_id pointe bien dessus : rclone config show',
  );
}
