import type * as THREE_NS from 'three';
import { POSES } from './poses';

/**
 * Comment on regarde un origami — l'angle et la lumière, partagés par
 * l'animation de pliage et les images du décor.
 *
 * Partagés, parce qu'un modèle vu sous un angle pendant l'animation et sous un
 * autre une fois posé dans la scène ne se reconnaît pas : le joueur vient de
 * regarder le papier se plier, il doit retrouver *cet objet-là* devant lui.
 */

/**
 * Direction depuis laquelle on regarde (du modèle vers la caméra), normalisée.
 *
 * Les modèles sortent d'Origami Simulator **à plat dans le plan XZ**, et ces
 * crease patterns sont tous *plats* : le solveur les replie dans leur propre
 * plan, il n'en sort presque rien (0,4 unité de relief pour 1,4 de côté sur
 * l'arbre). Le modèle plié n'est donc pas un volume, c'est une **silhouette** —
 * et une silhouette ne se lit que de face.
 *
 * D'où une caméra presque à la verticale du papier, à ~70° au-dessus de
 * l'horizon : on voit la forme, exactement comme sur la vue de pliage d'ORIPA.
 * L'ancienne caméra, à 24°, prenait la feuille par la tranche — on regardait
 * une arête. Les 20° qui restent, eux, sont ce qui donne le relief : les rabats
 * accrochent la lumière et on voit que c'est du papier posé, pas un dessin.
 *
 * **Aucune composante en X**, et c'est délibéré : la moindre dérive latérale
 * cisaille l'image, et un modèle rectangulaire — la porte — en sort de travers
 * sans qu'on comprenne pourquoi. La caméra reste dans le plan YZ, les verticales
 * du papier restent verticales à l'écran. L'inclinaison propre à chaque modèle
 * se règle dans `POSES`, pas ici.
 */
export const DIRECTION_VUE = { x: 0, y: 0.94, z: -0.34 };

/**
 * Vecteur du monde qui doit pointer **vers le haut** dans l'image.
 *
 * Il ne se déduit pas de la direction du regard : à la verticale d'un plan, le
 * « haut » est un choix, et c'est celui qui décide de l'orientation du modèle à
 * l'écran. `-Z` remet la feuille dans le sens du crease pattern — le haut du
 * dessin en haut de l'image — donc le manche de la hache vers le bas et sa tête
 * en l'air, plutôt que couchée.
 */
export const HAUT_VUE = { x: 0, y: 0, z: -1 };

/**
 * Le repère de l'image : la direction du regard, et les deux axes de l'écran
 * exprimés dans le monde.
 *
 * `haut` ne se déduit pas du regard — à la verticale d'un plan, le « haut » est
 * un choix (voir `HAUT_VUE`), et le produit vectoriel avec l'axe Y du monde
 * serait de toute façon dégénéré puisque la caméra regarde justement le long
 * de Y.
 *
 * Sert au cadrage des images fixes, et à l'outil de réglage : faire tourner un
 * modèle **à la souris** demande de savoir quels axes du monde correspondent au
 * gauche-droite et au haut-bas de l'écran.
 */
export function repereVue(THREE: typeof THREE_NS) {
  const oeil = new THREE.Vector3(DIRECTION_VUE.x, DIRECTION_VUE.y, DIRECTION_VUE.z).normalize();
  const vertical = new THREE.Vector3(HAUT_VUE.x, HAUT_VUE.y, HAUT_VUE.z);
  const droite = new THREE.Vector3().crossVectors(vertical, oeil).normalize();
  const haut = new THREE.Vector3().crossVectors(oeil, droite).normalize();
  return { oeil, droite, haut };
}

/**
 * Pose les trois lumières du jeu sur une scène three.js.
 *
 * Une clé chaude au-dessus, un ambiant doux pour que les faces en contre-jour
 * gardent leur texture, et un rappel rouge dans le dos — l'accent du jeu, qui
 * détache la silhouette du fond sombre du décor.
 *
 * Les intensités sont volontairement plus basses que sur du papier blanc uni :
 * les faces sont texturées, et une clé trop forte lave le grain du bois et
 * fait déborder le blanc du papier.
 */
export function eclairer(THREE: typeof THREE_NS, scene: THREE_NS.Scene) {
  scene.add(new THREE.AmbientLight(0xfff4e6, 0.9));

  const cle = new THREE.DirectionalLight(0xffffff, 1.7);
  cle.position.set(2, 4, 3);
  scene.add(cle);

  const rappel = new THREE.DirectionalLight(0xc4553d, 0.55);
  rappel.position.set(-3, -1, -2);
  scene.add(rappel);
}

