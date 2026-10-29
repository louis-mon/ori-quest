import { signalerUnEchec } from '../../chargement/telecharger';
import type { EcranDeChargement } from '../../ui/chargement';
import type { Overlay } from '../../ui/overlay';
import { gameState } from '../systems/state';
import { runCreasePuzzle } from './crease-puzzle';
import { signalerErreur } from './erreur';
import { PUZZLES } from './puzzles';
import { lanceurTutoriel } from './tutoriel';

// Le tag `# puzzle:`. Publie l'issue dans un drapeau `<nom>_resolu`, que la
// narration relit juste après. Montée dans la couche DOM, ce qui permet un
// glisser-déposer fiable malgré `input.windowEvents: false`.
//
// `couvrir` arrête le décor le temps de l'énigme, qui le recouvre en entier ; il
// rend de quoi le relancer.
//
// Le motif arrive par le réseau : entre la boîte de dialogue refermée et le
// plateau monté, l'écran restait figé sur un décor qui ne répondait plus — en
// 3G, plusieurs secondes. L'écran de chargement couvre ce temps-là.
export async function jouerEnigme(
  uiRoot: HTMLElement,
  overlay: Overlay,
  chargement: EcranDeChargement,
  nom: string,
  couvrir: () => () => void,
) {
  const def = PUZZLES[nom];
  if (!def) {
    console.error(`[puzzle] énigme inconnue : "${nom}"`);
    return;
  }
  const decouvrir = couvrir();
  try {
    overlay.hideDialogue();
    chargement.commencer();
    const outcome = await runCreasePuzzle(uiRoot, def, {
      tutoriel: lanceurTutoriel(uiRoot, overlay, def),
      signalerErreur: () => signalerErreur(overlay),
      montee: () => chargement.terminer(),
    });
    gameState.setFlag(`${nom}_resolu`, outcome === 'solved');
  } catch (err) {
    // Un crease pattern manquant ne doit pas bloquer la partie : on repart comme
    // d'un abandon, la narration a déjà une branche pour ça — et le joueur
    // apprend pourquoi l'énigme ne s'est pas ouverte.
    signalerUnEchec(new Error(`énigme "${nom}" : ${String(err)}`));
    gameState.setFlag(`${nom}_resolu`, false);
  } finally {
    // Sans effet après un échec signalé : l'écran garde son message.
    chargement.terminer();
    decouvrir();
  }
}
