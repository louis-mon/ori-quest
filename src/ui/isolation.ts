// Filet de sécurité pour les écouteurs de niveau fenêtre : un tap né dans
// l'interface ne remonte pas plus haut qu'elle. L'étanchéité vis-à-vis du jeu
// vient de `input.windowEvents: false` (`game/moteur.ts`).
//
// En bouillonnement : la cible traite l'événement normalement, on l'empêche
// seulement d'aller plus loin.
export function isolerLInterface(uiRoot: HTMLElement) {
  for (const type of ['pointerdown', 'pointerup'] as const) {
    uiRoot.addEventListener(type, (event) => {
      if (event.target !== uiRoot) event.stopPropagation();
    });
  }
}
