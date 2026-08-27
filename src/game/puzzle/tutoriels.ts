/**
 * Les tutoriels des énigmes, en données — le texte et l'enchaînement, pas le
 * moteur (`tutoriel.ts`).
 *
 * Voir game-design/07-tutoriel-puzzle-crease-pattern.md.
 *
 * **Pourquoi ce texte n'est pas dans ink**, alors que tout le reste du jeu y
 * est : un tutoriel se joue **par-dessus une énigme ouverte**, et l'énigme est
 * elle-même ouverte par un tag ink (`# puzzle:`) que le récit est en train
 * d'attendre. `DialogueRunner` n'a qu'une instance de `Story` et refuse d'être
 * relancé pendant qu'il tourne : lui demander de jouer un knot à ce moment-là
 * ne ferait rien du tout. Le tutoriel écrit donc directement dans la boîte de
 * dialogue, qui, elle, est libre.
 *
 * Une étape est soit une **réplique** — une chaîne, dite par le héros, qui
 * attend un tap comme n'importe quelle ligne du jeu — soit un **effet**, joué
 * entre deux répliques. Les effets sont nommés ici et exécutés dans
 * `tutoriel.ts` : ce fichier se relit comme un storyboard.
 *
 * Un effet peut porter un `puis` : la réplique qui **commente ce qu'on vient de
 * voir**. Elle n'est dite que si l'effet a bien eu lieu — tous ne se jouent pas
 * toujours, et le tutoriel ne doit pas commenter un geste qu'il n'a pas fait.
 */

import type { TracePli } from '../../origami/papier';

/** Ce qui se passe à l'écran entre deux répliques. */
export type Effet =
  /** Une flèche désigne une pièce du bac, qui glisse ensuite jusqu'à sa place. */
  | 'poser-une-piece'
  /** L'énigme s'assombrit ; une feuille de papier apparaît au centre. */
  | 'montrer-feuille'
  /** Les plis se tracent sur la feuille, à leur couleur, l'un après l'autre. */
  | 'tracer-pli'
  /** Le pliage se joue, lentement. */
  | 'plier'
  /** On laisse le joueur regarder ce qui est à l'écran. */
  | 'un-temps'
  /** La feuille s'efface et l'énigme réapparaît. */
  | 'cacher-feuille'
  /** Une flèche clignote sur le bouton « ? ». */
  | 'designer-aide';

/**
 * La feuille d'une démonstration : le modèle `.origami` qu'on va plier, et les
 * plis qu'on trace dessus avant de le faire.
 *
 * C'est un **vrai pliage baké depuis un vrai crease pattern**
 * (`content/origami/`), pas une animation dessinée : montrer un pli autrement
 * que par le pli lui-même, c'est exactement ce que ce projet s'interdit (voir
 * CLAUDE.md).
 *
 * Les repères des traits ne se lisent pas dans le crease pattern — le solveur
 * pose le modèle dans son propre repère — mais ils se **calculent**, et il vaut
 * mieux les calculer que les deviner : sur un pli diagonal, deux repères faux
 * donnent la même image, et l'erreur ne se voit qu'au moment du pliage.
 *
 * Les UV sont lues sur la pose à plat (`uvDuPlat`) et la texture est retournée
 * verticalement (`flipY`, par défaut sur trois.js). Un sommet du modèle à plat
 * tombe donc en
 *
 *     canvas = [ (x - minX) / (maxX - minX), 1 - (z - minZ) / (maxZ - minZ) ]
 *
 * Il suffit de sortir les sommets de la première pose du `.origami` : les coins
 * de la feuille s'y reconnaissent, tout le reste est un bout de pli.
 */
export interface Feuille {
  modele: string;
  traits: readonly TracePli[];
}

/** Un effet, et la réplique qui commente éventuellement ce qu'il a montré. */
export type EtapeEffet =
  | { faire: 'montrer-feuille'; feuille: Feuille; puis?: string }
  | { faire: Exclude<Effet, 'montrer-feuille'>; puis?: string };

export type Etape = string | EtapeEffet;

export interface Tutoriel {
  /** Libellé dans la liste du bouton « ? ». */
  titre: string;
  /**
   * La réplique du lancement automatique, suivie du choix de le jouer ou de le
   * passer. Le tutoriel lancé depuis « ? » ne la joue pas : le joueur l'a
   * demandé, on ne lui redemande pas s'il en est sûr.
   */
  invite: string;
  etapes: readonly Etape[];
}

// ------------------------------------------------------------------
// Les feuilles de démonstration
// ------------------------------------------------------------------

