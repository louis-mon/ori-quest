import './orientation.css';
import { rendreOrigami } from '../origami/apercu';
import { POSES, quaternionDegres, repereVue, type Pose } from '../origami/vue';

/**
 * Outil de réglage de la pose des origamis — développement seulement.
 *
 * Le problème qu'il résout : rien dans un crease pattern ne dit comment le
 * modèle se présentera une fois plié. Où tombe le manche de la hache, de quel
 * côté est le tronc de l'arbre, à quel pourcentage la forme se lit — ça se
 * constate en regardant, et ça se règle à la main.
 *
 * Deux choix d'ergonomie, tirés de l'usage de la première version :
 *
 * - **On tourne à la souris**, pas au curseur. Trois angles d'Euler ne se
 *   pensent pas : on veut « fais pivoter ça vers la gauche », et le geste doit
 *   être celui-là. Les curseurs restent pour finir au degré près.
 * - **L'échelle ne bouge jamais.** Le rendu du jeu serre au plus près de la
 *   silhouette, donc l'image grandissait et rétrécissait à chaque degré, et on
 *   perdait le fil de ce qu'on regardait. Ici le cadre est stable (`cadreStable`)
 *   et c'est le zoom, réglé à part, qui décide de la taille.
 *
 * Le rendu passe par le **même code que le jeu** (`rendreOrigami`), donc ce
 * qu'on voit est exactement ce que le décor montrera : même angle de caméra,
 * mêmes papiers, même lumière.
 */

type Angles = [number, number, number];

/** Degrés de rotation pour un déplacement d'un pixel à la souris. */
const SENSIBILITE = 0.55;

/** Côté du rendu principal, en pixels. */
const TAILLE_APERCU = 460;

/** État courant, initialisé sur ce que le jeu utilise aujourd'hui. */
const reglages = new Map<string, Pose>(
  Object.entries(POSES).map(([nom, pose]) => [nom, { ...pose, angles: [...pose.angles] as Angles }]),
);

let courant = [...reglages.keys()][0];

/**
 * Le cadre stable est calé sur le **rayon** du modèle, donc sur sa plus grande
 * dimension : un modèle allongé y flotte au milieu de beaucoup de vide. Partir
 * un peu au-dessus de 1 lui rend une taille confortable sans rien coûter à la
 * stabilité — c'est le même cadre, simplement plus serré.
 */
let zoom = 1.3;

const liste = document.getElementById('liste')!;
const titre = document.getElementById('titre')!;
const apercu = document.getElementById('apercu')!;
const sortie = document.getElementById('sortie')!;
const curseursAngle = [...document.querySelectorAll<HTMLElement>('.curseur[data-axe]')];
const curseurPliage = document.getElementById('pliage') as HTMLInputElement;
const curseurEchelle = document.getElementById('echelle') as HTMLInputElement;
const curseurZoom = document.getElementById('zoom') as HTMLInputElement;
const valeurPliage = document.getElementById('valeur-pliage')!;
const valeurEchelle = document.getElementById('valeur-echelle')!;
const valeurZoom = document.getElementById('valeur-zoom')!;
const statut = document.getElementById('statut')!;

// ------------------------------------------------------------------
// Rendu
// ------------------------------------------------------------------

/**
 * Un seul rendu en vol à la fois, par modèle.
 *
 * Un glisser produit bien plus d'événements que le GPU ne rend d'images : sans
 * ce garde-fou, on empilerait une centaine de rendus en retard et le modèle
 * suivrait la souris avec plusieurs secondes de décalage. On garde la dernière
 * demande, on jette les autres.
 */
const enVol = new Set<string>();
const aRefaire = new Set<string>();

async function dessiner(nom: string, cible: HTMLElement, taille: number, avecZoom: boolean) {
  if (enVol.has(nom + taille)) {
    aRefaire.add(nom + taille);
    return;
  }
  enVol.add(nom + taille);
  try {
    const pose = reglages.get(nom)!;
    const canvas = await rendreOrigami(nom, {
      taille,
      pliage: pose.pliage,
      orientation: pose.angles,
      cadreStable: true,
      zoom: avecZoom ? zoom : 0.95,
    });
    cible.replaceChildren(canvas);
  } catch (err) {
    cible.textContent = String(err);
  } finally {
    enVol.delete(nom + taille);
    if (aRefaire.delete(nom + taille)) void dessiner(nom, cible, taille, avecZoom);
  }
}

