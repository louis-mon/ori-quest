import type { Overlay } from '../../ui/overlay';
import { gameState } from '../systems/state';
import { runCreasePuzzle } from './crease-puzzle';
import { PUZZLES } from './puzzles';
import { lanceurTutoriel } from './tutoriel';

// Le tag `# puzzle:`. Publie l'issue dans un drapeau `<nom>_resolu`, que la
// narration relit juste après. Montée dans la couche DOM, ce qui permet un
// glisser-déposer fiable malgré `input.windowEvents: false`.
export async function jouerEnigme(uiRoot: HTMLElement, overlay: Overlay, nom: string) {
  const def = PUZZLES[nom];
  if (!def) {
    console.error(`[puzzle] énigme inconnue : "${nom}"`);
    return;
  }
  try {
    overlay.hideDialogue();
    const outcome = await runCreasePuzzle(uiRoot, def, {
      tutoriel: lanceurTutoriel(uiRoot, overlay, def),
    });
    gameState.setFlag(`${nom}_resolu`, outcome === 'solved');
  } catch (err) {
    // Un crease pattern manquant ne doit pas bloquer la partie : on repart comme
    // d'un abandon, la narration a déjà une branche pour ça.
    console.error(`[puzzle] "${nom}" n'a pas pu s'ouvrir`, err);
    gameState.setFlag(`${nom}_resolu`, false);
  }
}
