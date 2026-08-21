import { DECOUPAGES } from '../../generated/enigmes';
import type { CreasePuzzleDef } from './crease-puzzle';

/**
 * Les énigmes du jeu, en données. Le nom de la clé est celui qu'on écrit dans
 * la narration : `# puzzle: pont`.
 *
 * **Le découpage n'est pas ici** : il se dessine dans `decoupage.html`, vit dans
 * `game-design/enigmes/<nom>.json` et arrive par `DECOUPAGES`, comme la
 * géométrie d'une scène arrive de sa carte Tiled. Ce fichier ne dit plus que ce
 * qui ne se dessine pas — quel motif, quel modèle, quel titre.
 *
 * Le lien est vérifié par le compilateur : `DECOUPAGES` est figé en `as const`,
 * donc une énigme sans découpage ne compile pas. Redécouper une énigme ne
 * demande aucune modification de ce fichier.
 *
 * Les chemins sont **relatifs** : itch.io sert le jeu depuis un sous-dossier, un
 * chemin absolu n'y résoudrait pas (même raison que `base: './'` côté Vite).
 *
 * `modele` est le pliage montré comme but : c'est le `.origami` lui-même qui
 * est rendu, et non l'ancien `idee.svg` — l'image du but, celle de l'animation
 * et celle de l'inventaire sont donc littéralement la même.
 */
export const PUZZLES: Record<string, CreasePuzzleDef> = {
  // game-design/scenes/chapter-1/le-pont.md
  pont: {
    svg: 'assets/enigmes/pont/solution.svg',
    modele: 'pont',
    decoupage: DECOUPAGES.pont,
    title: 'Le pont',
  },

  // game-design/scenes/chapter-1/le-pont.md — le vieil arbre.
  arbre: {
    svg: 'assets/enigmes/arbre/solution.svg',
    modele: 'arbre',
    decoupage: DECOUPAGES.arbre,
    title: 'Le vieil arbre',
  },

  // game-design/scenes/chapter-1/la-porte.md — la hache.
  hache: {
    svg: 'assets/enigmes/hache/solution.svg',
    modele: 'hache',
    decoupage: DECOUPAGES.hache,
    title: 'La hache',
  },

  // game-design/scenes/chapter-1/la-porte.md — la porte.
  porte: {
    svg: 'assets/enigmes/porte/solution.svg',
    modele: 'porte',
    decoupage: DECOUPAGES.porte,
    title: 'La porte',
  },
};