function rafraichirApercu() {
  void dessiner(courant, apercu, TAILLE_APERCU, true);
}

function rafraichirMiniature(nom: string) {
  const vignette = liste.querySelector<HTMLElement>(`[data-modele="${nom}"] .vignette`);
  if (vignette) void dessiner(nom, vignette, 96, false);
}

// ------------------------------------------------------------------
// Liste des modèles
// ------------------------------------------------------------------

for (const nom of reglages.keys()) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.dataset.modele = nom;
  bouton.innerHTML = `<span class="vignette"></span><span class="nom">${nom}</span>`;
  bouton.addEventListener('click', () => choisir(nom));
  liste.appendChild(bouton);
  rafraichirMiniature(nom);
}

function choisir(nom: string) {
  courant = nom;
  for (const b of liste.querySelectorAll<HTMLElement>('[data-modele]')) {
    b.classList.toggle('is-actif', b.dataset.modele === nom);
  }
  titre.textContent = nom;
  poserCurseurs();
  rafraichirApercu();
}

// ------------------------------------------------------------------
// Curseurs
// ------------------------------------------------------------------

/** Recopie l'état courant dans les curseurs, sans relancer de rendu. */
function poserCurseurs() {
  const pose = reglages.get(courant)!;
  curseursAngle.forEach((ligne, i) => {
    const input = ligne.querySelector('input')!;
    input.value = String(Math.round(pose.angles[i]));
    ligne.querySelector('output')!.textContent = `${Math.round(pose.angles[i])}°`;
  });
  curseurPliage.value = String(pose.pliage);
  valeurPliage.textContent = `${Math.round(pose.pliage * 100)} %`;
  curseurEchelle.value = String(pose.echelle);
  valeurEchelle.textContent = `${pose.echelle.toFixed(2)}`;
  curseurZoom.value = String(zoom);
  valeurZoom.textContent = `${zoom.toFixed(2)}`;
}

curseursAngle.forEach((ligne, i) => {
  ligne.querySelector('input')!.addEventListener('input', (e) => {
    reglages.get(courant)!.angles[i] = Number((e.target as HTMLInputElement).value);
    poserCurseurs();
    ecrireSortie();
    rafraichirApercu();
    rafraichirMiniature(courant);
  });
});

curseurPliage.addEventListener('input', () => {
  reglages.get(courant)!.pliage = Number(curseurPliage.value);
  poserCurseurs();
  ecrireSortie();
  rafraichirApercu();
  rafraichirMiniature(courant);
});

curseurEchelle.addEventListener('input', () => {
  reglages.get(courant)!.echelle = Number(curseurEchelle.value);
  poserCurseurs();
  ecrireSortie();
});

curseurZoom.addEventListener('input', () => {
  zoom = Number(curseurZoom.value);
  poserCurseurs();
  rafraichirApercu();
});

/**
 * Annule les essais en cours et revient à la pose **du jeu** — celle qui est
 * écrite dans `POSES`, angles et pliage compris.
 *
 * C'est le seul retour en arrière qui ait un sens dans cet outil : on y tourne
 * un modèle pendant des dizaines d'essais, et ce qu'on veut retrouver n'est pas
 * une pose neutre mais celle qu'on avait validée la dernière fois.
 */
document.getElementById('revenir')!.addEventListener('click', () => {
  const enregistree = POSES[courant];
  if (!enregistree) return;
  reglages.set(courant, { ...enregistree, angles: [...enregistree.angles] as Angles });
  appliquerTout();
});

/**
 * Repose le modèle **face à la caméra**, comme la feuille au début de
 * l'animation : le point de départ naturel quand on ne sait plus où on en est.
 */
document.getElementById('face')!.addEventListener('click', async () => {
  const THREE = await import('three');
  const { oeil } = repereVue(THREE);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), oeil);
  reglages.get(courant)!.angles = versDegres(THREE, q);
  appliquerTout();
});

