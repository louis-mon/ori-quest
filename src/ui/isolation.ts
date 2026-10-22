// Filet de sécurité pour les écouteurs de niveau fenêtre : un tap né dans
// l'interface ne remonte pas plus haut qu'elle. L'étanchéité vis-à-vis du jeu
// vient de `input.windowEvents: false` (`game/moteur.ts`).
//
// En bouillonnement : la cible traite l'événement normalement, on l'empêche
// seulement d'aller plus loin.
//
// Sauf un voile marqué `data-ailleurs` : posé sur l'énigme le temps d'une
// réplique, il reçoit les taps qui seraient tombés sur le décor, et la boîte de
// dialogue les guette sur la fenêtre pour se signaler (`surveillerAilleurs()`).
// Arrêtés ici, elle restait muette.
export function isolerLInterface(uiRoot: HTMLElement) {
  for (const type of ['pointerdown', 'pointerup'] as const) {
    uiRoot.addEventListener(type, (event) => {
      if (event.target === uiRoot) return;
      if (event.target instanceof Element && event.target.hasAttribute('data-ailleurs')) return;
      event.stopPropagation();
    });
  }
}
