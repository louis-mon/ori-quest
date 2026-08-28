import Phaser from 'phaser';
import { preloadSprite } from './decor-sprite';

// Le terrain est une image de l'artiste, pas des aplats : les aplats tenaient la
// place et divergeaient de ce qui était livré, même travers que les dessins « qui
// ressemblent » aux pliages.
//
// Le ciel, lui, reste peint : le fond est livré transparent au-dessus de
// l'horizon, ce qui laisse les nuages dériver derrière le rempart sans découper
// l'image.
//
// L'image, sa position et sa taille viennent d'un calque image de classe `fond`
// dans la carte Tiled, qui pointe le fichier de `public/` : on place donc les
// zones tactiles sur les pixels exacts que le joueur aura sous les yeux.

// Ce que `npm run scenes` tire du calque `fond` de la carte.
export interface PlanFond {
  // Chemin relatif servi au jeu — `assets/decor/fond-pont.webp`.
  readonly image: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// Entre les nuages (-10) et le décor (0).
const PROFONDEUR_FOND = -5;

// Une texture par scène : deux fonds ne partagent jamais la même image.
const cleDe = (fond: PlanFond) => `fond-${fond.image}`;

// À appeler dans le `preload()` de la scène.
export function preloadFond(scene: Phaser.Scene, fond: PlanFond): void {
  preloadSprite(scene, cleDe(fond), fond.image);
}

// `setDisplaySize` plutôt que la taille naturelle : les deux coïncident, l'import
// refusant une carte où elles ont divergé, mais le dire garantit qu'un fichier
// remplacé en douce ne change pas le cadrage du jeu.
export function dessinerFond(scene: Phaser.Scene, fond: PlanFond): Phaser.GameObjects.Image {
  return scene.add
    .image(fond.x, fond.y, cleDe(fond))
    .setOrigin(0)
    .setDisplaySize(fond.w, fond.h)
    .setDepth(PROFONDEUR_FOND);
}
