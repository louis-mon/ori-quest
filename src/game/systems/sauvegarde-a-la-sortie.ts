import { gameState } from './state';

// Dernier moment fiable pour écrire sur iOS : l'onglet peut être tué ensuite.
export function sauverALaSortie() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') gameState.save();
  });
  window.addEventListener('pagehide', () => gameState.save());
}
