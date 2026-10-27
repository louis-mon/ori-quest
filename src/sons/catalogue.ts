// Les sons du jeu, livrés par l'artiste (README, « Intégrer les sons »). Chemins
// relatifs : itch.io sert le jeu depuis un sous-dossier.
//
// Chaque pièce dit elle-même quelle ambiance elle joue (`ambiance`, dans
// `PointClickScene`), et chaque zone quel cri pousse son animal (`cri`, dans
// `HotspotDef`).

// Courts, décodés une fois et gardés en mémoire.
export const BRUITAGES = {
  grenouille: 'assets/sons/bruitage/grenouille.mp3',
  hibou: 'assets/sons/bruitage/hibou.mp3',
  chat: 'assets/sons/bruitage/chat.mp3',
  lune_chat: 'assets/sons/bruitage/lune_chat.mp3',
  arbre_coupe: 'assets/sons/bruitage/arbre_coupe.mp3',
} as const;

export type Bruitage = keyof typeof BRUITAGES;

export function estUnBruitage(nom: string): nom is Bruitage {
  return nom in BRUITAGES;
}

// Plusieurs minutes chacune : lues en flux, jamais décodées en entier. Les
// fichiers gardent le nom que l'artiste leur a donné.
export const AMBIANCES = {
  // Les deux pièces du chapitre 1, et aussi le jardin : l'artiste a livré
  // `son_ambiance_chapitre_3_jardin.mp3` identique à celui-ci, octet pour octet.
  chapitre_1: 'assets/sons/ambiance/chapitre_1.mp3',
  // Au ravin, par-dessus `chapitre_1`.
  chapitre_1_riviere: 'assets/sons/ambiance/chapitre_1_riviere.mp3',
  chapitre_2: 'assets/sons/ambiance/chapitre_2.mp3',
  chapitre_3_chateau: 'assets/sons/ambiance/chapitre_3_chateau.mp3',
} as const;

export type Ambiance = keyof typeof AMBIANCES;
