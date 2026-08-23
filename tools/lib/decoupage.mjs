/**
 * Le découpage d'une énigme, côté outils : lecture, validation du pavage,
 * et recherche des dispositions qui donneraient la même image.
 *
 * Le pendant côté jeu est `src/game/puzzle/decoupage.ts`. Les deux se
 * ressemblent parce qu'un outil Node ne peut pas importer du TypeScript —
 * même raison que les constantes recopiées en tête de `import-scene.mjs`.
 * Ce qui compte est que les conventions restent les mêmes : sommets **entiers**
 * en cellules de la grille, et recouvrement testé sur une sous-grille décalée
 * plutôt que sur les polygones, pour que deux pièces qui se touchent par une
 * arête ne comptent pas comme superposées.
 */
import { existsSync, readFileSync } from 'node:fs';

const EPS = 1e-9;

/** Subdivisions d'une cellule, et position du point testé dans sa sous-cellule. */
export const SOUS = 4;
const DECALAGE_X = 0.37;
const DECALAGE_Y = 0.61;

/** Bornes de bon sens : au-delà, ce n'est plus un découpage. */
export const LIMITES = { grille: [2, 24], pieces: [1, 24], sommets: [3, 64] };

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Lit un `game-design/enigmes/<nom>.json` et refuse tout ce qui n'est pas un
 * découpage : la seule chose qui doit pouvoir arriver ici est ce qu'écrit
 * l'éditeur, mais le fichier est éditable à la main et le jeu en dépend.
 */
export function lireDecoupage(fichier) {
  const brut = JSON.parse(readFileSync(fichier, 'utf8'));
  const grille = brut.grille;
  if (!entier(grille, ...LIMITES.grille)) throw new Error(`grille invalide : ${grille}`);

  if (!Array.isArray(brut.pieces) || !dansBornes(brut.pieces.length, LIMITES.pieces)) {
    throw new Error(`nombre de pièces invalide : ${brut.pieces?.length}`);
  }

  const pieces = brut.pieces.map((piece, i) => {
    const points = piece?.points;
    if (!Array.isArray(points) || !dansBornes(points.length, LIMITES.sommets)) {
      throw new Error(`pièce ${i} : ${points?.length} sommet(s)`);
    }
    return points.map(([x, y]) => {
      if (!entier(x, 0, grille) || !entier(y, 0, grille)) {
        throw new Error(`pièce ${i} : sommet hors grille (${x}, ${y})`);
      }
      return [x, y];
    });
  });

  return { grille, pieces };
}

const entier = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const dansBornes = (n, [min, max]) => n >= min && n <= max;

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

export function boite(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function aire(points) {
  let somme = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    somme += x1 * y2 - x2 * y1;
  }
  return Math.abs(somme) / 2;
}

export function pointDans(points, x, y) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

export function surLeBord(points, x, y) {
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const croix = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(croix) > EPS) continue;
    if (
      x >= Math.min(xi, xj) - EPS &&
      x <= Math.max(xi, xj) + EPS &&
      y >= Math.min(yi, yj) - EPS &&
      y <= Math.max(yi, yj) + EPS
    ) {
      return true;
    }
  }
  return false;
}

/** Sous-cellules occupées, en coordonnées absolues de la grille. */
export function masque(points, grille) {
  const bits = new Uint8Array(grille * SOUS * grille * SOUS);
  const b = boite(points);
  for (let j = b.y * SOUS; j < (b.y + b.h) * SOUS; j++) {
    const y = (j + DECALAGE_Y) / SOUS;
    for (let i = b.x * SOUS; i < (b.x + b.w) * SOUS; i++) {
      const x = (i + DECALAGE_X) / SOUS;
      if (pointDans(points, x, y)) bits[j * grille * SOUS + i] = 1;
    }
  }
  return bits;
}

// ---------------------------------------------------------------------------
// Pavage
// ---------------------------------------------------------------------------

/**
 * Les pièces couvrent-elles le carré exactement une fois ?
 *
 * L'éditeur ne peut pas produire autre chose — il découpe, il n'assemble pas —
 * mais le fichier reste éditable à la main, et le jeu suppose un pavage exact.
 */
