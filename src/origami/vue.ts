import type * as THREE_NS from 'three';
import { POSES } from './poses';

// L'angle et la lumière sont partagés par l'animation de pliage et par les
// images du décor : un modèle vu sous un angle pendant l'animation et sous un
// autre une fois posé dans la scène ne se reconnaît pas.

// Ces crease patterns sont plats — le solveur les replie dans leur propre plan,
// 0,4 unité de relief pour 1,4 de côté sur l'arbre. Un pliage est donc une
// silhouette, et ça se regarde de face : ~70° au-dessus de l'horizon. À 24°, on
// prenait la feuille par la tranche.
//
// Aucune composante en X : la moindre dérive latérale cisaille l'image et fait
// sortir la porte de travers.
export const DIRECTION_VUE = { x: 0, y: 0.94, z: -0.34 };

// Ne se déduit pas de la direction du regard : à la verticale d'un plan, le
// « haut » est un choix. -Z remet la feuille dans le sens du crease pattern.
export const HAUT_VUE = { x: 0, y: 0, z: -1 };

// `haut` vient de HAUT_VUE et non d'un produit vectoriel avec l'axe Y du monde,
// qui serait dégénéré — la caméra regarde justement le long de Y.
export function repereVue(THREE: typeof THREE_NS) {
  const oeil = new THREE.Vector3(DIRECTION_VUE.x, DIRECTION_VUE.y, DIRECTION_VUE.z).normalize();
  const vertical = new THREE.Vector3(HAUT_VUE.x, HAUT_VUE.y, HAUT_VUE.z);
  const droite = new THREE.Vector3().crossVectors(vertical, oeil).normalize();
  const haut = new THREE.Vector3().crossVectors(oeil, droite).normalize();
  return { oeil, droite, haut };
}

// Intensités volontairement plus basses que sur du papier blanc uni : les faces
// sont texturées, et une clé trop forte lave le grain du bois.
export function eclairer(THREE: typeof THREE_NS, scene: THREE_NS.Scene) {
  scene.add(new THREE.AmbientLight(0xfff4e6, 0.9));

  const cle = new THREE.DirectionalLight(0xffffff, 1.7);
  cle.position.set(2, 4, 3);
  scene.add(cle);

  const rappel = new THREE.DirectionalLight(0xc4553d, 0.55);
  rappel.position.set(-3, -1, -2);
  scene.add(rappel);
}

// Surtout pas 1 : la pose finale du solveur est souvent parfaitement plate, et
// un objet plat n'a plus rien d'un origami.
export const PLIAGE_DEFAUT = 0.86;

export interface Pose {
  // En degrés, dans l'ordre X puis Y puis Z, appliqués avant la caméra.
  angles: [number, number, number];
  // Le bon arrêt varie par modèle : le pont est plat à 100 % et doit s'arrêter
  // bien avant, un plissé a besoin d'aller presque au bout pour prendre forme.
  pliage: number;
}

// Rien dans un crease pattern ne dit où sera le manche une fois plié : ces
// valeurs se règlent à l'œil dans orientation.html, dont le bouton
// « Enregistrer » réécrit poses.ts. Ne pas les éditer à la main.
//
// La TAILLE dans le décor n'est pas ici : elle se dessine dans Tiled, où le
// modèle est ajusté à sa boîte. Deux endroits pour un même réglage, c'est un
// jour où l'un des deux change sans qu'on regarde l'autre.
export { POSES } from './poses';

const POSE_NEUTRE: Pose = { angles: [0, 0, 0], pliage: PLIAGE_DEFAUT };

export function poseDe(nom: string): Pose {
  return POSES[nom] ?? POSE_NEUTRE;
}

export function pliageDe(nom: string): number {
  return poseDe(nom).pliage;
}

export function quaternionDegres(
  THREE: typeof THREE_NS,
  [x, y, z]: [number, number, number],
): THREE_NS.Quaternion {
  const rad = Math.PI / 180;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x * rad, y * rad, z * rad, 'XYZ'));
}

export function quaternionModele(THREE: typeof THREE_NS, nom: string): THREE_NS.Quaternion {
  return quaternionDegres(THREE, poseDe(nom).angles);
}

// Orientation de départ de l'animation. Le pliage pivote de là vers
// l'orientation du modèle, donc la dernière image de l'animation est celle que
// le décor montrera ensuite.
export function quaternionFeuille(THREE: typeof THREE_NS): THREE_NS.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    repereVue(THREE).oeil,
  );
}

// quaternionFeuille suffit à démarrer une animation mais laisse le roulis au
// hasard, et la feuille arrive de travers de quelques degrés. La base est prise
// dans l'ordre (droite, oeil, -haut) parce que c'est la seule combinaison
// directe : avec +haut le déterminant vaut -1 et la matrice décrit une symétrie.
// Le modèle doit être centré sur l'origine, sinon la perspective refait un
// trapèze — c'est ce que garantit frameModel.
export function quaternionFeuilleDeFace(THREE: typeof THREE_NS): THREE_NS.Quaternion {
  const { oeil, droite, haut } = repereVue(THREE);
  const base = new THREE.Matrix4().makeBasis(droite, oeil, haut.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(base);
}
