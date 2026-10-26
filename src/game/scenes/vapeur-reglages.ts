import type { ReglagesVapeur } from './vapeur';

// ⚠ Le bloc REGLAGES_VAPEUR est regénéré à chaque enregistrement dans
// http://localhost:5173/vapeur.html : ce qu'on y écrirait à la main disparaîtrait
// au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens de chaque champ est dans `vapeur.ts`, à côté du type `ReglagesVapeur`.
export const REGLAGES_VAPEUR: ReglagesVapeur = {
  filets: 3,
  duree: 3,
  hauteur: 1.05,
  epaisseur: 0.095,
  epanouissement: 3.3,
  opacite: 0.9,
  etalement: 0.79,
  ondulation: 0.16,
  boucles: 0.7,
  enroulement: 0.8,
  intermittence: 0.6,
};
