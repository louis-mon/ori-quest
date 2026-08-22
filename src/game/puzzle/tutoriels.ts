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
 */

/** Ce qui se passe à l'écran entre deux répliques. */
export type Effet =
  /** Une flèche désigne une pièce du bac, qui glisse ensuite jusqu'à sa place. */
  | 'poser-une-piece'
  /** L'énigme s'assombrit ; une feuille de papier apparaît au centre. */
  | 'montrer-feuille'
  /** Le pli se trace sur la feuille, à sa couleur. */
  | 'tracer-pli'
  /** Le pliage se joue, lentement. */
  | 'plier'
  /** La feuille s'efface et l'énigme réapparaît. */
  | 'cacher-feuille'
  /** Une flèche clignote sur le bouton « ? ». */
  | 'designer-aide';

export type Etape = string | { faire: Effet };

export interface Tutoriel {
  /** Libellé dans la liste du bouton « ? ». */
  titre: string;
  /**
   * La réplique du lancement automatique, suivie du choix de le jouer ou de le
   * passer. Le tutoriel lancé depuis « ? » ne la joue pas : le joueur l'a
   * demandé, on ne lui redemande pas s'il en est sûr.
   */
  invite: string;
  /**
   * Le modèle `.origami` de la démonstration, et le trait qu'on trace dessus
   * avant de le plier.
   *
   * C'est un vrai pliage baké depuis un vrai crease pattern
   * (`content/origami/vallee.svg`), pas une animation dessinée : montrer un pli
   * autrement que par le pli lui-même, c'est exactement ce que ce projet
   * s'interdit (voir CLAUDE.md).
   */
  modele: string;
  pli: 'va' | 'mo';
  /**
   * Les deux bouts du trait dans la texture du papier, en fraction, origine en
   * **haut à gauche**. Ils ne se déduisent pas du crease pattern — le solveur
   * pose le modèle dans son propre repère — ils se constatent en regardant le
   * rendu, comme les angles de `POSES`.
   */
  trace: { de: readonly [number, number]; a: readonly [number, number] };
  etapes: readonly Etape[];
}

export const TUTORIELS = {
  vallee: {
    titre: 'Le pli vallée',
    invite:
      "Ça fait longtemps que je n'ai pas exercé mon art d'origamiste. Un rappel des bases ne ferait pas de mal.",
    modele: 'vallee',
    pli: 'va',
    trace: { de: [1, 0], a: [0, 1] },
    etapes: [
      'Je vais devoir retrouver les plis nécessaires pour remettre ce pont en place.',
      "Pour l'instant je n'ai besoin que d'un type de pli : le pli vallée.",
      "Il apparaît en bleu sur le schéma : tout ce que j'ai à faire, c'est remettre les pièces en place dans le carré.",
      { faire: 'poser-une-piece' },
      'Cette pièce semble bien placée, il faut maintenant mettre les autres.',
      "Mais tu te demandes peut-être ce que signifie « pli vallée » ? Laisse-moi t'expliquer.",
      { faire: 'montrer-feuille' },
      "Voici une feuille de papier d'origami. Je vais faire un pli vallée dessus.",
      { faire: 'tracer-pli' },
      "J'ai ajouté le pli sur la feuille, en bleu. Voyons ce que ça donne en action.",
      { faire: 'plier' },
      "Voilà ce qu'est un pli vallée. Un bon moyen mnémotechnique pour s'en rappeler : vallée comme la vallée d'une montagne.",
      { faire: 'cacher-feuille' },
      { faire: 'designer-aide' },
      'Tu peux rejouer ce tutoriel à tout moment avec ce bouton.',
      'À nous de jouer maintenant.',
    ],
  },

  // À ÉCRIRE : le tutoriel du pli montagne, lancé par la première énigme qui en
  // porte un (l'arbre ou la hache — voir puzzles.ts). Son modèle de
  // démonstration se bake comme celui du pli vallée :
  //
  //     npm run bake -- content/origami/montagne.svg --name montagne --frames 12
} as const satisfies Record<string, Tutoriel>;

export type NomTutoriel = keyof typeof TUTORIELS;
