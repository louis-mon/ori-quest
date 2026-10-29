import { signalerUnEchec } from '../chargement/telecharger';

// three.js est chargé à la demande, et un seul `import()` pour tout le jeu.
//
// Un nouvel essai ne servirait à rien : Chrome garde en cache l'échec d'un
// `import()` dynamique et ne refait jamais la requête. L'échec est donc signalé
// tout de suite, pour que le joueur se voie proposer de recharger la page.
let module: Promise<typeof import('three')> | null = null;

export function chargerThree(): Promise<typeof import('three')> {
  module ??= import('three').catch((err) => {
    signalerUnEchec(err);
    throw err;
  });
  return module;
}
