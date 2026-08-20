import type { CreasePuzzleDef } from './crease-puzzle';

/**
 * Les énigmes du jeu, en données. Le nom de la clé est celui qu'on écrit dans
 * la narration : `# puzzle: pont`.
 *
 * Le découpage est repris tel quel du document d'énigme
 * (game-design/scenes/…) : taille de la grille d'ancrage, puis chaque pièce en
 * `(x, y, w, h)` cellules, origine en haut à gauche. Des pièces de tailles
 * différentes valent mieux qu'un découpage régulier : sur un motif symétrique,
 * des parts égales laissent plusieurs dispositions correctes alors qu'une seule
 * est validée.
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
    grid: 4,
    // Trois bandes pleine largeur. Ce n'est pas un choix esthétique : le motif
    // du pont n'a que deux plis horizontaux, donc rien n'y fixe une abscisse et
    // toute découpe en colonnes admet son miroir. Seules des bandes, chacune
    // identifiable par sa hauteur et par la position du pli qui la traverse,
    // donnent une solution unique. Vérifié par `npm run check-puzzle`.
    pieces: [
      { x: 0, y: 0, w: 4, h: 1 },
      { x: 0, y: 1, w: 4, h: 2 },
      { x: 0, y: 3, w: 4, h: 1 },
    ],
    title: 'Le pont',
  },

  // game-design/scenes/chapter-1/le-pont.md — le vieil arbre.
  //
  // ⚠ Découpage **proposé**, pas spécifié : la fiche de scène ne donne ni
  // grille ni pièces pour cette énigme. Quatre quartiers d'aires proches, la
  // colonne de gauche plus étroite que la droite — un découpage régulier
  // laisserait des pièces interchangeables. Unicité vérifiée :
  //
  //   npm run check-puzzle -- public/assets/enigmes/arbre/solution.svg \
  //     --grid 4 --pieces "0,0,1,2 1,0,3,2 0,2,1,2 1,2,3,2"
  arbre: {
    svg: 'assets/enigmes/arbre/solution.svg',
    modele: 'arbre',
    grid: 4,
    pieces: [
      { x: 0, y: 0, w: 1, h: 2 },
      { x: 1, y: 0, w: 3, h: 2 },
      { x: 0, y: 2, w: 1, h: 2 },
      { x: 1, y: 2, w: 3, h: 2 },
    ],
    title: 'Le vieil arbre',
  },

  // game-design/scenes/chapter-1/la-porte.md — la hache.
  //
  // ⚠ Découpage proposé. Le motif est une tessellation dense (61 traits
  // retenus) : c'est le seul du chapitre où des quartiers valent mieux que des
  // bandes, une bande entière y étant presque indiscernable de sa voisine.
  //
  //   npm run check-puzzle -- public/assets/enigmes/hache/solution.svg \
  //     --grid 7 --pieces "0,0,3,3 3,0,4,3 0,3,3,4 3,3,4,4"
  hache: {
    svg: 'assets/enigmes/hache/solution.svg',
    modele: 'hache',
    grid: 7,
    pieces: [
      { x: 0, y: 0, w: 3, h: 3 },
      { x: 3, y: 0, w: 4, h: 3 },
      { x: 0, y: 3, w: 3, h: 4 },
      { x: 3, y: 3, w: 4, h: 4 },
    ],
    title: 'La hache',
  },

  // game-design/scenes/chapter-1/la-porte.md — la porte.
  //
  // ⚠ Découpage proposé. Les plis tombent tous sur des sixièmes, d'où la
  // grille 6 ; en colonnes parce que le motif est nervuré verticalement.
  //
  //   npm run check-puzzle -- public/assets/enigmes/porte/solution.svg \
  //     --grid 6 --pieces "0,0,1,6 1,0,1,6 2,0,2,6 4,0,2,6"
  porte: {
    svg: 'assets/enigmes/porte/solution.svg',
    modele: 'porte',
    grid: 6,
    pieces: [
      { x: 0, y: 0, w: 1, h: 6 },
      { x: 1, y: 0, w: 1, h: 6 },
      { x: 2, y: 0, w: 2, h: 6 },
      { x: 4, y: 0, w: 2, h: 6 },
    ],
    title: 'La porte',
  },
};
