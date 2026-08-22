import type { Pose } from './vue';

/**
 * La pose de chaque modèle plié — orientation, pliage final, taille dans le décor.
 *
 * ⚠ **Fichier écrit par l'outil de réglage**, pas à la main :
 *
 *     npm run dev  puis  http://localhost:5173/orientation.html
 *
 * Le bloc `POSES` ci-dessous est **regénéré** à chaque enregistrement : ce qu'on
 * y écrirait à la main disparaîtrait au réglage suivant. Ce commentaire-ci, en
 * revanche, est conservé. Les explications de fond vivent dans `vue.ts`, à côté
 * du type `Pose`.
 *
 * Il est séparé pour cette raison exactement : une machine réécrit ce fichier,
 * des humains écrivent l'autre.
 */
export const POSES: Record<string, Pose> = {
  pont: { angles: [-98, 6, 0], pliage: 0.86, echelle: 1.15 },
  arbre: { angles: [0, 225, 17], pliage: 0.86, echelle: 2.8 },
  hache: { angles: [33, -18, -67], pliage: 0.88, echelle: 1 },
  porte: { angles: [0, 0, -9], pliage: 0.86, echelle: 1 },
  vallee: { angles: [-70, 15, -41], pliage: 0.94, echelle: 1 },
};
