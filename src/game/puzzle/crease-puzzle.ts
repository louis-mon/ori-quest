/**
 * Le minijeu commun à (presque) toutes les énigmes : reconstituer un crease
 * pattern à partir de morceaux découpés.
 *
 * Voir game-design/05-puzzle-crease-pattern.md. Le plateau est à gauche, les
 * pièces en colonne à droite, un bouton vérifie la solution. Échec = clignotement
 * rouge et attente ; réussite = on rend la main à la scène, qui joue le pliage.
 *
 * **Le découpage est décrit en cellules**, pas en parts égales : chaque pièce est
 * un rectangle `(x, y, w, h)` sur une grille de `grid` × `grid` cellules, origine
 * en haut à gauche. C'est ce qui rend la solution unique — un découpage en
 * quadrants égaux laissait plusieurs dispositions correctes sur un motif
 * symétrique, alors qu'une seule était validée.
 *
 * **La grille d'ancrage** est plus fine que les pièces : une pièce lâchée
 * n'importe où se cale sur la cellule la plus proche, ce qui évite au joueur de
 * viser au pixel. Une pièce posée à cheval sur une voisine renvoie celle-ci au
 * bac plutôt que de la recouvrir.
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

/** Un morceau du crease pattern, en cellules de la grille d'ancrage. */
export interface CreasePuzzlePiece {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** Côté de la grille d'ancrage, en cellules. Le motif est carré. */
  grid: number;
  /** Découpe. L'ordre n'a pas d'importance : chaque pièce porte sa position. */
  pieces: CreasePuzzlePiece[];
  /** Titre affiché au-dessus du plateau. */
  title: string;
}

export type PuzzleOutcome = 'solved' | 'abandoned';

/** Position d'une pièce sur la grille d'ancrage, en cellules. */
interface Anchor {
  c: number;
  r: number;
}

/**
 * Ouvre l'énigme et résout quand le joueur a gagné ou abandonné.
 * Nettoie son DOM et ses minuteurs dans tous les cas.
 */
