// On découpe, on n'assemble pas : en partant du carré et en ne faisant que
// fendre des pièces existantes, le résultat pave toujours le carré exactement.
// Dessiner les pièces une à une demanderait de faire coïncider à la main les
// arêtes partagées.
//
// Une coupe part d'un point du bord d'une pièce et va sur un autre, ou **se
// referme sur son point de départ** — départ qui peut alors être n'importe où,
// y compris en plein milieu du papier. La boucle détache le morceau qu'elle
// entoure ; ce qui reste garde sa forme en creux, et c'est là que le découpage
// cesse d'être exact par construction :
//
// - boucle refermée sur le bord de la pièce : le reste est **pincé** en ce
//   point, deux lobes qui ne tiennent que par lui ;
// - boucle refermée à l'intérieur : le reste a un **trou**, et une pièce cesse
//   d'être un anneau.
//
// Les deux se dessinent et ne se découpent pas — le jeu pose du papier, et un
// papier pincé tombe en deux, un papier troué n'a pas de liste de sommets. Ce
// sont donc des états de travail, que l'éditeur signale et que l'enregistrement
// refuse (`polygoneSimple`, dans `tools/lib/decoupage.mjs`). Ils se résolvent
// par d'autres coupes : un pincement en séparant ses deux lobes sans repasser
// par lui, un trou en le fondant dans le contour — ce qui demande deux coupes,
// la première réunissant les deux anneaux en un seul fendu dans la longueur, la
// seconde le tranchant pour de bon. C'est le prix de pouvoir dessiner la pièce
// qu'on veut d'un geste, au lieu de la déduire de l'ordre des coupes.
//
// Tout est entier — les extrémités sur un anneau, les points du milieu
// strictement à l'intérieur —, donc aucune tolérance numérique n'entre dans le
// découpage, et tout sommet se cale sur la grille d'ancrage. En contrepartie,
// une coupe en biais ne se reprend qu'aux points de grille qu'elle traverse :
// une diagonale de (0,0) à (3,2) n'en croise aucun.

import {
  aire,
  boite,
  masque,
  pointDans,
  SOUS,
  surLeBord,
  type Point,
} from '../game/puzzle/decoupage';

// Le contour d'abord, les trous ensuite. Le contour tourne dans un sens, les
// trous dans l'autre (`ranger`) : les recollages s'appuient dessus, fusionner
// deux anneaux tournés pareil ajouterait leurs aires au lieu de les retrancher.
export type Morceau = Point[][];
export type Piece = readonly (readonly Point[])[];

export type Resultat = { ok: true; pieces: Morceau[] } | { ok: false; erreur: string };

// Un trait du crease pattern, en unités de grille.
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Tolérance sur les plis, qui viennent du motif et ne tombent pas sur la grille.
const EPS = 1e-6;

// En deçà, deux traits ne se recouvrent pas, ils se croisent.
const RECOUVREMENT_MIN = 1e-3;

// À proscrire : un pli posé sur une arête de découpe est fendu en deux dans la
// longueur, chaque pièce en montrant la moitié, et l'arête dit alors où le pli
// passait — ce que le découpage est censé cacher.
//
// Contrairement au reste du fichier, ce test n'est pas exact : les plis viennent
// du crease pattern et ne tombent pas sur la grille.
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

// Sur quel anneau de la pièce le point se trouve-t-il, s'il est sur l'un d'eux ?
export function anneauDe(piece: Piece, p: Point): number {
  return piece.findIndex((anneau) => surLeBord(anneau, ...p));
}

// Strictement dans le papier : dans le contour, hors des trous, et sur aucun
// anneau. La parité répond aux deux premiers d'un coup.
export function dansLaPiece(piece: Piece, p: Point): boolean {
  if (anneauDe(piece, p) >= 0) return false;
  return piece.filter((anneau) => pointDans(anneau, ...p)).length % 2 === 1;
}

