import Phaser from 'phaser';
import type { Box } from './layout';

/**
 * Les origamis de l'artiste, posés dans le décor.
 *
 * Les PNG sont livrés détourés sur fond transparent ; l'intégration les rogne
 * sur leur boîte alpha et les réduit (voir README). Ils arrivent donc **sans
 * marge** : la taille du fichier est celle du sujet, ce qui permet de les caler
 * sur les boîtes du plan sans tâtonner.
 */

/** Charge une texture une seule fois, même si deux scènes la demandent. */
export function preloadSprite(scene: Phaser.Scene, key: string, fichier: string): void {
  if (scene.textures.exists(key)) return;
  // Chemin **relatif** : itch.io sert le jeu depuis un sous-dossier.
  scene.load.image(key, fichier);
}

/**
 * Pose un sprite dans une boîte du plan.
 *
 * Le sujet est mis à l'échelle pour tenir **entièrement** dans la boîte, sans
 * déformation, et il est calé sur le **bas** : une boîte de plan marque une
 * emprise au sol, et c'est le point d'appui qui doit rester fixe quand on
 * redimensionne la zone dans l'éditeur. Centrer verticalement ferait flotter
 * les personnages dès que la boîte change de proportion.
 *
 * L'ancrage `'centre'` est l'exception, pour ce qui ne repose sur rien — le
 * soleil dans son coin de ciel. Calé sur le bas, il glisserait vers le haut ou
 * vers le bas de sa boîte selon les proportions qu'on lui donne dans Tiled.
 */
export function placeSprite(
  scene: Phaser.Scene,
  key: string,
  box: Box,
  ancrage: 'bas' | 'centre' = 'bas',
): Phaser.GameObjects.Image {
  const centre = ancrage === 'centre';
  const image = scene.add
    .image(box.x + box.w / 2, box.y + (centre ? box.h / 2 : box.h), key)
    .setOrigin(0.5, centre ? 0.5 : 1);
  const source = scene.textures.get(key).getSourceImage();
  const echelle = Math.min(box.w / source.width, box.h / source.height);
  image.setScale(echelle);
  return image;
}

/**
 * Emprise réellement occupée par un sprite à l'écran.
 *
 * Elle est presque toujours plus petite que la boîte du plan : le sujet y est
 * ajusté sans déformation, donc il ne remplit que l'une des deux dimensions.
 * C'est cette emprise-là, et pas la boîte, qui doit servir de zone tactile —
 * sinon on « analyse » le renard en tapant 70 px au-dessus de sa tête.
 */
export function empriseDe(image: Phaser.GameObjects.Image): Box {
  const bornes = image.getBounds();
  return { x: bornes.x, y: bornes.y, w: bornes.width, h: bornes.height };
}
