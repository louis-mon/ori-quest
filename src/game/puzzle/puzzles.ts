import { DECOUPAGES } from '../../generated/enigmes';
import type { CreasePuzzleDef } from './crease-puzzle';

// Les énigmes du jeu, en données ; la clé est le nom écrit dans la narration
// (`# puzzle: pont`).
//
// Le découpage n'est pas ici : il se dessine dans `decoupage.html` et arrive par
// `DECOUPAGES`, figé en `as const`, donc une énigme sans découpage ne compile
// pas. Chemins relatifs : itch.io sert le jeu depuis un sous-dossier.
export const PUZZLES: Record<string, CreasePuzzleDef> = {
  // game-design/scenes/chapter-1/le-pont.md
  pont: {
    svg: 'assets/enigmes/pont/solution.svg',
    modele: 'pont',
    decoupage: DECOUPAGES.pont,
    title: 'Le pont',
    // La première énigme du jeu : c'est elle qui apprend le pli vallée, et son
    // motif n'a justement que des vallées.
    tutoriel: 'vallee',
  },

  // game-design/scenes/chapter-1/le-pont.md — le vieil arbre.
  arbre: {
    svg: 'assets/enigmes/arbre/solution.svg',
    modele: 'arbre',
    decoupage: DECOUPAGES.arbre,
    title: 'Le vieil arbre',
    // Le pli montagne est porté par les trois énigmes qui en contiennent, pas
    // par une seule choisie d'avance : le drapeau `tuto_montagne_vu` fait que
    // c'est la première ouverte qui le propose. Désigner l'arbre seul laisserait
    // un joueur passé directement à la porte devant des traits inexpliqués.
    tutoriel: 'montagne',
  },

  // game-design/scenes/chapter-1/la-porte.md — la hache.
  hache: {
    svg: 'assets/enigmes/hache/solution.svg',
    modele: 'hache',
    decoupage: DECOUPAGES.hache,
    title: 'La hache',
    tutoriel: 'montagne',
  },

  // game-design/scenes/chapter-1/la-porte.md — la porte.
  porte: {
    svg: 'assets/enigmes/porte/solution.svg',
    modele: 'porte',
    decoupage: DECOUPAGES.porte,
    title: 'La porte',
    tutoriel: 'montagne',
  },
};
