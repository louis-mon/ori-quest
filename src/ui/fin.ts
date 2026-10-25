import { gameState } from '../game/systems/state';
import { t } from '../langues/traduire';

// La fin de la version : le build publié s'arrête au dernier chapitre livré
// (src/game/chapitres.ts) et le dit, plutôt que d'emmener le joueur dans une
// scène qui n'existe pas. La fin de l'histoire, elle, passe aux crédits
// (`credits.ts`).
//
// Ce texte n'est pas dans ink, comme celui des tutoriels d'énigme et pour une
// raison voisine : il ne raconte rien, il clôt. La narration ne sait pas quels
// chapitres ont été compilés — le chapitre se referme sur sa dernière réplique,
// et cet écran prend la suite.

let pose = false;

export function montrerFin(root: HTMLElement): void {
  // Une sortie peut être touchée deux fois pendant le fondu : le deuxième appel
  // ne doit pas reposer un écran par-dessus le premier.
  if (pose) return;
  pose = true;

  const el = document.createElement('div');
  el.className = 'fin';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <p class="fin__titre">${t('À suivre…')}</p>
    <p class="fin__texte">${t('La suite nécessite encore quelques plis...')}</p>
    <button class="fin__bouton" type="button">${t('Recommencer')}</button>
  `;
  root.appendChild(el);

  // Rechargement complet, comme la remise à zéro du menu : ink garde ses
  // variables et ses passages déjà lus dans son instance `Story`, que
  // `gameState` ne touche pas.
  el.querySelector('button')!.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    gameState.reset();
    window.location.reload();
  });

  // Une frame de retard, sans quoi l'élément naît déjà à son état final et la
  // transition n'a rien à jouer : le voile tomberait d'un coup sur la dernière
  // réplique.
  requestAnimationFrame(() => el.classList.add('fin--visible'));
}
