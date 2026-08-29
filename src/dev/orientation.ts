import './orientation.css';
import { rendreOrigami } from '../origami/apercu';
import { POSES, quaternionDegres, repereVue, type Pose } from '../origami/vue';

// Outil de réglage de la pose des origamis — développement seulement. Rien dans
// un crease pattern ne dit où tombera le manche de la hache : ça se constate en
// regardant, et ça se règle à la main.
//
// On tourne à la souris et pas au curseur — trois angles d'Euler ne se pensent
// pas —, les curseurs restant pour finir au degré près. Et l'échelle ne bouge
// jamais : le rendu du jeu serre au plus près de la silhouette, donc l'image
// grandissait à chaque degré. D'où `cadreStable`, le zoom décidant de la taille.
//
// Le rendu passe par le même code que le jeu, donc ce qu'on voit est ce que le
// décor montrera.

type Angles = [number, number, number];

// Degrés de rotation pour un déplacement d'un pixel à la souris.
const SENSIBILITE = 0.55;

// Côté du rendu principal, en pixels.
const TAILLE_APERCU = 460;

// État courant, initialisé sur ce que le jeu utilise aujourd'hui.
const reglages = new Map<string, Pose>(
  Object.entries(POSES).map(([nom, pose]) => [
    nom,
    { ...pose, angles: [...pose.angles] as Angles },
  ]),
);

let courant = [...reglages.keys()][0];

// Le cadre stable est calé sur le rayon du modèle, donc sur sa plus grande
// dimension : un modèle allongé y flotte au milieu de beaucoup de vide. Partir
// au-dessus de 1 lui rend une taille confortable sans coûter à la stabilité.
let zoom = 1.3;

const liste = document.getElementById('liste')!;
const titre = document.getElementById('titre')!;
const apercu = document.getElementById('apercu')!;
const sortie = document.getElementById('sortie')!;
const curseursAngle = [...document.querySelectorAll<HTMLElement>('.curseur[data-axe]')];
const curseurPliage = document.getElementById('pliage') as HTMLInputElement;
const curseurZoom = document.getElementById('zoom') as HTMLInputElement;
const valeurPliage = document.getElementById('valeur-pliage')!;
const valeurZoom = document.getElementById('valeur-zoom')!;
const statut = document.getElementById('statut')!;

// ------------------------------------------------------------------
// Rendu
// ------------------------------------------------------------------

// Un glisser produit bien plus d'événements que le GPU ne rend d'images : sans
// ce garde-fou on empile une centaine de rendus en retard et le modèle suit la
// souris avec plusieurs secondes de décalage.
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

// Sans relancer de rendu.
function poserCurseurs() {
  const pose = reglages.get(courant)!;
  curseursAngle.forEach((ligne, i) => {
    const input = ligne.querySelector('input')!;
    input.value = String(Math.round(pose.angles[i]));
    ligne.querySelector('output')!.textContent = `${Math.round(pose.angles[i])}°`;
  });
  curseurPliage.value = String(pose.pliage);
  valeurPliage.textContent = `${Math.round(pose.pliage * 100)} %`;
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

curseurZoom.addEventListener('input', () => {
  zoom = Number(curseurZoom.value);
  poserCurseurs();
  rafraichirApercu();
});

// Revient à la pose écrite dans `POSES` : après des dizaines d'essais, ce qu'on
// veut retrouver n'est pas une pose neutre mais celle validée la dernière fois.
document.getElementById('revenir')!.addEventListener('click', () => {
  const enregistree = POSES[courant];
  if (!enregistree) return;
  reglages.set(courant, { ...enregistree, angles: [...enregistree.angles] as Angles });
  appliquerTout();
});

// Face à la caméra, comme la feuille au début de l'animation : le point de
// départ naturel quand on ne sait plus où on en est.
document.getElementById('face')!.addEventListener('click', async () => {
  const THREE = await import('three');
  const { oeil } = repereVue(THREE);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), oeil);
  reglages.get(courant)!.angles = versDegres(THREE, q);
  appliquerTout();
});

// Le point d'entrée est défini dans `vite.config.ts` : il n'existe qu'en
// développement, n'écrit qu'un fichier connu d'avance et ne garde que des
// nombres bornés.
//
// Vite recharge la page dans la foulée, puisque le fichier qu'on vient d'écrire
// est celui d'où l'outil tire son état : d'où le message de confirmation qui
// traverse le rechargement par `sessionStorage`.
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

// Les deux axes sont ceux de l'IMAGE et non du monde : c'est la différence entre
// « ça tourne comme je pousse » et trois curseurs dont il faut deviner l'effet.
//
// La rotation est composée À GAUCHE du quaternion courant, donc dans le repère
// de l'écran. Composée à droite, elle tournerait dans le repère de l'objet et le
// geste changerait de sens selon l'orientation en cours.
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

// Quaternion -> trois angles en degrés, dans l'ordre X, Y, Z du jeu.
function versDegres(THREE: typeof import('three'), q: import('three').Quaternion): Angles {
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
      return `  ${nom}: { angles: [${angles}], pliage: ${pose.pliage} },`;
    })
    .join('\n');
  sortie.textContent = `export const POSES: Record<string, Pose> = {\n${lignes}\n};`;
}

choisir(courant);
ecrireSortie();
