// Reconstituer un crease pattern à partir de morceaux découpés. Voir
// game-design/05-puzzle-crease-pattern.md.
//
// Le découpage est un pavage de polygones décrit en cellules de la grille
// d'ancrage, chaque pièce portant le coin de sa boîte comme position solution.
// Il n'est pas régulier, et c'est ce qui rend la solution unique : des parts
// égales sur un motif symétrique laissent plusieurs dispositions correctes.
//
// En DOM et pas dans le canvas : `input.windowEvents: false` limite Phaser aux
// événements du canvas, et un glisser dont le doigt sort du cadre n'y verrait
// jamais son relâchement. `setPointerCapture` le garantit.
//
// Les pièces ne pivotent pas : une rotation rendrait ambigus des motifs souvent
// symétriques.

import { urlApercuOrigami } from '../../origami/apercu';
import type { NomTutoriel } from './tutoriels';
import {
  boite,
  chemin,
  chevauchent,
  masque,
  type Boite,
  type Decoupage,
  type Masque,
} from './decoupage';

// Calé sur l'animation CSS `puzzle-wrong`.
const FLASH_MS = 900;

// Seuil ergonomique tactile en pixels réels, pas une proportion du décor : il ne
// suit pas `--ui-scale`.
const MIN_TOUCH_PX = 44;

const PAS_ECHELLE = 0.96;
const ESSAIS_ECHELLE = 24;

export interface CreasePuzzleDef {
  // Servi depuis public/, chemin relatif.
  svg: string;
  // Le but à atteindre, et c'est le modèle rendu, pas une illustration : le
  // joueur reconnaît là ce qu'il va voir se plier puis retrouver dans le décor.
  modele: string;
  decoupage: Decoupage;
  title: string;
  // Lancé de lui-même à la première ouverture. Une énigme sans tutoriel garde le
  // bouton « ? », d'où l'on rejoue n'importe lequel.
  tutoriel?: NomTutoriel;
}

export type PuzzleOutcome = 'solved' | 'abandoned';

// Le tutoriel vit au-dessus de l'énigme et lui interdit tout tap : c'est donc
// lui qui doit pouvoir bouger une pièce. Une poignée de gestes nommés plutôt que
// le DOM à manipuler à l'aveugle.
export interface ControlePuzzle {
  readonly boutonAide: HTMLElement;
  // La plus grande pièce du bac : elle se suit du regard le plus facilement.
  //
  // Seulement sur un plateau vide, et c'est ce qui empêche d'en tirer une
  // solution : le vrac étant tiré d'une graine fixe, c'est toujours la même
  // pièce qui part. Sans cette condition, quatre lectures du tutoriel
  // suffisaient à résoudre le pont.
  pieceADemontrer(): HTMLElement | null;
  // Le vrac fait se chevaucher les pièces : une pièce désignée mais à moitié
  // enfouie ne se distingue pas de son tas. À appeler avant de la désigner, pas
  // au moment de la déplacer.
  mettreEnAvant(piece: HTMLElement): void;
  poserEnSolution(piece: HTMLElement): Promise<void>;
}

export type LanceurTutoriel = (
  controle: ControlePuzzle,
  // Le tutoriel de l'énigme à l'ouverture, sinon le tap sur « ? ».
  auto: boolean,
) => Promise<void>;

export interface OptionsPuzzle {
  tutoriel?: LanceurTutoriel;
}

// Lent pour un déplacement : c'est une démonstration, le joueur doit avoir le
// temps de suivre la pièce du regard du bac jusqu'à sa place.
const DEMO_MS = 3000;

// En cellules de la grille d'ancrage.
interface Anchor {
  c: number;
  r: number;
}

interface Piece {
  el: HTMLElement;
  // Boîte englobante en cellules. Son coin est la position solution.
  boite: Boite;
  masque: Masque;
}

// Les `clipPath` vivent dans le document : leurs identifiants doivent l'être.
let numeroPuzzle = 0;

