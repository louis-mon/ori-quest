import Phaser from 'phaser';
import type { Box } from './layout';

// Les PNG sont livrés détourés et rognés sur leur boîte alpha (voir README) :
// la taille du fichier est celle du sujet, ce qui permet de les caler sur les
// boîtes du plan sans tâtonner.

// Une seule fois, même si deux scènes la demandent.
export function preloadSprite(scene: Phaser.Scene, key: string, fichier: string): void {
  if (scene.textures.exists(key)) return;
  // Chemin **relatif** : itch.io sert le jeu depuis un sous-dossier.
  scene.load.image(key, fichier);
}

// Le sujet tient entièrement dans la boîte, sans déformation, et calé sur le
// BAS : une boîte de plan marque une emprise au sol, et c'est le point d'appui
// qui doit rester fixe quand on redimensionne la zone dans l'éditeur.
//
// `'centre'` est l'exception, pour ce qui ne repose sur rien — le soleil.
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

// Presque toujours plus petite que la boîte du plan, le sujet n'y remplissant
// qu'une dimension. C'est elle, et pas la boîte, qui doit servir de zone
// tactile : sinon on « analyse » le renard en tapant 70 px au-dessus de sa tête.
export function empriseDe(image: Phaser.GameObjects.Image): Box {
  const bornes = image.getBounds();
  return { x: bornes.x, y: bornes.y, w: bornes.width, h: bornes.height };
}