export function couper(brute: Piece, trait: readonly Point[]): Resultat {
  if (trait.length < 2) return non('Une coupe demande au moins deux points.');
  const piece = ranger(brute.map((anneau) => anneau.map((p) => [...p] as Point)));

  const debut = trait[0];
  const fin = trait[trait.length - 1];
  const ferme = memePoint(debut, fin);
  const milieux = trait.slice(1, -1);
  if (ferme && trait.length < 4) return non('Une boucle demande au moins trois sommets.');

  const rDebut = anneauDe(piece, debut);
  const rFin = anneauDe(piece, fin);
  // Une coupe ouverte partie du dedans ne sépare rien : c'est une fente, et la
  // pièce reste d'un seul tenant. Partir de n'importe où suppose donc de revenir
  // à son point de départ.
  if (rDebut < 0 || rFin < 0) {
    if (!ferme) return non('Une coupe va d’un bord à l’autre, ou revient à son point de départ.');
    if (!dansLaPiece(piece, debut)) return non('Le départ est hors de la pièce.');
  }

  for (const p of milieux) {
    if (!dansLaPiece(piece, p)) {
      return non('Les points du milieu doivent être strictement dans la pièce.');
    }
  }
  // Un sommet repris en chemin pincerait le morceau détaché, et une seule sorte
  // de pincement se répare : celle qu'on a voulue.
  for (let i = 0; i < milieux.length; i++) {
    for (let j = i + 1; j < milieux.length; j++) {
      if (memePoint(milieux[i], milieux[j])) return non('La coupe repasse par un de ses sommets.');
    }
  }

  for (let i = 1; i < trait.length; i++) {
    const erreur = verifierSegment(piece, trait[i - 1], trait[i]);
    if (erreur) return non(erreur);
  }
  if (seCroise(trait)) return non('La coupe se recoupe elle-même.');

  const morceaux =
    rDebut < 0
      ? creuser(piece, trait)
      : rDebut === rFin
        ? fendreUnAnneau(piece, rDebut, trait, ferme)
        : fusionner(piece, rDebut, rFin, trait);

  if (!morceaux) return non('Coupe impossible à recoller au contour.');
  if (!recouvrent(piece, morceaux)) return non('Coupe impossible à recoller au contour.');
  return { ok: true, pieces: morceaux };
}

const non = (erreur: string): Resultat => ({ ok: false, erreur });

// ---------------------------------------------------------------------------
// Les trois recollages
// ---------------------------------------------------------------------------

// La boucle intérieure ne touche aucun anneau : elle détache ce qu'elle entoure
// et laisse un trou de la même forme. C'est le seul cas où une pièce en gagne
// un — et les trous qu'elle englobe partent avec le morceau.
function creuser(piece: Morceau, trait: readonly Point[]): Morceau[] | null {
  const boucle = normaliser(trait.slice(0, -1));
  if (!boucle) return null;
  const [dedans, dehors] = partager(piece.slice(1), boucle);
  return [ranger([boucle, ...dedans]), ranger([piece[0], ...dehors, boucle])];
}