export function verifierPavage({ grille, pieces }) {
  const cote = grille * SOUS;
  const compte = new Uint8Array(cote * cote);
  for (const points of pieces) {
    const bits = masque(points, grille);
    for (let k = 0; k < compte.length; k++) compte[k] += bits[k];
  }

  const trous = [];
  const doubles = [];
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) {
      const n = compte[j * cote + i];
      const ou = `${(i / SOUS).toFixed(2)},${(j / SOUS).toFixed(2)}`;
      if (n === 0) trous.push(ou);
      else if (n > 1) doubles.push(ou);
    }
  }

  const aireTotale = pieces.reduce((somme, points) => somme + aire(points), 0);
  return { trous, doubles, aireTotale, aireAttendue: grille * grille };
}

// ---------------------------------------------------------------------------
// Le motif, et ce que chaque pièce en montre
// ---------------------------------------------------------------------------

/**
 * Segments du crease pattern, ramenés en unités de grille.
 * Les traits de bord (`bo`) sont écartés : le jeu ne les affiche pas, pour ne
 * pas révéler quelle pièce vient d'une rive du carré.
 */
export function lireMotif(fichier, grille, gardeBords = false) {
  const svg = readFileSync(fichier, 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/);
  const [vx, vy, vw, vh] = box
    ? box[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number)
    : [0, 0, 1000, 1000];

  const segments = [];
  for (const m of svg.matchAll(/<line\b([^>]*)>/g)) {
    const attrs = m[1];
    const cls = attrs.match(/class="([^"]*)"/)?.[1] ?? '';
    if (cls === 'bo' && !gardeBords) continue;
    const num = (name) => Number(attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]);
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(num);
    if ([x1, y1, x2, y2].some((n) => !Number.isFinite(n))) continue;
    segments.push({
      cls,
      x1: ((x1 - vx) / vw) * grille,
      y1: ((y1 - vy) / vh) * grille,
      x2: ((x2 - vx) / vw) * grille,
      y2: ((y2 - vy) / vh) * grille,
    });
  }
  return segments;
}

/**
 * Portions d'un segment contenues dans le polygone, en coordonnées locales.
 *
 * Un trait posé **sur** une arête de découpe compte pour les deux pièces
 * voisines : c'est ce que le joueur voit, chacune en montrant la moitié de
 * l'épaisseur. D'où le test « dedans ou sur le bord » plutôt que « dedans ».
 */
function decouper(seg, points, ox, oy) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const ts = [0, 1];

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j];
    const [bx, by] = points[i];
    const ex = bx - ax;
    const ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) > EPS) {
      const t = ((ax - seg.x1) * ey - (ay - seg.y1) * ex) / den;
      const u = ((ax - seg.x1) * dy - (ay - seg.y1) * dx) / den;
      if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) ts.push(t);
    } else {
      // Arête parallèle : si elle est colinéaire, ses extrémités peuvent
      // marquer le début ou la fin d'un passage sur le bord.
      for (const [px, py] of [
        [ax, ay],
        [bx, by],
      ]) {
        const t = Math.abs(dx) > Math.abs(dy) ? (px - seg.x1) / dx : (py - seg.y1) / dy;
        if (t > EPS && t < 1 - EPS) ts.push(t);
      }
    }
  }

  ts.sort((a, b) => a - b);
  const morceaux = [];
  for (let k = 1; k < ts.length; k++) {
    const t0 = ts[k - 1];
    const t1 = ts[k];
    if (t1 - t0 < EPS) continue;
    const tm = (t0 + t1) / 2;
    const xm = seg.x1 + tm * dx;
    const ym = seg.y1 + tm * dy;
    if (!pointDans(points, xm, ym) && !surLeBord(points, xm, ym)) continue;
    morceaux.push({
      cls: seg.cls,
      a: { x: seg.x1 + t0 * dx - ox, y: seg.y1 + t0 * dy - oy },
      b: { x: seg.x1 + t1 * dx - ox, y: seg.y1 + t1 * dy - oy },
    });
  }
  return morceaux;
}

/**
 * Signature de ce que montre une pièce posée à une ancre donnée : les portions
 * de motif qu'elle couvre, en coordonnées locales. Deux emplacements sont
 * interchangeables aux yeux du joueur si leurs signatures sont identiques.
 */
