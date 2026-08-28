// Le découpage se dessine dans `decoupage.html` et vit dans
// `game-design/enigmes/<nom>.json` ; `tools/import-decoupage.mjs` en tire
// `src/generated/enigmes.ts`.
//
// Tout est entier : un sommet est une intersection de la grille d'ancrage, et
// une coupe ne touche le bord d'une pièce qu'à ses extrémités. Rien ici n'a donc
// besoin de tolérance numérique, et deux pièces voisines partagent exactement
// les mêmes points.
//
// Le recouvrement se teste sur un masque et non sur les polygones : deux pièces
// côte à côte partagent une arête entière, et un test d'aire exact devrait
// distinguer « se touchent » de « se recouvrent », le cas dégénéré à éviter.

// Un sommet, en cellules de la grille d'ancrage. Entier.
export type Point = readonly [number, number];

// Un polygone simple, fermé implicitement.
export interface PieceDecoupee {
  readonly points: readonly Point[];
}

export interface Decoupage {
  // Côté de la grille d'ancrage, en cellules. Le motif est carré.
  readonly grille: number;
  readonly pieces: readonly PieceDecoupee[];
}

export interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Subdivisions d'une cellule pour l'échantillonnage des masques.
export const SOUS = 4;

// Position du point testé dans sa sous-cellule. Deux valeurs différentes et
// choisies de travers : au centre, la diagonale d'une pièce coupée en biais
// passerait pile dessus et deux pièces voisines revendiqueraient les mêmes.
const DECALAGE_X = 0.37;
const DECALAGE_Y = 0.61;

// Sommets entiers et point entier : le test est exact, aucun epsilon en jeu.
// Sert à l'éditeur, qui n'accepte une coupe que d'un bord à l'autre.
export function surLeBord(points: readonly Point[], x: number, y: number): boolean {
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((x - xi) * (yj - yi) - (y - yi) * (xj - xi) !== 0) continue;
    if (
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) &&
      y <= Math.max(yi, yj)
    ) {
      return true;
    }
  }
  return false;
}

// Relatif au coin haut-gauche de la boîte de la pièce.
export interface Masque {
  cols: number;
  rows: number;
  bits: Uint8Array;
}

// En cellules. Son coin est la position solution de la pièce.
export function boite(points: readonly Point[]): Boite {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Formule du lacet, toujours positive.
export function aire(points: readonly Point[]): number {
  let somme = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    somme += x1 * y2 - x2 * y1;
  }
  return Math.abs(somme) / 2;
}

// Lancer de rayon horizontal. Les points sur le bord ne sont pas décidés : les
// appelants n'en testent pas, grâce aux décalages ci-dessus.
export function pointDans(points: readonly Point[], x: number, y: number): boolean {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

export function masque(points: readonly Point[]): Masque {
  const b = boite(points);
  const cols = b.w * SOUS;
  const rows = b.h * SOUS;
  const bits = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = b.y + (j + DECALAGE_Y) / SOUS;
    for (let i = 0; i < cols; i++) {
      const x = b.x + (i + DECALAGE_X) / SOUS;
      if (pointDans(points, x, y)) bits[j * cols + i] = 1;
    }
  }
  return { cols, rows, bits };
}

// Les ancres sont les coins haut-gauche, en cellules. Se toucher par une arête
// ne compte pas : c'est le cas normal d'un découpage bien posé.
export function chevauchent(
  a: Masque,
  ancreA: { c: number; r: number },
  b: Masque,
  ancreB: { c: number; r: number },
): boolean {
  const dx = (ancreB.c - ancreA.c) * SOUS;
  const dy = (ancreB.r - ancreA.r) * SOUS;
  const i0 = Math.max(0, dx);
  const j0 = Math.max(0, dy);
  const i1 = Math.min(a.cols, dx + b.cols);
  const j1 = Math.min(a.rows, dy + b.rows);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (a.bits[j * a.cols + i] && b.bits[(j - dy) * b.cols + (i - dx)]) return true;
    }
  }
  return false;
}

// Chemin SVG fermé ; `vers` convertit des cellules en unités de sortie.
export function chemin(points: readonly Point[], vers: (p: Point) => Point): string {
  return (
    points
      .map((p, i) => {
        const [x, y] = vers(p);
        return `${i === 0 ? 'M' : 'L'}${arrondi(x)} ${arrondi(y)}`;
      })
      .join(' ') + ' Z'
  );
}

function arrondi(n: number): number {
  return Math.round(n * 1000) / 1000;
}
