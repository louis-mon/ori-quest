import { gameState } from './state';

// Points d'étape du chapitre, pour le développement.
//
// ⚠ Réservé à `import.meta.env.DEV` : rien de tout ceci n'entre dans le build
// publié sur itch.io.
//
// Chaque étape est l'état COMPLET attendu à ce moment-là, pas un delta : on doit
// pouvoir lire ce que le joueur a en poche sans remonter la liste.
export interface Etape {
  nom: string;
  // Scène dans laquelle on reprend.
  piece: string;
  drapeaux: string[];
  objets: string[];
}

export interface Chapitre {
  nom: string;
  etapes: Etape[];
}

// Un chapitre par entrée de menu, ses étapes dans une fenêtre à part : à huit
// étapes, le menu principal devenait une liste à faire défiler où plein écran et
// recommencer se noyaient.
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
        // Volontairement SANS `arbre_demande` : c'est l'étape où il reste à
        // repasser voir le fils pour obtenir son accord, sans quoi la découpe
        // reste fermée.
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

// Le rechargement n'est pas une facilité : ink garde ses variables et ses
// passages déjà lus dans son instance `Story`, que `gameState` ne touche pas. On
// sauterait sinon à un état neuf avec une mémoire de narration ancienne.
export function allerA(etape: Etape): void {
  gameState.reset();
  for (const drapeau of etape.drapeaux) gameState.setFlag(drapeau);
  for (const objet of etape.objets) gameState.give(objet);
  gameState.goTo(etape.piece);
  gameState.save();
  window.location.reload();
}
