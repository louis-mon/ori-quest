/**
 * Le minijeu commun à (presque) toutes les énigmes : reconstituer un crease
 * pattern à partir de morceaux découpés.
 *
 * Voir game-design/05-puzzle-crease-pattern.md. Le plateau est à gauche, les
 * pièces en vrac dans un bac à droite, un bouton vérifie la solution. Échec =
 * clignotement rouge et attente ; réussite = on rend la main à la scène, qui
 * joue le pliage.
 *
 * **Le découpage est un pavage de polygones**, décrit en cellules de la grille
 * d'ancrage et dessiné dans `decoupage.html` (voir `decoupage.ts`). Chaque pièce
 * porte sa position solution : c'est le coin haut-gauche de sa boîte
 * englobante. Le découpage n'est pas régulier, et c'est ce qui rend la solution
 * unique — des parts égales sur un motif symétrique laissent plusieurs
 * dispositions correctes alors qu'une seule est validée.
 *
 * **La grille d'ancrage** est plus fine que les pièces : une pièce lâchée
 * n'importe où se cale sur la cellule la plus proche, ce qui évite au joueur de
 * viser au pixel. Une pièce posée à cheval sur une voisine renvoie celle-ci au
 * bac plutôt que de la recouvrir.
 *
 * **Les pièces sont détourées, pas rognées à leur boîte.** Le polygone sert de
 * `clipPath` au motif et de silhouette au papier ; l'ombre portée est un
 * `drop-shadow` CSS, qui suit l'alpha du rendu, donc la découpe elle-même. Sans
 * ça, deux pièces qui se chevauchent dans le bac montreraient leurs rectangles.
 *
 * **Pourquoi en DOM et pas dans le canvas Phaser.** D'abord la règle
 * d'architecture du projet : toute l'interface est en DOM. Ensuite et surtout,
 * `input.windowEvents: false` limite volontairement Phaser aux événements du
 * canvas — un glisser dont le doigt sort du cadre n'y verrait jamais son
 * relâchement et laisserait la pièce collée au pointeur. En DOM,
 * `setPointerCapture` garantit que la pièce reçoit `pointermove` et `pointerup`
 * où que parte le doigt, y compris hors de la fenêtre.
 *
 * Les pièces ne pivotent pas : le découpage produit des morceaux distinguables
 * un à un, et une rotation rendrait ambigus des motifs souvent symétriques.
 */

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

/** Durée du clignotement rouge, calée sur l'animation CSS `puzzle-wrong`. */
const FLASH_MS = 900;

/**
 * Plus petite dimension tolérée pour une pièce dans le bac, en pixels **réels**.
 * Seuil ergonomique tactile, pas une proportion du décor : il ne suit pas
 * `--ui-scale`.
 */
const MIN_TOUCH_PX = 44;

/** Part du cadre que le bac ne doit pas dépasser, même pour élargir les pièces. */
const MAX_TRAY_RATIO = 0.42;

export interface CreasePuzzleDef {
  /** Crease pattern solution, servi depuis public/ (chemin relatif). */
  svg: string;
  /**
   * Le modèle `.origami` qu'on est en train de plier, montré en vignette et
   * agrandissable. C'est le but à atteindre : sans lui, le joueur reconstitue
   * un motif abstrait sans savoir ce qu'il fabrique.
   *
   * C'est le **modèle rendu**, pas une illustration : le joueur reconnaît là ce
   * qu'il va voir se plier, puis retrouver dans le décor et dans son inventaire.
   */
  modele: string;
  /** Grille d'ancrage et pièces, tirées de `game-design/enigmes/<nom>.json`. */
  decoupage: Decoupage;
  /** Titre affiché au-dessus du plateau. */
  title: string;
  /**
   * Le tutoriel que cette énigme lance d'elle-même, la première fois qu'on
   * l'ouvre. Voir `src/game/puzzle/tutoriels.ts`.
   *
   * Une énigme sans tutoriel n'en propose pas moins le bouton « ? » : c'est de
   * là qu'on rejoue n'importe lequel des tutoriels, à tout moment.
   */
  tutoriel?: NomTutoriel;
}