export async function runCreasePuzzle(
  root: HTMLElement,
  def: CreasePuzzleDef,
  options: OptionsPuzzle = {},
): Promise<PuzzleOutcome> {
  const { viewBox, inner, folds } = await loadPattern(def.svg);
  const grille = def.decoupage.grille;

  const el = document.createElement('div');
  el.className = 'puzzle';
  el.style.setProperty('--grid', String(grille));
  const legend = [
    folds.valley ? { cls: 'va', label: 'pli vallée' } : null,
    folds.mountain ? { cls: 'mo', label: 'pli montagne' } : null,
  ].filter((entry) => entry !== null);

  el.innerHTML = `
    <button class="puzzle__goal" type="button" aria-label="Agrandir le pliage terminé">
      <img class="puzzle__goal-image" alt="Le pliage une fois terminé" />
    </button>
    <div class="puzzle__panel">
      <button class="puzzle__help" type="button" aria-label="Revoir un tutoriel">?</button>
      <h2 class="puzzle__title"></h2>
      <!-- Au-dessus du plateau : sous lui, la légende tombe derrière la boîte
           de dialogue, qui occupe le bas du cadre. -->
      <ul class="puzzle__legend">
        ${legend
          .map(
            (entry) =>
              `<li><span class="puzzle__legend-line puzzle__legend-line--${entry.cls}"></span>${entry.label}</li>`,
          )
          .join('')}
      </ul>
      <div class="puzzle__board"></div>
    </div>
    <div class="puzzle__side">
      <div class="puzzle__tray"></div>
      <!-- L'abandon à gauche, la vérification à droite : l'ordre des fenêtres
           de confirmation du jeu, et de la plupart des interfaces. Ces deux
           boutons étaient l'un sous l'autre, à portée du même pouce — un tap
           qui glissait d'un cran abandonnait l'énigme. -->
      <div class="puzzle__actions">
        <button class="puzzle__quit" type="button">Abandonner</button>
        <button class="puzzle__check" type="button">Vérifier la solution</button>
      </div>
    </div>
    <div class="puzzle__zoom" hidden>
      <img class="puzzle__zoom-image" alt="Le pliage une fois terminé, agrandi" />
    </div>
    <div class="puzzle__confirm" hidden role="alertdialog" aria-modal="true">
      <div class="menu__confirm-box">
        <p class="menu__confirm-text">
          Abandonner l'énigme ?
          <strong>Les pièces déjà posées retourneront dans le tas.</strong>
        </p>
        <div class="menu__confirm-actions">
          <button class="menu__item" data-action="continuer">Continuer</button>
          <button class="menu__item menu__item--danger" data-action="abandonner">
            Abandonner
          </button>
        </div>
      </div>
    </div>
  `;
  el.querySelector('.puzzle__title')!.textContent = def.title;

  // three.js et le `.origami` sont chargés à la demande : l'énigme est jouable
  // sans le but, l'image se pose quand elle est prête.
  const buts = el.querySelectorAll<HTMLImageElement>('.puzzle__goal-image, .puzzle__zoom-image');
  void urlApercuOrigami(def.modele, { taille: 640 })
    .then((url) => {
      for (const img of buts) img.src = url;
    })
    .catch((err) => console.error(`[puzzle] but de "${def.modele}" indisponible`, err));

  const board = el.querySelector<HTMLElement>('.puzzle__board')!;
  const tray = el.querySelector<HTMLElement>('.puzzle__tray')!;
  const check = el.querySelector<HTMLButtonElement>('.puzzle__check')!;
  const quit = el.querySelector<HTMLButtonElement>('.puzzle__quit')!;
  const goal = el.querySelector<HTMLButtonElement>('.puzzle__goal')!;
  const zoom = el.querySelector<HTMLElement>('.puzzle__zoom')!;
  const confirm = el.querySelector<HTMLElement>('.puzzle__confirm')!;
  const help = el.querySelector<HTMLButtonElement>('.puzzle__help')!;

  // Sans lanceur — un appel qui ne passe pas par le jeu, un test — le bouton
  // n'aurait rien à ouvrir : mieux vaut qu'il ne soit pas là.
  help.hidden = !options.tutoriel;

  // La vignette ne doit pas manger le plateau, d'où l'agrandissement.
  goal.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    zoom.hidden = false;
  });
  zoom.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    zoom.hidden = true;
  });

  const suffixe = `p${++numeroPuzzle}`;

  const pieces: Piece[] = def.decoupage.pieces.map(({ points }, i) => {
    const b = boite(points);
    const piece = document.createElement('div');
    piece.className = 'puzzle__piece';
    piece.dataset.piece = String(i);
    piece.style.setProperty('--w', String(b.w));
    piece.style.setProperty('--h', String(b.h));

    // La fenêtre découpée dans le motif est la BOÎTE de la pièce ; le polygone,
    // lui, sert de `clipPath`.
    const vx = viewBox.x + (b.x / grille) * viewBox.w;
    const vy = viewBox.y + (b.y / grille) * viewBox.h;
    const vw = (b.w / grille) * viewBox.w;
    const vh = (b.h / grille) * viewBox.h;
    const d = chemin(points, ([x, y]) => [
      viewBox.x + (x / grille) * viewBox.w,
      viewBox.y + (y / grille) * viewBox.h,
    ]);
    const coupe = `coupe-${suffixe}-${i}`;

    piece.innerHTML =
      `<svg viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="none"` +
      ` xmlns="http://www.w3.org/2000/svg">` +
      `<defs><clipPath id="${coupe}" clipPathUnits="userSpaceOnUse">` +
      `<path d="${d}" /></clipPath></defs>` +
      `<path class="puzzle__paper" d="${d}" />` +
      `<g clip-path="url(#${coupe})">${inner}</g>` +
      `</svg>`;

    return { el: piece, boite: b, masque: masque(points) };
  });

  const pieceOf = (el: HTMLElement) => pieces[Number(el.dataset.piece)];

  for (const { el: piece } of pieces) tray.appendChild(piece);
  root.appendChild(el);

  let trayLayout = eparpiller(el, tray, board, pieces, grille, graine(def.svg));

  return new Promise<PuzzleOutcome>((resolve) => {
    const placed = new Map<HTMLElement, Anchor>();
    let finished = false;

    // `eparpiller()` écrit des pixels qui ne valent que pour les dimensions
    // mesurées au montage. Le cas arrive vraiment : sur itch.io le plein écran
    // est un bouton du site, hors du jeu, donc atteignable énigme ouverte.
    // Groupé dans une frame, le temps que `syncStage()` recale le cadre.
    let recalculDemande = 0;
    const replacer = () => {
      if (finished || recalculDemande) return;
      recalculDemande = requestAnimationFrame(() => {
        recalculDemande = 0;
        if (finished) return;
        trayLayout = eparpiller(el, tray, board, pieces, grille, graine(def.svg));
      });
    };
    window.addEventListener('resize', replacer);

    const finish = (outcome: PuzzleOutcome) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('resize', replacer);
      if (recalculDemande) cancelAnimationFrame(recalculDemande);
      el.remove();
      resolve(outcome);
    };

    // Deux détails qui ne se voient qu'à l'usage : le glisser lui a donné sa
    // taille de plateau, qu'il faut défaire, sinon elle revient trop grande ; et
    // elle est réinsérée en fin de bac, donc au-dessus des autres, ce qui la
    // rend attrapable même si elle en recouvre une.
    function toTray(piece: HTMLElement) {
      placed.delete(piece);

      const pose = trayLayout.pose.get(piece);
      if (pose) {
        piece.style.width = `${pose.w}px`;
        piece.style.height = `${pose.h}px`;
        piece.style.left = `${pose.x}px`;
        piece.style.top = `${pose.y}px`;
      }
      tray.appendChild(piece);
    }

    // Dégage au passage ce que la pièce recouvrirait.
    function place(piece: HTMLElement, anchor: Anchor) {
      const { masque: m } = pieceOf(piece);
      for (const [other, at] of placed) {
        if (other === piece) continue;
        if (chevauchent(m, anchor, pieceOf(other).masque, at)) toTray(other);
      }

      placed.set(piece, anchor);
      // La taille sur le plateau vient du CSS (pourcentages de la grille) : on
      // retire celle du bac, qui est en dur et l'emporterait.
      piece.style.removeProperty('width');
      piece.style.removeProperty('height');
      piece.style.left = `${(anchor.c / grille) * 100}%`;
      piece.style.top = `${(anchor.r / grille) * 100}%`;
      board.appendChild(piece);
    }

    // C'est le point de relâchement qui tranche, pas le rectangle de la pièce :
    // avec le rectangle, une pièce large de six cellules chevauchait encore le
    // plateau le doigt loin dehors, et devenait impossible à rendre au bac.
    function drop(piece: HTMLElement, rect: DOMRect, x: number, y: number) {
      const b = board.getBoundingClientRect();
      const onBoard = x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;

      if (!onBoard) {
        toTray(piece);
        return;
      }

      const forme = pieceOf(piece).boite;
      place(piece, {
        c: clamp(Math.round((rect.left - b.left) / (b.width / grille)), 0, grille - forme.w),
        r: clamp(Math.round((rect.top - b.top) / (b.height / grille)), 0, grille - forme.h),
      });
    }

    for (const piece of pieces) {
      makeDraggable(piece, board, grille, (rect, x, y) => drop(piece.el, rect, x, y));
    }

    // ---------- Le tutoriel ----------

    // `position: fixed` le temps du trajet, comme le glisser : la pièce échappe
    // au rognage du bac. La taille est interpolée elle aussi — elle ne bouge
    // plus, bac et plateau partageant la même échelle, mais elle bougerait si la
    // fenêtre rétrécissait sous la taille mesurée au montage.
    function poserEnSolution(piece: HTMLElement): Promise<void> {
      const forme = pieceOf(piece).boite;
      const b = board.getBoundingClientRect();
      const depart = piece.getBoundingClientRect();

      piece.classList.add('is-dragging');
      piece.style.position = 'fixed';
      piece.style.width = `${depart.width}px`;
      piece.style.height = `${depart.height}px`;
      piece.style.left = `${depart.left}px`;
      piece.style.top = `${depart.top}px`;

      // Force le calcul de la mise en page avant d'armer la transition : sans
      // ça le navigateur regroupe les deux écritures et la pièce se téléporte.
      void piece.offsetWidth;

      piece.style.transition =
        `left ${DEMO_MS}ms ease-in-out, top ${DEMO_MS}ms ease-in-out,` +
        ` width ${DEMO_MS}ms ease-in-out, height ${DEMO_MS}ms ease-in-out`;
      piece.style.width = `${(forme.w / grille) * b.width}px`;
      piece.style.height = `${(forme.h / grille) * b.height}px`;
      piece.style.left = `${b.left + (forme.x / grille) * b.width}px`;
      piece.style.top = `${b.top + (forme.y / grille) * b.height}px`;

      return new Promise((fini) => {
        window.setTimeout(() => {
          piece.classList.remove('is-dragging');
          for (const prop of [
            'transition',
            'position',
            'width',
            'height',
            'left',
            'top',
          ] as const) {
            piece.style.removeProperty(prop);
          }
          place(piece, { c: forme.x, r: forme.y });
          fini();
        }, DEMO_MS);
      });
    }

    const controle: ControlePuzzle = {
      boutonAide: help,
      pieceADemontrer: () => {
        // Plateau entamé : plus rien à démontrer. Voir `ControlePuzzle`.
        if (placed.size > 0) return null;
        const restantes = pieces.filter((p) => p.el.parentElement === tray);
        if (restantes.length === 0) return null;
        return restantes.reduce((a, b) => (a.boite.w * a.boite.h >= b.boite.w * b.boite.h ? a : b))
          .el;
      },
      // Les pièces du bac se rangent dans l'ordre du DOM, sans `z-index` : la
      // dernière insérée passe devant.
      mettreEnAvant: (piece) => tray.appendChild(piece),
      poserEnSolution,
    };

    if (options.tutoriel) {
      const lanceur = options.tutoriel;
      help.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        void lanceur(controle, false);
      });
      // Ne bloque pas la promesse de l'énigme : c'est le voile du tutoriel qui
      // interdit les taps entre-temps, pas une garde ici.
      void lanceur(controle, true);
    }

    check.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (check.disabled) return;

      const solved =
        placed.size === pieces.length &&
        pieces.every(({ el: piece, boite: b }) => {
          const at = placed.get(piece);
          return at?.c === b.x && at?.r === b.y;
        });

      if (solved) {
        board.classList.add('is-solved');
        check.disabled = true;
        window.setTimeout(() => finish('solved'), 600);
        return;
      }

      // Aucune pénalité : on revérifie autant de fois qu'on veut.
      board.classList.add('is-wrong');
      window.setTimeout(() => board.classList.remove('is-wrong'), FLASH_MS);
    });

    // La seule action de l'énigme qu'on ne peut pas défaire, et elle arrivait
    // par erreur : sûr à gauche, irréversible à droite.
    quit.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      confirm.hidden = false;
    });
    confirm.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      const action = (e.target as HTMLElement)
        .closest('[data-action]')
        ?.getAttribute('data-action');
      // Le fond ne referme rien : il n'est là que pour avaler les taps destinés
      // au plateau.
      if (!action) return;
      confirm.hidden = true;
      if (action === 'abandonner') finish('abandoned');
    });
  });
}

