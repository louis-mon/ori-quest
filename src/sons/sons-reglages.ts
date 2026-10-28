import type { ReglagesSons } from './reglages';

// ⚠ Le bloc REGLAGES_SONS est regénéré à chaque enregistrement dans
// http://localhost:5173/sons.html : ce qu'on y écrirait à la main disparaîtrait
// au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens de chaque champ est dans `reglages.ts`, à côté du type `ReglagesSons`.
export const REGLAGES_SONS: ReglagesSons = {
  ambiances: {
    chapitre_1: 1,
    chapitre_1_riviere: 0.5,
    chapitre_2: 1,
    chapitre_3_chateau: 1,
  },
  bruitages: {
    grenouille: { volume: 1, duree: 1.1 },
    hibou: { volume: 1 },
    chat: { volume: 1 },
    lune_chat: { volume: 1 },
    arbre_coupe: { volume: 1 },
    pliage: { volume: 1 },
  },
};
