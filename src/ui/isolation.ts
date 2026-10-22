// Un tap né dans l'interface ne doit atteindre ni le jeu ni les écouteurs de
// niveau fenêtre. L'étanchéité vis-à-vis du jeu tient à deux choses :
// `input.windowEvents: false` (`game/moteur.ts`) pour les événements pointeur,
// et `ecarterLaSourisRejouee()` ci-dessous pour la souris qu'un toucher émule.
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
  ecarterLaSourisRejouee(uiRoot);
}

// Après un toucher, le navigateur rejoue le tap en souris — `mousedown` puis
// `mouseup` au même point — et ces événements visent ce qui s'y trouve À CE
// MOMENT-LÀ. Le tap qui ferme la boîte de dialogue la retire de dessous le
// doigt : la souris rejouée tombe alors sur le canvas, et Phaser, qui écoute la
// souris, déclenche le hotspot situé dessous. Au jardin, la fontaine couvre tout
// le bas du cadre, et rouvrait son dialogue à chaque fois qu'on le refermait.
//
// Ni `touchend` ni `touchstart` ne permettent de l'empêcher : le premier
// n'atteint plus l'interface quand sa cible vient d'en être retirée — un bouton
// de choix —, et le second, annulé, bloquerait le défilement des listes du menu.
// On écarte donc la souris d'un toucher né dans l'interface, jusqu'au contact
// suivant, qui commence toujours par un `pointerdown`. L'interface n'écoute que
// des événements pointeur : elle n'y perd rien.
function ecarterLaSourisRejouee(uiRoot: HTMLElement) {
  let rejouee = false;
  window.addEventListener(
    'pointerdown',
    (event) => {
      rejouee = event.pointerType !== 'mouse' && uiRoot.contains(event.target as Node);
    },
    true,
  );
  for (const type of ['mousedown', 'mouseup'] as const) {
    window.addEventListener(
      type,
      (event) => {
        if (rejouee) event.stopPropagation();
      },
      true,
    );
  }
}
