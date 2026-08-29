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
  {
    nom: 'Chapitre 2 — le village et le château',
    etapes: [
      {
        nom: 'Début du chapitre',
        piece: 'village',
        drapeaux: [],
        objets: [],
      },
      {
        nom: 'Le pingouin a chaud',
        piece: 'village',
        drapeaux: ['village_vu', 'pingouin_chaud'],
        objets: [],
      },
      {
        nom: 'Montagne pliée',
        piece: 'village',
        drapeaux: ['village_vu', 'pingouin_chaud', 'montagne_resolu', 'montagne_pliee'],
        objets: [],
      },
      {
        nom: 'Idée du chien',
        piece: 'village',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
        ],
        objets: ['idee_chien'],
      },
      {
        nom: 'Herbe pliée',
        piece: 'village',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
          'vache_faim',
          'herbe_resolu',
          'herbe_pliee',
        ],
        objets: ['idee_chien'],
      },
      {
        // Le pot est plié mais encore vide : c'est l'étape d'où l'on repart
        // voir la vache.
        nom: 'Pot à lait plié',
        piece: 'village',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
          'vache_faim',
          'herbe_resolu',
          'herbe_pliee',
          'herbe_broutee',
          'vache_pot_su',
          'pot_resolu',
          'pot_plie',
        ],
        objets: ['idee_chien', 'pot'],
      },
      {
        nom: 'Devant le château',
        piece: 'entree',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
          'vache_faim',
          'herbe_resolu',
          'herbe_pliee',
          'herbe_broutee',
          'vache_pot_su',
          'pot_resolu',
          'pot_plie',
          'entree_vue',
        ],
        objets: ['idee_chien', 'lait'],
      },
      {
        nom: "Le papier de l'os est tombé",
        piece: 'entree',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
          'vache_faim',
          'herbe_resolu',
          'herbe_pliee',
          'herbe_broutee',
          'vache_pot_su',
          'pot_resolu',
          'pot_plie',
          'entree_vue',
          'chat_vu',
          'chat_lait',
          'os_tombe',
          'diplo_su',
        ],
        objets: ['idee_chien'],
      },
      {
        nom: "Chouaf plié, l'os en main",
        piece: 'entree',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
          'vache_faim',
          'herbe_resolu',
          'herbe_pliee',
          'herbe_broutee',
          'vache_pot_su',
          'pot_resolu',
          'pot_plie',
          'entree_vue',
          'chat_vu',
          'chat_lait',
          'os_tombe',
          'diplo_su',
          'chien_resolu',
          'chien_plie',
          'os_resolu',
          'os_plie',
        ],
        objets: ['os'],
      },
      {
        // L'os est parti au chien, qui a fait fuir le dinosaure.
        nom: 'Le passage est libre (fin)',
        piece: 'entree',
        drapeaux: [
          'village_vu',
          'pingouin_chaud',
          'montagne_resolu',
          'montagne_pliee',
          'pingouin_chien_su',
          'vache_faim',
          'herbe_resolu',
          'herbe_pliee',
          'herbe_broutee',
          'vache_pot_su',
          'pot_resolu',
          'pot_plie',
          'entree_vue',
          'chat_vu',
          'chat_lait',
          'os_tombe',
          'diplo_su',
          'chien_resolu',
          'chien_plie',
          'os_resolu',
          'os_plie',
          'diplo_pousse',
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
