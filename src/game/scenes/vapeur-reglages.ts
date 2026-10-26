import type { ReglagesVapeur } from './vapeur';

// ⚠ Le bloc REGLAGES_VAPEUR est regénéré à chaque enregistrement dans
// http://localhost:5173/vapeur.html : ce qu'on y écrirait à la main disparaîtrait
// au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens de chaque champ est dans `vapeur.ts`, à côté du type `ReglagesVapeur`.
export const REGLAGES_VAPEUR: ReglagesVapeur = {
  debit: 6,
  duree: 2.8,
  hauteur: 1,
  taille: 0.18,
  epanouissement: 3,
  etirement: 1.6,
  opacite: 0.75,
  etalement: 0.8,
  ondulation: 0.16,
};