// Les deux bouts sur le même anneau. L'issue dépend de s'ils tombent au même
// endroit du contour ou à deux endroits, et de si l'anneau est le contour ou un
// trou.
function fendreUnAnneau(
  piece: Morceau,
  r: number,
  trait: readonly Point[],
  ferme: boolean,
): Morceau[] | null {
  const debut = trait[0];
  const fin = trait[trait.length - 1];
  // Une boucle n'a qu'une extrémité : la poser deux fois la dédoublerait sur son
  // arête, et le contour porterait un pincement que personne n'a coupé.
  const contour = inserer(piece[r], ferme ? [debut] : [debut, fin]);
  // Le papier est dedans pour le contour, dehors pour un trou.
  const cote = r === 0 ? sens(contour) : -sens(contour);
  const a = occurrence(contour, debut, trait[1], cote);
  const b = occurrence(contour, fin, trait[trait.length - 2], cote);
  if (a < 0 || b < 0) return null;

  const trous = piece.filter((_, i) => i > 0 && i !== r);

  // Ce n'est pas d'être fermée qui décide, c'est de revenir au même endroit du
  // contour. Une boucle partie d'un pincement et revenue par l'autre côté a ses
  // deux bouts au même point et à deux places distinctes : elle fend la pièce
  // comme n'importe quelle coupe — c'est même ainsi, et seulement ainsi, qu'un
  // pincement se défait.
  if (a === b) {
    const boucle = normaliser(trait.slice(0, -1));
    if (!boucle) return null;
    // Le morceau détaché tourne dans un sens, la forme en creux qu'il laisse
    // dans l'autre : sur le contour son aire se retranche, dans un trou elle
    // s'ajoute.
    const vise = r === 0 ? -sens(contour) : sens(contour);
    const creux = sens(boucle) === vise ? boucle : retourner(boucle);
    const pince = normaliser([contour[a], ...parcourir(contour, a, a), ...creux]);
    if (!pince) return null;

    const [dedans, dehors] = partager(trous, boucle);
    return [
      ranger([boucle, ...dedans]),
      ranger(r === 0 ? [pince, ...dehors] : [piece[0], ...dehors, pince]),
    ];
  }

  const un = normaliser([...trait, ...parcourir(contour, b, a)]);
  const deux = normaliser([...[...trait].reverse(), ...parcourir(contour, a, b)]);
  if (!un || !deux) return null;

  if (r === 0) {
    const [dansUn, dansDeux] = partager(trous, un);
    return [ranger([un, ...dansUn]), ranger([deux, ...dansDeux])];
  }

  // Une coupe partie d'un trou et qui y revient détache une lentille de papier
  // entre elle et le bord du trou ; le trou avale la lentille, donc des deux
  // anneaux c'est le plus grand qui reste un trou.
  const [lentille, creux] = aire(un) <= aire(deux) ? [un, deux] : [deux, un];
  const [dedans, dehors] = partager(trous, lentille);
  return [ranger([lentille, ...dedans]), ranger([piece[0], ...dehors, creux])];
}

// Les deux bouts sur deux anneaux différents : la coupe ne sépare rien, elle les
// réunit en un seul, parcouru en passant deux fois par elle. Le papier y est
// fendu dans la longueur — ce n'est pas encore un découpage, mais c'est la seule
// façon de faire disparaître un trou, et une coupe de plus tranche l'anneau
// obtenu.
function fusionner(
  piece: Morceau,
  rA: number,
  rB: number,
  trait: readonly Point[],
): Morceau[] | null {
  const debut = trait[0];
  const fin = trait[trait.length - 1];
  const A = inserer(piece[rA], [debut]);
  const B = inserer(piece[rB], [fin]);
  const a = occurrence(A, debut, trait[1], rA === 0 ? sens(A) : -sens(A));
  const b = occurrence(B, fin, trait[trait.length - 2], rB === 0 ? sens(B) : -sens(B));
  if (a < 0 || b < 0) return null;

  const milieux = trait.slice(1, -1);
  const pont = normaliser([
    ...tour(A, a),
    debut,
    ...milieux,
    ...tour(B, b),
    fin,
    ...[...milieux].reverse(),
  ]);
  if (!pont) return null;

  // Le rôle du nouvel anneau se lit sur les deux qu'il remplace : un contour
  // fondu avec un trou reste le contour, deux trous fondus restent un trou.
  const autres = piece.filter((_, i) => i !== rA && i !== rB);
  return [ranger(rA === 0 || rB === 0 ? [pont, ...autres] : [...autres, pont])];
}

// Chaque trou suit l'anneau qui le contient. Aucun ne touche la coupe — c'est
// vérifié —, donc un seul de ses sommets suffit à trancher.
function partager(trous: Morceau, contour: Point[]): [Morceau, Morceau] {
  const dedans: Morceau = [];
  const dehors: Morceau = [];
  for (const trou of trous) (pointDans(contour, ...trou[0]) ? dedans : dehors).push(trou);
  return [dedans, dehors];
}

// Le contour dans un sens, les trous dans l'autre.
function ranger(anneaux: Morceau): Morceau {
  return anneaux.map((anneau, i) =>
    sens(anneau) === (i === 0 ? 1 : -1) ? anneau : [...anneau].reverse(),
  );
}