/**
 * Taux de pliage par défaut, pour un modèle sans pose déclarée.
 *
 * Surtout pas 1. La pose finale du solveur est souvent parfaitement plate — le
 * pont y perd toute épaisseur — et l'image d'un objet plat n'a plus rien d'un
 * origami. Un cheveu avant la fin, les rabats gardent leur angle, la lumière
 * accroche les faces, et la forme se lit en volume.
 */
export const PLIAGE_DEFAUT = 0.86;

// ------------------------------------------------------------------
// La pose de chaque modèle
// ------------------------------------------------------------------

export interface Pose {
  /**
   * Rotation du modèle, en degrés, appliquée dans l'ordre X puis Y puis Z,
   * **avant** la caméra.
   */
  angles: [number, number, number];
  /**
   * Taux de pliage auquel on montre le modèle : la fin de l'animation, et la
   * pose des images fixes (décor, inventaire, but de l'énigme).
   *
   * Par modèle, parce que le bon arrêt ne se situe pas au même endroit pour
   * tous : le pont est plat à 100 % et doit s'arrêter bien avant, tandis qu'un
   * plissé a besoin d'aller presque jusqu'au bout pour que sa forme apparaisse.
   */
  pliage: number;
  /**
   * Taille du modèle **dans le décor**, en multiple de sa taille par défaut.
   *
   * Elle est là parce que la taille sur scène ne se déduit pas de la boîte du
   * plan seule : le modèle y est ajusté sans déformation, donc une silhouette
   * longue et fine n'occupe qu'une fraction de son emprise là où une silhouette
   * carrée la remplit. Deux modèles dans deux boîtes identiques n'ont donc pas
   * la même présence, et régler ça en agrandissant la boîte déplacerait aussi
   * la feuille encore dépliée, qui partage la même emprise.
   *
   * N'agit **que sur le décor** : l'inventaire et le but de l'énigme ont leurs
   * propres cases, et l'animation son propre cadre.
   */
  echelle: number;
}

/**
 * Comment chaque pliage se présente au joueur.
 *
 * Pourquoi tourner le modèle plutôt que la caméra : l'angle de vue est commun à
 * tout le jeu (voir `DIRECTION_VUE`), alors que la bonne façon de présenter un
 * objet dépend de l'objet. Un pont se regarde de biais, une hache manche en bas,
 * un arbre tronc au sol — trois poses qu'aucune caméra unique ne donne.
 *
 * Ces valeurs ne se devinent pas : rien dans un crease pattern ne dit où sera le
 * manche une fois plié. Elles se règlent à l'œil, dans l'outil interactif :
 *
 *     npm run dev  puis  http://localhost:5173/orientation.html
 *
 * On y tourne le modèle à la souris, on règle le pliage et la taille, et
 * « Enregistrer » réécrit `poses.ts`. C'est pour ça que les valeurs vivent dans
 * un fichier à part : celui-là est écrit par une machine, celui-ci par des
 * humains.
 */
export { POSES } from './poses';

const POSE_NEUTRE: Pose = { angles: [0, 0, 0], pliage: PLIAGE_DEFAUT, echelle: 1 };

/** La pose d'un modèle, ou une pose neutre s'il n'en a pas encore. */
export function poseDe(nom: string): Pose {
  return POSES[nom] ?? POSE_NEUTRE;
}

/** Taux de pliage auquel on montre ce modèle. */
export function pliageDe(nom: string): number {
  return poseDe(nom).pliage;
}

/** Taille de ce modèle dans le décor, en multiple de sa taille d'ajustement. */
export function echelleDe(nom: string): number {
  return poseDe(nom).echelle;
}

/** Quaternion d'une rotation donnée en degrés, dans l'ordre X, Y, Z. */
export function quaternionDegres(
  THREE: typeof THREE_NS,
  [x, y, z]: [number, number, number],
): THREE_NS.Quaternion {
  const rad = Math.PI / 180;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x * rad, y * rad, z * rad, 'XYZ'));
}

/** Quaternion de l'orientation finale d'un modèle. */
export function quaternionModele(THREE: typeof THREE_NS, nom: string): THREE_NS.Quaternion {
  return quaternionDegres(THREE, poseDe(nom).angles);
}

/**
 * Orientation de départ de l'animation : la feuille **bien en face**, sa normale
 * pointée sur la caméra.
 *
 * C'est la pose d'une feuille qu'on vient de poser devant soi pour la plier. Le
 * pliage part de là et pivote vers l'orientation du modèle au fur et à mesure —
 * on voit donc l'objet *se tourner vers sa position définitive* en même temps
 * qu'il se plie, et la dernière image de l'animation est exactement celle que le
 * décor montrera ensuite.
 */
export function quaternionFeuille(THREE: typeof THREE_NS): THREE_NS.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    repereVue(THREE).oeil,
  );
}
