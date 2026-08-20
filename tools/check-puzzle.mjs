#!/usr/bin/env node
/**
 * check-puzzle — une découpe d'énigme a-t-elle bien une solution unique ?
 *
 *   npm run check-puzzle -- public/assets/enigmes/pont/solution.svg \
 *     --grid 4 --pieces "0,0,4,1 0,1,4,2 0,3,4,1"
 *
 * Le joueur ne valide qu'une disposition : celle d'origine. Si une AUTRE
 * disposition produit exactement la même image, il croit avoir résolu l'énigme
 * et se voit refusé. C'est arrivé sur le pont, dont le motif — deux plis
 * horizontaux pleine largeur — ne fixe aucune abscisse : toute solution admet
 * son miroir.
 *
 * L'outil compare les pièces par leur CONTENU : les segments du motif tombant
 * dans le rectangle, ramenés en coordonnées locales. Deux emplacements sont
 * interchangeables si ce contenu est identique. On énumère ensuite tous les
 * pavages compatibles.
 *
 * Les traits de bord (`bo`) sont ignorés par défaut : le jeu ne les affiche pas,
 * justement pour ne pas révéler quelle pièce vient d'une rive. `--with-borders`
 * les recompte, ce qui montre ce qu'on gagnerait à les rendre visibles.
 */
import { readFileSync } from 'node:fs';

const EPS = 1e-6;

function parseArgs(argv) {
  const opts = { grid: 0, pieces: [], borders: false, input: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--grid') opts.grid = Number(argv[++i]);
    else if (a === '--pieces') opts.pieces = parsePieces(argv[++i]);
    else if (a === '--with-borders') opts.borders = true;
    else positional.push(a);
  }
  if (positional.length !== 1 || !opts.grid || opts.pieces.length === 0) {
    console.error(
      'Usage: npm run check-puzzle -- <crease-pattern.svg> --grid <n> \\\n' +
        '         --pieces "x,y,w,h x,y,w,h ..." [--with-borders]',
    );
    process.exit(1);
  }
  opts.input = positional[0];
  return opts;
}

function parsePieces(text) {
  return (text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => {
      const [x, y, w, h] = chunk.split(',').map(Number);
      if ([x, y, w, h].some((n) => !Number.isFinite(n))) {
        console.error(`✗ Pièce illisible : « ${chunk} » (attendu x,y,w,h)`);
        process.exit(1);
      }
      return { x, y, w, h };
    });
}

/** Segments du crease pattern, ramenés en unités de grille. */
function readPattern(file, grid, keepBorders) {
  const svg = readFileSync(file, 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/);
  const [vx, vy, vw, vh] = box
    ? box[1].trim().split(/[\s,]+/).map(Number)
    : [0, 0, 1000, 1000];

  const segments = [];
  for (const m of svg.matchAll(/<line\b([^>]*)>/g)) {
    const attrs = m[1];
    const cls = attrs.match(/class="([^"]*)"/)?.[1] ?? '';
    if (cls === 'bo' && !keepBorders) continue;
    const num = (name) => Number(attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]);
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(num);
    if ([x1, y1, x2, y2].some((n) => !Number.isFinite(n))) continue;
    segments.push({
      cls,
      x1: ((x1 - vx) / vw) * grid,
      y1: ((y1 - vy) / vh) * grid,
      x2: ((x2 - vx) / vw) * grid,
      y2: ((y2 - vy) / vh) * grid,
    });
  }
  return segments;
}

/**
 * Portion d'un segment contenue dans le rectangle, en coordonnées locales.
 * Découpage de Liang-Barsky ; rend null si le segment n'entre pas.
 */
