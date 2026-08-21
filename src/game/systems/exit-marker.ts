import Phaser from 'phaser';
import { creerMarqueur, preloadMarqueur } from './marqueur-papier';

/**
 * Le marqueur de sortie : la flèche pliée de l'artiste — un carré de papier
 * dont le pli central retourne le verso sombre en pointe.
 *
 * Deux signes, deux fonctions (game-design/03-langage-visuel.md) : la cocotte
 * dit « ici, on analyse », la flèche dit « ici, on change de scène ». Ils ne
 * doivent jamais se confondre, et les deux pliages s'en chargent d'eux-mêmes —
 * la **forme** (un carré net contre une silhouette d'oiseau), la **valeur** (une
 * pointe sombre contre du papier clair) et le **mouvement** (une dérive
 * latérale souple contre un battement sur place).
 */

const TEXTURE = 'marqueur-fleche';
const FICHIER = 'assets/ui/fleche.png';

/**
 * Taille à l'écran, en pixels du jeu. Le carré porte moins loin que la cocotte
 * à surface égale — la pointe n'occupe que son centre — d'où quelques pixels de
 * plus.
 */
const HAUTEUR = 58;

/** À appeler dans le `preload()` d'une scène. */
export function preloadFleche(scene: Phaser.Scene): void {
  preloadMarqueur(scene, TEXTURE, FICHIER);
}

/**
 * Pose une flèche animée. `sens` vaut 1 vers la droite, -1 vers la gauche.
 *
 * Le pliage est photographié **pointant vers la gauche** : c'est donc la sortie
 * de droite qu'on retourne, l'inverse de ce que faisait la silhouette dessinée
 * qu'il remplace.
 *
 * La dérive est volontairement courte (6 px) et lente : sur un bord d'écran,
 * un mouvement ample attire l'œil hors du décor, ce que le langage visuel du
 * jeu refuse — le marqueur signale, il ne réclame pas.
 */
export function createExitMarker(
  scene: Phaser.Scene,
  x: number,
  y: number,
  sens: 1 | -1,
): Phaser.GameObjects.Container {
  const marker = creerMarqueur(scene, TEXTURE, x, y, HAUTEUR, sens > 0);

  scene.tweens.add({
    targets: marker,
    x: { from: x - 6 * sens, to: x + 6 * sens },
    alpha: { from: 0.55, to: 0.95 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return marker;
}
