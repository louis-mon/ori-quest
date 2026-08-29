import Phaser from 'phaser';
import { battre, creerMarqueur, preloadMarqueur } from './marqueur-papier';

// La cocotte : la pajarita, l'oiseau traditionnel espagnol, pas la salière à
// quatre volets. Sur écran tactile il n'y a pas de survol, donc rien n'indique
// qu'un élément est actif : ce marqueur remplace le curseur qui change de forme.

const TEXTURE = 'marqueur-cocotte';
const FICHIER = 'assets/ui/parajita.png';

// En pixels du jeu. Au-delà, elle rivalise avec les objets qu'elle désigne ; en
// dessous, ses deux pointes — le bec, la queue — se referment.
const HAUTEUR = 52;

// À appeler dans le `preload()` d'une scène.
export function preloadCocotte(scene: Phaser.Scene): void {
  preloadMarqueur(scene, TEXTURE, FICHIER);
}

// Le battement reste lent et discret : sinon une scène à cinq hotspots clignote
// de partout.
export function createHotspotMarker(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const marker = creerMarqueur(scene, TEXTURE, x, y, HAUTEUR);

  battre(marker, {
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
