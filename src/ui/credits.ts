import { t } from '../langues/traduire';
import { CREASE_PATTERNS, FAIT_AVEC, PLIEURS, REMERCIEMENTS, ROLES } from './credits-texte';
import { typographier } from './typographie';

// Les crédits, qui closent l'histoire après la dernière réplique (`# fin:`). Ils
// défilent seuls ; le joueur peut les remonter ou les devancer, et le défilement
// reprend `REPRISE_MS` après son dernier geste. Ils finissent sur « Merci d'avoir
// joué ! », seul à l'écran.
//
// Sous le menu, contrairement à l'écran « À suivre… » : c'est par lui qu'on
// recommence, rien d'autre ne devant partager l'écran avec le remerciement.
// Ouverts depuis le menu, ils passent au contraire au-dessus de lui, et s'y
// referment.

// Le temps qu'une ligne met à traverser l'écran, quelle que soit sa taille.
const SECONDES_PAR_ECRAN = 14;
const REPRISE_MS = 5000;
// Celui de `.credits`, dans style.css.
const FONDU_MS = 600;

let pose = false;
let defilement: Defilement | null = null;

export function montrerLesCredits(root: HTMLElement): void {
  if (pose) return;
  pose = true;
  const { el, fenetre } = construire();
  root.appendChild(el);
  defilement = new Defilement(fenetre);
  apparaitre(el, fenetre);
}

// Depuis le menu : par-dessus l'écran de pause, depuis le début à chaque fois.
export function ouvrirLesCredits(root: HTMLElement): void {
  const { el, fenetre } = construire();
  el.classList.add('credits--menu');
  const fermer = bloc('button', 'ecran__option credits__fermer', t('Fermer'));
  el.append(fermer);
  root.appendChild(el);
  const lui = new Defilement(fenetre);

  fermer.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    lui.couper();
    el.classList.remove('credits--visible');
    window.setTimeout(() => el.remove(), FONDU_MS);
  });
  apparaitre(el, fenetre);
}

// Le menu fige ce qu'on regardait : les crédits ne défilent pas derrière lui.
export function figerLesCredits(gele: boolean): void {
  defilement?.figer(gele);
}

function construire(): { el: HTMLElement; fenetre: HTMLElement } {
  const el = document.createElement('div');
  el.className = 'credits';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('Crédits'));

  const fenetre = bloc('div', 'credits__defilement');
  fenetre.tabIndex = 0;
  const contenu = bloc('div', 'credits__contenu');
  contenu.append(
    bloc('h2', 'credits__titre', t('Crédits')),
    section(ROLES.map(({ role, qui }) => ligne(role, qui))),
    ...[CREASE_PATTERNS, ...PLIEURS].map(({ intitule, modeles }) =>
      section(
        modeles.map(({ modele, auteur, livre }) => ligne(modele, auteur, livre)),
        intitule,
      ),
    ),
    section(
      FAIT_AVEC.map((texte) => bloc('p', 'credits__texte', texte)),
      t('Fait avec'),
    ),
    section(
      REMERCIEMENTS.map((texte) => bloc('p', 'credits__texte', texte)),
      t('Remerciements'),
    ),
  );
  const merci = bloc('div', 'credits__fin');
  merci.append(bloc('p', 'credits__merci', typographier(t('Merci d’avoir joué !'))));
  fenetre.append(contenu, merci);
  el.append(fenetre);
  return { el, fenetre };
}

function apparaitre(el: HTMLElement, fenetre: HTMLElement) {
  fenetre.focus({ preventScroll: true });
  // Une frame de retard, sans quoi l'élément naît à son état final et le flou
  // tomberait d'un coup sur la dernière réplique.
  requestAnimationFrame(() => el.classList.add('credits--visible'));
}

class Defilement {
  // `scrollTop` s'arrondit au pixel d'écran : y ajouter quelques dixièmes à
  // chaque image ne le ferait jamais avancer. La position vraie est tenue ici.
  private position = 0;
  private ecrit = 0;
  private avant = 0;
  private frame = 0;
  private reprise = 0;
  private enMain = false;
  private fige = false;
  private doigts = 0;

  constructor(private el: HTMLElement) {
    el.addEventListener('wheel', this.prendreLaMain, { passive: true });
    el.addEventListener('keydown', this.prendreLaMain);
    // Le doigt posé arrête le défilement comme il arrête une liste lancée, et
    // tant qu'il reste posé, rien ne reprend.
    for (const type of ['touchstart', 'touchend', 'touchcancel'] as const) {
      el.addEventListener(
        type,
        (e) => {
          this.doigts = e.touches.length;
          this.prendreLaMain();
        },
        { passive: true },
      );
    }
    // L'élan d'un geste continue de faire défiler après le doigt levé : le délai
    // de reprise court depuis sa fin.
    el.addEventListener('scroll', () => {
      if (this.enMain) this.prendreLaMain();
    });
    this.lancer();
  }

  figer(gele: boolean) {
    this.fige = gele;
    if (gele) this.arreter();
    else if (!this.enMain) this.lancer();
  }

  // Pour de bon : l'élément s'en va, et la reprise ne doit plus rien relancer.
  couper() {
    clearTimeout(this.reprise);
    this.figer(true);
  }

  private prendreLaMain = () => {
    this.enMain = true;
    this.arreter();
    clearTimeout(this.reprise);
    this.reprise = window.setTimeout(this.rendreLaMain, REPRISE_MS);
  };

  private rendreLaMain = () => {
    if (this.doigts > 0) {
      this.reprise = window.setTimeout(this.rendreLaMain, REPRISE_MS);
      return;
    }
    this.enMain = false;
    if (!this.fige) this.lancer();
  };

  private lancer() {
    this.arreter();
    this.position = this.ecrit = this.el.scrollTop;
    this.avant = 0;
    this.frame = requestAnimationFrame(this.avancer);
  }

  private arreter() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private avancer = (maintenant: number) => {
    // Plafonné : après un onglet en arrière-plan, l'écart ferait un saut.
    const dt = this.avant ? Math.min(maintenant - this.avant, 100) : 0;
    this.avant = maintenant;

    // Le cadre a changé de taille, et le navigateur a recalé la position.
    if (Math.abs(this.el.scrollTop - this.ecrit) > 1) this.position = this.el.scrollTop;

    const fin = this.el.scrollHeight - this.el.clientHeight;
    this.position = Math.min(
      this.position + (this.el.clientHeight / SECONDES_PAR_ECRAN) * (dt / 1000),
      fin,
    );
    this.el.scrollTop = this.position;
    this.ecrit = this.el.scrollTop;

    this.frame = this.position < fin ? requestAnimationFrame(this.avancer) : 0;
  };
}

function section(lignes: HTMLElement[], intitule?: string): HTMLElement {
  const el = bloc('section', 'credits__section');
  if (intitule) el.append(bloc('h3', 'credits__intitule', intitule));
  el.append(...lignes);
  return el;
}

// En deux colonnes de part et d'autre du milieu, comme au cinéma : ce qui est
// crédité à gauche, qui à droite.
function ligne(quoi: string, qui: string, livre?: string): HTMLElement {
  const el = bloc('div', 'credits__ligne');
  el.append(bloc('span', 'credits__quoi', quoi), bloc('span', 'credits__qui', qui));
  if (livre) el.append(bloc('span', 'credits__livre', livre));
  return el;
}

function bloc(balise: string, classe: string, texte?: string): HTMLElement {
  const el = document.createElement(balise);
  el.className = classe;
  if (texte !== undefined) el.textContent = texte;
  return el;
}