export type PuzzleOutcome = 'solved' | 'abandoned';

/**
 * Ce qu'un tutoriel peut faire de l'énigme qu'il recouvre.
 *
 * Le tutoriel vit **au-dessus** de l'énigme et lui interdit tout tap ; c'est
 * donc lui qui doit pouvoir bouger une pièce pour en faire la démonstration. On
 * lui donne le strict nécessaire plutôt que l'énigme entière — une poignée de
 * gestes nommés, pas le DOM à manipuler à l'aveugle.
 */
export interface ControlePuzzle {
  /** Le bouton « ? », que le tutoriel désigne du doigt avant de rendre la main. */
  readonly boutonAide: HTMLElement;
  /**
   * La pièce que la démonstration ira poser, ou `null` s'il n'y a rien à
   * démontrer.
   *
   * La plus grande du bac : elle se suit du regard le plus facilement pendant
   * qu'elle glisse, et sa place est la plus évidente une fois posée — le
   * tutoriel montre le geste, il ne résout pas l'énigme à la place du joueur.
   *
   * **Seulement sur un plateau vide**, et c'est ce qui empêche d'en tirer une
   * solution : le vrac du bac est tiré d'une graine fixe, donc plateau vide
   * c'est toujours *la même* pièce qui part. Rejouer le tutoriel ne donne jamais
   * rien de plus que la première fois. Sans cette condition, chaque lecture en
   * posait une de plus et quatre suffisaient à résoudre le pont.
   */
  pieceADemontrer(): HTMLElement | null;
  /**
   * Fait passer une pièce **au-dessus des autres** dans le bac.
   *
   * Le vrac les fait se chevaucher : une pièce désignée du doigt mais à moitié
   * enfouie sous deux voisines ne se distingue pas, et la flèche semble montrer
   * le tas plutôt qu'un morceau. À appeler avant de la désigner, pas au moment
   * de la déplacer — c'est pendant qu'on la regarde qu'il faut la voir.
   */
  mettreEnAvant(piece: HTMLElement): void;
  /** Fait glisser une pièce jusqu'à sa position solution, à vitesse lisible. */
  poserEnSolution(piece: HTMLElement): Promise<void>;
}

/** Ouvre un tutoriel par-dessus l'énigme, et résout quand il se termine. */
export type LanceurTutoriel = (
  controle: ControlePuzzle,
  /** Le tutoriel de l'énigme, à l'ouverture — sinon le tap sur « ? ». */
  auto: boolean,
) => Promise<void>;

export interface OptionsPuzzle {
  tutoriel?: LanceurTutoriel;
}

/**
 * Durée du glissement démonstratif d'une pièce, en millisecondes.
 *
 * Lent pour un déplacement — c'est une démonstration, pas un geste : le joueur
 * doit avoir le temps de suivre la pièce du regard depuis le bac jusqu'à sa
 * place, et de comprendre que c'est *ça* qu'on lui demande de faire.
 */
const DEMO_MS = 3000;

/** Position d'une pièce sur la grille d'ancrage, en cellules. */
interface Anchor {
  c: number;
  r: number;
}

/** Une pièce montée : son élément, sa forme, et de quoi tester les collisions. */
interface Piece {
  el: HTMLElement;
  /** Boîte englobante en cellules. Son coin est la position solution. */
  boite: Boite;
  masque: Masque;
}

/** Les `clipPath` vivent dans le document : leurs identifiants doivent l'être aussi. */
let numeroPuzzle = 0;

