import Phaser from 'phaser';
import { COLORS } from '../config';

// Le socle des deux marqueurs (game-design/03-langage-visuel.md) : un origami de
// l'artiste posé au-dessus du décor.
//
// L'ombre n'est pas décorative : ces deux pliages sont en papier clair, et posés
// sur une rive au soleil ils disparaissaient — alors qu'ils sont le seul signe
// qui dise au joueur qu'il peut agir.

// Dilatation de l'ombre : ce qui en dépasse fait le liseré.
const OMBRE_DILATATION = 1.12;
const OMBRE_ALPHA = 0.5;
// En pixels du jeu : le marqueur flotte sur le décor.
const OMBRE_DESCENTE = 3;

// Au-dessus de tout le décor.
export const PROFONDEUR = 50;

// Chemin relatif : itch.io sert le jeu depuis un sous-dossier.
export function preloadMarqueur(scene: Phaser.Scene, key: string, fichier: string): void {
  if (scene.textures.exists(key)) return;
  scene.load.image(key, fichier);
}

// C'est le conteneur qui s'anime, donc l'ombre suit le pliage au lieu de se
// décoller de lui. `hauteur` est la taille voulue en pixels du jeu ; le fichier
// est livré en double densité pour rester net sur un téléphone.
export function creerMarqueur(
  scene: Phaser.Scene,
  texture: string,
  x: number,
  y: number,
  hauteur: number,
  miroir = false,
): Phaser.GameObjects.Container {
  const source = scene.textures.get(texture).getSourceImage();
  const echelle = hauteur / source.height;

  const ombre = scene.add
    .image(0, OMBRE_DESCENTE, texture)
    .setScale(echelle * OMBRE_DILATATION)
    .setTint(COLORS.ink)
    .setAlpha(OMBRE_ALPHA)
    .setFlipX(miroir);

  const dessin = scene.add.image(0, 0, texture).setScale(echelle).setFlipX(miroir);

  return scene.add.container(x, y, [ombre, dessin]).setDepth(PROFONDEUR);
}
