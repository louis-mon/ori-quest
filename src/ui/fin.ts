import { gameState } from '../game/systems/state';

// L'écran de fin, pour deux raisons. La version : le build publié s'arrête au
// dernier chapitre livré (src/game/chapitres.ts) et le dit, plutôt que
// d'emmener le joueur dans une scène qui n'existe pas. L'histoire : le dernier
// knot du dernier chapitre la referme (`# fin:`).
//
// Ce texte n'est pas dans ink, comme celui des tutoriels d'énigme et pour une
// raison voisine : il ne raconte rien, il clôt. La narration ne sait pas quels
// chapitres ont été compilés — le chapitre se referme sur sa dernière réplique,
// et cet écran prend la suite.
export type RaisonDeFin = 'version' | 'histoire';

const TEXTES: Record<RaisonDeFin, { titre: string; texte: string }> = {
  version: {
    titre: 'À suivre…',
    texte: 'Fin du chapitre 1. La suite nécessite encore quelques plis...',
  },
  // [A ECRIRE]
  histoire: {
    titre: 'Fin',
    texte: 'Les chats sont réconciliés, et le château retrouve ses plis. Merci d’avoir joué !',
  },
};

let pose = false;

export function montrerFin(root: HTMLElement, raison: RaisonDeFin = 'version'): void {
  // Une sortie peut être touchée deux fois pendant le fondu : le deuxième appel
  // ne doit pas reposer un écran par-dessus le premier.
  if (pose) return;
  pose = true;

  const { titre, texte } = TEXTES[raison];
  const el = document.createElement('div');
  el.className = 'fin';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <p class="fin__titre">${titre}</p>
    <p class="fin__texte">${texte}</p>
    <button class="fin__bouton" type="button">Recommencer</button>
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
