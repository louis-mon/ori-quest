import { gameState } from '../game/systems/state';
import { allerA, chapitresAtteignables, ETAPES_LIVREES } from '../game/systems/etapes';
import { cocottesMontrees, montrerLesCocottes } from '../game/systems/cocottes-montrees';
import type { Rideau } from '../game/rideau';
import { listerOutils, ouvrirOutil } from '../dev/outils';
import { choisirLaLangue, langue, LANGUES, nomDeLaLangue } from '../langues/langue';
import { t } from '../langues/traduire';
import { ouvrirLesCredits } from './credits';
import {
  basculerLePleinEcran,
  enPleinEcran,
  pleinEcranPossible,
  suivreLePleinEcran,
} from './plein-ecran';

// Le menu du jeu est un écran entier, et le même sert deux fois. À l'accueil
// d'une partie neuve : le titre, « Commencer à plier ». Pendant la partie,
// derrière le bouton du coin : « Pause », « Reprendre ». La pièce reste dessous,
// floutée et pâlie — vivante à l'accueil, figée en pause.
//
// L'accueil ne se rouvre pas : on n'y revient qu'en recommençant, ce qui
// recharge la page sur une partie neuve.

const NOM_DU_JEU = 'Orifable'; // hors traduction

// Celui de la transition de `.ecran`, dans style.css.
const FONDU_MS = 320;

type Mode = 'accueil' | 'pause';

// Le drapeau d'un pays pour dire une langue, toujours à côté de son nom : il se
// repère d'un coup d'œil, le nom tranche. L'anglais prend celui du Royaume-Uni.
// Tous deux du domaine public, repris de Wikimedia Commons (Flag_of_France.svg,
// Flag_of_the_United_Kingdom.svg). Une langue sans drapeau garde son nom seul.
const DRAPEAUX: Record<string, string> = { fr: 'fr', en: 'gb' };

function drapeauHtml(code: string): string {
  const pays = DRAPEAUX[code];
  if (!pays) return '';
  return `<img class="ecran__drapeau" src="assets/ui/drapeaux/${pays}.svg" alt="" />`;
}

// Chaque langue sous son propre nom, et `lang` pour que le navigateur la lise
// comme telle : « English » n'a pas à se prononcer à la française.
function languesHtml(): string {
  return LANGUES.map(
    (code) =>
      `<button class="ecran__option ecran__langue" data-langue="${code}" lang="${code}"` +
      ` aria-pressed="${code === langue}">${drapeauHtml(code)}${nomDeLaLangue(code)}</button>`,
  ).join('');
}

// `ETAPES_LIVREES` est une constante lue à la compilation : à `false`, le bouton
// et avec lui le module `etapes` disparaissent du bundle.
function etapesHtml(): string {
  if (!ETAPES_LIVREES) return '';
  return `<button class="ecran__option" data-action="etapes">${t('Points d’étape')}</button>`;
}

// Même élagage, sur `import.meta.env.DEV` : hors développement les pages de
// réglage n'existent pas, `vite build` ne connaissant qu'index.html.
function outilsHtml(): string {
  if (!import.meta.env.DEV) return '';
  return `<button class="ecran__option" data-action="outils">Outils de réglage</button>`;
}

interface Entree {
  nom: string;
  choisir: () => void;
}

export interface MenuOptions {
  // Baissé par `accueillir()`, levé par « Commencer à plier ».
  rideau: Rideau;
  // Appelé après une entrée ou une sortie de plein écran.
  onLayoutChange: () => void;
  // Appelé quand la pause commence et quand elle finit. Le menu reste
  // atteignable pendant un déplacement bloquant — c'est même la seule chose qui
  // le soit —, donc il doit pouvoir arrêter la scène : sans ça, ce qu'on était
  // en train de regarder finit sa course derrière l'écran.
  onGel: (gele: boolean) => void;
}

export class Menu {
  private bouton: HTMLButtonElement;
  private ecran: HTMLElement;
  private nom: SVGTextPathElement;
  private principal: HTMLButtonElement;
  private recommencer: HTMLButtonElement;
  private pleinEcran: HTMLButtonElement;
  private cocottes: HTMLButtonElement;
  private confirm: HTMLElement;
  // Les points d'étape, ou les outils de développement.
  private liste: HTMLElement;
  private mode: Mode = 'pause';
  private fondu = 0;

