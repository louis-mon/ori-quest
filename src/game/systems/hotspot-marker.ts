import Phaser from 'phaser';
import { creerMarqueur, preloadMarqueur } from './marqueur-papier';

/**
 * Le marqueur de hotspot : la cocotte en papier — la **pajarita**, l'oiseau
 * traditionnel espagnol, pas la salière à quatre volets qu'on manipule au bout
 * des doigts. C'est le pliage de l'artiste, photographié comme les personnages
 * et le reste du décor.
 *
 * Sur écran tactile il n'y a pas de survol, donc rien n'indique qu'un élément
 * est actif. Ce marqueur remplace le curseur qui change de forme.
 *
 * Voir game-design/03-langage-visuel.md — la cocotte signale « ici, on analyse »,
 * par opposition à la flèche qui signale « ici, on change de scène ».
 */

const TEXTURE = 'marqueur-cocotte';
const FICHIER = 'assets/ui/parajita.png';

/**
 * Taille à l'écran, en pixels du jeu. La silhouette de la pajarita tient dans
 * un carré : monter au-delà et elle rivalise avec les objets qu'elle désigne,
 * descendre en dessous et ses deux pointes — le bec, la queue — se referment.
 */
const HAUTEUR = 52;

/** À appeler dans le `preload()` d'une scène. */
export function preloadCocotte(scene: Phaser.Scene): void {
  preloadMarqueur(scene, TEXTURE, FICHIER);
}

/**
 * Pose un marqueur animé. Le battement lent doit rester discret : il signale
 * sans réclamer l'attention, sinon une scène à cinq hotspots clignote de partout.
 */
export function createHotspotMarker(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const marker = creerMarqueur(scene, TEXTURE, x, y, HAUTEUR);

  scene.tweens.add({
    targets: marker,
    scale: { from: 0.72, to: 1 },
    alpha: { from: 0.4, to: 0.9 },
    angle: { from: -8, to: 8 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return marker;
}
