/**
 * Couper une pièce en deux — le seul geste de l'éditeur de découpage.
 *
 * **On découpe, on n'assemble pas.** C'est ce qui donne au découpage sa
 * propriété essentielle sans avoir à la vérifier : partant du carré et ne
 * faisant que fendre des pièces existantes, le résultat pave toujours le carré
 * exactement, sans trou ni recouvrement. Dessiner les pièces une à une aurait
 * demandé de faire coïncider à la main les arêtes partagées.
 *
 * **Tout est entier.** Une coupe part d'un point de la grille situé sur le bord
 * de la pièce et s'arrête sur un autre, en passant par des points de la grille
 * strictement intérieurs. Les sommets produits sont donc entiers eux aussi, et
 * la propriété se conserve indéfiniment : aucune tolérance numérique n'entre
 * jamais dans le découpage. C'est aussi ce que demande la grille d'ancrage —
 * une pièce dont un sommet tomberait entre deux intersections ne pourrait pas
 * se caler.
 *
 * En contrepartie, une coupe en biais ne peut être reprise qu'aux points de
 * grille qu'elle traverse : une diagonale de (0,0) à (3,2) n'en croise aucun
 * entre ses extrémités, et rien ne pourra en repartir. C'est la même contrainte
 * que celle imposée au joueur.
 */

import { aire, pointDans, surLeBord, type Point } from '../game/puzzle/decoupage';

export type Resultat = { ok: true; pieces: [Point[], Point[]] } | { ok: false; erreur: string };

/** Un trait du crease pattern, en unités de grille. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Tolérance sur les plis, qui viennent du motif et ne tombent pas sur la grille. */
const EPS = 1e-6;

/** En deçà, deux traits ne se recouvrent pas, ils se croisent. */
const RECOUVREMENT_MIN = 1e-3;

/**
 * La coupe longe-t-elle un pli du motif ?
 *
 * À proscrire : un pli posé sur une arête de découpe se retrouve **coupé en
 * deux dans la longueur**, chaque pièce en montrant la moitié de l'épaisseur.
 * Le joueur voit alors deux demi-plis au lieu d'un, et l'arête de la pièce lui
 * dit où le pli passait — ce que le découpage est justement censé lui cacher.
 *
 * Contrairement au reste du fichier, ce test-ci n'est pas exact : les plis
 * viennent du crease pattern et tombent où ils veulent, pas sur la grille.
 */
export function longeUnPli(plis: readonly Segment[], a: Point, b: Point): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const longueur = Math.hypot(dx, dy);
  if (longueur < EPS) return false;

  for (const pli of plis) {
    // Les deux bouts du pli doivent être sur la droite portant la coupe.
    const ecart = (x: number, y: number) => ((x - a[0]) * dy - (y - a[1]) * dx) / longueur;
    if (Math.abs(ecart(pli.x1, pli.y1)) > EPS || Math.abs(ecart(pli.x2, pli.y2)) > EPS) continue;

    // Colinéaires : reste à savoir s'ils se recouvrent, et pas seulement s'ils
    // se prolongent.
    const long = (x: number, y: number) => ((x - a[0]) * dx + (y - a[1]) * dy) / longueur;
    const [u0, u1] = [long(pli.x1, pli.y1), long(pli.x2, pli.y2)].sort((p, q) => p - q);
    if (Math.min(longueur, u1) - Math.max(0, u0) > RECOUVREMENT_MIN) return true;
  }
  return false;
}

/** Fend `piece` le long de `trait`. Le trait va d'un bord à l'autre de la pièce. */
export function couper(piece: readonly Point[], trait: readonly Point[]): Resultat {
  if (trait.length < 2) return non('Une coupe demande au moins deux points.');

  const debut = trait[0];
  const fin = trait[trait.length - 1];
  if (!surLeBord(piece, ...debut)) return non('La coupe doit partir du bord de la pièce.');
  if (!surLeBord(piece, ...fin)) return non('La coupe doit finir sur le bord de la pièce.');
  if (memePoint(debut, fin)) return non('Une coupe ne revient pas à son point de départ.');

  for (const p of trait.slice(1, -1)) {
    if (surLeBord(piece, ...p) || !pointDans(piece, ...p)) {
      return non('Les points du milieu doivent être strictement dans la pièce.');
    }
  }

  for (let i = 1; i < trait.length; i++) {
    const erreur = verifierSegment(piece, trait[i - 1], trait[i]);
    if (erreur) return non(erreur);
  }
  if (seCroise(trait)) return non('La coupe se recoupe elle-même.');

  // Les extrémités deviennent des sommets de la pièce : le reste n'est plus
  // qu'un parcours du contour, d'une extrémité à l'autre, dans les deux sens.
  const contour = inserer(piece, [debut, fin]);
  const a = contour.findIndex((p) => memePoint(p, debut));
  const b = contour.findIndex((p) => memePoint(p, fin));
  if (a < 0 || b < 0 || a === b) return non('Coupe impossible à recoller au contour.');

  const gauche = normaliser([...trait, ...parcourir(contour, b, a)]);
  const droite = normaliser([...[...trait].reverse(), ...parcourir(contour, a, b)]);

  if (!gauche || !droite) return non('Cette coupe ne laisse pas deux morceaux.');
  return { ok: true, pieces: [gauche, droite] };
}