export async function runCreasePuzzle(
  root: HTMLElement,
  def: CreasePuzzleDef,
): Promise<PuzzleOutcome> {
  const { viewBox, inner, folds } = await loadPattern(def.svg);

  const el = document.createElement('div');
  el.className = 'puzzle';
  el.style.setProperty('--grid', String(def.grid));
  const legend = [
    folds.valley ? { cls: 'va', label: 'pli vallée' } : null,
    folds.mountain ? { cls: 'mo', label: 'pli montagne' } : null,
  ].filter((entry) => entry !== null);

  el.innerHTML = `
    <button class="puzzle__goal" type="button" aria-label="Agrandir le pliage terminé">
      <img class="puzzle__goal-image" alt="Le pliage une fois terminé" />
    </button>
    <div class="puzzle__panel">
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

  // La pièce garde son rectangle d'origine : c'est à la fois sa taille et sa
  // solution. L'index sert seulement à relier l'élément à sa définition.
  const pieces = def.pieces.map((spec, i) => {
    const piece = document.createElement('div');
    piece.className = 'puzzle__piece';
    piece.dataset.piece = String(i);
    piece.style.setProperty('--w', String(spec.w));
    piece.style.setProperty('--h', String(spec.h));

    const vx = viewBox.x + (spec.x / def.grid) * viewBox.w;
    const vy = viewBox.y + (spec.y / def.grid) * viewBox.h;
    const vw = (spec.w / def.grid) * viewBox.w;
    const vh = (spec.h / def.grid) * viewBox.h;
    piece.innerHTML =
      `<svg viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="none"` +
      ` xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

    return { el: piece, spec };
  });

  const specOf = (el: HTMLElement) => pieces[Number(el.dataset.piece)].spec;

  for (const { el: piece } of shuffled(pieces)) tray.appendChild(piece);
  root.appendChild(el);

  const trayLayout = layoutTray(el, tray, board, def);

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
     * Remet une pièce dans sa colonne d'origine, à sa taille de bac.
     *
     * Deux détails qui ne se voient qu'à l'usage : la replacer à la racine du
     * bac en ferait un frère des colonnes, donc une pièce posée par-dessus les
     * autres ; et le glisser lui a donné sa taille de plateau, qu'il faut
     * défaire, sinon elle revient trop grande et déborde.
     */
    function toTray(piece: HTMLElement) {
      placed.delete(piece);
      piece.style.left = '';
      piece.style.top = '';

      const px = trayLayout.size.get(piece);
      if (px) {
        piece.style.width = `${px.w}px`;
        piece.style.height = `${px.h}px`;
      }

      const column = trayLayout.home.get(piece) ?? tray;
      // Réinsertion dans l'ordre : une pièce qui revient ne doit pas sauter en
      // fin de colonne, on la remet entre ses voisines d'origine.
      const index = Number(piece.dataset.piece);
      const after = [...column.children].find(
        (sibling) => Number((sibling as HTMLElement).dataset.piece) > index,
      );
      column.insertBefore(piece, after ?? null);
    }

    /** Pose une pièce sur la grille, en dégageant ce qu'elle recouvrirait. */
    function place(piece: HTMLElement, anchor: Anchor) {
      const spec = specOf(piece);
      for (const [other, at] of placed) {
        if (other === piece) continue;
        const os = specOf(other);
        const disjoint =
          anchor.c + spec.w <= at.c ||
          at.c + os.w <= anchor.c ||
          anchor.r + spec.h <= at.r ||
          at.r + os.h <= anchor.r;
        if (!disjoint) toTray(other);
      }

      placed.set(piece, anchor);
      // La taille sur le plateau vient du CSS (pourcentages de la grille) : on
      // retire celle du bac, qui est en dur et l'emporterait.
      piece.style.removeProperty('width');
      piece.style.removeProperty('height');
      piece.style.left = `${(anchor.c / def.grid) * 100}%`;
      piece.style.top = `${(anchor.r / def.grid) * 100}%`;
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

      const spec = specOf(piece);
      place(piece, {
        c: clamp(Math.round((rect.left - b.left) / (b.width / def.grid)), 0, def.grid - spec.w),
        r: clamp(Math.round((rect.top - b.top) / (b.height / def.grid)), 0, def.grid - spec.h),
      });
    }

    for (const { el: piece, spec } of pieces) {
      makeDraggable(piece, board, def, spec, (rect, x, y) => drop(piece, rect, x, y));
    }

    check.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (check.disabled) return;

      const solved =
        placed.size === pieces.length &&
        pieces.every(({ el: piece, spec }) => {
          const at = placed.get(piece);
          return at?.c === spec.x && at?.r === spec.y;
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

/**
 * Dispose les pièces dans le bac, à l'échelle et sur autant de colonnes qu'il
 * faut.
 *
 * Toutes les pièces partagent un même facteur `k` (pixels par cellule) : elles
 * gardent donc entre elles les proportions qu'elles auront sur le plateau, ce
 * qui aide à reconnaître laquelle va où. Leur donner à toutes la même largeur
 * paraissait plus simple, mais une pièce étroite et haute devenait démesurée et
 * la colonne débordait du cadre.
 *
 * `k` est plafonné à la taille réelle : une pièce n'est jamais **plus grande**
 * dans le bac que sur le plateau. En dessous, elle rétrécit seulement si la
 * place manque — et le glisser la ramène de toute façon à sa taille réelle dès
 * qu'on la saisit, ce qui rend inutile un survol pour la « rendre lisible ».
 *
 * Le nombre de colonnes n'est pas fixé d'avance : on cherche celui qui autorise
 * le plus grand `k`. Sur un téléphone en paysage, une colonne unique écrasait
 * les pièces à 30 px de côté — sous le seuil tactile — parce que leur hauteur
 * cumulée ne tient pas dans 375 px.
 *
 * Rend de quoi remettre une pièce à sa place : sa colonne d'origine et sa taille
 * de bac. Sans ça, une pièce relâchée hors du plateau atterrissait à la racine
 * du bac, en frère des colonnes, et se superposait aux autres.
 */
function layoutTray(
  root: HTMLElement,
  tray: HTMLElement,
  board: HTMLElement,
  def: CreasePuzzleDef,
): TrayLayout {
  const gap = parseFloat(getComputedStyle(tray).rowGap) || 0;
  const box = tray.getBoundingClientRect();
  const maxWidth = root.getBoundingClientRect().width * MAX_TRAY_RATIO;
  const trueCell = board.getBoundingClientRect().width / def.grid;

  const best = bestTrayLayout(def.pieces, maxWidth, box.height, gap);
  const k = Math.min(best.k, trueCell);

  const byIndex = new Map<number, HTMLElement>();
  for (const el of tray.querySelectorAll<HTMLElement>('.puzzle__piece')) {
    byIndex.set(Number(el.dataset.piece), el);
  }

  const home = new Map<HTMLElement, HTMLElement>();
  const size = new Map<HTMLElement, { w: number; h: number }>();

  tray.replaceChildren();
  for (let c = 0; c < best.columns; c++) {
    const column = document.createElement('div');
    column.className = 'puzzle__tray-column';
    for (const [i, assigned] of best.assign.entries()) {
      const el = assigned === c ? byIndex.get(i) : undefined;
      if (!el) continue;
      const spec = def.pieces[i];
      size.set(el, { w: Math.round(k * spec.w), h: Math.round(k * spec.h) });
      home.set(el, column);
      column.appendChild(el);
    }
    tray.appendChild(column);
  }

  for (const [el, px] of size) {
    el.style.width = `${px.w}px`;
    el.style.height = `${px.h}px`;
  }

  // Le bac se resserre sur ce qu'il occupe vraiment : le reste va au plateau.
  root.style.setProperty('--tray-width', `${Math.ceil(k * best.cellsWide)}px`);

  const smallest = k * Math.min(...def.pieces.flatMap((p) => [p.w, p.h]));
  if (import.meta.env.DEV && smallest < MIN_TOUCH_PX) {
    console.warn(
      `[puzzle] pièces à ${Math.round(smallest)}px de côté, sous le seuil tactile ` +
        `de ${MIN_TOUCH_PX}px : le découpage est trop fin pour ce cadre.`,
    );
  }

  return { home, size, scale: k, trueCell };
}

interface TrayLayout {
  /** Colonne d'origine de chaque pièce, où la remettre si elle revient. */
  home: Map<HTMLElement, HTMLElement>;
  /** Taille en pixels dans le bac — à réappliquer au retour. */
  size: Map<HTMLElement, { w: number; h: number }>;
  /** Pixels par cellule dans le bac. */
  scale: number;
  /** Pixels par cellule sur le plateau, soit la taille réelle. */
  trueCell: number;
}

/**
 * Cherche la répartition en colonnes qui laisse les pièces les plus grandes.
 *
 * Les pièces sont placées de la plus haute à la plus courte, chacune dans la
 * colonne la moins remplie — une heuristique suffisante pour la poignée de
 * pièces d'une énigme, là où un vrai calcul d'agencement serait hors de propos.
 */
function bestTrayLayout(
  pieces: CreasePuzzlePiece[],
  maxWidth: number,
  maxHeight: number,
  gap: number,
) {
  let best = { k: 0, columns: 1, assign: pieces.map(() => 0), cellsWide: 0 };
  const byHeight = [...pieces.keys()].sort((a, b) => pieces[b].h - pieces[a].h);

  for (let columns = 1; columns <= pieces.length; columns++) {
    const cellsPerColumn = new Array(columns).fill(0);
    const countPerColumn = new Array(columns).fill(0);
    const widthPerColumn = new Array(columns).fill(0);
    const assign = pieces.map(() => 0);

    for (const i of byHeight) {
      const c = cellsPerColumn.indexOf(Math.min(...cellsPerColumn));
      assign[i] = c;
      cellsPerColumn[c] += pieces[i].h;
      countPerColumn[c] += 1;
      widthPerColumn[c] = Math.max(widthPerColumn[c], pieces[i].w);
    }

    const cellsTall = Math.max(...cellsPerColumn);
    const cellsWide = widthPerColumn.reduce((sum, w) => sum + w, 0);
    const k = Math.min(
      (maxHeight - gap * (Math.max(...countPerColumn) - 1)) / cellsTall,
      (maxWidth - gap * (columns - 1)) / cellsWide,
    );

    if (k > best.k) best = { k, columns, assign, cellsWide };
  }

  return best;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 1000')
    .split(/[\s,]+/)
    .map(Number);

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
 */
function makeDraggable(
  piece: HTMLElement,
  board: HTMLElement,
  def: CreasePuzzleDef,
  spec: CreasePuzzlePiece,
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
    width = (spec.w / def.grid) * b.width;
    height = (spec.h / def.grid) * b.height;
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
