import type { ReglagesEau } from './eau';

// ⚠ Le bloc REGLAGES_EAU est regénéré à chaque enregistrement dans
// http://localhost:5173/eau.html : ce qu'on y écrirait à la main disparaîtrait
// au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens de chaque champ est dans `eau.ts`, à côté du type `ReglagesEau`.
export const REGLAGES_EAU: ReglagesEau = {
  couleur: '#6b9cc7',
  relief: 1,
  plis: 1,
  defilement: 20,
  vagues: 0.4,
  amplitude: 6.5,
  longueur: 70,
  reflet: 0.18,
  berges: 0.3,
  inclinaison: 60,
};
