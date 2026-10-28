// Le bouton du menu répond à deux gestes : le tap, qui ouvre la pause, et celui
// du testeur — l'enfoncer, glisser sans lâcher jusqu'au coin opposé du cadre et
// lever le doigt là —, qui bascule le mode dev (`game/systems/mode-dev.ts`).
// Rien à afficher ni à cacher au joueur, et personne ne le fait par hasard.

// La part du cadre, sur chaque axe, où le doigt doit se lever.
const COIN = 0.25;
// Un doigt glisse un peu en se levant : un tap qui déborde du bouton en reste un.
const MARGE_PX = 16;

export interface GestesDuMenu {
  tap: () => void;
  testeur: () => void;
}

export function suivreLeBoutonDuMenu(
  bouton: HTMLElement,
  cadre: HTMLElement,
  gestes: GestesDuMenu,
): void {
  let pointeur: number | null = null;

  // Capturé, le pointeur reste au bouton jusqu'au lâcher : le glisser traverse
  // le décor sans rien y déclencher, et le lâcher revient ici où qu'il tombe.
  bouton.addEventListener('pointerdown', (e) => {
    pointeur = e.pointerId;
    bouton.setPointerCapture(e.pointerId);
  });
  bouton.addEventListener('pointercancel', () => (pointeur = null));
  bouton.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointeur) return;
    pointeur = null;
    if (auCoinOppose(e, bouton, cadre)) gestes.testeur();
    else if (surLeBouton(e, bouton)) gestes.tap();
  });
}

// Opposé à la place du bouton, lue à l'écran plutôt que supposée : le geste
// suit le bouton s'il change de coin.
function auCoinOppose(e: PointerEvent, bouton: HTMLElement, cadre: HTMLElement): boolean {
  const c = cadre.getBoundingClientRect();
  const b = bouton.getBoundingClientRect();
  const oppose = (point: number, centre: number, debut: number, taille: number) => {
    const part = (point - debut) / taille;
    return (centre - debut) / taille > 0.5 ? part < COIN : part > 1 - COIN;
  };
  return (
    oppose(e.clientX, b.left + b.width / 2, c.left, c.width) &&
    oppose(e.clientY, b.top + b.height / 2, c.top, c.height)
  );
}

function surLeBouton(e: PointerEvent, bouton: HTMLElement): boolean {
  const b = bouton.getBoundingClientRect();
  return (
    e.clientX >= b.left - MARGE_PX &&
    e.clientX <= b.right + MARGE_PX &&
    e.clientY >= b.top - MARGE_PX &&
    e.clientY <= b.bottom + MARGE_PX
  );
}
