/**
 * Plans de scène — la géométrie vient du dessin, pas du code.
 *
 * Chaque scène a un plan dans `game-design/scenes/`, dessiné à l'échelle du jeu
 * (1280x720) dans Tiled. `npm run scenes` le convertit en module TypeScript ici.
 * Voir game-design/06-plans-de-scene.md.
 *
 * Le partage des responsabilités : le **plan** dit où et combien grand, la
 * **scène** dit ce que ça raconte (libellé, knot, condition d'apparition).
 * Déplacer une zone tactile ne demande donc plus de toucher au code, et écrire
 * un dialogue ne demande pas d'ouvrir un éditeur de plan.
 *
 * Le plan généré est figé en `as const`, et les fonctions ci-dessous en tirent
 * la **liste exacte des noms disponibles**. Écrire `boxOf(PLAN, 'dec_nuages')`
 * quand la carte ne contient pas ce repère ne compile pas : c'est ce qui
 * empêche le code d'inventer une zone que le plan ne connaît pas, et donc les
 * deux de diverger. La carte Tiled est la source de vérité, `tsc` le vérifie.
 */
import type { Box, Contour, ExitDef, HotspotDef } from '../systems/hotspots';

export type { Box, Contour };

/**
 * Une zone du plan. Elle a toujours une boîte — c'est elle qui sert à poser un
 * dessin ou un marqueur — et, quand elle a été tracée au polygone, le contour
 * qui sert au test tactile.
 */
export interface PlanZone extends Box {
  id: string;
  points?: Contour;
}

export interface SceneLayout {
  readonly scene: string;
  /** La carte Tiled d'origine, citée dans les messages d'erreur. */
  readonly source: string;
  readonly design: { readonly width: number; readonly height: number };
  readonly hotspots: readonly PlanZone[];
  readonly exits: readonly PlanZone[];
  readonly decor: { readonly [id: string]: Box };
}

/** Les identifiants réellement présents dans une liste de zones du plan. */
type Ids<Z extends readonly PlanZone[]> = Z[number]['id'];

/**
 * Tous les noms qu'un plan donné sait résoudre, préfixés de leur rôle. C'est ce
 * type qui fait échouer `tsc` sur un repère inventé.
 */
export type PlanRef<L extends SceneLayout> =
  | `hs_${Ids<L['hotspots']>}`
  | `exit_${Ids<L['exits']>}`
  | `dec_${keyof L['decor'] & string}`;

/** Ce que la scène ajoute à la géométrie : le sens. */
export type HotspotContent = Omit<HotspotDef, 'id' | 'x' | 'y' | 'w' | 'h' | 'points'>;
export type ExitContent = Omit<ExitDef, 'id' | 'x' | 'y' | 'w' | 'h' | 'points'>;

const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Scènes dont on a déjà listé le reste à faire. `hotspots()` est rappelé à
 * chaque changement d'état du jeu : sans ce garde-fou, la liste défilerait en
 * boucle dans la console pendant la partie.
 */
const dejaListe = new Set<string>();

/**
 * Boîte d'un élément du plan, désigné par son rôle et son nom dans Tiled —
 * `dec_sol`, `hs_feuille`, `exit_porte`. Le code parle donc le même vocabulaire
 * que le plan, ce qui rend la correspondance vérifiable à l'œil nu.
 *
 * Un nom absent du plan est une **erreur de compilation**, pas une surprise à
 * l'exécution. Le repli reste là pour le cas où le plan généré serait en retard
 * sur la carte : la scène se dessine de travers, mais la console dit quoi faire
 * plutôt que de planter.
 */
export function boxOf<L extends SceneLayout>(layout: L, ref: PlanRef<L>): Box {
  const [prefix, ...rest] = (ref as string).split('_');
  const id = rest.join('_');
  const found =
    prefix === 'dec'
      ? layout.decor[id]
      : (prefix === 'hs' ? layout.hotspots : layout.exits).find((b) => b.id === id);

  if (found) return found;
  console.error(`[plan] « ${ref} » est absent de ${layout.source} — pense à « npm run scenes »`);
  return EMPTY;
}

/**
 * Croise le plan avec la table de contenu de la scène.
 *
 * L'ordre du résultat suit celui de la table : c'est la scène qui décide de
 * l'ordre des zones, pas l'ordre des objets dans Tiled. Une clé qui ne
 * correspond à aucun objet du plan ne compile pas.
 */
export function hotspotsFrom<L extends SceneLayout>(
  layout: L,
  content: Partial<Record<Ids<L['hotspots']>, HotspotContent>>,
): HotspotDef[] {
  return croiser(layout.hotspots, content);
}

export function exitsFrom<L extends SceneLayout>(
  layout: L,
  content: Partial<Record<Ids<L['exits']>, ExitContent>>,
): ExitDef[] {
  return croiser(layout.exits, content);
}

function croiser<T extends object>(
  zones: readonly PlanZone[],
  content: Partial<Record<string, T>>,
): (T & PlanZone)[] {
  const defs: (T & PlanZone)[] = [];
  for (const [id, meaning] of Object.entries(content)) {
    const zone = zones.find((z) => z.id === id);
    // Injoignable en pratique — `tsc` refuse une clé absente du plan. Le garde
    // reste pour le décalage transitoire d'un plan pas encore regénéré.
    if (!zone || !meaning) continue;
    defs.push({ ...zone, ...meaning });
  }
  return defs;
}

/**
 * Liste ce qui est dessiné mais pas encore câblé — le reste à faire de la
 * scène. Ce n'est pas une erreur : c'est du contenu à écrire, et ça doit rester
 * visible plutôt que silencieux.
 */
export function signalerNonCables(layout: SceneLayout, cables: string[]): void {
  if (dejaListe.has(layout.scene)) return;
  dejaListe.add(layout.scene);

  const restants = [
    ...layout.hotspots.filter((h) => !cables.includes(h.id)).map((h) => `hs_${h.id}`),
    ...layout.exits.filter((e) => !cables.includes(e.id)).map((e) => `exit_${e.id}`),
  ];
  if (restants.length > 0) {
    console.info(`[plan] « ${layout.scene} » : ${restants.join(', ')} — dessiné, pas encore câblé`);
  }
}