// Où et à quelle taille une pièce repose dans le bac, en pixels.
interface PoseBac {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TrayLayout {
  pose: Map<HTMLElement, PoseBac>;
  // Pixels par cellule dans le bac.
  scale: number;
}

// Jette les pièces en vrac, à la taille qu'elles auront sur le plateau.
//
// Les positions viennent d'un générateur à graine fixe : le désordre est le même
// à chaque ouverture, donc un bug de placement se reproduit. Le chevauchement
// est toléré — c'est ce qui fait le tas — mais plafonné, sinon une pièce
// disparaît sous une autre. Il se mesure sur les boîtes, donc on en tolère moins
// qu'il n'y paraît : deux boîtes qui mordent de 15 % ne montrent souvent aucun
// recouvrement de papier.
//
// Une seule échelle `k` pour le bac et le plateau : quand le bac rétrécissait
// ses pièces pour tenir dans sa colonne, elles grossissaient d'un tiers à
// l'instant où on les attrapait. Les deux contraintes tirent en sens inverse —
// agrandir les pièces agrandit le plateau, donc rétrécit le bac —, d'où la
// recherche par rétrécissements successifs. Le plafond est la taille naturelle
// du plateau : on ne l'agrandit jamais.
//
// Rejouable, d'où deux précautions : effacer les deux variables du passage
// précédent, sinon on mesure l'ancien plateau au lieu de son plafond CSS et
// l'échelle rétrécit à chaque fois ; et ne reposer que les pièces encore dans le
// bac, celles du plateau étant en pourcentages.
function eparpiller(
  root: HTMLElement,
  tray: HTMLElement,
  board: HTMLElement,
  pieces: Piece[],
  grille: number,
  seed: number,
): TrayLayout {
  root.style.removeProperty('--plateau');
  root.style.removeProperty('--tray-width');

  const cadre = root.getBoundingClientRect();
  const panneau = board.parentElement!.getBoundingClientRect();
  const flanc = tray.parentElement!.getBoundingClientRect();
  const hauteur = tray.getBoundingClientRect().height;

  // Mesuré sur la page plutôt que recopié du CSS, sinon les deux divergent au
  // premier réglage.
  const gouttiere = flanc.left - panneau.right;
  const reserve = cadre.width - panneau.width - flanc.width + gouttiere;

  const largeurBac = (cote: number) => cadre.width - reserve - cote;

  // Le plafond : le côté que le CSS donne au plateau quand rien ne le serre.
  const cellMax = board.getBoundingClientRect().width / grille;

  let k = cellMax;
  let largeur = largeurBac(grille * k);
  let poses: PoseBac[] | null = null;
  for (let essai = 0; essai < ESSAIS_ECHELLE && !poses; essai++) {
    poses = tenterVrac(pieces, largeur, hauteur, k, seed);
    if (!poses) {
      k *= PAS_ECHELLE;
      largeur = largeurBac(grille * k);
    }
  }
  // Dernier recours : à cette taille toutes les pièces tiennent côte à côte.
  poses ??= tenterVrac(pieces, largeur, hauteur, k, seed, 1) ?? [];

  // Le plateau se règle sur l'échelle trouvée, et non l'inverse : c'est ce qui
  // fait qu'une pièce garde sa taille en passant du bac à la grille.
  root.style.setProperty('--plateau', `${grille * k}px`);

  const pose = new Map<HTMLElement, PoseBac>();
  for (const [i, p] of pieces.entries()) {
    const ou = poses[i] ?? { x: 0, y: 0, w: p.boite.w * k, h: p.boite.h * k };
    // Y compris pour les pièces posées : c'est là qu'elles reviendront.
    pose.set(p.el, ou);
    if (p.el.parentElement !== tray) continue;
    p.el.style.width = `${ou.w}px`;
    p.el.style.height = `${ou.h}px`;
    p.el.style.left = `${ou.x}px`;
    p.el.style.top = `${ou.y}px`;
  }

  // Le bac se resserre sur ce qu'il occupe vraiment : le reste va au plateau.
  const utilisee = Math.max(...poses.map((p) => p.x + p.w), 0);
  root.style.setProperty('--tray-width', `${Math.ceil(utilisee)}px`);

  const plusPetite = Math.min(...pieces.flatMap((p) => [p.boite.w, p.boite.h])) * k;
  if (import.meta.env.DEV && plusPetite < MIN_TOUCH_PX) {
    console.warn(
      `[puzzle] pièces à ${Math.round(plusPetite)}px de côté, sous le seuil tactile ` +
        `de ${MIN_TOUCH_PX}px : le découpage est trop fin pour ce cadre.`,
    );
  }

  return { pose, scale: k };
}

// En part de la plus petite des deux boîtes.
const CHEVAUCHEMENT = 0.18;
// Ce qu'on accepte faute de mieux, plutôt que de tout rétrécir encore.
const CHEVAUCHEMENT_MAX = 0.4;
// Positions tirées par pièce avant d'abandonner cette taille.
const ESSAIS = 400;

// `null` si le bac est trop petit. Les grandes pièces d'abord : posées en
// dernier, elles ne trouvent plus de place et font échouer des tailles pourtant
// tenables.
function tenterVrac(
  pieces: Piece[],
  largeur: number,
  hauteur: number,
  k: number,
  seed: number,
  tolerance = CHEVAUCHEMENT,
): PoseBac[] | null {
  const hasard = melangeur(seed);
  const ordre = [...pieces.keys()].sort(
    (a, b) => pieces[b].boite.w * pieces[b].boite.h - pieces[a].boite.w * pieces[a].boite.h,
  );

  const poses: PoseBac[] = new Array(pieces.length);
  // Une liste à part, et non `poses` : celle-ci se remplit dans le désordre des
  // tailles, et ses trous se compareraient à `undefined`.
  const deja: PoseBac[] = [];

  for (const i of ordre) {
    const w = pieces[i].boite.w * k;
    const h = pieces[i].boite.h * k;
    if (w > largeur || h > hauteur) return null;

    let meilleur: PoseBac | null = null;
    let meilleurScore = Infinity;
    for (let essai = 0; essai < ESSAIS; essai++) {
      const candidat = {
        x: hasard() * (largeur - w),
        y: hasard() * (hauteur - h),
        w,
        h,
      };
      const score = Math.max(0, ...deja.map((autre) => recouvrement(candidat, autre)));
      if (score < meilleurScore) {
        meilleurScore = score;
        meilleur = candidat;
      }
      if (score <= tolerance) break;
    }

    if (!meilleur || meilleurScore > Math.max(tolerance, CHEVAUCHEMENT_MAX)) return null;
    poses[i] = meilleur;
    deja.push(meilleur);
  }
  return poses;
}

// Part de la plus petite des deux boîtes que l'autre recouvre.
function recouvrement(a: PoseBac, b: PoseBac): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

// mulberry32 : même graine, même vrac. `Math.random()` donnerait un tas
// différent à chaque ouverture, donc un bug de placement impossible à revoir.
function melangeur(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// La graine vient du chemin de motif de l'énigme, pas d'un nombre écrit à la
// main : chaque énigme a son vrac, et il ne bouge pas.
function graine(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

// Le `<style>` embarqué par ORIPA est retiré : les styles d'un SVG inline ne
// sont pas encapsulés, il s'appliquerait au document entier et serait dupliqué à
// chaque pièce. Les classes mo/va/bo sont restylées dans style.css.
async function loadPattern(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`crease pattern introuvable : ${url}`);

  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  for (const style of Array.from(svg.getElementsByTagName('style'))) style.remove();

  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 1000').split(/[\s,]+/).map(Number);

  // La légende se construit à partir du motif : le pont n'a que des plis vallée,
  // et annoncer un pli montagne enverrait chercher une couleur introuvable.
  return {
    viewBox: { x, y, w, h },
    inner: svg.innerHTML,
    folds: { valley: !!svg.querySelector('.va'), mountain: !!svg.querySelector('.mo') },
  };
}

// `setPointerCapture` redirige tous les événements du pointeur vers la pièce
// jusqu'au relâchement : un doigt qui sort du cadre ne laisse pas de pièce
// orpheline. Elle passe en `position: fixed` le temps du glisser, échappant au
// rognage de son conteneur.
//
// Elle se déplace par `transform`, jamais par `left`/`top` : ceux-là repeignent
// la pièce — détourage et ombres compris — et le décor derrière elle à chaque
// frame, et elle traînait derrière la souris. Rien ici ne lisse le mouvement :
// un retard sur le pointeur est toujours un coût de rendu.
//
// Le tap n'est reçu que par le papier : le détourage laisse du vide dans la
// boîte, que le CSS rend traversant, sinon une pièce en recouvrirait une autre
// par un coin transparent.
function makeDraggable(
  { el: piece, boite: forme }: Piece,
  board: HTMLElement,
  grille: number,
  onDrop: (rect: DOMRect, x: number, y: number) => void,
) {
  let dragging = false;
  let width = 0;
  let height = 0;

  // Un `pointercancel` doit pouvoir rendre ces styles : les retirer renverrait
  // la pièce en `auto`, donc dans le coin de son conteneur, alors qu'elle reste
  // enregistrée à son ancienne ancre.
  let avant: Partial<Record<'position' | 'width' | 'height' | 'left' | 'top', string>> = {};

  const moveTo = (x: number, y: number) => {
    piece.style.transform = `translate3d(${x - width / 2}px, ${y - height / 2}px, 0)`;
  };

  piece.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = true;

    avant = {
      position: piece.style.position,
      width: piece.style.width,
      height: piece.style.height,
      left: piece.style.left,
      top: piece.style.top,
    };

    const b = board.getBoundingClientRect();
    width = (forme.w / grille) * b.width;
    height = (forme.h / grille) * b.height;
    // `transform` porte la position, donc l'origine doit être neutre : sans ça
    // la pièce garderait le décalage qu'elle avait dans le bac.
    piece.style.position = 'fixed';
    piece.style.left = '0';
    piece.style.top = '0';
    piece.style.width = `${width}px`;
    piece.style.height = `${height}px`;
    moveTo(e.clientX, e.clientY);

    piece.setPointerCapture(e.pointerId);
    piece.classList.add('is-dragging');
  });

