/**
 * Plans de scène — la géométrie vient du dessin, pas du code.
 *
 * Chaque scène a un plan dans `game-design/scenes/`, dessiné à l'échelle du jeu
 * (1280x720) dans n'importe quel éditeur vectoriel. `npm run scenes` le convertit
 * en JSON ici. Voir game-design/06-plans-de-scene.md.
 *
 * Le partage des responsabilités : le **plan** dit où et combien grand, la
 * **scène** dit ce que ça raconte (libellé, knot, condition d'apparition).
 * Déplacer une zone tactile ne demande donc plus de toucher au code, et écrire
 * un dialogue ne demande pas d'ouvrir un éditeur vectoriel.
 */
import type { Box, ExitDef, HotspotDef } from '../systems/hotspots';

export type { Box };

export interface SceneLayout {
  scene: string;
  /** Le SVG d'origine, cité dans les messages d'erreur. */
  source: string;
  design: { width: number; height: number };
  hotspots: (Box & { id: string })[];
  exits: (Box & { id: string })[];
  decor: Record<string, Box>;
}

/** Ce que la scène ajoute à la géométrie : le sens. */
export type HotspotContent = Omit<HotspotDef, 'id' | 'x' | 'y' | 'w' | 'h'>;
export type ExitContent = Omit<ExitDef, 'id' | 'x' | 'y' | 'w' | 'h'>;

const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Scènes dont on a déjà listé le reste à faire. `hotspots()` est rappelé à
 * chaque changement d'état du jeu : sans ce garde-fou, la liste défilerait en
 * boucle dans la console pendant la partie.
 */
const dejaListe = new Set<string>();

/**
 * Boîte d'un élément du plan, désigné par son nom exact dans l'éditeur —
 * `dec_sol`, `hs_feuille`, `exit_porte`. Le code parle donc le même vocabulaire
 * que le dessin, ce qui rend la correspondance vérifiable à l'œil nu.
 *
 * Un repère manquant ne fait pas planter : la scène se dessinera de travers,
 * mais la console dit exactement quel nom manque et dans quel fichier. Un jeu
 * qui refuse de démarrer parce qu'un rectangle a été renommé serait pire.
 */
export function boxOf(layout: SceneLayout, ref: string): Box {
  const [prefix, ...rest] = ref.split('_');
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
 * l'ordre des zones, pas l'ordre des calques dans l'éditeur.
 */
export function hotspotsFrom(
  layout: SceneLayout,
  content: Record<string, HotspotContent>,
): HotspotDef[] {
  return croiser(layout, layout.hotspots, content, 'hs');
}

export function exitsFrom(
  layout: SceneLayout,
  content: Record<string, ExitContent>,
): ExitDef[] {
  return croiser(layout, layout.exits, content, 'exit');
}

function croiser<T extends object>(
  layout: SceneLayout,
  boites: (Box & { id: string })[],
  content: Record<string, T>,
  prefixe: string,
): (T & Box & { id: string })[] {
  const defs: (T & Box & { id: string })[] = [];
  for (const [id, meaning] of Object.entries(content)) {
    const box = boites.find((b) => b.id === id);
    if (!box) {
      console.error(
        `[plan] « ${prefixe}_${id} » est câblé dans le code mais absent de ${layout.source}`,
      );
      continue;
    }
    defs.push({ id, x: box.x, y: box.y, w: box.w, h: box.h, ...meaning });
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
