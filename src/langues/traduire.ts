import { CATALOGUES, RECIT_SOURCE, SOURCE } from './catalogues';
import { langue } from './langue';

// Un texte de l'interface s'écrit en français, là où il sert, enveloppé de
// `t()` : c'est ce qui permet à `npm run langues` de le trouver, et à
// `npm run check-langues` de refuser une langue où il manquerait.
//
// Le texte français EST la clé. Toujours un littéral, donc : `t(variable)` ne
// dit pas quoi traduire, et la vérification le refuse. Ce qui varie passe par
// un champ — `t('Obtenu : {nom}', { nom })` — que la traduction doit garder.

const textes = langue === SOURCE ? null : (CATALOGUES[langue]?.textes ?? null);
const signales = new Set<string>();

export function t(source: string, champs?: Record<string, string | number>): string {
  let texte = source;
  if (textes) {
    const traduit = textes[source];
    if (traduit) texte = traduit;
    else if (!signales.has(source)) {
      // Une fois par texte : `npm run check-langues` l'aurait refusé, la console
      // le dit à qui joue un build fait sans.
      signales.add(source);
      console.warn(`[langues] pas de traduction (${langue}) pour « ${source} »`);
    }
  }
  if (!champs) return texte;
  return texte.replace(/\{(\w+)\}/g, (champ, nom: string) =>
    nom in champs ? String(champs[nom]) : champ,
  );
}

// Le récit d'ink dans la langue de la partie : même structure, mêmes knots,
// mêmes tags — seuls les textes changent (tools/lib/langues.mjs).
export function recitDansLaLangue(): Record<string, unknown> {
  return (langue !== SOURCE && CATALOGUES[langue]?.recit) || RECIT_SOURCE;
}
