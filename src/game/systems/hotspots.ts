import { MIN_TOUCH_SIZE } from '../config';

/**
 * Le seul verbe du jeu : **analyser**.
 *
 * Le joueur ne fait qu'une chose sur un élément de décor — il l'observe, et
 * l'observation donne des idées. Il n'y a ni objet à combiner ni serrure où
 * insérer une clé, donc pas de second verbe à proposer. Voir
 * game-design/04-interface.md.
 *
 * Le type reste une union plutôt qu'une chaîne unique : le menu contextuel sait
 * toujours s'ouvrir si un élément en propose deux un jour, sans rien réécrire.
 */
export type Verb = 'analyser';

export const VERB_LABELS: Record<Verb, string> = {
  analyser: 'Analyser',
};

/** Rectangle en coordonnées logiques, tel que le plan Tiled le donne. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Contour d'une zone tracée au polygone dans Tiled, en coordonnées du jeu.
 *
 * Une zone en a un quand sa forme est le propos — une berge en biais, une
 * silhouette d'arbre. Le reste du temps la boîte suffit, et coûte moins cher au
 * test tactile.
 */
export type Contour = readonly (readonly [number, number])[];

/**
 * Où se pose le marqueur, quand le centre de la zone tombe à côté du sujet.
 *
 * Une emprise est un rectangle, un pliage n'en est pas un : au centre de la
 * sienne, la cocotte du renard tombait dans le creux entre son dos et sa queue.
 * Le point vient du **plan** — un objet de classe `marqueur` portant le nom de
 * la zone —, et rien ne le câble côté code : il arrive avec elle.
 */
export type Marqueur = readonly [number, number];

export interface HotspotDef extends Box {
  id: string;
  label: string;
  /** Contour tactile, quand la zone a été tracée au polygone. */
  points?: Contour;
  marqueur?: Marqueur;
  /** Verbe -> nom du knot ink à jouer. L'ordre définit l'ordre des boutons. */
  knots: Partial<Record<Verb, string>>;
  /** Le hotspot n'existe que si ce prédicat est vrai (objet déjà pris, etc.). */
  visibleIf?: () => boolean;
}

/**
 * Une sortie : le pli de papier qui pointe vers la scène voisine.
 *
 * Elle change de scène sans dialogue — c'est ce qui la distingue d'un hotspot,
 * et ce que la flèche promet au joueur. Le `knot` n'est là que pour les sorties
 * qui doivent d'abord raconter quelque chose (une fin de chapitre) ; la
 * narration peut alors enchaîner elle-même avec `# goto:`.
 */
export interface ExitDef extends Box {
  id: string;
  /**
   * Ce que la sortie veut dire, pour qui lit la scène. Il n'est **pas** montré
   * au joueur : la flèche et le fondu suffisent à dire qu'on part, et une
   * légende affichée pendant la transition se lisait sur la scène d'arrivée
   * (voir `PointClickScene.onZone`). Il reste la seule phrase française d'une
   * sortie qui passe par un knot, là où `room` ne dit rien.
   */
  label: string;
  points?: Contour;
  marqueur?: Marqueur;
  /** Scène de destination. */
  room?: string;
  /** Knot à jouer au lieu de partir directement. */
  knot?: string;
  visibleIf?: () => boolean;
}

export function verbsOf(def: HotspotDef): Verb[] {
  return (Object.keys(def.knots) as Verb[]).filter((v) => def.knots[v]);
}

/**
 * Garantit qu'une zone tactile atteint la taille minimale confortable, en
 * l'élargissant autour de son centre. Le visuel n'est pas modifié — seule la
 * zone de collision grandit.
 */
export function touchRect(def: Box) {
  const w = Math.max(def.w, MIN_TOUCH_SIZE);
  const h = Math.max(def.h, MIN_TOUCH_SIZE);
  return {
    x: def.x + def.w / 2 - w / 2,
    y: def.y + def.h / 2 - h / 2,
    w,
    h,
  };
}
