import recitSource from '../generated/story.json';

// Les langues du jeu sont les fichiers que `npm run ink` a écrits, un par
// catalogue de content/langues/ : en ajouter une ne demande rien ici.
//
// Chargés d'emblée et non à la demande : les textes servent dès l'évaluation des
// modules (`OBJETS`, `PERSONNAGES`…), avant qu'aucune promesse n'ait pu se
// dénouer, et le build vise une cible sans `await` au niveau du module.

export interface Catalogue {
  // Texte français de l'interface -> sa traduction.
  textes: Record<string, string>;
  // Le JSON d'ink, à ses textes près.
  recit: Record<string, unknown>;
}

export const SOURCE = 'fr';

const fichiers = import.meta.glob<Catalogue>('../generated/langues/*.json', {
  eager: true,
  import: 'default',
});

export const CATALOGUES: Record<string, Catalogue> = Object.fromEntries(
  Object.entries(fichiers).map(([chemin, catalogue]) => [
    /([^/]+)\.json$/.exec(chemin)![1],
    catalogue,
  ]),
);

export const RECIT_SOURCE = recitSource as Record<string, unknown>;
