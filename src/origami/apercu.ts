import type * as THREE_NS from 'three';
import { PREFERENCE_GPU } from '../gpu';
import { animationOrigami, sampleFold } from './fold-file';
import { creerMeshOrigami, libererMateriaux } from './papier';
import { eclairer, pliageDe, quaternionDegres, quaternionModele, repereVue } from './vue';

// L'image d'un origami plié, partout où le jeu montre un modèle sans le faire
// bouger. On rend le `.origami` lui-même : un dessin d'appoint finit toujours
// par diverger du modèle, et le joueur le remarque.

const TAILLE_DEFAUT = 384; // plus grand côté de l'image, en pixels
const MARGE = 0.06; // fraction de l'encombrement du modèle

export interface OptionsApercu {
  pliage?: number;
  taille?: number;
  // Sert à l'outil de réglage ; le jeu prend celle de `POSES`.
  orientation?: [number, number, number];
  // Échelle constante quelle que soit la rotation. Le cadrage normal serre sur
  // la silhouette, ce qu'il faut pour poser le modèle dans une boîte de scène,
  // mais dans l'outil de réglage l'image grandit alors à chaque degré.
  cadreStable?: boolean;
  // Dans le cadre stable. 1 = le modèle tient tout juste.
  zoom?: number;
}

// Un navigateur limite le nombre de contextes vivants (16 sur la plupart, moins
// sur certains mobiles) et détruit silencieusement les plus anciens : une scène
// qui rendrait trois modèles ferait disparaître la couche de pliage. D'où un
// contexte unique, recopié aussitôt dans un canvas 2D, qui n'a pas de limite.
let atelier: THREE_NS.WebGLRenderer | null = null;

function renderer(THREE: typeof THREE_NS): THREE_NS.WebGLRenderer {
  if (!atelier) {
    atelier = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      // La même carte que les deux autres contextes de la page, sinon le
      // compositeur recopie chaque frame de l'une à l'autre.
      powerPreference: PREFERENCE_GPU,
      // La lecture des pixels se fait après `render()` : sans ce drapeau, le
      // navigateur a le droit d'avoir déjà vidé le tampon.
      preserveDrawingBuffer: true,
    });
    atelier.setPixelRatio(1);
    atelier.setClearAlpha(0);

    // Un contexte perdu ne lève aucune erreur : le rendu continue de « marcher »
    // et ne produit plus que des images vides. On jette l'atelier et le cache,
    // sinon les images vides y resteraient.
    atelier.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[origami] contexte perdu : les images seront refaites');
      atelier = null;
      images.clear();
    });
  }
  return atelier;
}

const images = new Map<string, Promise<HTMLCanvasElement>>();

// Le cadrage serré n'est pas cosmétique : l'appelant pose l'image dans une boîte
// du plan de scène, et une marge transparente variable ferait flotter le modèle
// au-dessus du sol.
export function apercuOrigami(
  nom: string,
  options: OptionsApercu = {},
): Promise<HTMLCanvasElement> {
  const pliage = options.pliage ?? pliageDe(nom);
  const taille = options.taille ?? TAILLE_DEFAUT;
  const cle = `${nom}@${pliage}@${taille}`;

  // Tout réglage sur mesure court-circuite le cache : il ne sert qu'à l'outil,
  // qui rend en continu et le remplirait de poses jetables.
  if (options.orientation || options.cadreStable) return rendreOrigami(nom, options);

  let promesse = images.get(cle);
  if (!promesse) {
    promesse = rendreOrigami(nom, options);
    images.set(cle, promesse);
  }
  return promesse;
}

// En `data:`, pour un `<img>` de l'interface DOM.
export async function urlApercuOrigami(nom: string, options: OptionsApercu = {}): Promise<string> {
  return (await apercuOrigami(nom, options)).toDataURL('image/png');
}