  piece.addEventListener('pointermove', (e) => {
    if (dragging) moveTo(e.clientX, e.clientY);
  });

  const end = (e: PointerEvent, dropped: boolean) => {
    if (!dragging) return;
    dragging = false;
    e.stopPropagation();
    if (piece.hasPointerCapture(e.pointerId)) piece.releasePointerCapture(e.pointerId);

    const rect = piece.getBoundingClientRect();
    piece.classList.remove('is-dragging');
    piece.style.removeProperty('transform');

    if (dropped) {
      // `place()` ou `toTray()` va la reposer : on leur rend une ardoise propre.
      for (const prop of ['position', 'width', 'height', 'left', 'top'] as const) {
        piece.style.removeProperty(prop);
      }
      onDrop(rect, e.clientX, e.clientY);
      return;
    }

    // Personne ne va la reposer : on lui rend exactement ce qu'elle avait.
    for (const [prop, valeur] of Object.entries(avant)) {
      if (valeur) piece.style.setProperty(prop, valeur);
      else piece.style.removeProperty(prop);
    }
  };

  piece.addEventListener('pointerup', (e) => end(e, true));
  // Interruption système : on repose la pièce là où elle était plutôt que de
  // la téléporter sous le dernier point connu.
  piece.addEventListener('pointercancel', (e) => end(e, false));
}
