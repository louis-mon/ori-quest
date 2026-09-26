import './eau.css';
import Phaser from 'phaser';
import plan from '../generated/scenes/pont';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../game/config';
import { dessinerCiel, preloadCiel } from '../game/scenes/ciel';
import { poserEau, type Eau, type ReglagesEau } from '../game/scenes/eau';
import { REGLAGES_EAU } from '../game/scenes/eau-reglages';
import { dessinerFond, preloadFond } from '../game/scenes/fond';
import { boxOf } from '../game/scenes/layout';
import { PREFERENCE_GPU } from '../gpu';
import { installHiddenPageRaf } from './hidden-page-raf';

// Outil de réglage de l'eau du ravin — développement seulement. Une vitesse ou
// une houle ne se jugent qu'en regardant l'eau couler, sur le fond qu'elle aura
// dans le jeu : l'aperçu passe donc par `poserEau()`, comme la scène.

// Même raison que dans main.ts : un volet de preview masqué coupe rAF, et
// l'aperçu se figeait.
installHiddenPageRaf();

type Cle = keyof ReglagesEau;

interface Champ {
  cle: Cle;
  nom: string;
  // Absents pour la teinte, qui prend un sélecteur de couleur.
  min?: number;
  max?: number;
  pas?: number;
  unite?: string;
}

// Bornes alignées sur LIMITES_EAU (vite.config.ts), qui refuse tout le reste.
const GROUPES: { titre: string; note?: string; champs: Champ[] }[] = [
  {
    titre: 'Papier',
    note: 'Teinte, relief et plis recalculent la texture TexEau.',
    champs: [
      { cle: 'couleur', nom: 'Teinte' },
      { cle: 'relief', nom: 'Relief', min: 0, max: 3, pas: 0.05 },
      { cle: 'plis', nom: 'Plis', min: 0, max: 3, pas: 0.05 },
    ],
  },
  {
    titre: 'Courant',
    champs: [{ cle: 'defilement', nom: 'Vitesse', min: 0, max: 200, pas: 1, unite: 'px/s' }],
  },
  {
    titre: 'Vagues',
    note: 'Leur vitesse est une fraction de celle du courant : sous 1, elles vont toujours moins vite que le papier.',
    champs: [
      { cle: 'vagues', nom: 'Vitesse', min: 0, max: 0.95, pas: 0.01, unite: '×' },
      { cle: 'amplitude', nom: 'Amplitude', min: 0, max: 20, pas: 0.5, unite: 'px' },
      { cle: 'longueur', nom: 'Longueur', min: 20, max: 300, pas: 1, unite: 'px' },
      { cle: 'reflet', nom: 'Reflet', min: 0, max: 0.6, pas: 0.01 },
    ],
  },
  {
    titre: "Plan d'eau",
    note: "Pivoté vers l'arrière sur son bord bas : à 0°, il fait face ; plus l'angle monte, plus il fuit vers l'horizon.",
    champs: [{ cle: 'inclinaison', nom: 'Inclinaison', min: 0, max: 75, pas: 1, unite: '°' }],
  },
  {
    titre: 'Berges',
    champs: [{ cle: 'berges', nom: 'Ombre', min: 0, max: 1, pas: 0.01 }],
  },
];

// Assez pour juger le grain du papier, pas plus : la zone doit tenir dans le
// cadre.
const GROS_PLAN = 2.2;

// Enregistrer réécrit un fichier que cette page importe, et Vite la recharge :
// ce qu'on regardait doit survivre au rechargement.
const MEMOIRE = { grosPlan: 'eau-gros-plan', enregistre: 'eau-enregistree' };

const ZONES = { ravin: boxOf(plan, 'dec_ravin'), eau: boxOf(plan, 'dec_eau') };

const reglages: ReglagesEau = { ...REGLAGES_EAU };
let grosPlan = sessionStorage.getItem(MEMOIRE.grosPlan) === '1';
let origine = false;
let eau: Eau | undefined;
let scene: Phaser.Scene | undefined;

const conteneur = document.getElementById('curseurs')!;
const sortie = document.getElementById('sortie')!;
const statut = document.getElementById('statut')!;
const boutonGrosPlan = document.getElementById('gros-plan')!;
const boutonOrigine = document.getElementById('origine')!;

// ------------------------------------------------------------------
// Aperçu
// ------------------------------------------------------------------

class Apercu extends Phaser.Scene {
  constructor() {
    super('apercu-eau');
  }

  preload() {
    preloadCiel(this);
    preloadFond(this, plan.fond);
  }

  create() {
    dessinerCiel(this, boxOf(plan, 'dec_sol').y, boxOf(plan, 'dec_soleil'));
    eau = poserEau(this, dessinerFond(this, plan.fond), ZONES, reglages);
    scene = this;
    cadrer();
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
  // Bornée au décor : l'eau touche le bas du cadre, et le gros plan montrait
  // sinon une bande noire sous elle.
  camera.setBounds(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  if (grosPlan)
    camera
      .setZoom(GROS_PLAN)
      .centerOn(ZONES.ravin.x + ZONES.ravin.w / 2, ZONES.ravin.y + ZONES.ravin.h / 2);
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
    if (champ.cle === 'couleur') {
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
      if (champ.cle === 'couleur') reglages.couleur = entree.value;
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
  eau?.regler(reglages);
  for (const [cle, { entree, valeur }] of entrees) {
    entree.value = String(reglages[cle]);
    valeur.textContent = `${reglages[cle]}${unite(cle)}`;
  }
  sortie.textContent = [
    'export const REGLAGES_EAU: ReglagesEau = {',
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
  Object.assign(reglages, REGLAGES_EAU);
  appliquer();
});

boutonGrosPlan.addEventListener('click', () => {
  grosPlan = !grosPlan;
  sessionStorage.setItem(MEMOIRE.grosPlan, grosPlan ? '1' : '');
  cadrer();
});

// Pour juger le découpage : ce que l'eau recouvre, et ce qu'elle laisse.
boutonOrigine.addEventListener('click', () => {
  origine = !origine;
  boutonOrigine.setAttribute('aria-pressed', String(origine));
  eau?.montrer(!origine);
});

// Le point d'entrée est défini dans `vite.config.ts` : il n'existe qu'en
// développement, n'écrit qu'un fichier connu d'avance et ne garde que des
// valeurs bornées.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__eau', {
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