function clip(seg, rx, ry, rw, rh) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  let t0 = 0;
  let t1 = 1;
  const bornes = [
    [-dx, seg.x1 - rx],
    [dx, rx + rw - seg.x1],
    [-dy, seg.y1 - ry],
    [dy, ry + rh - seg.y1],
  ];
  for (const [p, q] of bornes) {
    if (Math.abs(p) < EPS) {
      if (q < -EPS) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  const a = { x: seg.x1 + t0 * dx - rx, y: seg.y1 + t0 * dy - ry };
  const b = { x: seg.x1 + t1 * dx - rx, y: seg.y1 + t1 * dy - ry };
  if (Math.hypot(b.x - a.x, b.y - a.y) < EPS) return null; // simple contact
  return { cls: seg.cls, a, b };
}

/** Signature comparable de ce que montre un rectangle du motif. */
function signature(segments, rx, ry, rw, rh) {
  const round = (n) => (Math.abs(n) < EPS ? 0 : Number(n.toFixed(6)));
  return segments
    .map((seg) => clip(seg, rx, ry, rw, rh))
    .filter(Boolean)
    .map((s) => {
      // Un segment et son inverse décrivent le même trait : on ordonne.
      const ends = [
        [round(s.a.x), round(s.a.y)],
        [round(s.b.x), round(s.b.y)],
      ].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      return `${s.cls}:${ends[0]}|${ends[1]}`;
    })
    .sort()
    .join(' ');
}

function checkTiling(pieces, grid) {
  const cover = new Map();
  const overlaps = [];
  for (const [i, p] of pieces.entries()) {
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        const key = `${x},${y}`;
        if (x >= grid || y >= grid || x < 0 || y < 0) overlaps.push(`${key} (hors grille)`);
        else if (cover.has(key)) overlaps.push(`${key} (pièces ${cover.get(key)} et ${i})`);
        else cover.set(key, i);
      }
    }
  }
  const holes = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) if (!cover.has(`${x},${y}`)) holes.push(`${x},${y}`);
  }
  return { holes, overlaps };
}

function countSolutions(pieces, grid, segments) {
  const source = pieces.map((p) => signature(segments, p.x, p.y, p.w, p.h));
  const spots = pieces.map((p, i) => {
    const out = [];
    for (let x = 0; x <= grid - p.w; x++) {
      for (let y = 0; y <= grid - p.h; y++) {
        if (signature(segments, x, y, p.w, p.h) === source[i]) out.push([x, y]);
      }
    }
    return out;
  });

  const cells = Array.from({ length: grid }, () => new Array(grid).fill(false));
  const solutions = [];
  const place = (k, acc) => {
    if (solutions.length > 200) return; // garde-fou : on ne compte plus au-delà
    if (k === pieces.length) {
      solutions.push([...acc]);
      return;
    }
    const { w, h } = pieces[k];
    for (const [x, y] of spots[k]) {
      let free = true;
      for (let dy = 0; dy < h && free; dy++) {
        for (let dx = 0; dx < w; dx++) if (cells[y + dy][x + dx]) { free = false; break; }
      }
      if (!free) continue;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells[y + dy][x + dx] = true;
      place(k + 1, [...acc, [x, y]]);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells[y + dy][x + dx] = false;
    }
  };
  place(0, []);
  return { solutions, spots };
}

// ---------------------------------------------------------------- exécution

const opts = parseArgs(process.argv.slice(2));
const segments = readPattern(opts.input, opts.grid, opts.borders);

console.log(
  `Motif   : ${opts.input.replace(process.cwd() + '/', '')} — ${segments.length} trait(s) retenu(s)` +
    `${opts.borders ? '' : ', bords exclus (comme en jeu)'}`,
);
console.log(`Grille  : ${opts.grid}x${opts.grid}, ${opts.pieces.length} pièce(s)\n`);

const { holes, overlaps } = checkTiling(opts.pieces, opts.grid);
let fatal = false;
if (overlaps.length) {
  console.error(`✗ Chevauchement sur ${overlaps.length} cellule(s) : ${overlaps.slice(0, 6).join(', ')}`);
  fatal = true;
}
if (holes.length) {
  console.error(`✗ ${holes.length} cellule(s) non couverte(s) : ${holes.slice(0, 8).join(', ')}`);
  fatal = true;
}
if (fatal) process.exit(1);
console.log('✓ Pavage exact : aucune cellule en double ni oubliée.');

const { solutions } = countSolutions(opts.pieces, opts.grid, segments);

if (solutions.length === 1) {
  console.log('✓ Solution unique : aucune autre disposition ne donne la même image.');
  process.exit(0);
}

console.error(
  `\n✗ ${solutions.length} dispositions produisent la même image. Le joueur peut en\n` +
    `  trouver une que la validation refusera. Les premières :`,
);
for (const s of solutions.slice(0, 4)) {
  console.error('    ' + s.map(([x, y], i) => `p${i}->(${x},${y})`).join('  '));
}
console.error(
  `\n  Pistes : un motif sans trait vertical ni oblique ne fixe aucune abscisse,\n` +
    `  et toute solution admet alors son miroir. Rendre les bords visibles\n` +
    `  (--with-borders pour simuler) ou choisir un crease pattern plus riche.`,
);
process.exit(1);
