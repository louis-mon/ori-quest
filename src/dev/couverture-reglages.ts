import type { ReglagesCouverture } from './couverture';

// ⚠ Le bloc REGLAGES_COUVERTURE est regénéré à chaque enregistrement dans
// http://localhost:5173/couverture.html : ce qu'on y écrirait à la main
// disparaîtrait au réglage suivant. Ce commentaire-ci, lui, est conservé.
// Le sens de chaque champ est dans `couverture.ts`, à côté du type.
export const REGLAGES_COUVERTURE: ReglagesCouverture = {
  horizon: 1,
  vue: 'face',
  retouches: {
    face: { luminosite: 1.55, contraste: 1.05, saturation: 1.1 },
    trois_quarts: { luminosite: 1, contraste: 1, saturation: 1 },
  },
  titre: { y: 0, largeur: 0.605 },
  soleil: { x: 0.11, y: 0.135, zoom: 0.15, rotation: 0, miroir: false },
  nuage1: { x: 0.3, y: 0.335, zoom: 0.12, rotation: 0, miroir: false },
  nuage2: { x: 0.85, y: 0.295, zoom: 0.11, rotation: 0, miroir: false },
  nuage3: { x: 0.6, y: 0.31, zoom: 0.09, rotation: 0, miroir: false },
  grenouille: { x: 0.64, y: 0.56, zoom: 0.22, rotation: 30, miroir: false },
  chateau: { x: 0.5, y: 0.68, zoom: 0.66, rotation: 0, miroir: false },
  hibou: { x: 0.5, y: 0.57, zoom: 0.14, rotation: 0, miroir: false },
  chat: { x: 0.13, y: 0.78, zoom: 0.42, rotation: 0, miroir: false },
  lune_chat: { x: 0.86, y: 0.77, zoom: 0.44, rotation: 0, miroir: false },
};