export function signature(segments, points, ancre) {
  const b = boite(points);
  const dx = ancre[0] - b.x;
  const dy = ancre[1] - b.y;
  const decale = points.map(([x, y]) => [x + dx, y + dy]);
  const rond = (n) => (Math.abs(n) < 1e-6 ? 0 : Number(n.toFixed(6)));

  return segments
    .flatMap((seg) => decouper(seg, decale, ancre[0], ancre[1]))
    .map((s) => {
      const bouts = [
        [rond(s.a.x), rond(s.a.y)],
        [rond(s.b.x), rond(s.b.y)],
      ].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      return `${s.cls}:${bouts[0]}|${bouts[1]}`;
    })
    .sort()
    .join(' ');
}

/**
 * Toutes les dispositions qui produiraient exactement la même image que la
 * solution. Il doit y en avoir une seule, sans quoi le joueur peut en trouver
 * une que la validation refusera.
 */
export function chercherSolutions(
  { grille, pieces },
  segments,
  { plafond = 200, budget = 200_000 } = {},
) {
  const cote = grille * SOUS;
  const attendu = pieces.map((points) =>
    signature(segments, points, [boite(points).x, boite(points).y]),
  );

  const places = pieces.map((points, i) => {
    const b = boite(points);
    const out = [];
    for (let y = 0; y <= grille - b.h; y++) {
      for (let x = 0; x <= grille - b.w; x++) {
        if (signature(segments, points, [x, y]) === attendu[i]) out.push([x, y]);
      }
    }
    return out;
  });

  // Masque de chaque pièce à chacune de ses ancres possibles, calculé une fois.
  const masques = pieces.map((points, i) => {
    const b = boite(points);
    return places[i].map(([x, y]) =>
      masque(
        points.map(([px, py]) => [px + x - b.x, py + y - b.y]),
        grille,
      ),
    );
  });

  const occupe = new Uint8Array(cote * cote);
  const solutions = [];
  let noeuds = 0;

  const poser = (k, acc) => {
    // L'énumération est exponentielle par nature. Sur un découpage très fin
    // elle peut ne pas finir, et l'éditeur interroge cet appel à chaque coupe :
    // mieux vaut répondre « je ne sais pas » que bloquer.
    if (++noeuds > budget || solutions.length > plafond) return;
    if (k === pieces.length) {
      solutions.push([...acc]);
      return;
    }
    for (const [n, ancre] of places[k].entries()) {
      const bits = masques[k][n];
      let libre = true;
      for (let i = 0; i < occupe.length && libre; i++) if (bits[i] && occupe[i]) libre = false;
      if (!libre) continue;
      for (let i = 0; i < occupe.length; i++) if (bits[i]) occupe[i] = 1;
      poser(k + 1, [...acc, ancre]);
      for (let i = 0; i < occupe.length; i++) if (bits[i]) occupe[i] = 0;
    }
  };
  poser(0, []);

  return { solutions, places, interrompu: noeuds > budget };
}

/**
 * Le verdict complet sur un découpage : pave-t-il le carré, et son image
 * a-t-elle une seule lecture ? C'est ce que disent l'import, l'outil en ligne
 * de commande et l'éditeur — un seul calcul pour les trois, sans quoi l'éditeur
 * finirait par afficher autre chose que ce que le jeu vérifie.
 */
export function analyser(decoupage, fichierMotif, { bords = false } = {}) {
  const pavage = verifierPavage(decoupage);
  if (pavage.doubles.length) return { etat: 'superposition', pavage };
  if (pavage.trous.length) return { etat: 'trou', pavage };
  if (!existsSync(fichierMotif)) return { etat: 'sans-motif', pavage };

  const segments = lireMotif(fichierMotif, decoupage.grille, bords);
  const { solutions, interrompu } = chercherSolutions(decoupage, segments);
  if (interrompu) return { etat: 'trop-long', traits: segments.length, pavage };
  return {
    etat: solutions.length === 1 ? 'unique' : 'multiple',
    solutions,
    traits: segments.length,
    pavage,
  };
}
