#!/usr/bin/env node
/**
 * Le jeu en un seul fichier HTML, pour l'envoyer à quelqu'un qui n'a que son
 * navigateur : un double-clic l'ouvre, sans serveur ni installation.
 *
 *   npm run portable        # -> build/<titre du jeu>.html
 *
 * `dist/` ne s'ouvre pas tel quel depuis le disque. En `file://`, Chrome refuse
 * les modules JS, `fetch` et les XHR, et tient une image du disque pour une
 * origine étrangère : WebGL la refuse en texture, Web Audio rend du silence
 * pour une ambiance. Un dossier poserait de plus un piège sous Windows, où
 * l'explorateur ouvre un fichier du zip sans extraire ses voisins.
 *
 * Tout est donc DANS la page : le JS en un seul bundle, la CSS, et chaque
 * fichier de `public/` en base64. Le jeu n'en sait rien — il demande toujours
 * `assets/…`, et `chargeurEmbarque()` répond par un blob à la place du disque.
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { mo } from './lib/dist-itch.mjs';
import { FICHIER_LICENCES } from './lib/licences-tierces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRAVAIL = join(ROOT, 'build', 'portable');

const TYPES = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.origami': 'application/octet-stream',
};

// Un seul bundle : un module inline ne peut rien importer, ni `three` à la
// demande, ni `phaser` à côté.
await build({
  root: ROOT,
  logLevel: 'warn',
  build: { outDir: TRAVAIL, emptyOutDir: true, modulePreload: false },
  plugins: [
    {
      name: 'ori-quest:un-seul-bundle',
      config(config) {
        const sortie = config.build?.rollupOptions?.output;
        delete sortie.manualChunks;
        sortie.inlineDynamicImports = true;
      },
    },
  ],
});

let html = readFileSync(join(TRAVAIL, 'index.html'), 'utf8');

// Le module garde `type="module"` : inline, il n'a rien à télécharger, donc
// rien que `file://` puisse lui refuser.
html = remplacerUneFois(
  html,
  /<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/,
  (chemin) => {
    const js = readFileSync(join(TRAVAIL, chemin), 'utf8');
    // `<!--` suivi de `<script` ferait ignorer le `</script>` qui ferme la balise.
    // Le bundle n'en contient pas, et doit le rester.
    if (/<script/i.test(js))
      throw new Error(`${chemin} contient « <script » : l'inliner casserait la page`);
    return [
      `<script type="application/json" id="fichiers-embarques">${JSON.stringify(fichiers())}</script>`,
      `<script>(${chargeurEmbarque})();</script>`,
      `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
    ].join('\n    ');
  },
);
html = remplacerUneFois(
  html,
  /<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/,
  (chemin) => {
    const css = readFileSync(join(TRAVAIL, chemin), 'utf8');
    if (/<\/style/i.test(css)) throw new Error(`${chemin} contient « </style »`);
    return `<style>${css}</style>`;
  },
);

const restants = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
if (restants.length) throw new Error(`encore chargé depuis le disque : ${restants.join(', ')}`);

// MIT exige que la notice accompagne chaque copie : le fichier n'a pas de
// voisin, elle voyage donc dedans.
const licences = readFileSync(join(TRAVAIL, FICHIER_LICENCES), 'utf8');
if (licences.includes('--'))
  throw new Error(`${FICHIER_LICENCES} contient « -- » : le commentaire HTML se fermerait`);
html = html.replace('<!doctype html>', () => `<!doctype html>\n<!--\n${licences}\n-->`);

const titre = /<title>([^<]+)<\/title>/.exec(html)?.[1].trim();
if (!titre) throw new Error('index.html sans <title> : le fichier livré prend son nom');
const SORTIE = join(ROOT, 'build', `${titre}.html`);
writeFileSync(SORTIE, html);
rmSync(TRAVAIL, { recursive: true, force: true });

console.log(`✓ ${relative(ROOT, SORTIE)} — ${mo(statSync(SORTIE).size)}, s'ouvre d'un double-clic`);

// Tout ce que le build a sorti à côté du HTML, sauf ce qui y est déjà fondu.
function fichiers() {
  const table = {};
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
        continue;
      }
      const relatif = relative(TRAVAIL, chemin).split('\\').join('/');
      if (relatif === 'index.html' || relatif === FICHIER_LICENCES) continue;
      if (/\.(js|css)$/.test(relatif) || entree.name === '.DS_Store') continue;
      const type = TYPES[extname(entree.name)];
      if (!type) throw new Error(`${relatif} : type inconnu, à ajouter dans TYPES`);
      table[relatif] = [type, readFileSync(chemin).toString('base64')];
    }
  };
  parcourir(TRAVAIL);
  return table;
}

function remplacerUneFois(texte, motif, remplacer) {
  const trouves = texte.match(new RegExp(motif, 'g')) ?? [];
  if (trouves.length !== 1)
    throw new Error(`index.html : ${trouves.length} balise(s) pour ${motif}`);
  return texte.replace(motif, (_tout, chemin) => remplacer(chemin));
}

/**
 * Tourne dans la page, avant le jeu : sérialisée par `toString()`, elle ne voit
 * rien de ce module.
 *
 * Chaque chemin `assets/…` devient l'URL d'un blob, décodé au premier usage. Un
 * blob est de la même origine que la page : texture WebGL et ambiance passent.
 * Sont couverts les chemins par lesquels le jeu charge — `fetch`, XHR (le
 * chargeur de Phaser), `src` d'image et de son, `innerHTML` (les drapeaux du
 * menu).
 */
function chargeurEmbarque() {
  const balise = document.getElementById('fichiers-embarques');
  const table = JSON.parse(balise.textContent);
  balise.remove();
  const blobs = new Map();

  const resoudre = (url) => {
    if (typeof url !== 'string' && !(url instanceof URL)) return url;
    const chemin = String(url).replace(/^\.\//, '');
    if (!chemin.startsWith('assets/')) return url;
    let blob = blobs.get(chemin);
    if (blob) return blob;
    const fichier = table[chemin];
    if (!fichier) {
      console.error(`[portable] absent du fichier : ${chemin}`);
      return url;
    }
    const [type, base64] = fichier;
    const binaire = atob(base64);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    blob = URL.createObjectURL(new Blob([octets], { type }));
    blobs.set(chemin, blob);
    delete table[chemin];
    return blob;
  };

  const fetchOrigine = window.fetch;
  window.fetch = (entree, options) => fetchOrigine.call(window, resoudre(entree), options);

  const ouvrir = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (methode, url, ...reste) {
    return ouvrir.call(this, methode, resoudre(url), ...reste);
  };

  const intercepter = (prototype, propriete, transformer) => {
    const origine = Object.getOwnPropertyDescriptor(prototype, propriete);
    Object.defineProperty(prototype, propriete, {
      ...origine,
      set(valeur) {
        origine.set.call(this, transformer(valeur));
      },
    });
  };
  intercepter(HTMLImageElement.prototype, 'src', resoudre);
  intercepter(HTMLMediaElement.prototype, 'src', resoudre);
  intercepter(Element.prototype, 'innerHTML', (valeur) =>
    typeof valeur === 'string'
      ? valeur.replace(/(\ssrc=")([^"]*)"/g, (_tout, debut, url) => `${debut}${resoudre(url)}"`)
      : valeur,
  );
}
