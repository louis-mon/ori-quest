import './reglages.css';
import Phaser from 'phaser';
import plan from '../generated/scenes/trone';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/config';
import { dessinerFond, preloadFond } from '../game/scenes/fond';
import { boxOf } from '../game/scenes/layout';
import { allumerLesTorches, type ReglagesTorches, type Torches } from '../game/scenes/torches';
import { REGLAGES_TORCHES } from '../game/scenes/torches-reglages';
import { PREFERENCE_GPU } from '../gpu';
import { installHiddenPageRaf } from './hidden-page-raf';

// Outil de réglage des torches de la salle du trône — développement seulement.
// Un vacillement ne se juge qu'en le regardant vaciller, sur le mur qu'il
// éclaire : l'aperçu passe donc par `allumerLesTorches()`, comme la scène.

// Même raison que dans main.ts : un volet de preview masqué coupe rAF, et
// l'aperçu se figeait.
installHiddenPageRaf();

type Cle = keyof ReglagesTorches;

interface Champ {
  cle: Cle;
  nom: string;
  // Absents pour la teinte, qui prend un sélecteur de couleur.
  min?: number;
  max?: number;
  pas?: number;
  unite?: string;
}

// Bornes alignées sur LIMITES_TORCHES (vite.config.ts), qui refuse tout le reste.
const GROUPES: { titre: string; note?: string; champs: Champ[] }[] = [
  {
    titre: 'Lumière',
    note: 'La portée se compte en largeurs de flamme : une flamme redessinée plus grande dans Tiled éclaire plus loin.',
    champs: [
      { cle: 'teinte', nom: 'Teinte' },
      { cle: 'portee', nom: 'Portée', min: 1, max: 10, pas: 0.1, unite: '×' },
      { cle: 'chaleur', nom: 'Chaleur', min: 0, max: 1, pas: 0.01 },
      { cle: 'lueur', nom: 'Clarté', min: 0, max: 1, pas: 0.01 },
      { cle: 'halo', nom: 'Halo', min: 0, max: 1, pas: 0.01 },
    ],
  },
  {
    titre: 'Vacillement',
    note: 'Rafales : à 0, la flamme vacille toujours autant ; à 1, elle passe du calme plat au coup de vent. Chaque torche tire son propre hasard.',
    champs: [
      { cle: 'vacillement', nom: 'Ampleur', min: 0, max: 1, pas: 0.01 },
      { cle: 'rafales', nom: 'Rafales', min: 0, max: 1, pas: 0.01 },
      { cle: 'vitesse', nom: 'Vitesse', min: 0, max: 5, pas: 0.05, unite: '×' },
    ],
  },
];

const FLAMMES = [boxOf(plan, 'dec_flamme_gauche'), boxOf(plan, 'dec_flamme_droite')];

// Assez pour juger le bord de la lueur sur le mur, pas plus : la portée doit
// tenir dans le cadre.
const GROS_PLAN = 2.5;

// Enregistrer réécrit un fichier que cette page importe, et Vite la recharge :
// ce qu'on regardait doit survivre au rechargement.
const MEMOIRE = { grosPlan: 'torches-gros-plan', enregistre: 'torches-enregistrees' };

const reglages: ReglagesTorches = { ...REGLAGES_TORCHES };
let grosPlan = sessionStorage.getItem(MEMOIRE.grosPlan) === '1';
let eteint = false;
let torches: Torches | undefined;
let scene: Phaser.Scene | undefined;

const conteneur = document.getElementById('curseurs')!;
const sortie = document.getElementById('sortie')!;
const statut = document.getElementById('statut')!;
const boutonGrosPlan = document.getElementById('gros-plan')!;
const boutonEteindre = document.getElementById('eteindre')!;

// ------------------------------------------------------------------
// Aperçu
// ------------------------------------------------------------------

class Apercu extends Phaser.Scene {
  constructor() {
    super('apercu-torches');
  }

  preload() {
    preloadFond(this, plan.fond);
  }

  create() {
    dessinerFond(this, plan.fond);
    torches = allumerLesTorches(this, FLAMMES, reglages);
    scene = this;
    cadrer();
    appliquer();
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'apercu',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#100e0c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: PREFERENCE_GPU },
  scene: [Apercu],
});

