// Le texte et l'enchaînement des tutoriels, pas le moteur (`tutoriel.ts`). Voir
// game-design/07-tutoriel-puzzle-crease-pattern.md.
//
// Ce texte n'est pas dans ink — le seul du jeu — parce qu'un tutoriel se joue
// pendant que le récit attend le verdict de l'énigme (`# puzzle:`) :
// `DialogueRunner` n'a qu'une instance de `Story` et refuse d'être relancé
// pendant qu'il tourne. Déplacé dans story.ink, il ne s'afficherait jamais.
//
// Une étape est soit une réplique, soit un effet joué entre deux répliques ; les
// effets sont nommés ici et exécutés dans `tutoriel.ts`. Le `puis` d'un effet
// commente ce qu'on vient de voir, et n'est dit que si l'effet a eu lieu.

import type { TracePli } from '../../origami/papier';

// Ce qui se passe à l'écran entre deux répliques.
export type Effet =
  // Une flèche désigne une pièce du bac, qui glisse ensuite jusqu'à sa place.
  | 'poser-une-piece'
  // L'énigme s'assombrit ; une feuille de papier apparaît au centre.
  | 'montrer-feuille'
  // Les plis se tracent sur la feuille, à leur couleur, l'un après l'autre.
  | 'tracer-pli'
  | 'plier'
  // On laisse le joueur regarder ce qui est à l'écran.
  | 'un-temps'
  | 'cacher-feuille'
  // Une flèche clignote sur le bouton « ? ».
  | 'designer-aide';

// Les repères des traits ne se lisent pas dans le crease pattern — le solveur
// pose le modèle dans son propre repère — mais se calculent, et mieux vaut les
// calculer que les deviner : sur un pli diagonal, deux repères faux donnent la
// même image et l'erreur n'apparaît qu'au pliage. Les UV étant lues sur la pose
// à plat avec `flipY`, un sommet du modèle à plat tombe en
//
//     canvas = [ (x - minX) / (maxX - minX), 1 - (z - minZ) / (maxZ - minZ) ]
//
// Il suffit donc de sortir les sommets de la première pose du `.origami`.
export interface Feuille {
  modele: string;
  traits: readonly TracePli[];
}

export type EtapeEffet =
  | { faire: 'montrer-feuille'; feuille: Feuille; puis?: string }
  | { faire: Exclude<Effet, 'montrer-feuille'>; puis?: string };

export type Etape = string | EtapeEffet;

export interface Tutoriel {
  // Libellé dans la liste du bouton « ? ».
  titre: string;
  // La réplique du lancement automatique, suivie du choix de jouer ou de passer.
  // Celui lancé depuis « ? » ne la joue pas : le joueur l'a demandé.
  invite: string;
  etapes: readonly Etape[];
}

// ------------------------------------------------------------------
// Les feuilles de démonstration
// ------------------------------------------------------------------

// `content/origami/vallee.svg`. Pas la diagonale, délibérément : elle se lisait
// mal une fois le papier en mouvement. En contrepartie ce pli ne longe aucun axe
// de symétrie du carré, des coins sortent de son emprise en se repliant, et le
// cadrage de la toile en tient compte (`.tuto__feuille` dans style.css).
const FEUILLE_VALLEE: Feuille = {
  modele: 'vallee',
  traits: [{ pli: 'va', de: [1, 0.25], a: [0, 0.75] }],
};

// `content/origami/montagne.svg` : exactement le même carré et le même trait que
// la feuille du pli vallée, à la couleur près. C'est tout l'argument de la
// leçon — « l'inverse du pli vallée » ne se démontre qu'à géométrie égale.
const FEUILLE_MONTAGNE: Feuille = {
  modele: 'montagne',
  traits: [{ pli: 'mo', de: [1, 0.25], a: [0, 0.75] }],
};

