import type { Pose } from './vue';

// ⚠ Le bloc POSES est regénéré à chaque enregistrement dans
// http://localhost:5173/orientation.html : ce qu'on y écrirait à la main
// disparaîtrait au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens des deux champs est dans `vue.ts`, à côté du type `Pose`.
export const POSES: Record<string, Pose> = {
  pont: { angles: [-98, 6, 0], pliage: 0.86 },
  arbre: { angles: [0, 225, 17], pliage: 0.86 },
  hache: { angles: [33, -18, -67], pliage: 0.88 },
  porte: { angles: [0, 0, -9], pliage: 0.86 },
  vallee: { angles: [-70, 15, -41], pliage: 0.97 },
  pli_montagne: { angles: [-70, 15, -41], pliage: 0.95 },
  bombe: { angles: [42, -3, -2], pliage: 0.92 },
  montagne: { angles: [69, -41, -174], pliage: 0.86 },
  herbe: { angles: [-102, 22, 175], pliage: 0.86 },
  pot: { angles: [-84, -41, -20], pliage: 0.98 },
  chien: { angles: [54, -36, 141], pliage: 0.91 },
  os: { angles: [0, 45, 0], pliage: 0.92 },
};
