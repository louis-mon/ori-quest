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

// Safari sur iPhone n'implémente toujours pas l'API plein écran pour un élément
// quelconque : mieux vaut masquer l'entrée qu'offrir un bouton inerte, et
// itch.io fournit de toute façon le sien.
export function pleinEcranPossible(): boolean {
  const d = document as DocumentPleinEcran;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function enPleinEcran(): boolean {
  const d = document as DocumentPleinEcran;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function basculerLePleinEcran(): Promise<void> {
  const d = document as DocumentPleinEcran;
  try {
    if (enPleinEcran()) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    } else {
      const el = cible() as ElementPleinEcran;
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
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
