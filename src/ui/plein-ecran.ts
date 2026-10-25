// Le plein écran s'applique à `#app` et pas au canvas : l'interface vit dans des
// éléments frères et resterait dehors.
function cible(): HTMLElement {
  return document.getElementById('app') ?? document.documentElement;
}

type ElementPleinEcran = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type DocumentPleinEcran = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const CLE = 'ori-quest.plein-ecran';

// Safari sur iPhone n'implémente toujours pas l'API plein écran pour un élément
// quelconque : mieux vaut masquer l'entrée qu'offrir un bouton inerte.
//
// Dans une iframe — itch.io —, le plein écran est celui du site. Le site y met
// son propre cadre, ce que la page du jeu ne voit pas : ni `fullscreenElement`,
// ni `fullscreenchange`. Le menu proposait donc « Plein écran » sur un écran
// déjà plein, et l'accepter empilait un second plein écran sur celui du site —
// qu'un rechargement faisait alors tomber avec le nôtre, quand celui du site,
// seul, y survit.
export function pleinEcranPossible(): boolean {
  if (window.self !== window.top) return false;
  const d = document as DocumentPleinEcran;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function enPleinEcran(): boolean {
  const d = document as DocumentPleinEcran;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

async function entrer(): Promise<void> {
  const el = cible() as ElementPleinEcran;
  await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
}

export async function basculerLePleinEcran(): Promise<void> {
  const d = document as DocumentPleinEcran;
  try {
    if (enPleinEcran()) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    } else {
      await entrer();
    }
  } catch (err) {
    // Un refus du navigateur (geste utilisateur jugé insuffisant, politique
    // d'iframe) ne doit pas casser le menu.
    console.warn('[menu] plein écran refusé', err);
  }
}

export function suivreLePleinEcran(rappel: () => void): void {
  document.addEventListener('fullscreenchange', rappel);
  document.addEventListener('webkitfullscreenchange', rappel);
}

// Recommencer, changer de langue, un point d'étape : tout ça recharge la page,
// et un rechargement fait toujours sortir du plein écran, où le navigateur ne
// laisse revenir que sur un geste du joueur. On note donc en partant qu'on y
// était, et son premier tap l'y remet — après « Recommencer », c'est
// « Commencer à plier ».
export function garderLePleinEcranAuRechargement(): void {
  window.addEventListener('pagehide', () => {
    try {
      if (enPleinEcran()) sessionStorage.setItem(CLE, '1');
      else sessionStorage.removeItem(CLE);
    } catch {
      // Stockage refusé : la page se rouvrira fenêtrée.
    }
  });

  // Effacé aussitôt lu : une page tuée sans `pagehide` laisserait sinon la
  // marque d'un plein écran que le joueur a peut-être quitté depuis.
  let revenir = false;
  try {
    revenir = sessionStorage.getItem(CLE) === '1';
    sessionStorage.removeItem(CLE);
  } catch {
    return;
  }
  if (!revenir || !pleinEcranPossible()) return;

  // En capture : l'interface arrête ses taps avant qu'ils n'atteignent la
  // fenêtre (`isolation.ts`).
  window.addEventListener(
    'pointerup',
    () => {
      if (enPleinEcran()) return;
      entrer().catch((err) => console.warn('[menu] plein écran refusé', err));
    },
    { capture: true, once: true },
  );
}
