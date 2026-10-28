import './reglages.css';
import { ajusterLAmbiance, jouerLAmbiance } from '../sons/ambiance';
import { jouerBruitage } from '../sons/bruitages';
import { AMBIANCES, BRUITAGES, type Ambiance, type Bruitage } from '../sons/catalogue';
import { demarrerLeSonAuPremierGeste } from '../sons/contexte';
import { reglerLesSons, type ReglagesSons } from '../sons/reglages';
import { couperLeSon } from '../sons/son-coupe';
import { REGLAGES_SONS } from '../sons/sons-reglages';

// Outil de réglage des sons — développement seulement. Un mélange ne se juge
// qu'à l'oreille, et avec les modules du jeu : ce qu'on entend ici est ce
// qu'entendra le joueur.

// Alignées sur LIMITES_SONS (vite.config.ts), qui refuse tout le reste.
const VOLUME = { min: 0, max: 2, pas: 0.01 };
const DUREE = { min: 0.1, pas: 0.1 };

// Enregistrer réécrit un fichier que cette page importe, et Vite la recharge.
const MEMOIRE = 'sons-enregistres';

const reglages: ReglagesSons = structuredClone(REGLAGES_SONS);
reglerLesSons(reglages);
// Le réglage du joueur vaut ici aussi, la page partageant le stockage du jeu :
// coupé depuis le menu, l'outil resterait muet.
couperLeSon(false);
demarrerLeSonAuPremierGeste();

// Indépendantes, comme dans le jeu : la rivière se juge par-dessus `chapitre_1`.
const jouees = new Set<Ambiance>();
// La durée de chaque fichier, qui borne le curseur : au bout, le cri est entier.
const durees = new Map<Bruitage, number>();

const sortie = document.getElementById('sortie')!;
const statut = document.getElementById('statut')!;
const rafraichir: (() => void)[] = [];

// ------------------------------------------------------------------
// Curseurs
// ------------------------------------------------------------------

function tete(nom: string, jouer: () => void, joue?: () => boolean): HTMLElement {
  const ligne = document.createElement('div');
  ligne.className = 'son-tete';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.textContent = '▶';
  bouton.addEventListener('click', jouer);
  if (joue) rafraichir.push(() => bouton.setAttribute('aria-pressed', String(joue())));
  const titre = document.createElement('code');
  titre.textContent = nom;
  ligne.append(bouton, titre);
  return ligne;
}

function curseur(
  nom: string,
  bornes: () => { min: number; max: number; pas: number } | null,
  lire: () => number,
  ecrire: (valeur: number) => void,
  afficher: (valeur: number) => string,
): HTMLElement {
  const ligne = document.createElement('label');
  ligne.className = 'curseur';
  const titre = document.createElement('span');
  titre.textContent = nom;
  const entree = document.createElement('input');
  entree.type = 'range';
  const valeur = document.createElement('output');
  ligne.append(titre, entree, valeur);

  entree.addEventListener('input', () => {
    ecrire(Number(entree.value));
    appliquer();
  });
  rafraichir.push(() => {
    const b = bornes();
    entree.disabled = !b;
    if (b) {
      entree.min = String(b.min);
      entree.max = String(b.max);
      entree.step = String(b.pas);
    }
    entree.value = String(lire());
    valeur.textContent = b ? afficher(lire()) : '…';
  });
  return ligne;
}

const pourcent = (v: number) => `${Math.round(v * 100)} %`;

const ambiances = document.getElementById('ambiances')!;
for (const nom of Object.keys(AMBIANCES) as Ambiance[]) {
  ambiances.append(
    tete(
      nom,
      () => {
        if (!jouees.delete(nom)) jouees.add(nom);
        jouerLAmbiance([...jouees]);
        appliquer();
      },
      () => jouees.has(nom),
    ),
    curseur(
      'Volume',
      () => VOLUME,
      () => reglages.ambiances[nom],
      (v) => {
        reglages.ambiances[nom] = v;
        ajusterLAmbiance();
      },
      pourcent,
    ),
  );
}

const bruitages = document.getElementById('bruitages')!;
for (const nom of Object.keys(BRUITAGES) as Bruitage[]) {
  const max = () => {
    const duree = durees.get(nom);
    return duree === undefined ? undefined : Math.ceil(duree * 10) / 10;
  };
  bruitages.append(
    tete(nom, () => jouerBruitage(nom)),
    curseur(
      'Volume',
      () => VOLUME,
      () => reglages.bruitages[nom].volume,
      (v) => (reglages.bruitages[nom].volume = v),
      pourcent,
    ),
    curseur(
      'Durée',
      () => {
        const m = max();
        return m === undefined ? null : { ...DUREE, max: m };
      },
      () => reglages.bruitages[nom].duree ?? max() ?? 0,
      (v) => {
        const m = max();
        if (m !== undefined && v >= m) delete reglages.bruitages[nom].duree;
        else reglages.bruitages[nom].duree = v;
      },
      (v) => (reglages.bruitages[nom].duree === undefined ? 'entier' : `${v.toFixed(1)} s`),
    ),
  );
}

// Un contexte hors ligne : il décode sans geste du joueur, et sans rien jouer.
const decodeur = new OfflineAudioContext(1, 1, 44_100);
for (const nom of Object.keys(BRUITAGES) as Bruitage[]) {
  void fetch(BRUITAGES[nom])
    .then((reponse) => reponse.arrayBuffer())
    .then((octets) => decodeur.decodeAudioData(octets))
    .then((tampon) => {
      durees.set(nom, tampon.duration);
      appliquer();
    });
}

function appliquer() {
  for (const f of rafraichir) f();
  const bruit = ({ volume, duree }: { volume: number; duree?: number }) =>
    duree === undefined ? `{ volume: ${volume} }` : `{ volume: ${volume}, duree: ${duree} }`;
  sortie.textContent = [
    'export const REGLAGES_SONS: ReglagesSons = {',
    '  ambiances: {',
    ...Object.entries(reglages.ambiances).map(([nom, v]) => `    ${nom}: ${v},`),
    '  },',
    '  bruitages: {',
    ...Object.entries(reglages.bruitages).map(([nom, b]) => `    ${nom}: ${bruit(b)},`),
    '  },',
    '};',
  ].join('\n');
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

document.getElementById('revenir')!.addEventListener('click', () => {
  Object.assign(reglages, structuredClone(REGLAGES_SONS));
  ajusterLAmbiance();
  appliquer();
});

// Le point d'entrée est défini dans `vite.config.ts` : il n'existe qu'en
// développement, n'écrit qu'un fichier connu d'avance et ne garde que des
// valeurs bornées.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__sons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reglages),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.ok) throw new Error(resultat.erreur ?? reponse.statusText);
    sessionStorage.setItem(MEMOIRE, '1');
    dire('Enregistré ✓');
  } catch (err) {
    dire(`Échec : ${String(err)}`, true);
  }
});

function dire(texte: string, erreur = false) {
  statut.textContent = texte;
  statut.classList.toggle('is-erreur', erreur);
}

if (sessionStorage.getItem(MEMOIRE)) {
  sessionStorage.removeItem(MEMOIRE);
  dire('Enregistré ✓');
}

appliquer();
