import type { ReglagesTorches } from './torches';

// ⚠ Le bloc REGLAGES_TORCHES est regénéré à chaque enregistrement dans
// http://localhost:5173/torches.html : ce qu'on y écrirait à la main disparaîtrait
// au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens de chaque champ est dans `torches.ts`, à côté du type `ReglagesTorches`.
export const REGLAGES_TORCHES: ReglagesTorches = {
  teinte: '#ff8a2a',
  portee: 5,
  chaleur: 0.45,
  lueur: 0.37,
  halo: 0.1,
  vacillement: 0.5,
  rafales: 0.6,
  vitesse: 1.2,
};
