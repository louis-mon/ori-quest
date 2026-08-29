import type { Pose } from './vue';

// ⚠ Le bloc POSES est regénéré à chaque enregistrement dans
// http://localhost:5173/orientation.html : ce qu'on y écrirait à la main
// disparaîtrait au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens des trois champs est dans `vue.ts`, à côté du type `Pose`.
export const POSES: Record<string, Pose> = {
  pont: { angles: [-98, 6, 0], pliage: 0.86, echelle: 1.85 },
  arbre: { angles: [0, 225, 17], pliage: 0.86, echelle: 2.8 },
  hache: { angles: [33, -18, -67], pliage: 0.88, echelle: 1 },
  porte: { angles: [0, 0, -9], pliage: 0.86, echelle: 1 },
  vallee: { angles: [-70, 15, -41], pliage: 0.97, echelle: 1 },
  pli_montagne: { angles: [-70, 15, -41], pliage: 0.95, echelle: 1 },
  bombe: { angles: [42, -3, -2], pliage: 0.92, echelle: 1 },
  montagne: { angles: [69, -41, -174], pliage: 0.86, echelle: 1.8 },
  herbe: { angles: [-102, 22, 175], pliage: 0.86, echelle: 1 },
  pot: { angles: [-84, -41, -20], pliage: 0.98, echelle: 1 },
  chien: { angles: [54, -36, 141], pliage: 0.91, echelle: 1 },
  os: { angles: [0, 45, 0], pliage: 0.92, echelle: 1 },
};
