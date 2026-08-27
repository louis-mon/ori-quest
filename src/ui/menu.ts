import { gameState } from '../game/systems/state';
import { allerA, CHAPITRES } from '../game/systems/etapes';

/**
 * Menu du jeu : plein écran et remise à zéro de la progression.
 *
 * Comme le reste de l'interface, c'est du DOM posé au-dessus du canvas — voir
 * la note d'architecture dans CLAUDE.md.
 */

/**
 * Le plein écran s'applique à `#app`, pas au canvas Phaser.
 *
 * Passer le seul canvas en plein écran laisserait dehors toute l'interface
 * (dialogues, inventaire, ce menu), puisqu'elle vit dans des éléments frères.
 * `#app` est le plus petit ancêtre qui contienne l'ensemble.
 */
function fullscreenTarget(): HTMLElement {
  return document.getElementById('app') ?? document.documentElement;
}

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenCapableDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function fullscreenSupported(): boolean {
  const d = document as FullscreenCapableDocument;
  // Safari sur iPhone n'implémente toujours pas l'API plein écran pour un
  // élément quelconque (seules les vidéos y ont droit). Sur ces appareils on
  // masque l'entrée plutôt que d'offrir un bouton qui ne fait rien — et itch.io
  // fournit de toute façon son propre plein écran.
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

function isFullscreen(): boolean {
  const d = document as FullscreenCapableDocument;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

async function toggleFullscreen(): Promise<void> {
  const d = document as FullscreenCapableDocument;
  try {
    if (isFullscreen()) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    } else {
      const el = fullscreenTarget() as FullscreenCapableElement;
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    }
  } catch (err) {
    // Un refus du navigateur (geste utilisateur jugé insuffisant, politique
    // d'iframe) ne doit pas casser le menu.
    console.warn('[menu] plein écran refusé', err);
  }
}

/**
 * Le sélecteur de point d'étape, en développement seulement.
 *
 * `import.meta.env.DEV` est remplacé par une constante à la compilation : en
 * production la condition est fausse, et le bloc — comme le module `etapes` —
 * disparaît du bundle. Rien de ce menu de test ne part sur itch.io.
 */
function etapesHtml(): string {
  if (!import.meta.env.DEV) return '';
  const items = CHAPITRES.map(
    (chapitre, i) =>
      `<button class="menu__item" data-action="chapitre" data-chapitre="${i}">${chapitre.nom}</button>`,
  ).join('');
  return `<p class="menu__label">Reprendre à… (dev)</p>${items}`;
}

export interface MenuOptions {
  /** Appelé après un changement de mise en page (entrée/sortie de plein écran). */
  onLayoutChange: () => void;
}

export class Menu {
  private button: HTMLButtonElement;
  private panel: HTMLElement;
  private fullscreenItem: HTMLButtonElement;
  private confirm: HTMLElement;
  private etapes: HTMLElement;
  /** Transparent, plein cadre : il absorbe les taps pendant que le menu est ouvert. */
  private voile: HTMLElement;

  constructor(
    root: HTMLElement,
    private options: MenuOptions,
  ) {
    const el = document.createElement('div');
    el.className = 'menu';
    el.innerHTML = `
      <div class="menu__voile" hidden></div>
      <button class="menu__button" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div class="menu__panel" hidden>
        <button class="menu__item" data-action="fullscreen">Plein écran</button>
        <button class="menu__item menu__item--danger" data-action="reset">
          Recommencer
        </button>
        ${etapesHtml()}
      </div>
      <div class="menu__etapes" hidden role="dialog" aria-modal="true">
        <div class="menu__confirm-box">
          <p class="menu__confirm-text menu__etapes-titre"></p>
          <div class="menu__etapes-liste"></div>
          <div class="menu__confirm-actions">
            <button class="menu__item" data-action="cancel-etapes">Fermer</button>
          </div>
        </div>
      </div>
      <div class="menu__confirm" hidden role="alertdialog" aria-modal="true">
        <div class="menu__confirm-box">
          <p class="menu__confirm-text">
            Effacer toute ta progression et repartir du début ?
            <strong>Cette action est définitive.</strong>
          </p>
          <div class="menu__confirm-actions">
            <button class="menu__item" data-action="cancel">Annuler</button>
            <button class="menu__item menu__item--danger" data-action="confirm">
              Tout effacer
            </button>
          </div>
        </div>
      </div>
    `;
    root.appendChild(el);

    this.button = el.querySelector('.menu__button')!;
    this.panel = el.querySelector('.menu__panel')!;
    this.fullscreenItem = el.querySelector('[data-action="fullscreen"]')!;
    this.confirm = el.querySelector('.menu__confirm')!;
    this.etapes = el.querySelector('.menu__etapes')!;
    this.voile = el.querySelector('.menu__voile')!;

    if (!fullscreenSupported()) this.fullscreenItem.hidden = true;

    this.button.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    el.querySelectorAll<HTMLButtonElement>('.menu__item').forEach((item) => {
      item.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        // Le test `import.meta.env.DEV` est ici AUSSI, et pas seulement autour
        // du HTML : sans lui, `CHAPITRES` reste référencé depuis ce
        // gestionnaire, le module `etapes` ne peut pas être élagué, et la liste
        // des points d'étape part dans le bundle publié. Vérifié — elle y était.
        if (import.meta.env.DEV) {
          const chapitre = item.dataset.chapitre;
          if (chapitre !== undefined) {
            this.ouvrirEtapes(Number(chapitre));
            return;
          }
        }
        void this.onAction(item.dataset.action);
      });
    });

    // Le voile absorbe le tap qui referme le menu. Sans lui, Phaser le traite
    // sur le canvas avant qu'il ne remonte à l'écouteur `window` ci-dessous :
    // un seul geste, et le hotspot sous le doigt partait aussi.
    this.voile.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.close();
    });
    window.addEventListener('pointerup', () => {
      if (!this.panel.hidden) this.close();
    });

    document.addEventListener('fullscreenchange', this.syncFullscreenLabel);
    document.addEventListener('webkitfullscreenchange', this.syncFullscreenLabel);
    this.syncFullscreenLabel();
  }

  private async onAction(action?: string) {
    switch (action) {
      case 'fullscreen':
        this.close();
        await toggleFullscreen();
        break;
      case 'reset':
        this.close();
        this.confirm.hidden = false;
        break;
      case 'cancel':
        this.confirm.hidden = true;
        break;
      case 'cancel-etapes':
        this.etapes.hidden = true;
        break;
      case 'confirm':
        this.confirm.hidden = true;
        this.resetProgress();
        break;
    }
  }

  /**
   * Ouvre la fenêtre des points d'étape d'un chapitre (développement).
   *
   * La liste est construite à l'ouverture plutôt qu'au démarrage : elle ne sert
   * qu'à ce moment-là, et la reconstruire évite d'entretenir des écouteurs sur
   * des boutons cachés en permanence.
   */
  private ouvrirEtapes(index: number) {
    if (!import.meta.env.DEV) return;
    const chapitre = CHAPITRES[index];
    if (!chapitre) return;

    this.close();
    this.etapes.querySelector('.menu__etapes-titre')!.textContent = chapitre.nom;

    const liste = this.etapes.querySelector('.menu__etapes-liste')!;
    liste.innerHTML = '';
    for (const etape of chapitre.etapes) {
      const bouton = document.createElement('button');
      bouton.className = 'menu__item';
      bouton.textContent = etape.nom;
      bouton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        allerA(etape);
      });
      liste.appendChild(bouton);
    }
    this.etapes.hidden = false;
  }

  /**
   * Écrase la sauvegarde puis recharge la page.
   *
   * Le rechargement complet n'est pas de la paresse : l'état de jeu n'est pas
   * le seul à devoir repartir de zéro. Le récit ink garde ses propres variables
   * dans son instance `Story`, la couche origami garde un contexte WebGL et un
   * modèle chargé. Redémarrer la seule scène Phaser laisserait tout cela en
   * place, avec une partie « neuve » qui se souviendrait des dialogues déjà lus.
   */
  private resetProgress() {
    gameState.reset();
    window.location.reload();
  }

  private toggle() {
    if (this.panel.hidden) this.open();
    else this.close();
  }

  private open() {
    this.voile.hidden = false;
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.syncFullscreenLabel();
  }

  private close() {
    this.panel.hidden = true;
    this.voile.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }

  private syncFullscreenLabel = () => {
    this.fullscreenItem.textContent = isFullscreen() ? 'Quitter le plein écran' : 'Plein écran';
    // Le passage en plein écran change les dimensions du canvas : la couche DOM
    // doit être recalée dessus, sinon elle reste à l'ancienne taille.
    this.options.onLayoutChange();
  };
}
