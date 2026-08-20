import Phaser from 'phaser';
import type { Box } from './layout';
import { placeSprite, preloadSprite } from './decor-sprite';

/**
 * Le héros : la grenouille de papier, celle de l'artiste.
 *
 * Il est présent et analysable dans chaque scène — c'est le seul élément commun
 * à toutes les pièces, d'où ce module partagé plutôt qu'une copie par scène.
 * C'est le même modèle que la vignette de dialogue : le personnage qu'on voit
 * dans le décor et celui qui parle doivent être reconnaissables l'un dans
 * l'autre.
 */

const TEXTURE = 'heros';
const FICHIER = 'assets/decor/grenouille.png';

/** À appeler dans le `preload()` de la scène. */
export function preloadHeros(scene: Phaser.Scene): void {
  preloadSprite(scene, TEXTURE, FICHIER);
}

export function placeHeros(scene: Phaser.Scene, box: Box): Phaser.GameObjects.Image {
  return placeSprite(scene, TEXTURE, box);
}
