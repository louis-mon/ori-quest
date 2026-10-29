import './reglages.css';
import './couverture.css';
import { DESIGN_WIDTH } from '../game/config';
import { peindreLeCiel } from '../game/scenes/ciel';
import { REGLAGES_COUVERTURE } from './couverture-reglages';

// Outil de composition de la couverture d'itch.io — développement seulement.
// L'image qui représente le jeu dans les listes du site est faite des mêmes
// pliages photographiés que le jeu, pris en pleine définition dans assets-src/ :
// rien n'y est dessiné, seul le ciel est peint, et c'est celui du jeu.

// Le double des 630 × 500 qu'itch.io demande, pour les écrans denses. Aligné
// sur l'écriture du PNG (vite.config.ts), qui refuse toute autre taille.
const LARGEUR = 1260;
const HAUTEUR = 1000;

// Celui de l'écran titre (NOM_DU_JEU, src/ui/menu.ts), dans ses teintes
// (src/ui/style.css) : c'est le titre que le joueur retrouvera en lançant le jeu.
const NOM = 'OriFable';
const VERT_CLAIR = '#5c8047';
const VERT_SOMBRE = '#40632c';
const PIERRE = '#e2e0da';
const POLICE = 'ui-rounded, "Avenir Next", "Segoe UI", system-ui, sans-serif';
// L'arche de l'écran titre vit dans un viewBox de 640 × 200 ; le contour et
// l'ombre en débordent, et une image SVG rogne ce qui sort de son viewBox.
const MARGE_TITRE = 24;

// L'ordre du dessin, du fond vers le devant : la grenouille passe la tête
// derrière le château, le hibou se pose dessus.
const ELEMENTS = [
  'soleil',
  'nuage1',
  'nuage2',
  'nuage3',
  'grenouille',
  'chateau',
  'hibou',
  'chat',
  'lune_chat',
] as const;

type NomElement = (typeof ELEMENTS)[number];

// `x` et `y` placent le centre, en fractions de la couverture ; `zoom` est la
// hauteur du pliage, dans la même fraction, la largeur suivant la photo ;
// `rotation` en degrés.
export interface Element {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  miroir: boolean;
}

// Le château a deux photos, et la couverture choisit la sienne (`vue`).
const PHOTOS_DU_CHATEAU = {
  face: { fichier: 'chateau_face.png', nom: 'De face' },
  trois_quarts: { fichier: 'chateau.png', nom: 'De trois quarts' },
} as const;

type VueDuChateau = keyof typeof PHOTOS_DU_CHATEAU;
const VUES = Object.keys(PHOTOS_DU_CHATEAU) as VueDuChateau[];

interface Retouche {
  luminosite: number;
  contraste: number;
  saturation: number;
}

export type ReglagesCouverture = Record<NomElement, Element> & {
  // Où le dégradé du ciel atteint sa brume, en fraction de la hauteur.
  horizon: number;
  // Une retouche par photo : celle de face est sombre, l'autre non, et changer
  // de photo ne doit pas emporter un éclaircissement qui ne valait que pour la
  // première.
  vue: VueDuChateau;
  retouches: Record<VueDuChateau, Retouche>;
  titre: { y: number; largeur: number };
};

const NOMS: Record<NomElement, string> = {
  soleil: 'Soleil',
  nuage1: 'Nuage 1',
  nuage2: 'Nuage 2',
  nuage3: 'Nuage 3',
  grenouille: 'Grenouille',
  chateau: 'Château',
  hibou: 'Hibou',
  chat: 'Chat',
  lune_chat: 'Chat de la lune',
};

const PHOTOS: Record<Exclude<NomElement, 'chateau'>, string> = {
  soleil: 'soleil.png',
  nuage1: 'nuage/nuage1.png',
  nuage2: 'nuage/nuage2.png',
  nuage3: 'nuage/nuage3.png',
  grenouille: 'grenouille.png',
  hibou: 'hibou.png',
  chat: 'chat.png',
  lune_chat: 'lune_chat.png',
};

const DOSSIER = 'assets-src/graphisme_origami';

// Enregistrer réécrit un fichier que cette page importe, et Vite la recharge.
const MEMOIRE = 'couverture-enregistree';

const reglages: ReglagesCouverture = structuredClone(REGLAGES_COUVERTURE);