const non = (erreur: string): Resultat => ({ ok: false, erreur });

const memePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

/** Produit vectoriel (a-o) x (b-o). Son signe dit de quel côté tombe b. */
const croix = (o: Point, a: Point, b: Point) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const signe = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Un segment de coupe doit rester dans la pièce. Trois façons d'en sortir :
 * traverser une arête, la longer, ou passer par l'extérieur d'une pièce
 * concave — d'où le test du milieu.
 */
function verifierSegment(piece: readonly Point[], a: Point, b: Point): string | null {
  if (memePoint(a, b)) return 'Deux points de coupe confondus.';

  for (let i = 0, j = piece.length - 1; i < piece.length; j = i++) {
    const c = piece[j];
    const d = piece[i];
    if (traverse(a, b, c, d)) return 'La coupe sort de la pièce.';
    if (longe(a, b, c, d)) return 'La coupe longe un bord au lieu de le franchir.';
  }

  const milieu: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (!pointDans(piece, ...milieu) && !surLeBord(piece, ...milieu)) {
    return 'La coupe passe hors de la pièce.';
  }
  return null;
}

/** Croisement franc : chaque segment sépare les extrémités de l'autre. */
function traverse(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = signe(croix(a, b, c));
  const d2 = signe(croix(a, b, d));
  const d3 = signe(croix(c, d, a));
  const d4 = signe(croix(c, d, b));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Colinéaires et recouvrement de longueur non nulle. */
function longe(a: Point, b: Point, c: Point, d: Point): boolean {
  if (croix(a, b, c) !== 0 || croix(a, b, d) !== 0) return false;
  const proj = (p: Point) => (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? p[0] : p[1]);
  const [u0, u1] = [proj(a), proj(b)].sort((x, y) => x - y);
  const [v0, v1] = [proj(c), proj(d)].sort((x, y) => x - y);
  return Math.min(u1, v1) - Math.max(u0, v0) > 0;
}

function seCroise(trait: readonly Point[]): boolean {
  for (let i = 1; i < trait.length; i++) {
    for (let j = i + 2; j < trait.length; j++) {
      if (traverse(trait[i - 1], trait[i], trait[j - 1], trait[j])) return true;
    }
  }
  return false;
}

/** Ajoute les points donnés au contour, à leur place sur l'arête qui les porte. */
function inserer(piece: readonly Point[], points: readonly Point[]): Point[] {
  const contour: Point[] = [];
  for (let i = 0; i < piece.length; i++) {
    const a = piece[i];
    const b = piece[(i + 1) % piece.length];
    contour.push(a);
    const surCetteArete = points
      .filter((p) => !memePoint(p, a) && !memePoint(p, b) && croix(a, b, p) === 0 && entre(a, b, p))
      .sort((p, q) => distance2(a, p) - distance2(a, q));
    contour.push(...surCetteArete);
  }
  return contour;
}

const entre = (a: Point, b: Point, p: Point) =>
  p[0] >= Math.min(a[0], b[0]) &&
  p[0] <= Math.max(a[0], b[0]) &&
  p[1] >= Math.min(a[1], b[1]) &&
  p[1] <= Math.max(a[1], b[1]);

const distance2 = (a: Point, b: Point) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** Les sommets rencontrés en allant de l'indice `de` à l'indice `a`, exclus. */
function parcourir(contour: readonly Point[], de: number, a: number): Point[] {
  const out: Point[] = [];
  for (let i = (de + 1) % contour.length; i !== a; i = (i + 1) % contour.length) {
    out.push(contour[i]);
  }
  return out;
}

/**
 * Retire les points inutiles — doublons et sommets alignés — et refuse ce qui
 * n'est pas un polygone. Le contour reste géométriquement identique : deux
 * pièces voisines partagent toujours exactement la même arête, un sommet
 * intermédiaire en moins.
 */
function normaliser(points: readonly Point[]): Point[] | null {
  const sans: Point[] = [];
  for (const p of points) {
    if (!sans.length || !memePoint(sans[sans.length - 1], p)) sans.push(p);
  }
  if (sans.length > 1 && memePoint(sans[0], sans[sans.length - 1])) sans.pop();

  const droit: Point[] = [];
  for (let i = 0; i < sans.length; i++) {
    const avant = sans[(i - 1 + sans.length) % sans.length];
    const apres = sans[(i + 1) % sans.length];
    if (croix(avant, sans[i], apres) !== 0) droit.push(sans[i]);
  }

  return droit.length >= 3 && aire(droit) > 0 ? droit : null;
}
