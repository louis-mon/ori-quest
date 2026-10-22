// Ce que dit le héros quand une vérification est fausse : le liseré rouge du
// plateau, seul, se distinguait mal.
//
// Hors d'ink pour la même raison que les tutoriels (`tutoriels.ts`) : le récit
// attend le verdict de l'énigme, et `DialogueRunner` refuse d'être relancé
// pendant qu'il tourne.

import type { Overlay } from '../../ui/overlay';
import { personnage } from '../systems/personnages';

const REPLIQUE = "Ça ne semble pas être ça, j'ai dû me tromper quelque part...";

const HEROS = personnage('heros');

export async function signalerErreur(overlay: Overlay) {
  overlay.mettreDevant(true);
  try {
    await overlay.say(REPLIQUE, HEROS);
  } finally {
    overlay.hideDialogue();
    overlay.mettreDevant(false);
  }
}
