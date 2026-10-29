import type { CoucheDuRecit } from '../origami/couche-du-recit';
import type { EcranDeChargement } from '../ui/chargement';
import type { Overlay } from '../ui/overlay';
import type { Navigation } from './navigation';
import { jouerEnigme } from './puzzle/jouer-enigme';
import type { DialogueEffects } from './systems/dialogue';
import { objet } from './systems/objets';
import { gameState } from './systems/state';

// Ce que chaque tag ink fait au jeu, branché sur le système qui le joue.
// `couvrir` : voir `couvrirLeJeu()` (`gel.ts`).
export function effetsDuRecit(
  uiRoot: HTMLElement,
  overlay: Overlay,
  chargement: EcranDeChargement,
  couche: CoucheDuRecit,
  navigation: Navigation,
  couvrir: () => () => void,
): DialogueEffects {
  return {
    origami: couche.plier,
    rangerLePliage: couche.ranger,
    puzzle: (nom) => jouerEnigme(uiRoot, overlay, chargement, nom, couvrir),
    goto: navigation.goto,
    donner: (item) => {
      const { modele } = objet(item);
      donner(overlay, item, modele ? couche.quandOnRange(modele) : null);
    },
    fin: () => navigation.finir('histoire'),
  };
}

// Ici et pas dans l'état : `gameState.give()` sert aussi à restaurer une
// sauvegarde et à sauter à un point d'étape, où il n'y a rien à annoncer. Seul
// le tag `# give:` est une obtention — et pas quand l'objet est déjà là, sinon
// un `# give:` rejoué ferait voler une seconde hache.
export function donner(
  overlay: Overlay,
  item: string,
  depart: Promise<DOMRect | null> | null = null,
) {
  if (!gameState.has(item)) overlay.annoncerObtention(item, depart);
  gameState.give(item);
}
