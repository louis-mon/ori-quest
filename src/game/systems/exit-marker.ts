import Phaser from 'phaser';
import { battre, creerMarqueur, preloadMarqueur } from './marqueur-papier';

// La flèche dit « ici, on change de scène », la cocotte « ici, on analyse » :
// ils ne doivent jamais se confondre, d'où trois différences tenues ensemble —
// la forme, la valeur et le mouvement.

const TEXTURE = 'marqueur-fleche';
const FICHIER = 'assets/ui/fleche.png';

// En pixels du jeu. Le carré porte moins loin que la cocotte à surface égale, la
// pointe n'occupant que son centre : d'où quelques pixels de plus.
const HAUTEUR = 58;

// À appeler dans le `preload()` d'une scène.
export function preloadFleche(scene: Phaser.Scene): void {
  preloadMarqueur(scene, TEXTURE, FICHIER);
}

// `sens` vaut 1 vers la droite, -1 vers la gauche. Le pliage est photographié
// pointant vers la GAUCHE, c'est donc la sortie de droite qu'on retourne.
//
// La dérive est courte et lente : sur un bord d'écran, un mouvement ample attire
// l'œil hors du décor. Le marqueur signale, il ne réclame pas.
export function createExitMarker(
  scene: Phaser.Scene,
  x: number,
  y: number,
  sens: 1 | -1,
): Phaser.GameObjects.Container {
  const marker = creerMarqueur(scene, TEXTURE, x, y, HAUTEUR, sens > 0);

  battre(marker, {
    x: { from: x - 6 * sens, to: x + 6 * sens },
    alpha: { from: 0.55, to: 0.95 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return marker;
}