  constructor(
    private root: HTMLElement,
    private options: MenuOptions,
  ) {
    const el = document.createElement('div');
    el.className = 'menu';
    el.innerHTML = `
      <button class="menu__button" data-action="pause" aria-label="${t('Menu')}" aria-haspopup="dialog">
        <span></span><span></span><span></span>
      </button>
      <div class="ecran" hidden role="dialog" aria-modal="true" aria-labelledby="ecran-titre">
        <h1 class="ecran__titre" id="ecran-titre">
          <svg viewBox="0 0 640 200">
            <defs>
              <linearGradient id="ecran-vert" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" />
                <stop offset="1" />
              </linearGradient>
            </defs>
            <path id="ecran-arc" d="M 40 190 A 560 560 0 0 1 600 190" />
            <text><textPath href="#ecran-arc" startOffset="50%" text-anchor="middle"></textPath></text>
          </svg>
        </h1>
        <div class="ecran__centre">
          <button class="ecran__principal" data-action="principal"></button>
          <button class="ecran__recommencer" data-action="reset">
            ${t('Recommencer l’aventure')}
          </button>
        </div>
        <div class="ecran__options">
          <div class="ecran__ligne" role="group" aria-labelledby="ecran-langue">
            <span class="ecran__label" id="ecran-langue">${t('Langue')}</span>
            ${languesHtml()}
          </div>
          <div class="ecran__ligne">
            <button class="ecran__option ecran__bascule" data-action="cocottes"
              aria-pressed="${cocottesMontrees()}">${t('Montrer les zones cliquables')}</button>
            <button class="ecran__option" data-action="fullscreen">${t('Plein écran')}</button>
            <button class="ecran__option" data-action="credits">${t('Crédits')}</button>
            ${etapesHtml()}
            ${outilsHtml()}
          </div>
        </div>
      </div>
      <div class="menu__liste" hidden role="dialog" aria-modal="true">
        <div class="menu__confirm-box">
          <p class="menu__confirm-text menu__liste-titre"></p>
          <div class="menu__liste-entrees"></div>
          <div class="menu__confirm-actions">
            <button class="menu__item" data-action="fermer-liste">${t('Fermer')}</button>
          </div>
        </div>
      </div>
      <div class="menu__confirm" hidden role="alertdialog" aria-modal="true">
        <div class="menu__confirm-box">
          <p class="menu__confirm-text">
            ${t('Effacer toute ta progression et repartir du début ?')}
            <strong>${t('Cette action est définitive.')}</strong>
          </p>
          <div class="menu__confirm-actions">
            <button class="menu__item" data-action="cancel">${t('Annuler')}</button>
            <button class="menu__item menu__item--danger" data-action="confirm">
              ${t('Tout effacer')}
            </button>
          </div>
        </div>
      </div>
    `;
    root.appendChild(el);

    this.bouton = el.querySelector('.menu__button')!;
    this.ecran = el.querySelector('.ecran')!;
    this.nom = el.querySelector('textPath')!;
    this.principal = el.querySelector('[data-action="principal"]')!;
    this.recommencer = el.querySelector('[data-action="reset"]')!;
    this.pleinEcran = el.querySelector('[data-action="fullscreen"]')!;
    this.cocottes = el.querySelector('[data-action="cocottes"]')!;
    this.confirm = el.querySelector('.menu__confirm')!;
    this.liste = el.querySelector('.menu__liste')!;

    if (!pleinEcranPossible()) this.pleinEcran.hidden = true;

    // L'écran couvre tout le cadre : un tap qui ne tombe sur aucun bouton n'a
    // rien d'autre à atteindre, et ne referme rien.
    el.addEventListener('pointerup', (e) => {
      const bouton = (e.target as Element).closest<HTMLButtonElement>(
        'button[data-action], button[data-langue]',
      );
      if (!bouton) return;
      e.stopPropagation();
      if (bouton.dataset.langue) {
        choisirLaLangue(bouton.dataset.langue);
        return;
      }
      void this.onAction(bouton.dataset.action);
    });

    suivreLePleinEcran(this.syncPleinEcran);
    this.syncPleinEcran();
  }

  // Une partie neuve s'ouvre ici, sa première pièce montée derrière.
  accueillir() {
    this.options.rideau.baisser();
    this.ouvrir('accueil');
  }

