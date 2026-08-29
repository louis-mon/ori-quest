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
    // Le pli montagne est porté par l'arbre ET par la hache, pas par une seule
    // des deux : elles s'ouvrent dans n'importe quel ordre, et le drapeau
    // `tuto_montagne_vu` fait que c'est la première ouverte qui le propose. La
    // porte, elle, ne le porte pas — on ne peut pas l'atteindre sans avoir plié
    // les deux autres, la leçon est donc toujours déjà donnée.
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
  },

  // ⚠ Aucune énigme du chapitre 2 ne porte de `tutoriel`, pour la même raison
  // que la porte : les deux leçons sont derrière le joueur. Elles restent
  // accessibles à tout moment par le bouton « ? », qui ne dépend pas de ce
  // champ.

  // game-design/scenes/chapter-2/le-village.md — la montagne du pingouin.
  montagne: {
    svg: 'assets/enigmes/montagne/solution.svg',
    modele: 'montagne',
    decoupage: DECOUPAGES.montagne,
    title: 'La montagne',
  },

  // game-design/scenes/chapter-2/le-village.md — l'herbe de la vache.
  herbe: {
    svg: 'assets/enigmes/herbe/solution.svg',
    modele: 'herbe',
    decoupage: DECOUPAGES.herbe,
    title: "L'herbe",
  },

  // game-design/scenes/chapter-2/le-village.md — le pot à lait.
  pot: {
    svg: 'assets/enigmes/pot/solution.svg',
    modele: 'pot',
    decoupage: DECOUPAGES.pot,
    title: 'Le pot à lait',
  },

  // game-design/scenes/chapter-2/entree-chateau.md — Chouaf. Le dossier de
  // l'artiste dit « dog » ; le modèle, lui, porte le nom que parlent les knots.
  chien: {
    svg: 'assets/enigmes/chien/solution.svg',
    modele: 'chien',
    decoupage: DECOUPAGES.chien,
    title: 'Chouaf',
  },

  // game-design/scenes/chapter-2/entree-chateau.md — l'os.
  //
  // Beaucoup de couches, et le solveur ne gère pas les collisions : il retrouve
  // l'octogone et ses quatre bosses, mais mou. D'où une pose à plat et un
  // pliage plus poussé que les autres (`POSES`) — c'est là qu'on lit un os.
  os: {
    svg: 'assets/enigmes/os/solution.svg',
    modele: 'os',
    decoupage: DECOUPAGES.os,
    title: "L'os",
  },
};