/**
 * Ouvre l'énigme et résout quand le joueur a gagné ou abandonné.
 * Nettoie son DOM et ses minuteurs dans tous les cas.
 */
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
      <div class="puzzle__board"></div>
      <ul class="puzzle__legend">
        ${legend
          .map(
            (entry) =>
              `<li><span class="puzzle__legend-line puzzle__legend-line--${entry.cls}"></span>${entry.label}</li>`,
          )
          .join('')}
      </ul>
    </div>
    <div class="puzzle__side">
      <div class="puzzle__tray"></div>
      <div class="puzzle__actions">
        <button class="puzzle__check" type="button">Vérifier la solution</button>
        <button class="puzzle__quit" type="button">Abandonner</button>
      </div>
    </div>
    <div class="puzzle__zoom" hidden>
      <img class="puzzle__zoom-image" alt="Le pliage une fois terminé, agrandi" />
    </div>
  `;
  el.querySelector('.puzzle__title')!.textContent = def.title;

  // Le rendu du modèle arrive en différé (three.js et le `.origami` sont
  // chargés à la demande). L'énigme est jouable sans lui ; l'image se pose
  // quand elle est prête.
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
  const help = el.querySelector<HTMLButtonElement>('.puzzle__help')!;

  // Sans lanceur — un appel qui ne passe pas par le jeu, un test — le bouton
  // n'aurait rien à ouvrir : mieux vaut qu'il ne soit pas là.
  help.hidden = !options.tutoriel;

  // La vignette est petite par nécessité — elle ne doit pas manger le plateau —
  // donc on donne un moyen de la regarder vraiment.
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

    // La fenêtre découpée dans le motif, en unités du crease pattern : la
    // boîte de la pièce, pas la pièce elle-même. Le polygone, lui, sert de
    // `clipPath` — d'où le détourage.
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

  const trayLayout = eparpiller(el, tray, board, pieces, grille, graine(def.svg));

  return new Promise<PuzzleOutcome>((resolve) => {
    const placed = new Map<HTMLElement, Anchor>();
    let finished = false;

    const finish = (outcome: PuzzleOutcome) => {
      if (finished) return;
      finished = true;
      el.remove();
      resolve(outcome);
    };

    /**
     * Remet une pièce dans le bac, là où le vrac l'avait posée et à sa taille
     * de bac.
     *
     * Deux détails qui ne se voient qu'à l'usage : le glisser lui a donné sa
     * taille de plateau, qu'il faut défaire, sinon elle revient trop grande et
     * déborde ; et elle est réinsérée en fin de bac, donc au-dessus des autres,
     * ce qui la rend attrapable même si elle en recouvre une.
     */
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

    /** Pose une pièce sur la grille, en dégageant ce qu'elle recouvrirait. */
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

    /**
     * Décide du sort d'une pièce lâchée : sur le plateau ou retour au bac.
     *
     * C'est le **point de relâchement** qui tranche, pas le rectangle de la
     * pièce. Avec le rectangle, une pièce large de six cellules chevauchait
     * encore le plateau même le doigt loin à l'extérieur : impossible de la
     * rendre au bac. Le doigt, lui, dit sans ambiguïté où le joueur visait.
     *
     * La position du rectangle sert ensuite à choisir la cellule d'ancrage.
     */
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

    /**
     * Fait glisser une pièce du bac jusqu'à sa place, comme le ferait un doigt.
     *
     * Même mécanique que le glisser : `position: fixed` le temps du trajet, donc
     * la pièce échappe au rognage du bac et passe au-dessus du reste. La taille
     * est animée elle aussi — une pièce qui prend d'un coup sa taille de plateau
     * au départ du mouvement fait un saut que l'œil lit comme un défaut.
     */
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
      // dernière insérée passe devant. C'est déjà ce dont `toTray` se sert pour
      // rendre attrapable une pièce qui revient sur une autre.
      mettreEnAvant: (piece) => tray.appendChild(piece),
      poserEnSolution,
    };

    if (options.tutoriel) {
      const lanceur = options.tutoriel;
      help.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        void lanceur(controle, false);
      });
      // Le tutoriel d'ouverture ne bloque pas la promesse de l'énigme : il se
      // pose par-dessus et lui rendra la main tout seul. C'est son voile qui
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

      // Aucune pénalité : on peut revérifier autant de fois qu'on veut. Seul
      // le clignotement rouge signale l'erreur.
      board.classList.add('is-wrong');
      window.setTimeout(() => board.classList.remove('is-wrong'), FLASH_MS);
    });

    quit.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      finish('abandoned');
    });
  });
}

/** Où et à quelle taille une pièce repose dans le bac, en pixels. */
interface PoseBac {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TrayLayout {
  pose: Map<HTMLElement, PoseBac>;
  /** Pixels par cellule dans le bac. */
  scale: number;
}

/**
 * Jette les pièces en vrac dans le bac.
 *
 * **En vrac, mais sans jamais sortir du bac** : le bac est la seule surface où
 * l'on est sûr qu'une pièce ne recouvre ni le plateau ni les boutons. Les
 * positions sont tirées d'un générateur **à graine fixe** (`graine()`), donc le
 * désordre est le même à chaque ouverture de la même énigme : deux parties se
 * comparent, un bug se reproduit, et rien ne dépend du hasard de la session.
 *
 * Le chevauchement est toléré — c'est ce qui fait le tas — mais mesuré et
 * plafonné : au-delà, une pièce disparaît sous une autre et devient
 * inattrapable. Il se mesure sur les **boîtes** des pièces, donc on en tolère
 * moins qu'il n'en paraît : deux boîtes qui mordent l'une sur l'autre de 15 %
 * ne montrent souvent aucun recouvrement de papier.
 *
 * Toutes les pièces partagent un même facteur `k` (pixels par cellule) : elles
 * gardent donc entre elles les proportions qu'elles auront sur le plateau, ce
 * qui aide à reconnaître laquelle va où. `k` est plafonné à la taille réelle —
 * une pièce n'est jamais **plus grande** dans le bac que sur le plateau — et
 * rétrécit tant que le vrac ne tient pas.
 */
function eparpiller(
  root: HTMLElement,
  tray: HTMLElement,
  board: HTMLElement,
  pieces: Piece[],
  grille: number,
  seed: number,
): TrayLayout {
  const cadre = tray.getBoundingClientRect();
  const largeur = root.getBoundingClientRect().width * MAX_TRAY_RATIO;
  const hauteur = cadre.height;
  const trueCell = board.getBoundingClientRect().width / grille;

  // Point de départ : le facteur qui ferait occuper aux boîtes des pièces un
  // peu plus de la moitié du bac. Le reste est du vide, et c'est lui qui rend
  // le vrac possible.
  const cellules = pieces.reduce((somme, p) => somme + p.boite.w * p.boite.h, 0);
  const depart = Math.min(trueCell, Math.sqrt((largeur * hauteur * 0.55) / cellules));

  let k = depart;
  let poses: PoseBac[] | null = null;
  for (let essai = 0; essai < 14 && !poses; essai++) {
    poses = tenterVrac(pieces, largeur, hauteur, k, seed);
    if (!poses) k *= 0.9;
  }
  // Dernier recours : à cette taille-là toutes les pièces tiennent côte à côte
  // dans le bac, le vrac n'a plus le choix.
  if (!poses) poses = tenterVrac(pieces, largeur, hauteur, k, seed, 1) ?? [];

  const pose = new Map<HTMLElement, PoseBac>();
  for (const [i, p] of pieces.entries()) {
    const ou = poses[i] ?? { x: 0, y: 0, w: p.boite.w * k, h: p.boite.h * k };
    pose.set(p.el, ou);
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

/** Recouvrement toléré entre deux boîtes, en part de la plus petite des deux. */
const CHEVAUCHEMENT = 0.18;
/** Ce qu'on accepte faute de mieux, plutôt que de tout rétrécir encore. */
const CHEVAUCHEMENT_MAX = 0.4;
/** Positions tirées par pièce avant d'abandonner cette taille. */
const ESSAIS = 400;

/**
 * Un jet de pièces à la taille `k`, ou `null` si le bac est trop petit pour ça.
 * Les grandes pièces d'abord : posées en dernier, elles ne trouvent plus de
 * place et font échouer des tailles pourtant tenables.
 */
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
  // Les pièces déjà posées, dans l'ordre où elles l'ont été. Une liste à part,
  // et non `poses` : celle-ci se remplit dans le désordre des tailles, et ses
  // trous se compareraient à `undefined`.
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

/** Part de la plus petite des deux boîtes que l'autre recouvre. */
function recouvrement(a: PoseBac, b: PoseBac): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même vrac.
 * `Math.random()` donnerait un tas différent à chaque ouverture, donc un bug
 * de placement impossible à revoir.
 */
function melangeur(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * La graine vient de l'énigme elle-même (son chemin de motif), pas d'un nombre
 * écrit à la main : chaque énigme a son vrac, et il ne bouge pas.
 */
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

/**
 * Charge le crease pattern et en extrait de quoi fabriquer les pièces.
 *
 * Le `<style>` embarqué par ORIPA est retiré : injecté tel quel dans la page il
 * s'appliquerait au document entier (les styles d'un SVG inline ne sont pas
 * encapsulés), et il serait dupliqué à chaque pièce. Les classes `mo`/`va`/`bo`
 * sont restylées dans style.css, ce qui permet au passage d'accorder les plis à
 * la palette du jeu.
 */
async function loadPattern(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`crease pattern introuvable : ${url}`);

  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  for (const style of Array.from(svg.getElementsByTagName('style'))) style.remove();

  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 1000').split(/[\s,]+/).map(Number);

  // La légende se construit à partir du motif, pas d'une liste écrite à la main :
  // le pont n'a que des plis vallée, et annoncer un pli montagne inexistant
  // enverrait le joueur chercher une couleur qu'il ne trouvera jamais.
  return {
    viewBox: { x, y, w, h },
    inner: svg.innerHTML,
    folds: { valley: !!svg.querySelector('.va'), mountain: !!svg.querySelector('.mo') },
  };
}

/**
 * Rend une pièce déplaçable au doigt.
 *
 * `setPointerCapture` est le cœur du mécanisme : il redirige tous les
 * événements du pointeur vers la pièce jusqu'au relâchement, donc un doigt qui
 * sort du plateau — ou du cadre du jeu — ne laisse jamais de pièce orpheline.
 *
 * Pendant le glisser la pièce passe en `position: fixed`, centrée sous le doigt
 * et déjà à sa taille de plateau. Elle échappe ainsi à tout rognage par un
 * conteneur, et ce qu'on voit sous le doigt est exactement ce qui sera posé.
 *
 * L'écouteur est posé sur la pièce, mais le tap n'est reçu que par le papier :
 * le détourage laisse du vide dans la boîte, et c'est le CSS
 * (`pointer-events`) qui le rend traversant, sans quoi une pièce en recouvrirait
 * une autre par un coin transparent.
 */
function makeDraggable(
  { el: piece, boite: forme }: Piece,
  board: HTMLElement,
  grille: number,
  onDrop: (rect: DOMRect, x: number, y: number) => void,
) {
  let dragging = false;
  let width = 0;
  let height = 0;

  const moveTo = (x: number, y: number) => {
    piece.style.left = `${x - width / 2}px`;
    piece.style.top = `${y - height / 2}px`;
  };

  piece.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = true;

    const b = board.getBoundingClientRect();
    width = (forme.w / grille) * b.width;
    height = (forme.h / grille) * b.height;
    piece.style.position = 'fixed';
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
    for (const prop of ['position', 'width', 'height', 'left', 'top'] as const) {
      piece.style.removeProperty(prop);
    }

    if (dropped) onDrop(rect, e.clientX, e.clientY);
  };

  piece.addEventListener('pointerup', (e) => end(e, true));
  // Interruption système (appel entrant, geste de l'OS) : on repose la pièce
  // là où elle était plutôt que de la téléporter sous le dernier point connu.
  piece.addEventListener('pointercancel', (e) => end(e, false));
}