// `content/origami/bombe.svg` : diagonales en vallée, médianes en montagne. Ce
// sens-là et pas l'autre — diagonales en montagne, le papier se referme vers le
// joueur et ne montre que son recto, quatre rabats de la même couleur. Retourné,
// il ouvre ses rabats et le verso apparaît, et c'est le verso qui dessine les
// plis.
//
// L'ordre des traits groupe les vallées puis les montagnes : les deux familles
// apparaissent l'une après l'autre, ce que le joueur vient d'apprendre à
// distinguer.
//
// ⚠ Ce crease pattern porte un `opacity="0.5"` sur ses médianes, seule entorse à
// la forme ORIPA des autres : c'est ainsi qu'Origami Simulator note un angle de
// pli, l'opacité valant le pourcentage de 180°. À 180° sur les quatre lignes, le
// sommet central ne respecte plus Maekawa et le solveur n'a plus de pliage à
// plat à trouver.
const FEUILLE_BOMBE: Feuille = {
  modele: 'bombe',
  traits: [
    { pli: 'va', de: [0, 0], a: [1, 1] },
    { pli: 'va', de: [1, 0], a: [0, 1] },
    { pli: 'mo', de: [0.5, 0], a: [0.5, 1] },
    { pli: 'mo', de: [0, 0.5], a: [1, 0.5] },
  ],
};

// ------------------------------------------------------------------
// Les tutoriels
// ------------------------------------------------------------------

export const TUTORIELS = {
  vallee: {
    titre: 'Le pli vallée',
    invite:
      "Ça fait longtemps que je n'ai pas exercé mon art d'origamiste. Un rappel des bases ne ferait pas de mal.",
    etapes: [
      'Je vais devoir retrouver les plis nécessaires pour remettre ce pont en place.',
      "Pour l'instant je n'ai besoin que d'un type de pli : le pli vallée.",
      "Il apparaît en bleu sur les pièces : tout ce que j'ai à faire, c'est remettre les pièces en place dans le carré.",
      {
        faire: 'poser-une-piece',
        // Sautée avec l'effet : sur un plateau déjà entamé, aucune pièce ne
        // bouge, et « cette pièce » ne désignerait rien.
        puis: 'Cette pièce semble bien placée, il faut maintenant mettre les autres.',
      },
      "Mais tu te demandes peut-être ce que signifie « pli vallée » ? Laisse-moi t'expliquer.",
      { faire: 'montrer-feuille', feuille: FEUILLE_VALLEE },
      "Voici une feuille de papier d'origami. Je vais faire un pli vallée dessus.",
      { faire: 'tracer-pli' },
      "J'ai ajouté le pli sur la feuille, en bleu. Voyons ce que ça donne en action.",
      { faire: 'plier' },
      "Voilà ce qu'est un pli vallée. Un bon moyen mnémotechnique pour s'en souvenir : vallée comme la vallée d'une montagne.",
      { faire: 'cacher-feuille' },
      // La réplique avant la flèche : un effet laisse à l'écran la ligne qui le
      // précède, et c'est elle qui lui sert de légende.
      'Tu peux rejouer ce tutoriel à tout moment avec ce bouton.',
      { faire: 'designer-aide' },
      'À nous de jouer maintenant.',
    ],
  },

  montagne: {
    titre: 'Le pli montagne',
    invite: "Celui-là semble plus compliqué : il n'y a pas que des plis vallée.",
    etapes: [
      'Un autre type de pli est nécessaire pour plier ce modèle : le pli montagne.',
      "Comme son nom l'indique, c'est une montagne — l'inverse du pli vallée.",
      'Je vais te montrer en pratique.',
      { faire: 'montrer-feuille', feuille: FEUILLE_MONTAGNE },
      // La leçon est que le MÊME carré, plié dans l'autre sens, donne l'autre
      // pli : tracer le trait rouge aussitôt ne laisserait pas le temps de
      // reconnaître la feuille d'avant.
      { faire: 'un-temps' },
      { faire: 'tracer-pli' },
      'En rouge le pli montagne, là où le pli vallée était en bleu.',
      { faire: 'plier' },
      "Voilà un pli montagne. Le même trait que tout à l'heure, et le papier part de l'autre côté.",
      'Un origami combine en général les deux. Je vais te montrer la base de la « bombe à eau », une des façons les plus simples de les combiner.',
      // Remplace la feuille pliée sans rendre l'énigme au joueur.
      { faire: 'montrer-feuille', feuille: FEUILLE_BOMBE },
      { faire: 'tracer-pli' },
      'Voilà les plis de la base de la « bombe à eau » : deux vallées, deux montagnes.',
      { faire: 'plier' },
      // La réplique AVANT de ranger la feuille : c'est elle qui tient le pliage
      // à l'écran. L'effacer d'abord, c'était commenter une place vide.
      "Et voilà. Je crois qu'on a tout ce qu'il faut pour s'attaquer aux modèles les plus compliqués.",
      { faire: 'cacher-feuille' },
    ],
  },
} as const satisfies Record<string, Tutoriel>;

export type NomTutoriel = keyof typeof TUTORIELS;
