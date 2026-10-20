import '../ui/style.css';
import './choix.css';
import { Story } from 'inkjs';
import storyJson from '../generated/story.json';
import { HEROS, locuteurDe } from '../game/systems/dialogue';
import type { Personnage } from '../game/systems/personnages';
import { REGLAGES_CHOIX } from '../ui/choix-reglages';
import { Overlay, type OptionDeChoix, type ReglagesChoix } from '../ui/overlay';

// Outil de réglage des menus de choix — développement seulement. Une marque de
// réplique ou un en-tête ne se jugent que sur un vrai menu, à la taille d'un
// téléphone : l'aperçu joue donc les knots d'ink dans l'`Overlay` du jeu.
//
// Le récit tourne sur sa propre `Story`, sans `DialogueRunner` : celui-ci passe
// par `gameState`, qui écrirait la sauvegarde du jeu, servi sur la même origine.

interface Scenario {
  nom: string;
  knot: string;
  drapeaux: string[];
}

const SCENARIOS: Record<string, Scenario> = {
  wyverne: { nom: 'La wyverne — elle pose la question', knot: 'revoir_wyvern', drapeaux: [] },
  renard: {
    nom: 'Le renard, au retour — menu sans réplique',
    knot: 'porte_renard',
    drapeaux: ['renard_vu'],
  },
  trone: {
    nom: 'Les feuilles du trône — la grenouille vient de parler',
    knot: 'trone_coeur',
    drapeaux: ['wyvern_indices'],
  },
};

// Le cadre du jeu à l'écran, dont `syncStage()` tire l'échelle de l'interface.
// Le téléphone est un iPhone en paysage : 844 × 390, letterboxé en 16:9.
const FORMATS: Record<string, { nom: string; largeur: number; hauteur: number }> = {
  telephone: { nom: 'Téléphone en paysage', largeur: 693, hauteur: 390 },
  ordinateur: { nom: 'Ordinateur', largeur: 1280, hauteur: 720 },
};

type Cle = keyof ReglagesChoix;

// Valeurs alignées sur CHOIX_PERMIS (vite.config.ts), qui refuse tout le reste.
const REGLAGES: { cle: Cle; titre: string; valeurs: [string, string][] }[] = [
  {
    cle: 'marque',
    titre: 'Une option que la grenouille prononce',
    valeurs: [
      ['tiret', '— tiret de dialogue'],
      ['guillemets', '« guillemets »'],
      ['aucune', 'sans marque'],
    ],
  },
  {
    cle: 'geste',
    titre: 'Un geste (« plier un pont »)',
    valeurs: [
      ['italique', 'italique, comme la voix intérieure'],
      ['droit', 'droit'],
    ],
  },
  {
    cle: 'repondant',
    titre: "Sous la question d'un autre personnage",
    valeurs: [
      ['vignette-et-nom', 'vignette et nom'],
      ['nom', 'nom seul'],
    ],
  },
];

// Enregistrer réécrit un fichier que cette page importe, et Vite la recharge :
// ce qu'on regardait doit survivre au rechargement.
const MEMOIRE = {
  scenario: 'choix-scenario',
  format: 'choix-format',
  enregistre: 'choix-enregistre',
};

const reglages: ReglagesChoix = { ...REGLAGES_CHOIX };
let scenario = sessionStorage.getItem(MEMOIRE.scenario) ?? 'wyverne';
let format = sessionStorage.getItem(MEMOIRE.format) ?? 'telephone';
if (!SCENARIOS[scenario]) scenario = 'wyverne';
if (!FORMATS[format]) format = 'telephone';

const stage = document.getElementById('stage')!;
const ui = document.getElementById('ui')!;
const groupes = document.getElementById('groupes')!;
const sortie = document.getElementById('sortie')!;
const statut = document.getElementById('statut')!;

let overlay: Overlay | null = null;
// Une partie relancée laisse la précédente en attente d'un tap qui ne viendra
// plus : le jeton la fait taire.
let partie = 0;

// ------------------------------------------------------------------
// Le récit, jusqu'au menu
// ------------------------------------------------------------------

