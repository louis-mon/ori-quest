import Phaser from 'phaser';
import { preloadSprite } from './decor-sprite';

/**
 * Le fond de scène — le terrain peint par l'artiste.
 *
 * Ce que le joueur voit du sol, des rives et du rempart n'est plus tracé en
 * aplats : c'est une image, papier froissé photographié comme le reste du
 * monde. Les aplats tenaient la place, et ils divergeaient de ce que l'artiste
 * livrait — même travers que les dessins « qui ressemblent » aux pliages.
 *
 * Le **ciel reste peint** (voir ciel.ts) : le fond est livré transparent
 * au-dessus de l'horizon, et le dégradé, son soleil et ses nuages passent donc
 * dessous. C'est ce qui permet aux nuages de dériver derrière le rempart sans
 * qu'il faille découper l'image en morceaux.
 *
 * L'image, sa position et sa taille viennent du **plan de scène** : un calque
 * image de classe `fond` dans la carte Tiled, qui pointe directement le fichier
 * de `public/`. On place donc les zones tactiles, dans l'éditeur, sur les pixels
 * exacts que le joueur aura sous les yeux.
 */

/** Ce que `npm run scenes` tire du calque `fond` de la carte. */
export interface PlanFond {
  /** Chemin relatif servi au jeu — `assets/decor/fond-pont.webp`. */
  readonly image: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Entre les nuages (-10) et le décor (0) : le terrain est devant le ciel, et
 * tout ce que la scène pose ensuite — personnages, feuilles, pliages — est
 * devant lui.
 */
const PROFONDEUR_FOND = -5;

/** Une texture par scène : deux fonds ne partagent jamais la même image. */
const cleDe = (fond: PlanFond) => `fond-${fond.image}`;

/** À appeler dans le `preload()` de la scène. */
export function preloadFond(scene: Phaser.Scene, fond: PlanFond): void {
  preloadSprite(scene, cleDe(fond), fond.image);
}

/**
 * Pose le fond à l'endroit et à la taille que la carte lui donne.
 *
 * `setDisplaySize` plutôt que la taille naturelle : Tiled n'étire jamais un
 * calque image, donc les deux coïncident — et l'import refuse la carte quand
 * elles ont divergé. Le dire explicitement garantit qu'un fichier remplacé en
 * douce ne change pas le cadrage du jeu.
 */
export function dessinerFond(scene: Phaser.Scene, fond: PlanFond): Phaser.GameObjects.Image {
  return scene.add
    .image(fond.x, fond.y, cleDe(fond))
    .setOrigin(0)
    .setDisplaySize(fond.w, fond.h)
    .setDepth(PROFONDEUR_FOND);
}
