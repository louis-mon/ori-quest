import './reglages.css';
import Phaser from 'phaser';
import plan from '../generated/scenes/cuisine';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/config';
import { placeSprite, preloadSprite } from '../game/scenes/decor-sprite';
import { dessinerFond, preloadFond } from '../game/scenes/fond';
import { boxOf } from '../game/scenes/layout';
import { poserOrigami } from '../game/scenes/origami-decor';
import { allumerLesTorches } from '../game/scenes/torches';
import { poserVapeur, type ReglagesVapeur, type Vapeur } from '../game/scenes/vapeur';
import { REGLAGES_VAPEUR } from '../game/scenes/vapeur-reglages';
import { PREFERENCE_GPU } from '../gpu';
import { installHiddenPageRaf } from './hidden-page-raf';

// Outil de réglage de la vapeur de la daurade — développement seulement.
// Une vapeur ne se juge qu'en la regardant monter, devant le mur où elle se
// dissipe : l'aperçu passe donc par `poserVapeur()`, comme la scène, sur la
// table de la cuisine, torches allumées.

// Même raison que dans main.ts : un volet de preview masqué coupe rAF, et
// l'aperçu se figeait.
installHiddenPageRaf();

type Cle = keyof ReglagesVapeur;

interface Champ {
  cle: Cle;
  nom: string;
  min: number;
  max: number;
  pas: number;
  unite?: string;
}

// Bornes alignées sur LIMITES_VAPEUR (vite.config.ts), qui refuse tout le reste.
const GROUPES: { titre: string; note?: string; champs: Champ[] }[] = [
  {
    titre: 'Filets',
    note: 'Épaisseur, hauteur et ondulation se comptent en largeurs de plat : un plat redessiné plus grand dans Tiled fume à proportion. Étalement : à 0, tous les filets partent du milieu du plat ; à 1, de toute sa largeur.',
    champs: [
      { cle: 'filets', nom: 'Nombre', min: 1, max: 5, pas: 1 },
      { cle: 'etalement', nom: 'Étalement', min: 0, max: 1, pas: 0.01 },
      { cle: 'epaisseur', nom: 'Épaisseur', min: 0.01, max: 0.3, pas: 0.005, unite: '×' },
      { cle: 'epanouissement', nom: 'Épanouissement', min: 1, max: 8, pas: 0.1, unite: '×' },
      { cle: 'opacite', nom: 'Opacité', min: 0, max: 1, pas: 0.01 },
      { cle: 'intermittence', nom: 'Intermittence', min: 0, max: 1, pas: 0.01 },
    ],
  },
  {
    titre: 'Volutes',
    note: 'Ondulation : l’écart d’une volute arrivée en haut — il grandit à mesure qu’elle monte. Enroulement : à 0 le filet serpente, plus fort il revient sur lui-même en boucles.',
    champs: [
      { cle: 'duree', nom: 'Montée', min: 0.5, max: 8, pas: 0.1, unite: 's' },
      { cle: 'hauteur', nom: 'Hauteur', min: 0.1, max: 3, pas: 0.05, unite: '×' },
      { cle: 'ondulation', nom: 'Ondulation', min: 0, max: 0.5, pas: 0.01, unite: '×' },
      { cle: 'boucles', nom: 'Boucles', min: 0, max: 3, pas: 0.05, unite: '/ s' },
      { cle: 'enroulement', nom: 'Enroulement', min: 0, max: 2, pas: 0.05 },
    ],
  },
];

const ASSIETTE = 'assiette';
const REPAS = boxOf(plan, 'dec_repas');

// Assez pour suivre une volute, pas plus : la hauteur doit tenir dans le cadre.
const GROS_PLAN = 2.5;

// Enregistrer réécrit un fichier que cette page importe, et Vite la recharge :
// ce qu'on regardait doit survivre au rechargement.
const MEMOIRE = { grosPlan: 'vapeur-gros-plan', enregistre: 'vapeur-enregistree' };

const reglages: ReglagesVapeur = { ...REGLAGES_VAPEUR };
let grosPlan = sessionStorage.getItem(MEMOIRE.grosPlan) === '1';
let coupee = false;
let vapeur: Vapeur | undefined;
let scene: Phaser.Scene | undefined;

const conteneur = document.getElementById('curseurs')!;
const sortie = document.getElementById('sortie')!;
const statut = document.getElementById('statut')!;
const boutonGrosPlan = document.getElementById('gros-plan')!;
const boutonCouper = document.getElementById('couper')!;

// ------------------------------------------------------------------
// Aperçu
// ------------------------------------------------------------------

class Apercu extends Phaser.Scene {
  constructor() {
    super('apercu-vapeur');
  }

  preload() {
    preloadFond(this, plan.fond);
    preloadSprite(this, ASSIETTE, 'assets/decor/assiette.png');
  }

  create() {
    dessinerFond(this, plan.fond);
    allumerLesTorches(this, [boxOf(plan, 'dec_flamme_gauche'), boxOf(plan, 'dec_flamme_droite')]);
    placeSprite(this, ASSIETTE, boxOf(plan, 'dec_assiette'));
    const daurade = poserOrigami(this, 'poisson', REPAS, (emprise) => vapeur?.poser(emprise));
    vapeur = poserVapeur(this, reglages);
    daurade.montrer(true);
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
  // Le plat en bas du cadre : c'est au-dessus qu'il se passe quelque chose.
  if (grosPlan) {
    camera
      .setZoom(GROS_PLAN)
      .centerOn(REPAS.x + REPAS.w / 2, REPAS.y + REPAS.h - DESIGN_HEIGHT / GROS_PLAN / 3);
  } else camera.setZoom(1).centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
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
    entree.type = 'range';
    entree.min = String(champ.min);
    entree.max = String(champ.max);
    entree.step = String(champ.pas);
    const valeur = document.createElement('output');
    ligne.append(nom, entree, valeur);
    cadre.append(ligne);
    entrees.set(champ.cle, { entree, valeur });

    entree.addEventListener('input', () => {
      reglages[champ.cle] = Number(entree.value);
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
  boutonCouper.setAttribute('aria-pressed', String(coupee));
  vapeur?.regler(reglages);
  vapeur?.fumer(!coupee);
  for (const [cle, { entree, valeur }] of entrees) {
    entree.value = String(reglages[cle]);
    valeur.textContent = `${reglages[cle]}${unite(cle)}`;
  }
  sortie.textContent = [
    'export const REGLAGES_VAPEUR: ReglagesVapeur = {',
    ...Object.entries(reglages).map(([cle, v]) => `  ${cle}: ${v},`),
    '};',
  ].join('\n');
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

document.getElementById('revenir')!.addEventListener('click', () => {
  Object.assign(reglages, REGLAGES_VAPEUR);
  appliquer();
});

boutonGrosPlan.addEventListener('click', () => {
  grosPlan = !grosPlan;
  sessionStorage.setItem(MEMOIRE.grosPlan, grosPlan ? '1' : '');
  cadrer();
});

// Le plat tel qu'il serait froid — et, en le rallumant, comme on le trouve en
// entrant dans la cuisine : déjà fumant.
boutonCouper.addEventListener('click', () => {
  coupee = !coupee;
  appliquer();
});

// Le point d'entrée est défini dans `vite.config.ts` : il n'existe qu'en
// développement, n'écrit qu'un fichier connu d'avance et ne garde que des
// valeurs bornées.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__vapeur', {
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
