import type { Ambiance, Bruitage } from './catalogue';
import { REGLAGES_SONS } from './sons-reglages';

// Le mélange, réglé à l'oreille dans sons.html. Un volume est un gain : 1 laisse
// le fichier tel que l'artiste l'a livré.
export interface ReglagesSons {
  ambiances: Record<Ambiance, number>;
  // `duree`, en secondes : au-delà, le cri s'éteint en fondu. Absente, il est
  // joué en entier.
  bruitages: Record<Bruitage, { volume: number; duree?: number }>;
}

// Ceux du fichier dans le jeu ; sons.html les remplace pour les faire entendre
// avant de les enregistrer.
let courants: ReglagesSons = REGLAGES_SONS;

export function reglagesSons(): ReglagesSons {
  return courants;
}

export function reglerLesSons(reglages: ReglagesSons) {
  courants = reglages;
}
