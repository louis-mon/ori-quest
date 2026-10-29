import { animationOrigami } from './fold-file';
import { POSES } from './poses';
import { chargerThree } from './three';

// three.js et tous les pliages, en tâche de fond, une fois la première pièce
// montrée : le premier pli du récit les attendait sinon — la réplique « le pont
// se positionne » se lisait dix secondes sur un pont absent, en 3G. Moins de
// 250 ko de modèles, et three.js que le premier pli demandera de toute façon.
//
// Un échec ici ne dit rien : `chargerThree()` signale déjà le sien, et un modèle
// manqué sera redemandé quand on en aura besoin.
export function prechargerLesPliages(): void {
  chargerThree().catch(() => {});
  for (const nom of Object.keys(POSES)) animationOrigami(nom).catch(() => {});
}
