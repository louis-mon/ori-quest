import Phaser from 'phaser';
import { COLORS } from '../config';

/**
 * Le socle commun aux deux marqueurs : un origami de l'artiste, posé au-dessus
 * du décor avec sa propre ombre portée.
 *
 * Les deux signes du jeu (game-design/03-langage-visuel.md) sont désormais des
 * pliages photographiés — la cocotte pour « ici, on analyse », la flèche pour
 * « ici, on change de scène ». Ils étaient dessinés en polygones dans le code
 * en attendant ces images ; ils ne le sont plus, et pour la même raison que le
 * reste du décor : un dessin qui *ressemble* à un pliage finit toujours par
 * mentir sur ce qu'est ce jeu.
 *
 * L'ombre n'est pas de la décoration. Ces deux origamis sont en papier clair, et
 * posés sur une rive au soleil ou sur une feuille blanche ils disparaissaient
 * — alors qu'ils sont le seul signe qui dise au joueur qu'il peut agir. Elle
 * remplace le détourage sombre que les silhouettes en polygones traçaient
 * elles-mêmes.
 */

/** Dilatation de l'ombre : ce qui en dépasse fait le liseré. */
const OMBRE_DILATATION = 1.12;
const OMBRE_ALPHA = 0.5;
/** Descente de l'ombre, en pixels du jeu : le marqueur flotte sur le décor. */
const OMBRE_DESCENTE = 3;

/** Profondeur des marqueurs : au-dessus de tout le décor. */
export const PROFONDEUR = 50;

/**
 * Charge la texture d'un marqueur, une seule fois pour tout le jeu.
 *
 * Chemin **relatif** : itch.io sert le jeu depuis un sous-dossier.
 */
export function preloadMarqueur(scene: Phaser.Scene, key: string, fichier: string): void {
  if (scene.textures.exists(key)) return;
  scene.load.image(key, fichier);
}

/**
 * Le marqueur et son ombre, dans un conteneur.
 *
 * Le conteneur est ce qui s'anime : échelle, opacité et angle s'appliquent à
 * l'ensemble, donc l'ombre suit le pliage au lieu de se décoller de lui.
 *
 * `hauteur` est la taille voulue à l'écran, en pixels du jeu (espace 1280x720).
 * L'image est mise à l'échelle depuis sa définition réelle : le fichier est
 * livré en double densité pour rester net sur un écran de téléphone.
 */
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