// Sans passer par le cache. Exporté pour l'outil de réglage.
export async function rendreOrigami(
  nom: string,
  options: OptionsApercu = {},
): Promise<HTMLCanvasElement> {
  const pliage = options.pliage ?? pliageDe(nom);
  const taille = options.taille ?? TAILLE_DEFAUT;

  const THREE = await import('three');
  const anim = await animationOrigami(nom);

  const scene = new THREE.Scene();
  eclairer(THREE, scene);

  const { mesh, geometry, positions } = creerMeshOrigami(THREE, anim, nom);
  sampleFold(anim, pliage, positions);

  // Recentré avant d'être tourné, sinon il décrit un arc au lieu de pivoter sur
  // place : le solveur ne centre pas la pose finale sur l'origine.
  centrer(THREE, positions, anim.vertexCount);

  // L'orientation est cuite dans les positions plutôt que posée sur le mesh : le
  // cadrage mesure l'encombrement à même le tampon, et doit mesurer le modèle
  // tel qu'on le verra.
  tourner(
    THREE,
    positions,
    anim.vertexCount,
    options.orientation
      ? quaternionDegres(THREE, options.orientation)
      : quaternionModele(THREE, nom),
  );

  geometry.getAttribute('position').needsUpdate = true;
  geometry.computeVertexNormals();
  scene.add(mesh);

  const { oeil, droite, haut } = repereVue(THREE);

  // Encombrement projeté sur ces axes, et non boîte englobante alignée sur les
  // axes du monde : celle-ci laisserait des marges variant avec l'orientation.
  const etendue = (axe: THREE_NS.Vector3) => {
    let min = Infinity;
    let max = -Infinity;
    const p = new THREE.Vector3();
    for (let v = 0; v < anim.vertexCount; v++) {
      p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const d = p.dot(axe);
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { min, max, taille: max - min, centre: (min + max) / 2 };
  };

  const u = etendue(droite);
  const w = etendue(haut);
  const d = etendue(oeil);

  // Le cadre stable prend le rayon du modèle, invariant par rotation, pour que
  // tourner ne change pas la taille à l'écran.
  const stable = options.cadreStable === true;
  const demi = stable ? rayon(positions, anim.vertexCount) / (options.zoom ?? 1) : 0;

  const largeurMonde = stable ? demi * 2 : (u.taille || 1) * (1 + MARGE * 2);
  const hauteurMonde = stable ? demi * 2 : (w.taille || 1) * (1 + MARGE * 2);

  const centre = stable
    ? new THREE.Vector3()
    : new THREE.Vector3()
        .addScaledVector(droite, u.centre)
        .addScaledVector(haut, w.centre)
        .addScaledVector(oeil, d.centre);

  const recul = d.taille + Math.max(largeurMonde, hauteurMonde) + 1;
  const camera = new THREE.OrthographicCamera(
    -largeurMonde / 2,
    largeurMonde / 2,
    hauteurMonde / 2,
    -hauteurMonde / 2,
    0.01,
    recul * 2 + 2,
  );
  camera.position.copy(centre).addScaledVector(oeil, recul);
  camera.up.copy(haut);
  camera.lookAt(centre);

  // L'image reprend les proportions du modèle : pas de bande transparente à
  // rogner, et le rapport suffit à le poser dans le décor sans le déformer.
  const ratio = largeurMonde / hauteurMonde;
  const largeur = Math.max(16, Math.round(ratio >= 1 ? taille : taille * ratio));
  const hauteur = Math.max(16, Math.round(ratio >= 1 ? taille / ratio : taille));

  const gl = renderer(THREE);
  gl.setSize(largeur, hauteur, false);
  gl.render(scene, camera);

  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  canvas.getContext('2d')!.drawImage(gl.domElement, 0, 0, largeur, hauteur);

  // Le contexte WebGL est partagé et reste vivant ; ce modèle-ci, non.
  scene.remove(mesh);
  libererMateriaux(mesh);
  geometry.dispose();

  return canvas;
}

// Invariant par rotation : c'est ce qui donne au cadre stable une échelle qui ne
// bouge pas d'un degré à l'autre.
function rayon(positions: Float32Array, vertexCount: number): number {
  let max = 0;
  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    const d = Math.hypot(x, y, z);
    if (d > max) max = d;
  }
  return max || 1;
}

function centrer(THREE: typeof THREE_NS, positions: Float32Array, vertexCount: number) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const p = new THREE.Vector3();
  for (let v = 0; v < vertexCount; v++) {
    p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    min.min(p);
    max.max(p);
  }
  const centre = min.add(max).multiplyScalar(0.5);
  for (let v = 0; v < vertexCount; v++) {
    positions[v * 3] -= centre.x;
    positions[v * 3 + 1] -= centre.y;
    positions[v * 3 + 2] -= centre.z;
  }
}

function tourner(
  THREE: typeof THREE_NS,
  positions: Float32Array,
  vertexCount: number,
  q: THREE_NS.Quaternion,
) {
  const p = new THREE.Vector3();
  for (let v = 0; v < vertexCount; v++) {
    p.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]).applyQuaternion(q);
    positions[v * 3] = p.x;
    positions[v * 3 + 1] = p.y;
    positions[v * 3 + 2] = p.z;
  }
}
