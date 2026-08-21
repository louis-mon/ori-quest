/**
 * Ce que le héros emporte — registre des objets.
 *
 * **Une idée est un objet comme un autre.** Rien ne les distingue dans la
 * logique du jeu : même inventaire, même `# give:`, même condition `has_` dans
 * la narration. La seule différence est à l'écran, et elle se lit au nom : un
 * identifiant qui commence par `idee_` s'affiche dans une bulle. C'est ce qui
 * évite d'avoir deux mécanismes parallèles pour « savoir plier une hache » et
 * « avoir une hache » — deux choses que le joueur ne possède d'ailleurs jamais
 * en même temps.
 *
 * Des données, comme les personnages et les hotspots : ajouter un objet ne
 * demande pas de toucher au moteur.
 */

/** Vignettes dessinées, pour ce qui n'est pas un pliage. Voir ui/vignettes.ts. */
export type Dessin = 'bois';

export interface Objet {
  /** Nom affiché dans la case d'inventaire. Court : la colonne est étroite. */
  nom: string;
  /** Texte affiché au tap, puis estompé. */
  description: string;
  /**
   * Modèle origami dont le rendu sert de vignette.
   *
   * Une **idée** porte le modèle qu'elle permet de plier : la vignette de
   * l'inventaire est alors exactement l'image que l'énigme montre comme but,
   * et l'objet obtenu garde la même. Le joueur suit un seul dessin du début à
   * la fin — « je sais faire ça » puis « j'ai ça ».
   */
  modele?: string;
  /** Vignette dessinée, quand l'objet n'est pas un pliage. */
  dessin?: Dessin;
}

export const OBJETS: Record<string, Objet> = {
  idee_arbre: {
    nom: "Idée : l'arbre",
    description: 'Une idée de comment plier l\'arbre.',
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
    // Le seul objet du chapitre qui ne soit pas un pliage : le vieil arbre a
    // été découpé, il n'en reste que de la matière. D'où une vignette dessinée.
    dessin: 'bois',
  },
};

/** Une idée se dessine dans une bulle ; un objet, non. */
export function estIdee(id: string): boolean {
  return id.startsWith('idee_');
}

const inconnus = new Set<string>();

/**
 * Un objet absent du registre reste jouable — il s'affiche sous son
 * identifiant, avec un avertissement. Écrire la narration ne doit pas attendre
 * que la fiche de l'objet existe.
 */
export function objet(id: string): Objet {
  const connu = OBJETS[id];
  if (connu) return connu;
  if (!inconnus.has(id)) {
    inconnus.add(id);
    console.warn(`[objet] inconnu : ${id} (voir src/game/systems/objets.ts)`);
  }
  return { nom: id, description: '' };
}