/**
 * Écrit les poses dans `src/origami/poses.ts`, par le serveur de développement.
 *
 * Recopier un bloc entre le navigateur et l'éditeur à chaque essai était le vrai
 * coût du réglage — on tourne un modèle vingt fois avant de trouver. Le point
 * d'entrée est défini dans `vite.config.ts` : il n'existe qu'en développement,
 * n'écrit qu'un fichier connu d'avance, et ne garde que des nombres bornés.
 *
 * Vite recharge la page dans la foulée, puisque le fichier qu'on vient d'écrire
 * est celui d'où l'outil tire son état. Le message de confirmation traverse ce
 * rechargement par `sessionStorage`, sans quoi on ne le verrait jamais.
 */
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__poses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(reglages)),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.ok) throw new Error(resultat.erreur ?? reponse.statusText);
    sessionStorage.setItem('poses-enregistrees', '1');
    dire('Enregistré ✓');
  } catch (err) {
    dire(`Échec : ${String(err)}`, true);
  }
});

function dire(texte: string, erreur = false) {
  statut.textContent = texte;
  statut.classList.toggle('is-erreur', erreur);
}

if (sessionStorage.getItem('poses-enregistrees')) {
  sessionStorage.removeItem('poses-enregistrees');
  dire('Enregistré ✓');
}

function appliquerTout() {
  poserCurseurs();
  ecrireSortie();
  rafraichirApercu();
  rafraichirMiniature(courant);
}

// ------------------------------------------------------------------
// Rotation à la souris
// ------------------------------------------------------------------

/**
 * Le geste : un glisser horizontal fait tourner le modèle autour de la
 * **verticale de l'écran**, un glisser vertical le fait basculer autour de
 * l'**horizontale de l'écran**.
 *
 * Ces deux axes sont ceux de l'image, pas ceux du monde — c'est toute la
 * différence entre « ça tourne comme je pousse » et trois curseurs dont il faut
 * deviner l'effet. `repereVue` les donne (voir vue.ts).
 *
 * La rotation est composée **à gauche** du quaternion courant : le nouveau tour
 * s'applique dans le repère de l'écran, indépendamment de la pose déjà prise.
 * Composée à droite, il aurait tourné dans le repère de l'objet et le geste
 * aurait changé de sens selon l'orientation en cours.
 */
apercu.addEventListener('pointerdown', (e) => {
  apercu.setPointerCapture(e.pointerId);
  apercu.classList.add('is-tourne');
  let dernierX = e.clientX;
  let dernierY = e.clientY;

  const bouger = async (ev: PointerEvent) => {
    const dx = ev.clientX - dernierX;
    const dy = ev.clientY - dernierY;
    dernierX = ev.clientX;
    dernierY = ev.clientY;
    if (dx === 0 && dy === 0) return;

    const THREE = await import('three');
    const { droite, haut } = repereVue(THREE);
    const rad = (Math.PI / 180) * SENSIBILITE;

    const pose = reglages.get(courant)!;
    const q = quaternionDegres(THREE, pose.angles);
    const tour = new THREE.Quaternion()
      .setFromAxisAngle(haut, dx * rad)
      .multiply(new THREE.Quaternion().setFromAxisAngle(droite, dy * rad));

    pose.angles = versDegres(THREE, tour.multiply(q));
    appliquerTout();
  };

  const lacher = (ev: PointerEvent) => {
    apercu.releasePointerCapture(ev.pointerId);
    apercu.classList.remove('is-tourne');
    apercu.removeEventListener('pointermove', bouger);
    apercu.removeEventListener('pointerup', lacher);
    apercu.removeEventListener('pointercancel', lacher);
  };

  apercu.addEventListener('pointermove', bouger);
  apercu.addEventListener('pointerup', lacher);
  apercu.addEventListener('pointercancel', lacher);
});

/** Quaternion -> trois angles en degrés, dans l'ordre X, Y, Z du jeu. */
function versDegres(
  THREE: typeof import('three'),
  q: import('three').Quaternion,
): Angles {
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  const deg = 180 / Math.PI;
  return [
    Math.round(e.x * deg * 10) / 10,
    Math.round(e.y * deg * 10) / 10,
    Math.round(e.z * deg * 10) / 10,
  ];
}

// ------------------------------------------------------------------
// Sortie
// ------------------------------------------------------------------

function ecrireSortie() {
  const lignes = [...reglages]
    .map(([nom, pose]) => {
      const angles = pose.angles.map((a) => Math.round(a)).join(', ');
      return `  ${nom}: { angles: [${angles}], pliage: ${pose.pliage}, echelle: ${pose.echelle} },`;
    })
    .join('\n');
  sortie.textContent = `export const POSES: Record<string, Pose> = {\n${lignes}\n};`;
}

choisir(courant);
ecrireSortie();
