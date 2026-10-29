import { t } from '../langues/traduire';

// Tout ce qui se plie passe par WebGL : le décor, les énigmes, les vignettes.
// Sans lui, le jeu démarrait quand même — Phaser se rabat sur le canvas 2D — et
// ne cassait qu'au premier pliage, ou bloquait sur le chargement d'une pièce
// dont le pont ne se rendrait jamais. Mieux vaut le dire avant de commencer.
// Ça arrive sur un navigateur dont l'accélération matérielle est coupée.
export function webglDisponible(): boolean {
  try {
    const toile = document.createElement('canvas');
    const gl = toile.getContext('webgl2') ?? toile.getContext('webgl');
    // Rendu tout de suite : le navigateur limite les contextes vivants et
    // sacrifie le plus ancien, celui de Phaser.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

export function direQueWebGLManque(root: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'fin fin--visible';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <p class="fin__titre">${t('Ce jeu a besoin de WebGL')}</p>
    <p class="fin__texte">${t('Ton navigateur ne le propose pas en ce moment. Active l’accélération matérielle dans ses réglages, ou essaie un autre navigateur.')}</p>
  `;
  root.appendChild(el);
}
