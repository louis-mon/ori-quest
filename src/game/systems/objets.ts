// Une idée est un objet comme un autre : même inventaire, même `# give:`, même
// condition `has_`. Seul l'affichage les distingue, à partir du préfixe `idee_`.
// C'est ce qui évite deux mécanismes parallèles pour « savoir plier une hache »
// et « avoir une hache », que le joueur ne possède jamais en même temps.

// Pour ce qui n'est pas un pliage. Voir ui/vignettes.ts.
export type Dessin = 'bois';

export interface Objet {
  // Court : la colonne d'inventaire est étroite.
  nom: string;
  description: string;
  // Une idée porte le modèle qu'elle permet de plier : sa vignette est alors
  // l'image que l'énigme montre comme but, et l'objet obtenu garde la même.
  modele?: string;
  dessin?: Dessin;
}

export const OBJETS: Record<string, Objet> = {
  idee_arbre: {
    nom: "Idée : l'arbre",
    description: "Une idée de comment plier l'arbre.",
    modele: 'arbre',
  },
  idee_hache: {
    nom: 'Idée : la hache',
    description: 'Une idée de comment plier la hache.',
    modele: 'hache',
  },
  hache: {
    nom: 'La hache',
    description: 'Une hache de papier bien tranchante, idéale pour couper du bois',
    modele: 'hache',
  },
  bois: {
    nom: 'Du bois',
    description: 'De belles planches de bois. Merci vieux chêne.',
    // Le seul objet du chapitre qui ne soit pas un pliage, d'où une vignette
    // dessinée.
    dessin: 'bois',
  },

  // Chapitre 2 — le village et l'entrée du château.
  //
  // À ÉCRIRE : noms et descriptions sont un premier jet, comme les répliques du
  // chapitre (voir content/story.ink).
  idee_chien: {
    nom: 'Idée : le chien',
    description: 'Une idée de comment plier Chouaf, le chien du pingouin.',
    modele: 'chien',
  },
  idee_pot: {
    nom: 'Idée : le pot',
    description: 'Une idée de comment plier un pot à lait.',
    modele: 'pot',
  },
  // `pot` puis `lait` partagent le modèle, et c'est exact : c'est le même pot,
  // rempli entre-temps. Seul le nom du bandeau dit ce qui a changé.
  pot: {
    nom: 'Le pot',
    description: 'Un joli pot à lait en papier. Vide, pour le moment.',
    modele: 'pot',
  },
  lait: {
    nom: 'Du lait',
    description: 'Un pot de lait tout frais. Aucun chat ne résiste à ça.',
    modele: 'pot',
  },
  os: {
    nom: "L'os",
    description: 'Un os en papier, de quoi occuper un chien un bon moment.',
    modele: 'os',
  },
};

// Une idée se dessine dans une bulle ; un objet, non.
export function estIdee(id: string): boolean {
  return id.startsWith('idee_');
}

const inconnus = new Set<string>();

// Un objet absent du registre reste jouable, sous son identifiant : écrire la
// narration ne doit pas attendre que sa fiche existe.
export function objet(id: string): Objet {
  const connu = OBJETS[id];
  if (connu) return connu;
  if (!inconnus.has(id)) {
    inconnus.add(id);
    console.warn(`[objet] inconnu : ${id} (voir src/game/systems/objets.ts)`);
  }
  return { nom: id, description: '' };
}