function jusquAuMenu({ knot, drapeaux }: Scenario) {
  const story = new Story(storyJson);
  for (const nom of drapeaux) story.variablesState[`flag_${nom}`] = true;
  story.ChoosePathString(knot);

  let qui: Personnage | null = null;
  let replique: { texte: string; qui: Personnage | null } | null = null;
  while (story.canContinue) {
    const texte = story.Continue()?.trim() ?? '';
    const tag = locuteurDe(story.currentTags ?? []);
    if (tag !== undefined) qui = tag;
    if (texte) replique = { texte, qui };
  }
  const options: OptionDeChoix[] = story.currentChoices.map((c) => ({
    texte: c.text,
    qui: locuteurDe(c.tags ?? []),
  }));
  return { replique, options };
}

async function jouer() {
  const jeton = ++partie;
  overlay = new Overlay(ui);
  overlay.reglerLesChoix(reglages);
  const { replique, options } = jusquAuMenu(SCENARIOS[scenario]);

  if (replique) await overlay.say(replique.texte, replique.qui);
  if (jeton !== partie) return;
  const choisi = options[await overlay.choose(options, HEROS)];
  if (jeton !== partie) return;
  if (choisi.qui) await overlay.redire(choisi.texte, choisi.qui);
  if (jeton !== partie) return;
  void jouer();
}

function cadrer() {
  const { largeur, hauteur } = FORMATS[format];
  stage.style.width = `${largeur}px`;
  stage.style.height = `${hauteur}px`;
  // Même formule que `syncStage()`, plancher compris.
  stage.style.setProperty('--ui-scale', String(Math.max(Math.min(largeur / 1280, 1), 0.62)));
}

// ------------------------------------------------------------------
// Réglages
// ------------------------------------------------------------------

function groupe(
  titre: string,
  nom: string,
  valeurs: [string, string][],
  actuelle: string,
  choisir: (v: string) => void,
) {
  const cadre = document.createElement('fieldset');
  const legende = document.createElement('legend');
  legende.textContent = titre;
  cadre.append(legende);
  for (const [valeur, libelle] of valeurs) {
    const ligne = document.createElement('label');
    ligne.className = 'option';
    const entree = document.createElement('input');
    entree.type = 'radio';
    entree.name = nom;
    entree.value = valeur;
    entree.checked = valeur === actuelle;
    entree.addEventListener('change', () => choisir(valeur));
    ligne.append(entree, libelle);
    cadre.append(ligne);
  }
  groupes.append(cadre);
}

function construire() {
  groupes.innerHTML = '';
  groupe(
    'Menu',
    'scenario',
    Object.entries(SCENARIOS).map(([id, s]) => [id, s.nom]),
    scenario,
    (v) => {
      scenario = v;
      sessionStorage.setItem(MEMOIRE.scenario, v);
      void jouer();
    },
  );
  groupe(
    'Écran',
    'format',
    Object.entries(FORMATS).map(([id, f]) => [id, f.nom]),
    format,
    (v) => {
      format = v;
      sessionStorage.setItem(MEMOIRE.format, v);
      cadrer();
    },
  );
  for (const { cle, titre, valeurs } of REGLAGES) {
    groupe(titre, cle, valeurs, reglages[cle], (v) => {
      (reglages as unknown as Record<Cle, string>)[cle] = v;
      appliquer();
    });
  }
}

function appliquer() {
  overlay?.reglerLesChoix(reglages);
  sortie.textContent = [
    'export const REGLAGES_CHOIX: ReglagesChoix = {',
    ...Object.entries(reglages).map(([cle, v]) => `  ${cle}: '${v}',`),
    '};',
  ].join('\n');
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

document.getElementById('rejouer')!.addEventListener('click', () => void jouer());

document.getElementById('revenir')!.addEventListener('click', () => {
  Object.assign(reglages, REGLAGES_CHOIX);
  construire();
  appliquer();
});

// Le point d'entrée est défini dans `vite.config.ts` : il n'existe qu'en
// développement, n'écrit qu'un fichier connu d'avance et n'accepte que des
// valeurs de la liste.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__choix', {
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

construire();
cadrer();
appliquer();
void jouer();
