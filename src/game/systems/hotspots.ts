import { MIN_TOUCH_SIZE } from '../config';

// Le seul verbe du jeu : analyser. Ni objet à combiner ni serrure où insérer une
// clé (game-design/04-interface.md). Le type reste une union plutôt qu'une
// chaîne : le menu contextuel sait s'ouvrir si un élément en propose deux.
export type Verb = 'analyser';

export const VERB_LABELS: Record<Verb, string> = {
  analyser: 'Analyser',
};

// En coordonnées logiques, tel que le plan Tiled le donne.
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// En coordonnées du jeu. Une zone en a un quand sa forme est le propos ; sinon
// la boîte suffit, et coûte moins cher au test tactile.
export type Contour = readonly (readonly [number, number])[];

// Une emprise est un rectangle, un pliage n'en est pas un : au centre de la
// sienne, la cocotte du renard tombait dans le creux entre son dos et sa queue.
// Le point vient d'un objet `marqueur` du plan portant le nom de la zone.
export type Marqueur = readonly [number, number];

export interface HotspotDef extends Box {
  id: string;
  label: string;
  // Contour tactile, quand la zone a été tracée au polygone.
  points?: Contour;
  marqueur?: Marqueur;
  // Verbe -> knot ink. L'ordre définit celui des boutons.
  knots: Partial<Record<Verb, string>>;
  // Le hotspot n'existe que si ce prédicat est vrai.
  visibleIf?: () => boolean;
}

// Elle change de scène sans dialogue : c'est ce qui la distingue d'un hotspot,
// et ce que la flèche promet. Le `knot` ne sert qu'aux sorties qui doivent
// d'abord raconter quelque chose, la narration enchaînant avec `# goto:`.
export interface ExitDef extends Box {
  id: string;
  // PAS montré au joueur : une légende affichée pendant la transition se lisait
  // sur la scène d'arrivée. Il reste la seule phrase française d'une sortie qui
  // passe par un knot, là où `room` ne dit rien.
  label: string;
  points?: Contour;
  marqueur?: Marqueur;
  // Scène de destination.
  room?: string;
  // Knot à jouer au lieu de partir directement.
  knot?: string;
  visibleIf?: () => boolean;
}

export function verbsOf(def: HotspotDef): Verb[] {
  return (Object.keys(def.knots) as Verb[]).filter((v) => def.knots[v]);
}

// Élargit autour du centre. Le visuel n'est pas modifié, seule la zone de
// collision grandit.
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