const toile = document.getElementById('toile') as HTMLCanvasElement;
toile.width = LARGEUR;
toile.height = HAUTEUR;
const ctx = toile.getContext('2d')!;

const conteneur = document.getElementById('curseurs')!;
const sortie = document.getElementById('sortie')!;
const statut = document.getElementById('statut')!;

// ------------------------------------------------------------------
// Images
// ------------------------------------------------------------------

// Rognées sur leur alpha : les photos de l'artiste ont des marges inégales, et
// la hauteur d'un élément doit être celle du pliage, pas celle du cliché. Par
// fichier : les deux photos du château sont chargées d'emblée.
const images = new Map<string, HTMLCanvasElement>();
let titre: HTMLImageElement | undefined;

const imageDe = (nom: NomElement) =>
  images.get(nom === 'chateau' ? PHOTOS_DU_CHATEAU[reglages.vue].fichier : PHOTOS[nom]);

async function charger(fichier: string): Promise<void> {
  const chemin = `${DOSSIER}/${fichier}`;
  try {
    images.set(fichier, rogner(await image(chemin)));
  } catch {
    throw new Error(`${chemin} introuvable — npm run assets:pull`);
  }
}

// `load` plutôt que `decode()`, qui n'aboutit pas tant que la page est cachée —
// un volet de preview masqué, par exemple.
function image(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const image = new Image();
    image.onload = () => ok(image);
    image.onerror = ko;
    image.src = src;
  });
}

function rogner(image: HTMLImageElement): HTMLCanvasElement {
  const brut = document.createElement('canvas');
  brut.width = image.naturalWidth;
  brut.height = image.naturalHeight;
  const c = brut.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(image, 0, 0);
  const { data, width, height } = c.getImageData(0, 0, brut.width, brut.height);

  let [x0, y0, x1, y1] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }

  const rogne = document.createElement('canvas');
  rogne.width = x1 - x0 + 1;
  rogne.height = y1 - y0 + 1;
  rogne.getContext('2d', { willReadFrequently: true })!.drawImage(brut, -x0, -y0);
  return rogne;
}

