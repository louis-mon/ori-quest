/**
 * Qui parle — registre des personnages.
 *
 * La narration désigne un locuteur par son identifiant (`# qui: renard` dans
 * ink) ; c'est ici qu'on décide comment il se montre dans la boîte de
 * dialogue : son nom, et sa vignette quand il en a une.
 *
 * Des données, comme les hotspots : ajouter un PNJ ne demande pas de toucher au
 * moteur de dialogue. Un identifiant absent de ce registre reste jouable — le
 * dialogue affiche l'identifiant tel quel et prévient en console — pour qu'on
 * puisse écrire les répliques avant que le graphisme n'existe.
 *
 * Le héros est **la grenouille** : il a une entrée comme les autres, et parle
 * donc sous sa vignette. Ce qui reste sans `# qui:` est la narration — les
 * descriptions et sa voix intérieure.
 */

export interface Personnage {
  /** Nom affiché dans la boîte de dialogue. */
  nom: string;
  /**
   * Vignette carrée, chemin **relatif** (itch.io sert le jeu depuis un
   * sous-dossier : un chemin absolu casserait le chargement). Facultative — un
   * personnage sans vignette n'affiche que son nom.
   */
  portrait?: string;
  /** Couleur du nom. Par défaut l'accent du jeu. */
  couleur?: string;
}

/**
 * Les vignettes vivent dans `public/assets/personnages/`, carrées et petites :
 * elles s'affichent à ~56 px, 160 px de côté suffisent largement. On les tire
 * des PNG de l'artiste, déjà détourés sur fond transparent :
 *
 *     sips -Z 160 assets-src/graphisme_origami/renard.png \
 *          --out public/assets/personnages/renard.png
 */
export const PERSONNAGES: Record<string, Personnage> = {
  grenouille: { nom: 'La grenouille', portrait: 'assets/personnages/grenouille.png' },
  renard: { nom: 'Le renard', portrait: 'assets/personnages/renard.png' },
  hibou: { nom: 'Le hibou', portrait: 'assets/personnages/hibou.png' },
  // Le jeune arbre du chapitre 1 parle, mais n'a pas encore de vignette : le
  // registre accepte un personnage sans portrait, seul son nom s'affiche.
  arbre: { nom: 'Le jeune arbre' },
};

/**
 * Noms de rôle acceptés dans ink, à côté des identifiants d'espèce.
 *
 * `# qui: heros` dit ce que la ligne fait dans le récit, `# qui: grenouille` dit
 * qui la prononce — les deux se valent à l'écriture. Le jour où le héros change
 * de forme, ce qui n'a rien d'invraisemblable dans un jeu d'origami, seule cette
 * table bouge et les dialogues déjà écrits suivent.
 */
const ALIAS: Record<string, string> = {
  heros: 'grenouille',
};

const inconnus = new Set<string>();

/**
 * Résout un identifiant de locuteur. `null` = narration (pas d'en-tête).
 *
 * Un identifiant inconnu n'interrompt pas le dialogue : il s'affiche tel quel.
 * Écrire le texte doit rester possible avant que le personnage n'existe
 * vraiment — l'avertissement en console suffit à ne pas l'oublier.
 */
export function personnage(id: string | null): Personnage | null {
  if (!id) return null;
  const connu = PERSONNAGES[ALIAS[id] ?? id];
  if (connu) return connu;
  if (!inconnus.has(id)) {
    inconnus.add(id);
    console.warn(`[ink] personnage inconnu : ${id} (voir src/game/systems/personnages.ts)`);
  }
  return { nom: id };
}