function cadrer() {
  boutonGrosPlan.setAttribute('aria-pressed', String(grosPlan));
  const camera = scene?.cameras.main;
  if (!camera) return;
  camera.setBounds(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const [flamme] = FLAMMES;
  if (grosPlan) camera.setZoom(GROS_PLAN).centerOn(flamme.x + flamme.w / 2, flamme.y + flamme.h);
  else camera.setZoom(1).centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
}

// ------------------------------------------------------------------
// Curseurs
// ------------------------------------------------------------------

const entrees = new Map<Cle, { entree: HTMLInputElement; valeur: HTMLOutputElement }>();

for (const groupe of GROUPES) {
  const cadre = document.createElement('fieldset');
  const titre = document.createElement('legend');
  titre.textContent = groupe.titre;
  cadre.append(titre);

  for (const champ of groupe.champs) {
    const ligne = document.createElement('label');
    ligne.className = 'curseur';
    const nom = document.createElement('span');
    nom.textContent = champ.nom;
    const entree = document.createElement('input');
    if (champ.cle === 'teinte') {
      entree.type = 'color';
    } else {
      entree.type = 'range';
      entree.min = String(champ.min);
      entree.max = String(champ.max);
      entree.step = String(champ.pas);
    }
    const valeur = document.createElement('output');
    ligne.append(nom, entree, valeur);
    cadre.append(ligne);
    entrees.set(champ.cle, { entree, valeur });

    entree.addEventListener('input', () => {
      if (champ.cle === 'teinte') reglages.teinte = entree.value;
      else reglages[champ.cle] = Number(entree.value);
      appliquer();
    });
  }

  if (groupe.note) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = groupe.note;
    cadre.append(note);
  }
  conteneur.append(cadre);
}

function unite(cle: Cle): string {
  const champ = GROUPES.flatMap((g) => g.champs).find((c) => c.cle === cle);
  return champ?.unite ? ` ${champ.unite}` : '';
}

function appliquer() {
  boutonEteindre.setAttribute('aria-pressed', String(eteint));
  torches?.regler(eteint ? { ...reglages, chaleur: 0, lueur: 0, halo: 0 } : reglages);
  for (const [cle, { entree, valeur }] of entrees) {
    entree.value = String(reglages[cle]);
    valeur.textContent = `${reglages[cle]}${unite(cle)}`;
  }
  sortie.textContent = [
    'export const REGLAGES_TORCHES: ReglagesTorches = {',
    ...Object.entries(reglages).map(
      ([cle, v]) => `  ${cle}: ${typeof v === 'string' ? `'${v}'` : v},`,
    ),
    '};',
  ].join('\n');
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

document.getElementById('revenir')!.addEventListener('click', () => {
  Object.assign(reglages, REGLAGES_TORCHES);
  appliquer();
});

boutonGrosPlan.addEventListener('click', () => {
  grosPlan = !grosPlan;
  sessionStorage.setItem(MEMOIRE.grosPlan, grosPlan ? '1' : '');
  cadrer();
});

// Le mur tel que l'artiste l'a livré, pour juger ce que la lumière y ajoute.
boutonEteindre.addEventListener('click', () => {
  eteint = !eteint;
  appliquer();
});

// Le point d'entrée est défini dans `vite.config.ts` : il n'existe qu'en
// développement, n'écrit qu'un fichier connu d'avance et ne garde que des
// valeurs bornées.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__torches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reglages),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.ok) throw new Error(resultat.erreur ?? reponse.statusText);
    sessionStorage.setItem(MEMOIRE.enregistre, '1');
    dire('Enregistré ✓');
  } catch (err) {
    dire(`Échec : ${String(err)}`, true);
  }
});

function dire(texte: string, erreur = false) {
  statut.textContent = texte;
  statut.classList.toggle('is-erreur', erreur);
}

if (sessionStorage.getItem(MEMOIRE.enregistre)) {
  sessionStorage.removeItem(MEMOIRE.enregistre);
  dire('Enregistré ✓');
}

appliquer();
cadrer();
