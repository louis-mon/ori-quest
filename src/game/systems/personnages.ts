// Qui parle. Un identifiant absent de ce registre reste jouable — le dialogue
// l'affiche tel quel et prévient en console — pour qu'on puisse écrire les
// répliques avant que le graphisme n'existe.
//
// Le héros est la grenouille et a une entrée comme les autres. Ce qui reste sans
// `# qui:` est la narration : les descriptions et sa voix intérieure.

export interface Personnage {
  nom: string;
  // Chemin relatif : itch.io sert le jeu depuis un sous-dossier.
  portrait?: string;
  // Par défaut l'accent du jeu.
  couleur?: string;
}

// Les vignettes vivent dans `public/assets/personnages/`, carrées : elles
// s'affichent à ~56 px, 160 px de côté suffisent. On les tire des PNG de
// l'artiste, déjà détourés :
//
//     sips -Z 160 assets-src/graphisme_origami/renard.png \
//          --out public/assets/personnages/renard.png
export const PERSONNAGES: Record<string, Personnage> = {
  grenouille: { nom: 'La grenouille', portrait: 'assets/personnages/grenouille.png' },
  renard: { nom: 'Le renard', portrait: 'assets/personnages/renard.png' },
  hibou: { nom: 'Le hibou', portrait: 'assets/personnages/hibou.png' },
  // Sa vignette est le pliage que la scène du pont pose dans le décor : celui
  // qui parle et celui qu'on voit au bord du ravin doivent être le même.
  arbre: { nom: 'Le jeune arbre', portrait: 'assets/personnages/arbre.png' },
};

// Noms de rôle acceptés dans ink, à côté des identifiants d'espèce. Le jour où
// le héros change de forme, seule cette table bouge et les dialogues suivent.
const ALIAS: Record<string, string> = {
  heros: 'grenouille',
};

const inconnus = new Set<string>();

// `null` = narration, pas d'en-tête.
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