// Le filet : les morceaux recouvrent-ils la pièce exactement ? Un contour mal
// recollé reste un polygone plausible à l'œil, et son aire au lacet peut même
// tomber juste, les allers et les retours se compensant. Le masque, lui, ne se
// laisse pas faire — et c'est celui du jeu, donc c'est la bonne question. Aucun
// morceau ne dépasse le cadre de la pièce : tous leurs sommets en viennent.
function recouvrent(piece: Morceau, morceaux: Morceau[]): boolean {
  const cadre = boite(piece[0]);
  const tout = masque(...piece);
  const parts = morceaux.map((m) => ({ bits: masque(...m), coin: boite(m[0]) }));

  for (let j = 0; j < tout.rows; j++) {
    for (let i = 0; i < tout.cols; i++) {
      let fois = 0;
      for (const { bits, coin } of parts) {
        const ci = i - (coin.x - cadre.x) * SOUS;
        const cj = j - (coin.y - cadre.y) * SOUS;
        const dedans = ci >= 0 && cj >= 0 && ci < bits.cols && cj < bits.rows;
        if (dedans && bits.bits[cj * bits.cols + ci]) fois++;
      }
      if (fois !== tout.bits[j * tout.cols + i]) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

const memePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

// Produit vectoriel (a-o) x (b-o). Son signe dit de quel côté tombe b.
const croix = (o: Point, a: Point, b: Point) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const signe = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

// Le même cycle, à l'envers, en gardant son premier sommet en tête.
const retourner = (anneau: readonly Point[]): Point[] => [anneau[0], ...anneau.slice(1).reverse()];

// L'anneau entier, à partir de ce sommet.
const tour = (anneau: readonly Point[], k: number): Point[] => [
  anneau[k],
  ...parcourir(anneau, k, k),
];

// Aire signée : seul son signe sert, pour savoir dans quel sens tourne un
// anneau. Un anneau pincé la donne juste, la fente n'ayant pas d'aire.
function sens(points: readonly Point[]): number {
  let somme = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    somme += x1 * y2 - x2 * y1;
  }
  return signe(somme);
}

// Où le contour passe par ce point. Il peut y passer deux fois — c'est ce qu'est
// un pincement —, et la coupe ne part que dans le secteur intérieur de l'une des
// deux occurrences. Recoller sur l'autre donnerait un polygone plausible et
// faux.
function occurrence(contour: readonly Point[], point: Point, vers: Point, tourne: number): number {
  const places: number[] = [];
  for (let k = 0; k < contour.length; k++) {
    if (memePoint(contour[k], point)) places.push(k);
  }
  if (places.length < 2) return places.length ? places[0] : -1;

  const direction: Point = [vers[0] - point[0], vers[1] - point[1]];
  return places.find((k) => dansLeSecteur(contour, k, direction, tourne)) ?? -1;
}

// Le secteur intérieur d'un sommet va de l'arête sortante à l'arête entrante,
// dans le sens du contour. Trois formes : saillant (moins d'un demi-tour),
// rentrant (plus), et plat — un point posé au milieu d'une arête, qui est le cas
// courant ici.
function dansLeSecteur(
  contour: readonly Point[],
  k: number,
  direction: Point,
  tourne: number,
): boolean {
  const ici = contour[k];
  const avant = contour[(k - 1 + contour.length) % contour.length];
  const apres = contour[(k + 1) % contour.length];
  const depuis = (p: Point): Point => [p[0] - ici[0], p[1] - ici[1]];
  const [sortante, entrante] =
    tourne >= 0 ? [depuis(apres), depuis(avant)] : [depuis(avant), depuis(apres)];

  const vectoriel = (u: Point, v: Point) => u[0] * v[1] - u[1] * v[0];
  const ouverture = vectoriel(sortante, entrante);
  if (ouverture > 0)
    return vectoriel(sortante, direction) > 0 && vectoriel(direction, entrante) > 0;
  if (ouverture < 0)
    return vectoriel(sortante, direction) > 0 || vectoriel(direction, entrante) > 0;

  // Colinéaires : un demi-tour si les deux arêtes s'opposent, rien du tout si
  // elles se superposent.
  const scalaire = sortante[0] * entrante[0] + sortante[1] * entrante[1];
  return scalaire < 0 && vectoriel(sortante, direction) > 0;
}

// Trois façons de sortir de la pièce : traverser une arête, la longer, ou passer
// par l'extérieur d'une pièce concave — d'où le test du milieu. Les trous
// comptent comme des bords : on ne coupe pas à travers un trou.
function verifierSegment(piece: Piece, a: Point, b: Point): string | null {
  if (memePoint(a, b)) return 'Deux points de coupe confondus.';

  for (const anneau of piece) {
    for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
      const c = anneau[j];
      const d = anneau[i];
      if (traverse(a, b, c, d)) return 'La coupe sort de la pièce.';
      if (longe(a, b, c, d)) return 'La coupe longe un bord au lieu de le franchir.';
    }

    // Un sommet de la pièce en plein milieu du segment : la coupe y touche le
    // bord sans le franchir, et ni `traverse` ni le milieu ci-dessous ne le
    // voient — un point n'est du mauvais côté de rien. Le morceau détaché s'y
    // pincerait, à un endroit que personne n'a dessiné.
    for (const sommet of anneau) {
      if (
        !memePoint(sommet, a) &&
        !memePoint(sommet, b) &&
        croix(a, b, sommet) === 0 &&
        entre(a, b, sommet)
      ) {
        return 'La coupe touche le bord de la pièce en chemin.';
      }
    }
  }

  const milieu: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (!dansLaPiece(piece, milieu) && anneauDe(piece, milieu) < 0) {
    return 'La coupe passe hors de la pièce.';
  }
  return null;
}

// Croisement franc : chaque segment sépare les extrémités de l'autre.
function traverse(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = signe(croix(a, b, c));
  const d2 = signe(croix(a, b, d));
  const d3 = signe(croix(c, d, a));
  const d4 = signe(croix(c, d, b));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Colinéaires et recouvrement de longueur non nulle.
function longe(a: Point, b: Point, c: Point, d: Point): boolean {
  if (croix(a, b, c) !== 0 || croix(a, b, d) !== 0) return false;
  const proj = (p: Point) => (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? p[0] : p[1]);
  const [u0, u1] = [proj(a), proj(b)].sort((x, y) => x - y);
  const [v0, v1] = [proj(c), proj(d)].sort((x, y) => x - y);
  return Math.min(u1, v1) - Math.max(u0, v0) > 0;
}

// Se toucher suffit : deux segments qui se frôlent en un point donnent deux
// morceaux pincés là, et un croisement franc n'est que le cas visible. Les
// segments voisins, eux, partagent un sommet par construction — et une boucle
// fait du premier et du dernier des voisins aussi ; il ne leur reste qu'à ne pas
// se superposer, ce qui serait un demi-tour.
function seCroise(trait: readonly Point[]): boolean {
  const ferme = memePoint(trait[0], trait[trait.length - 1]);
  for (let i = 1; i < trait.length; i++) {
    for (let j = i + 1; j < trait.length; j++) {
      const [a, b, c, d] = [trait[i - 1], trait[i], trait[j - 1], trait[j]];
      const voisins = j === i + 1 || (ferme && i === 1 && j === trait.length - 1);
      if (voisins ? longe(a, b, c, d) : seTouchent(a, b, c, d)) return true;
    }
  }
  return false;
}

// Deux segments ont-ils un point commun, croisement franc ou simple contact ?
function seTouchent(a: Point, b: Point, c: Point, d: Point): boolean {
  if (traverse(a, b, c, d)) return true;
  const pose = (p: Point, q: Point, r: Point) => croix(p, q, r) === 0 && entre(p, q, r);
  return pose(a, b, c) || pose(a, b, d) || pose(c, d, a) || pose(c, d, b);
}

// À leur place sur l'arête qui les porte.
function inserer(anneau: readonly Point[], points: readonly Point[]): Point[] {
  const contour: Point[] = [];
  for (let i = 0; i < anneau.length; i++) {
    const a = anneau[i];
    const b = anneau[(i + 1) % anneau.length];
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

// Les sommets rencontrés en allant de l'indice `de` à l'indice `a`, exclus.
function parcourir(contour: readonly Point[], de: number, a: number): Point[] {
  const out: Point[] = [];
  for (let i = (de + 1) % contour.length; i !== a; i = (i + 1) % contour.length) {
    out.push(contour[i]);
  }
  return out;
}

// Retire doublons et sommets alignés, et refuse ce qui n'est pas un polygone. Le
// contour reste géométriquement identique, donc deux pièces voisines partagent
// toujours exactement la même arête.
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