/**
 * Le pli vallée seul : `content/origami/vallee.svg`, un carré et un trait bleu
 * qui va du quart gauche aux trois quarts droits.
 *
 * Pas la diagonale, et c'est délibéré : elle se lisait mal une fois le papier en
 * mouvement. En contrepartie ce pli ne longe aucun axe de symétrie du carré, des
 * coins sortent de son emprise en se repliant, et le cadrage de la toile en tient
 * compte (voir `.tuto__feuille` dans style.css).
 */
const FEUILLE_VALLEE: Feuille = {
  modele: 'vallee',
  traits: [{ pli: 'va', de: [1, 0.25], a: [0, 0.75] }],
};

/**
 * Le pli montagne seul : `content/origami/montagne.svg`, **exactement le même
 * carré et le même trait** que la feuille du pli vallée, à la couleur près.
 *
 * C'est tout l'argument de la leçon : « l'inverse du pli vallée » ne se démontre
 * qu'à géométrie égale. Le solveur en donne d'ailleurs la preuve — la dernière
 * pose du pli montagne est celle du pli vallée avec le Y changé de signe, le
 * même papier retourné comme un gant.
 */
const FEUILLE_MONTAGNE: Feuille = {
  modele: 'montagne',
  traits: [{ pli: 'mo', de: [1, 0.25], a: [0, 0.75] }],
};

/**
 * La base de la bombe à eau : `content/origami/bombe.svg`, les deux diagonales
 * en vallée et les deux médianes en montagne.
 *
 * Le premier modèle du jeu qui **combine les deux plis**, et le plus simple à
 * l'être — c'est pour ça qu'elle clôt le tutoriel du pli montagne plutôt qu'une
 * figure décorative.
 *
 * **Ce sens-là et pas l'autre.** Diagonales en montagne, le papier se referme
 * vers le joueur et ne lui présente que son recto : quatre rabats de la même
 * couleur, une tente claire où seule l'ombre dit qu'il y a des plis. Retourné,
 * le pliage ouvre ses rabats et **le verso apparaît** — et c'est le verso qui
 * dessine les plis, ici comme sur tous les modèles du jeu (voir `PAPIERS`).
 *
 * Les traits sont tracés dans l'ordre où ils sont écrits : les deux vallées
 * d'abord, les deux montagnes ensuite. Grouper par couleur plutôt qu'alterner
 * fait apparaître les deux familles de plis l'une après l'autre, ce que le
 * joueur vient précisément d'apprendre à distinguer.
 *
 * ⚠ Ce crease pattern porte un `opacity="0.5"` sur ses médianes, seule entorse à
 * la forme ORIPA des autres. C'est ainsi qu'Origami Simulator note un **angle de
 * pli** — l'opacité vaut le pourcentage de 180° — et son propre
 * `assets/Bases/waterbombBase.svg` fait pareil : à 180° sur les quatre lignes, le
 * sommet central ne respecte plus Maekawa (quatre montagnes, quatre vallées) et
 * le solveur n'a plus de pliage à plat à trouver.
 */
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
      { faire: 'designer-aide' },
      'Tu peux rejouer ce tutoriel à tout moment avec ce bouton.',
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
      // La feuille arrive nue, et on laisse le joueur la voir telle quelle : la
      // leçon est que le *même* carré, plié dans l'autre sens, donne l'autre
      // pli. Tracer le trait rouge dans la seconde qui suit ne lui laisserait
      // pas le temps de reconnaître la feuille d'avant.
      { faire: 'un-temps' },
      { faire: 'tracer-pli' },
      'En rouge le pli montagne, là où le pli vallée était en bleu.',
      { faire: 'plier' },
      "Voilà un pli montagne. Le même trait que tout à l'heure, et le papier part de l'autre côté.",
      'Un origami combine en général les deux. Je vais te montrer la base de la « bombe à eau », une des façons les plus simples de les combiner.',
      // Remplace la feuille pliée sans rendre l'énigme au joueur : on reste
      // dans la démonstration, on change seulement de papier.
      { faire: 'montrer-feuille', feuille: FEUILLE_BOMBE },
      { faire: 'tracer-pli' },
      'Voilà les plis de la base de la « bombe à eau » : deux vallées, deux montagnes.',
      { faire: 'plier' },
      // La réplique **avant** de ranger la feuille : c'est elle qui tient le
      // pliage à l'écran, le temps qu'on le regarde. L'effacer d'abord, c'était
      // commenter une place vide.
      "Et voilà. Je crois qu'on a tout ce qu'il faut pour s'attaquer aux modèles les plus compliqués.",
      { faire: 'cacher-feuille' },
    ],
  },
} as const satisfies Record<string, Tutoriel>;

export type NomTutoriel = keyof typeof TUTORIELS;
