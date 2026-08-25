import type * as THREE_NS from 'three';
import { PREFERENCE_GPU } from '../gpu';
import { animationOrigami, sampleFold } from './fold-file';
import { creerMeshOrigami, libererMateriaux } from './papier';
import { eclairer, pliageDe, quaternionDegres, quaternionModele, repereVue } from './vue';

/**
 * L'image d'un origami plié — la même partout où le jeu doit *montrer* un
 * modèle sans le faire bouger : dans le décor une fois le pliage joué, dans
 * l'inventaire, et comme but à atteindre pendant l'énigme.
 *
 * Rien n'est dessiné à la main : on rend le modèle `.origami` lui-même, avec
 * ses textures et sa lumière. C'est la seule façon de garantir que ce que le
 * joueur voit dans la scène est bien ce qu'il vient de plier — un dessin
 * d'appoint finit toujours par diverger du modèle, et le joueur le remarque.
 *
 * Le taux de pliage n'est jamais 1, et se règle par modèle : voir `POSES`
 * dans `vue.ts`.
 */

/** Plus grand côté de l'image produite, en pixels. */
const TAILLE_DEFAUT = 384;

/** Marge autour du modèle, en fraction de son encombrement. */
const MARGE = 0.06;

export interface OptionsApercu {
  /** Taux de pliage, de 0 (à plat) à 1 (pose finale du solveur). */
  pliage?: number;
  /** Plus grand côté de l'image, en pixels. */
  taille?: number;
  /**
   * Orientation en degrés, à la place de celle du modèle (`POSES`).
   * Sert à l'outil de réglage ; le jeu n'a jamais besoin de la préciser.
   */
  orientation?: [number, number, number];
  /**
   * Cadre **carré et stable** : le modèle garde exactement la même taille à
   * l'écran quelle que soit sa rotation, et l'image fait `taille` × `taille`.
   *
   * Le cadrage normal serre au plus près de la silhouette, ce qu'il faut pour
   * poser le modèle dans une boîte de scène — mais dans un outil de réglage,
   * ça donne une image qui grandit et rétrécit à chaque degré, et on ne sait
   * plus ce qu'on regarde.
   */
  cadreStable?: boolean;
  /** Agrandissement dans le cadre stable. 1 = le modèle tient tout juste. */
  zoom?: number;
}

// ------------------------------------------------------------------
// Ressources partagées
// ------------------------------------------------------------------

/**
 * Un seul contexte WebGL pour toutes les images, redimensionné à la demande.
 *
 * Un navigateur limite le nombre de contextes vivants (16 sur la plupart, moins
 * sur certains mobiles) et détruit silencieusement les plus anciens quand on
 * dépasse. Une scène qui rendrait trois modèles ferait donc disparaître la
 * couche de pliage. Ici le contexte est unique et le résultat est recopié tout
 * de suite dans un canvas 2D, qui lui n'a pas de limite.
 */
let atelier: THREE_NS.WebGLRenderer | null = null;

function renderer(THREE: typeof THREE_NS): THREE_NS.WebGLRenderer {
  if (!atelier) {
    atelier = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      // La même carte que les deux autres contextes de la page, sinon le
      // compositeur recopie chaque frame de l'une à l'autre. Voir `gpu.ts`.
      powerPreference: PREFERENCE_GPU,
      // La lecture des pixels se fait après `render()` : sans ce drapeau, le
      // navigateur a le droit d'avoir déjà vidé le tampon.
      preserveDrawingBuffer: true,
    });
    atelier.setPixelRatio(1);
    atelier.setClearAlpha(0);

    // Un contexte perdu — mise en veille de l'onglet, réinitialisation du
    // pilote, trop de contextes ailleurs dans la page — ne lève aucune erreur :
    // le rendu continue de « marcher » et ne produit plus que des images vides.
    // C'est ainsi que le but de l'énigme et les vignettes disparaissaient sans
    // que rien ne le dise. On jette l'atelier **et** le cache : la prochaine
    // demande refabrique l'un et refait l'autre.
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

/**
 * Rend un modèle plié dans un canvas 2D à fond transparent, taillé au plus
 * juste autour de la silhouette.
 *
 * Le cadrage serré n'est pas cosmétique : l'appelant pose l'image dans une
 * boîte du plan de scène, et une marge transparente variable ferait flotter le
 * modèle au-dessus du sol sans qu'on comprenne pourquoi.
 */
export function apercuOrigami(
  nom: string,
  options: OptionsApercu = {},
): Promise<HTMLCanvasElement> {
  const pliage = options.pliage ?? pliageDe(nom);
  const taille = options.taille ?? TAILLE_DEFAUT;
  const cle = `${nom}@${pliage}@${taille}`;

  // Tout réglage sur mesure court-circuite le cache : il ne sert qu'à l'outil,
  // qui rend en continu et remplirait la table de poses jetables.
  if (options.orientation || options.cadreStable) return rendreOrigami(nom, options);

  let promesse = images.get(cle);
  if (!promesse) {
    promesse = rendreOrigami(nom, options);
    images.set(cle, promesse);
  }
  return promesse;
}

/** Même chose, en `data:` — pour un `<img>` de l'interface DOM. */
export async function urlApercuOrigami(nom: string, options: OptionsApercu = {}): Promise<string> {
  return (await apercuOrigami(nom, options)).toDataURL('image/png');
}

/** Rend sans passer par le cache. Exporté pour l'outil de réglage. */
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

  // Le modèle est **recentré sur lui-même avant d'être tourné**, sinon il
  // décrit un arc au lieu de pivoter sur place : le solveur ne garantit pas que
  // la pose finale soit centrée sur l'origine.
  centrer(THREE, positions, anim.vertexCount);

  // L'orientation est **cuite dans les positions** plutôt que posée sur le
  // mesh : le cadrage plus bas mesure l'encombrement à même le tampon, et il
  // doit mesurer le modèle tel qu'on le verra, pas tel qu'il sort du solveur.
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

  // Encombrement du modèle **projeté** sur ces axes : c'est ce que la caméra
  // doit cadrer, et non la boîte englobante alignée sur les axes du monde, qui
  // laisserait des marges différentes selon l'orientation du pliage.
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

  // Deux cadrages, pour deux usages. Le cadre **stable** garde une échelle
  // constante — le rayon du modèle, invariant par rotation — pour que tourner
  // ne change plus la taille à l'écran. Le cadrage normal serre sur la
  // silhouette, ce qu'il faut pour poser l'image dans une boîte de scène sans
  // marge transparente.
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
  // rogner ensuite, et le rapport largeur/hauteur suffit à le poser dans le
  // décor sans le déformer.
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

/**
 * Rayon du modèle autour de l'origine.
 *
 * Invariant par rotation — c'est tout l'intérêt : il donne au cadre stable une
 * échelle qui ne bouge pas d'un degré à l'autre.
 */
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

/** Ramène le centre de la boîte englobante sur l'origine, sur place. */
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

/** Applique une rotation à un tampon de positions, sur place. */
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
