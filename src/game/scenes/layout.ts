// Le plan dit où et combien grand, la scène dit ce que ça raconte. Voir
// game-design/06-plans-de-scene.md.
//
// Le plan généré est figé en `as const` et les fonctions ci-dessous en tirent la
// liste exacte des noms disponibles : `boxOf(PLAN, 'dec_nuages')` ne compile pas
// si la carte n'a pas ce repère. C'est ce qui empêche le code d'inventer une
// zone que le plan ne connaît pas, et donc les deux de diverger.
import type { Box, Contour, ExitDef, HotspotDef, Marqueur } from '../systems/hotspots';
import type { PlanFond } from './fond';

export type { Box, Contour, Marqueur };

// Toujours une boîte, et le contour du test tactile quand elle a été tracée au
// polygone.
export interface PlanZone extends Box {
  id: string;
  points?: Contour;
  // Le point de l'objet `marqueur` qui porte le nom de cette zone. L'import l'y
  // rattache et vérifie qu'il tombe dedans ; la scène n'a rien à en dire.
  marqueur?: Marqueur;
}

export interface SceneLayout {
  readonly scene: string;
  // La carte Tiled d'origine, citée dans les messages d'erreur.
  readonly source: string;
  readonly design: { readonly width: number; readonly height: number };
  // Optionnel : une scène d'intérieur n'en a pas, et `tsc` refuse alors le code
  // qui l'utilise, comme pour les repères de `boxOf`.
  readonly fond?: PlanFond;
  readonly hotspots: readonly PlanZone[];
  readonly exits: readonly PlanZone[];
  readonly decor: { readonly [id: string]: Box };
}

// Les identifiants réellement présents dans une liste de zones du plan.
type Ids<Z extends readonly PlanZone[]> = Z[number]['id'];

// C'est ce type qui fait échouer `tsc` sur un repère inventé.
export type PlanRef<L extends SceneLayout> =
  `hs_${Ids<L['hotspots']>}` | `exit_${Ids<L['exits']>}` | `dec_${keyof L['decor'] & string}`;

// Ce que la scène ajoute à la géométrie : le sens.
type DuPlan = 'id' | 'x' | 'y' | 'w' | 'h' | 'points' | 'marqueur';
export type HotspotContent = Omit<HotspotDef, DuPlan>;
export type ExitContent = Omit<ExitDef, DuPlan>;

const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };

// `hotspots()` est rappelé à chaque changement d'état : sans ce garde-fou, la
// liste défilerait en boucle dans la console pendant la partie.
const dejaListe = new Set<string>();

// Désigné par son rôle et son nom dans Tiled — `dec_sol`, `hs_feuille` : le code
// parle le même vocabulaire que le plan. Un nom absent est une erreur de
// compilation ; le repli ne sert qu'au plan pas encore regénéré.
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

// L'ordre du résultat suit celui de la table : c'est la scène qui décide de
// l'ordre des zones, pas l'ordre des objets dans Tiled.
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
    // Injoignable en pratique : `tsc` refuse une clé absente du plan. Le garde
    // ne sert qu'au plan pas encore regénéré.
    if (!zone || !meaning) continue;
    defs.push({ ...zone, ...meaning });
  }
  return defs;
}

// Ce qui est dessiné mais pas encore câblé. Ce n'est pas une erreur : c'est du
// contenu à écrire, qui doit rester visible plutôt que silencieux.
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