// L'arche de l'écran titre, refaite en SVG autonome : une image SVG ne voit pas
// la feuille de style de la page, tout doit y être écrit.
async function chargerTitre(): Promise<void> {
  const m = MARGE_TITRE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${640 + 2 * m} ${200 + 2 * m}" width="${640 + 2 * m}" height="${200 + 2 * m}">
  <defs>
    <linearGradient id="vert" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${VERT_CLAIR}" />
      <stop offset="1" stop-color="${VERT_SOMBRE}" />
    </linearGradient>
  </defs>
  <path id="arc" d="M 40 190 A 560 560 0 0 1 600 190" fill="none" />
  <text style="fill: url(#vert); font-family: ${POLICE.replaceAll('"', "'")}; font-size: 112px; font-weight: 800; letter-spacing: 0.05em; paint-order: stroke; stroke: ${PIERRE}; stroke-width: 14px; stroke-linejoin: round; filter: drop-shadow(0 0 1.5px rgba(16, 14, 12, 0.7)) drop-shadow(0 4px 6px rgba(16, 14, 12, 0.4));"><textPath href="#arc" startOffset="50%" text-anchor="middle">${NOM}</textPath></text>
</svg>`;
  titre = await image(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
}

// ------------------------------------------------------------------
// Composition
// ------------------------------------------------------------------

function dimensions(nom: NomElement): { l: number; h: number } {
  const image = imageDe(nom)!;
  const h = reglages[nom].zoom * HAUTEUR;
  return { l: (image.width / image.height) * h, h };
}

function rectangleDuTitre(): { x: number; y: number; l: number; h: number } {
  const l = reglages.titre.largeur * LARGEUR;
  const h = (l * (200 + 2 * MARGE_TITRE)) / (640 + 2 * MARGE_TITRE);
  return { x: (LARGEUR - l) / 2, y: reglages.titre.y * HAUTEUR, l, h };
}

function composer() {
  const soleil = reglages.soleil;
  peindreLeCiel(ctx, LARGEUR, HAUTEUR, LARGEUR / DESIGN_WIDTH, reglages.horizon * HAUTEUR, {
    x: soleil.x * LARGEUR,
    y: soleil.y * HAUTEUR,
  });

  for (const nom of ELEMENTS) {
    const image = imageDe(nom);
    if (!image) continue;
    const e = reglages[nom];
    const { l, h } = dimensions(nom);
    ctx.save();
    ctx.translate(e.x * LARGEUR, e.y * HAUTEUR);
    ctx.rotate((e.rotation * Math.PI) / 180);
    ctx.scale(e.miroir ? -1 : 1, 1);
    if (nom === 'chateau') {
      const r = reglages.retouches[reglages.vue];
      ctx.filter = `brightness(${r.luminosite}) contrast(${r.contraste}) saturate(${r.saturation})`;
    }
    ctx.drawImage(image, -l / 2, -h / 2, l, h);
    ctx.restore();
  }

  if (titre) {
    const r = rectangleDuTitre();
    ctx.drawImage(titre, r.x, r.y, r.l, r.h);
  }
}

// ------------------------------------------------------------------
// Glisser sur l'aperçu
// ------------------------------------------------------------------

// Placer à la main va plus vite qu'aux curseurs, qui restent pour finir. On
// attrape le pliage lui-même, pas sa boîte : le hibou posé sur le château doit
// pouvoir se saisir sans emporter le château.
type Prise = NomElement | 'titre';

function sousLeDoigt(px: number, py: number): Prise | undefined {
  const r = rectangleDuTitre();
  if (titre && px >= r.x && px <= r.x + r.l && py >= r.y && py <= r.y + r.h) {
    const ix = ((px - r.x) / r.l) * titre.naturalWidth;
    const iy = ((py - r.y) / r.h) * titre.naturalHeight;
    if (opaque(titre, ix, iy)) return 'titre';
  }

  for (const nom of [...ELEMENTS].reverse()) {
    const image = imageDe(nom);
    if (!image) continue;
    const e = reglages[nom];
    const { l, h } = dimensions(nom);
    const a = (-e.rotation * Math.PI) / 180;
    const dx = px - e.x * LARGEUR;
    const dy = py - e.y * HAUTEUR;
    let lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (e.miroir) lx = -lx;
    if (Math.abs(lx) > l / 2 || Math.abs(ly) > h / 2) continue;
    if (opaque(image, ((lx + l / 2) / l) * image.width, ((ly + h / 2) / h) * image.height)) {
      return nom;
    }
  }
  return undefined;
}

const sonde = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
sonde.canvas.width = sonde.canvas.height = 1;

function opaque(source: CanvasImageSource, x: number, y: number): boolean {
  sonde.clearRect(0, 0, 1, 1);
  sonde.drawImage(source, x, y, 1, 1, 0, 0, 1, 1);
  return sonde.getImageData(0, 0, 1, 1).data[3] > 32;
}

function versLaToile(evenement: PointerEvent): { x: number; y: number } {
  const r = toile.getBoundingClientRect();
  return {
    x: ((evenement.clientX - r.left) / r.width) * LARGEUR,
    y: ((evenement.clientY - r.top) / r.height) * HAUTEUR,
  };
}

let prise: { quoi: Prise; depart: { x: number; y: number }; x: number; y: number } | undefined;

toile.addEventListener('pointerdown', (evenement) => {
  const p = versLaToile(evenement);
  const quoi = sousLeDoigt(p.x, p.y);
  if (!quoi) return;
  const origine = quoi === 'titre' ? { x: 0, y: reglages.titre.y } : reglages[quoi];
  prise = { quoi, depart: p, x: origine.x, y: origine.y };
  toile.setPointerCapture(evenement.pointerId);
  toile.classList.add('is-saisi');
  dire(quoi === 'titre' ? 'Titre' : NOMS[quoi]);
});

toile.addEventListener('pointermove', (evenement) => {
  if (!prise) return;
  const p = versLaToile(evenement);
  const y = arrondi(prise.y + (p.y - prise.depart.y) / HAUTEUR);
  // Le titre reste centré, comme sur l'écran titre.
  if (prise.quoi === 'titre') reglages.titre.y = y;
  else {
    reglages[prise.quoi].x = arrondi(prise.x + (p.x - prise.depart.x) / LARGEUR);
    reglages[prise.quoi].y = y;
  }
  appliquer();
});

const lacher = () => {
  prise = undefined;
  toile.classList.remove('is-saisi');
};
toile.addEventListener('pointerup', lacher);
toile.addEventListener('pointercancel', lacher);

const arrondi = (n: number) => Math.round(n * 1000) / 1000;

// ------------------------------------------------------------------
// Curseurs
// ------------------------------------------------------------------

interface Champ {
  nom: string;
  min: number;
  max: number;
  pas: number;
  lire: () => number;
  ecrire: (n: number) => void;
}

// Bornes alignées sur LIMITES_COUVERTURE (vite.config.ts), qui refuse tout le
// reste. Les positions débordent du cadre : un élément peut n'y entrer qu'à
// moitié.
function champsDe(nom: NomElement): Champ[] {
  const e = () => reglages[nom];
  return [
    { nom: 'x', min: -0.5, max: 1.5, pas: 0.005, lire: () => e().x, ecrire: (n) => (e().x = n) },
    { nom: 'y', min: -0.5, max: 1.5, pas: 0.005, lire: () => e().y, ecrire: (n) => (e().y = n) },
    {
      nom: 'Zoom',
      min: 0.02,
      max: 1.5,
      pas: 0.005,
      lire: () => e().zoom,
      ecrire: (n) => (e().zoom = n),
    },
    {
      nom: 'Rotation',
      min: -180,
      max: 180,
      pas: 1,
      lire: () => e().rotation,
      ecrire: (n) => (e().rotation = n),
    },
  ];
}

const retouche = () => reglages.retouches[reglages.vue];

const GROUPES: {
  titre: string;
  note?: string;
  vues?: true;
  champs: Champ[];
  miroir?: NomElement;
}[] = [
  {
    titre: 'Titre',
    note: 'Toujours centré, comme sur l’écran titre. Largeur en fraction de la couverture.',
    champs: [
      {
        nom: 'y',
        min: -0.2,
        max: 0.6,
        pas: 0.005,
        lire: () => reglages.titre.y,
        ecrire: (n) => (reglages.titre.y = n),
      },
      {
        nom: 'Largeur',
        min: 0.2,
        max: 1.2,
        pas: 0.005,
        lire: () => reglages.titre.largeur,
        ecrire: (n) => (reglages.titre.largeur = n),
      },
    ],
  },
  {
    titre: 'Photo du château',
    note: 'Chaque photo garde sa retouche. À 1, la photo telle quelle.',
    vues: true,
    champs: [
      {
        nom: 'Luminosité',
        min: 0.5,
        max: 2,
        pas: 0.01,
        lire: () => retouche().luminosite,
        ecrire: (n) => (retouche().luminosite = n),
      },
      {
        nom: 'Contraste',
        min: 0.5,
        max: 2,
        pas: 0.01,
        lire: () => retouche().contraste,
        ecrire: (n) => (retouche().contraste = n),
      },
      {
        nom: 'Saturation',
        min: 0,
        max: 2,
        pas: 0.01,
        lire: () => retouche().saturation,
        ecrire: (n) => (retouche().saturation = n),
      },
    ],
  },
  {
    titre: 'Ciel',
    note: 'Où le dégradé atteint la brume de l’horizon. Le halo suit le soleil.',
    champs: [
      {
        nom: 'Horizon',
        min: 0,
        max: 1.5,
        pas: 0.01,
        lire: () => reglages.horizon,
        ecrire: (n) => (reglages.horizon = n),
      },
    ],
  },
  ...[...ELEMENTS].reverse().map((nom) => ({
    titre: NOMS[nom],
    champs: champsDe(nom),
    miroir: nom,
  })),
];

const rafraichir: (() => void)[] = [];

for (const groupe of GROUPES) {
  const cadre = document.createElement('fieldset');
  const legende = document.createElement('legend');
  legende.textContent = groupe.titre;
  cadre.append(legende);

  if (groupe.vues) {
    for (const vue of VUES) {
      const ligne = document.createElement('label');
      ligne.className = 'case';
      const choix = document.createElement('input');
      choix.type = 'radio';
      choix.name = 'vue';
      ligne.append(choix, PHOTOS_DU_CHATEAU[vue].nom);
      cadre.append(ligne);
      choix.addEventListener('change', () => {
        reglages.vue = vue;
        appliquer();
      });
      rafraichir.push(() => (choix.checked = reglages.vue === vue));
    }
  }

  for (const champ of groupe.champs) {
    const ligne = document.createElement('label');
    ligne.className = 'curseur';
    const nom = document.createElement('span');
    nom.textContent = champ.nom;
    const entree = document.createElement('input');
    entree.type = 'range';
    entree.min = String(champ.min);
    entree.max = String(champ.max);
    entree.step = String(champ.pas);
    const valeur = document.createElement('output');
    ligne.append(nom, entree, valeur);
    cadre.append(ligne);

    entree.addEventListener('input', () => {
      champ.ecrire(Number(entree.value));
      appliquer();
    });
    rafraichir.push(() => {
      entree.value = String(champ.lire());
      valeur.textContent = String(champ.lire());
    });
  }

  const miroir = groupe.miroir;
  if (miroir) {
    const ligne = document.createElement('label');
    ligne.className = 'case';
    const caseMiroir = document.createElement('input');
    caseMiroir.type = 'checkbox';
    ligne.append(caseMiroir, 'Miroir');
    cadre.append(ligne);
    caseMiroir.addEventListener('change', () => {
      reglages[miroir].miroir = caseMiroir.checked;
      appliquer();
    });
    rafraichir.push(() => (caseMiroir.checked = reglages[miroir].miroir));
  }

  if (groupe.note) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = groupe.note;
    cadre.append(note);
  }
  conteneur.append(cadre);
}

function appliquer() {
  composer();
  for (const r of rafraichir) r();
  sortie.textContent = blocDuFichier();
}

function blocDuFichier(): string {
  const element = (e: Element) =>
    `{ x: ${e.x}, y: ${e.y}, zoom: ${e.zoom}, rotation: ${e.rotation}, miroir: ${e.miroir} }`;
  return [
    'export const REGLAGES_COUVERTURE: ReglagesCouverture = {',
    `  horizon: ${reglages.horizon},`,
    `  vue: '${reglages.vue}',`,
    '  retouches: {',
    ...VUES.map((vue) => {
      const r = reglages.retouches[vue];
      return `    ${vue}: { luminosite: ${r.luminosite}, contraste: ${r.contraste}, saturation: ${r.saturation} },`;
    }),
    '  },',
    `  titre: { y: ${reglages.titre.y}, largeur: ${reglages.titre.largeur} },`,
    ...ELEMENTS.map((nom) => `  ${nom}: ${element(reglages[nom])},`),
    '};',
  ].join('\n');
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

document.getElementById('revenir')!.addEventListener('click', () => {
  Object.assign(reglages, structuredClone(REGLAGES_COUVERTURE));
  appliquer();
});

// Les points d'entrée sont définis dans `vite.config.ts` : ils n'existent qu'en
// développement, et chacun n'écrit qu'un fichier connu d'avance. L'image part
// la première : les réglages réécrivent un module de cette page, et Vite la
// recharge aussitôt.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const png = await new Promise<Blob>((ok, ko) =>
      toile.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob a échoué'))), 'image/png'),
    );
    await envoyer('/__couverture-image', png, 'image/png');
    sessionStorage.setItem(MEMOIRE, '1');
    await envoyer('/__couverture-reglages', JSON.stringify(reglages), 'application/json');
    dire('Enregistré ✓');
  } catch (err) {
    sessionStorage.removeItem(MEMOIRE);
    dire(`Échec : ${String(err)}`, true);
  }
});

async function envoyer(route: string, corps: BodyInit, type: string): Promise<void> {
  const reponse = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': type },
    body: corps,
  });
  const resultat = await reponse.json();
  if (!reponse.ok || !resultat.ok) throw new Error(resultat.erreur ?? reponse.statusText);
}

function dire(texte: string, erreur = false) {
  statut.textContent = texte;
  statut.classList.toggle('is-erreur', erreur);
}

if (sessionStorage.getItem(MEMOIRE)) {
  sessionStorage.removeItem(MEMOIRE);
  dire('Enregistré ✓');
}

appliquer();
const fichiers = [...Object.values(PHOTOS), ...VUES.map((vue) => PHOTOS_DU_CHATEAU[vue].fichier)];
Promise.allSettled([...fichiers.map(charger), chargerTitre()]).then((issues) => {
  appliquer();
  const echecs = issues.filter((i) => i.status === 'rejected').map((i) => String(i.reason));
  if (echecs.length) dire(echecs.join(' · '), true);
});