  private async onAction(action?: string) {
    switch (action) {
      case 'pause':
        this.ouvrir('pause');
        break;
      case 'principal':
        this.fermer();
        if (this.mode === 'accueil') this.options.rideau.lever();
        break;
      case 'cocottes':
        montrerLesCocottes(!cocottesMontrees());
        this.cocottes.setAttribute('aria-pressed', String(cocottesMontrees()));
        break;
      case 'fullscreen':
        await basculerLePleinEcran();
        break;
      case 'credits':
        ouvrirLesCredits(this.root);
        break;
      case 'reset':
        this.confirm.hidden = false;
        break;
      case 'cancel':
        this.confirm.hidden = true;
        break;
      case 'confirm':
        this.resetProgress();
        break;
      case 'fermer-liste':
        this.liste.hidden = true;
        break;
      case 'etapes':
        // Le test ici AUSSI, et pas seulement autour du HTML : sans lui,
        // `etapes` reste référencé depuis ce gestionnaire et part dans le bundle
        // même quand `ETAPES_LIVREES` est faux.
        if (ETAPES_LIVREES) this.ouvrirChapitres();
        break;
      case 'outils':
        // La même chose pour les pages de réglage.
        if (import.meta.env.DEV) {
          const outils = await listerOutils().catch((err) => {
            console.warn('[menu] pages de réglage introuvables', err);
            return [];
          });
          this.ouvrirListe(
            'Outils de réglage',
            outils.map(({ nom, page }) => ({ nom, choisir: () => ouvrirOutil(page) })),
          );
        }
        break;
    }
  }

  private ouvrir(mode: Mode) {
    clearTimeout(this.fondu);
    this.mode = mode;
    this.ecran.dataset.mode = mode;
    this.nom.textContent = mode === 'accueil' ? NOM_DU_JEU : t('Pause');
    this.principal.textContent = mode === 'accueil' ? t('Commencer à plier') : t('Reprendre');
    // Une partie neuve n'a rien à effacer.
    this.recommencer.hidden = mode === 'accueil';
    this.bouton.hidden = true;
    this.ecran.hidden = false;
    // L'accueil est là d'emblée : en fondu, il laisserait voir la pièce nette
    // le temps de se poser. La pause, elle, s'ouvre sur un jeu déjà vu.
    if (mode === 'pause') void this.ecran.offsetWidth;
    this.ecran.classList.add('ecran--visible');
    // À l'accueil, la pièce vit derrière l'écran ; en pause, elle s'arrête.
    if (mode === 'pause') this.options.onGel(true);
  }

  private fermer() {
    this.ecran.classList.remove('ecran--visible');
    this.bouton.hidden = false;
    if (this.mode === 'pause') this.options.onGel(false);
    this.fondu = window.setTimeout(() => (this.ecran.hidden = true), FONDU_MS);
  }

  private ouvrirChapitres() {
    if (!ETAPES_LIVREES) return;
    this.ouvrirListe(
      t('Points d’étape'),
      chapitresAtteignables().map((chapitre) => ({
        nom: chapitre.nom,
        choisir: () =>
          this.ouvrirListe(
            chapitre.nom,
            chapitre.etapes.map((etape) => ({ nom: etape.nom, choisir: () => allerA(etape) })),
          ),
      })),
    );
  }

  // La liste est construite à l'ouverture : elle ne sert qu'à ce moment-là, et
  // la reconstruire évite d'entretenir des écouteurs sur des boutons cachés.
  private ouvrirListe(titre: string, entrees: Entree[]) {
    this.liste.querySelector('.menu__liste-titre')!.textContent = titre;

    const conteneur = this.liste.querySelector('.menu__liste-entrees')!;
    conteneur.innerHTML = '';
    for (const entree of entrees) {
      const bouton = document.createElement('button');
      bouton.className = 'menu__item';
      bouton.textContent = entree.nom;
      bouton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        entree.choisir();
      });
      conteneur.appendChild(bouton);
    }
    this.liste.hidden = false;
  }

  // Le rechargement complet n'est pas de la paresse : ink garde ses variables
  // dans son instance `Story` et la couche origami son contexte WebGL.
  // Redémarrer la seule scène Phaser donnerait une partie « neuve » qui se
  // souvient des dialogues déjà lus. Rechargée, la partie neuve rouvre l'accueil.
  private resetProgress() {
    gameState.reset();
    window.location.reload();
  }

  private syncPleinEcran = () => {
    this.pleinEcran.textContent = enPleinEcran() ? t('Quitter le plein écran') : t('Plein écran');
    // Le passage en plein écran change les dimensions du canvas : la couche DOM
    // doit être recalée dessus, sinon elle reste à l'ancienne taille.
    this.options.onLayoutChange();
  };
}
