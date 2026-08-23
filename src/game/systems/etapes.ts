import { gameState } from './state';

/**
 * Points d'étape du chapitre, pour le développement.
 *
 * Rejouer tout le chapitre à chaque essai coûte plusieurs minutes et une
 * énigme ; il suffit d'une correction de dialogue en fin de parcours pour que
 * ça devienne le poste de dépense principal. Ces entrées reconstituent un
 * moment précis de la partie.
 *
 * ⚠ Réservé au mode développement (`import.meta.env.DEV`) : rien de tout ceci
 * n'entre dans le build publié sur itch.io.
 *
 * Chaque étape est l'état **complet** attendu à ce moment-là, pas un delta :
 * une étape qu'on lit doit dire ce que le joueur a en poche sans qu'on ait à
 * remonter la liste.
 */
export interface Etape {
  nom: string;
  /** Scène dans laquelle on reprend. */
  piece: string;
  drapeaux: string[];
  objets: string[];
}

export interface Chapitre {
  nom: string;
  etapes: Etape[];
}

/**
 * Un chapitre par entrée de menu, ses étapes dans une fenêtre à part : à huit
 * étapes le menu principal devenait une liste à faire défiler, et les deux
 * entrées qui comptent vraiment — plein écran, recommencer — s'y noyaient.
 */
export const CHAPITRES: Chapitre[] = [
  {
    nom: 'Chapitre 1 — le ravin et la porte',
    etapes: [
      {
        nom: 'Début du chapitre',
        piece: 'pont',
        drapeaux: [],
        objets: [],
      },
      {
        nom: 'Pont posé',
        piece: 'pont',
        drapeaux: ['pont_vu', 'pont_resolu', 'pont_plie'],
        objets: [],
      },
      {
        nom: 'Devant la porte',
        piece: 'porte',
        drapeaux: ['pont_vu', 'pont_resolu', 'pont_plie', 'porte_vue'],
        objets: [],
      },
      {
        nom: 'Le renard a parlé',
        piece: 'porte',
        drapeaux: [
          'pont_vu',
          'pont_resolu',
          'pont_plie',
          'porte_vue',
          'porte_disparue',
          'renard_bois_su',
        ],
        objets: ['idee_hache'],
      },
      {
        nom: 'Hache en main',
        piece: 'porte',
        drapeaux: [
          'pont_vu',
          'pont_resolu',
          'pont_plie',
          'porte_vue',
          'porte_disparue',
          'renard_bois_su',
          'hache_resolu',
          'hache_pliee',
        ],
        // L'idée de la hache s'est dépensée en la pliant.
        objets: ['hache'],
      },
      {
        // Volontairement **sans** `arbre_demande` : c'est l'étape où il reste à
        // repasser voir le fils pour obtenir son accord, sans quoi la découpe
        // reste fermée. Voir `pont_vieil_arbre_plie` dans content/story.ink.
        nom: 'Vieil arbre plié',
        piece: 'pont',
        drapeaux: [
          'pont_vu',
          'pont_resolu',
          'pont_plie',
          'porte_vue',
          'porte_disparue',
          'renard_bois_su',
          'hache_resolu',
          'hache_pliee',
          'arbre_parle',
          'arbre_resolu',
          'arbre_plie',
        ],
        objets: ['hache'],
      },
      {
        nom: 'Bois en poche',
        piece: 'porte',
        drapeaux: [
          'pont_vu',
          'pont_resolu',
          'pont_plie',
          'porte_vue',
          'porte_disparue',
          'renard_bois_su',
          'hache_resolu',
          'hache_pliee',
          'arbre_parle',
          'arbre_resolu',
          'arbre_plie',
          'arbre_demande',
          'vieil_arbre_decoupe',
        ],
        // La hache a servi : elle a quitté l'inventaire au moment de la découpe.
        objets: ['bois'],
      },
      {
        nom: 'Porte pliée (fin)',
        piece: 'porte',
        drapeaux: [
          'pont_vu',
          'pont_resolu',
          'pont_plie',
          'porte_vue',
          'porte_disparue',
          'renard_bois_su',
          'hache_resolu',
          'hache_pliee',
          'arbre_parle',
          'arbre_resolu',
          'arbre_plie',
          'arbre_demande',
          'vieil_arbre_decoupe',
          'porte_resolu',
          'porte_plie',
        ],
        objets: [],
      },
    ],
  },
];

/**
 * Installe l'étape, puis recharge la page.
 *
 * Le rechargement n'est pas une facilité : le récit ink garde ses variables et
 * ses passages déjà lus dans son instance `Story`, que `gameState` ne touche
 * pas. Sans rechargement, on sauterait à un état de jeu neuf avec une mémoire
 * de narration ancienne — un dialogue « première visite » qui refuse de
 * rejouer, par exemple. Même raison que « Recommencer ».
 */
export function allerA(etape: Etape): void {
  gameState.reset();
  for (const drapeau of etape.drapeaux) gameState.setFlag(drapeau);
  for (const objet of etape.objets) gameState.give(objet);
  gameState.goTo(etape.piece);
  gameState.save();
  window.location.reload();
}
