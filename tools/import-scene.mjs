#!/usr/bin/env node
/**
 * import-scene — un plan de scène dessiné en SVG devient des données de jeu.
 *
 *   npm run scenes                                    # tout game-design/scenes/
 *   npm run scenes -- game-design/scenes/chapter-1/pont.svg
 *   npm run scenes -- --check                         # valide sans écrire
 *
 * Le problème résolu : décrire une scène en français ne donne jamais de
 * coordonnées. « La feuille est à gauche du pont » demande trois allers-retours
 * avant d'être jouable. Un plan dessiné à l'échelle, lui, EST la coordonnée.
 *
 * Le document se dessine dans n'importe quel éditeur (Figma, Inkscape, Penpot)
 * sur un cadre 1280x720 — la résolution logique du jeu, cf. src/game/config.ts.
 * Un rectangle par élément, et le NOM de l'objet porte son rôle :
 *
 *   hs_<id>     zone à examiner        -> hotspot
 *   exit_<id>   passage vers une scène -> hotspot de navigation
 *   dec_<id>    repère de décor        -> bord, surface, position
 *
 * Tout ce qui n'est pas nommé ainsi est ignoré : la grille, le cadre, les
 * croquis d'ambiance restent dans le fichier sans polluer la sortie.
 *
 * Les éditeurs empilent les groupes et les `transform="matrix(...)"` : c'est ici
 * qu'on les aplatit, pour que l'utilisateur n'ait jamais à garder son SVG
 * propre. Un objet tourné est ramené à sa boîte englobante — le jeu ne sait pas
 * gérer une zone tactile oblique.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

/**
 * Recopiés de src/game/config.ts : un outil Node ne peut pas importer du
 * TypeScript. Ces trois valeurs doivent rester synchronisées à la main.
 */
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const MIN_TOUCH_SIZE = 88;

const SCENES_DIR = 'game-design/scenes';
const OUT_DIR = 'src/generated/scenes';

/** Rôles reconnus, dans l'ordre où ils apparaissent dans le JSON produit. */
const ROLES = { hs: 'hotspots', exit: 'exits', dec: 'decor' };

/** Éléments qui ne sont pas dessinés : leur géométrie ne veut rien dire. */
const NOT_RENDERED = new Set([
  'defs', 'clipPath', 'mask', 'symbol', 'marker', 'pattern', 'style', 'title', 'desc', 'metadata',
]);

// ---------------------------------------------------------------------------
// Lecture XML
// ---------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });
}

function parseAttrs(text) {
  const attrs = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(text))) attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? '');
  return attrs;
}

/**
 * Analyseur XML minimal, suffisant pour du SVG d'éditeur (toujours bien formé).
 * On garde la structure, les attributs, et le texte — ce dernier uniquement
 * pour vérifier que l'étiquette affichée dit bien la même chose que le nom.
 */
function parseXml(source) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m;
  let fin = 0;
  while ((m = re.exec(source))) {
    const [whole, closing, opening, attrText, selfClosing] = m;

    const parent = stack[stack.length - 1];
    if (m.index > fin) {
      const texte = source.slice(fin, m.index);
      if (texte.trim()) parent.text = (parent.text ?? '') + texte;
    }
    fin = re.lastIndex;

    if (!closing && !opening) continue; // commentaire, prologue, doctype, CDATA

    if (closing) {
      // Fermeture : on remonte jusqu'à la balise ouvrante correspondante. Une
      // fermeture orpheline est ignorée plutôt que de décaler tout l'arbre.
      const depth = stack.map((n) => n.tag).lastIndexOf(closing);
      if (depth > 0) stack.length = depth;
      continue;
    }

    const node = { tag: opening, attrs: parseAttrs(attrText ?? ''), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root.children.find((n) => n.tag === 'svg') ?? root;
}

// ---------------------------------------------------------------------------
// Transformations affines, au format matrix(a b c d e f) du SVG
// ---------------------------------------------------------------------------

const IDENTITY = [1, 0, 0, 1, 0, 0];

/** m ∘ n : applique n, puis m. */
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransform(text) {
  let result = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    const rad = (deg) => (deg * Math.PI) / 180;
    let step = IDENTITY;
    switch (m[1]) {
      case 'matrix':
        step = a.length === 6 ? a : IDENTITY;
        break;
      case 'translate':
        step = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
        break;
      case 'scale':
        step = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const c = Math.cos(rad(a[0] || 0));
        const s = Math.sin(rad(a[0] || 0));
        step = [c, s, -s, c, 0, 0];
        // rotate(angle, cx, cy) tourne autour d'un point : on encadre par la
        // translation aller-retour.
        if (a.length >= 3) {
          step = multiply(multiply([1, 0, 0, 1, a[1], a[2]], step), [1, 0, 0, 1, -a[1], -a[2]]);
        }
        break;
      }
      case 'skewX':
        step = [1, 0, Math.tan(rad(a[0] || 0)), 1, 0, 0];
        break;
      case 'skewY':
        step = [1, Math.tan(rad(a[0] || 0)), 0, 1, 0, 0];
        break;
    }
    result = multiply(result, step);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

const num = (value, fallback = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Boîte englobante d'une forme, dans ses coordonnées locales. */
function localBox(node) {
  const a = node.attrs;
  switch (node.tag) {
    case 'rect':
    case 'image':
      return { x: num(a.x), y: num(a.y), w: num(a.width), h: num(a.height) };
    case 'circle':
      return { x: num(a.cx) - num(a.r), y: num(a.cy) - num(a.r), w: 2 * num(a.r), h: 2 * num(a.r) };
    case 'ellipse':
      return {
        x: num(a.cx) - num(a.rx),
        y: num(a.cy) - num(a.ry),
        w: 2 * num(a.rx),
        h: 2 * num(a.ry),
      };
    case 'line':
      return boxOfPoints([
        [num(a.x1), num(a.y1)],
        [num(a.x2), num(a.y2)],
      ]);
    case 'polygon':
    case 'polyline':
      return boxOfPoints(pairs(a.points ?? ''));
    case 'path':
      // Approximation : on prend tous les nombres du chemin, points de contrôle
      // compris. La boîte peut donc dépasser la courbe réelle — d'où
      // l'avertissement plus bas. Un plan se dessine en rectangles.
      return boxOfPoints(pairs(a.d ?? ''));
    default:
      return null;
  }
}

function pairs(text) {
  const nums = (text.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

function boxOfPoints(points) {
  if (points.length === 0) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Boîte englobante de la boîte transformée — les quatre coins, puis min/max. */
function transformBox(box, m) {
  return boxOfPoints([
    apply(m, box.x, box.y),
    apply(m, box.x + box.w, box.y),
    apply(m, box.x, box.y + box.h),
    apply(m, box.x + box.w, box.y + box.h),
  ]);
}

function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

const round = (box) => ({
  x: Math.round(box.x),
  y: Math.round(box.y),
  w: Math.round(box.w),
  h: Math.round(box.h),
});

// ---------------------------------------------------------------------------
// Étiquettes
// ---------------------------------------------------------------------------

/**
 * Le nom visible de l'objet dans l'éditeur. Inkscape l'écrit dans
 * `inkscape:label`, Illustrator dans `data-name`, Figma directement dans `id`
 * (case « Include id attribute » à l'export).
 */
function nameOf(node) {
  return node.attrs['inkscape:label'] ?? node.attrs['data-name'] ?? node.attrs.id ?? '';
}

function slug(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Texte d'un nœud et de ses descendants — un <text> peut contenir des <tspan>. */
function textOf(node) {
  return (node.text ?? '') + node.children.map(textOf).join('');
}

/**
 * L'étiquette *dessinée* dans une boîte. Purement décorative : elle est là pour
 * qu'un humain lise le plan. On la relit quand même, pour vérifier qu'elle ne
 * ment pas — renommer le groupe sans retoucher le texte donnerait un plan qui
 * affiche une chose et en produit une autre.
 */
function labelOf(node) {
  return node.children
    .filter((c) => c.tag === 'text')
    .map(textOf)
    .join(' ')
    .trim();
}

function tagOf(node) {
  const m = /^\s*(hs|exit|dec)[_-](.+)$/i.exec(nameOf(node));
  if (!m) return null;
  const id = slug(m[2]);
  return id ? { role: m[1].toLowerCase(), id } : null;
}

// ---------------------------------------------------------------------------
// Parcours du document
// ---------------------------------------------------------------------------

/**
 * Descend l'arbre en accumulant les transformations, et renvoie la boîte
 * englobante du sous-arbre — ce qui donne gratuitement la boîte d'un groupe
 * nommé : c'est l'union de ce qu'il contient.
 */
function visit(node, matrix, found) {
  if (NOT_RENDERED.has(node.tag)) return null;

  const m = node.attrs.transform ? multiply(matrix, parseTransform(node.attrs.transform)) : matrix;
  const own = localBox(node);
  let box = own && own.w >= 0 && own.h >= 0 ? transformBox(own, m) : null;

  for (const child of node.children) box = union(box, visit(child, m, found));

  const tag = tagOf(node);
  if (tag) found.push({ ...tag, box, shape: node.tag, etiquette: labelOf(node) });
  return box;
}

/**
 * Matrice qui amène le repère du document dans l'espace logique du jeu.
 * Un plan dessiné en 2560x1440 ou en millimètres reste donc exploitable.
 */
function rootMatrix(svg, warn) {
  const vb = (svg.attrs.viewBox ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
  let minX = 0;
  let minY = 0;
  let width = num(svg.attrs.width, DESIGN_WIDTH);
  let height = num(svg.attrs.height, DESIGN_HEIGHT);

  if (vb.length === 4 && vb.every(Number.isFinite)) [minX, minY, width, height] = vb;
  if (!width || !height) return IDENTITY;

  const sx = DESIGN_WIDTH / width;
  const sy = DESIGN_HEIGHT / height;
  if (Math.abs(sx - sy) > 0.01 * Math.max(sx, sy)) {
    warn(
      `le document fait ${Math.round(width)}x${Math.round(height)}, pas du 16:9 — ` +
        `les proportions du plan ne sont pas celles du jeu`,
    );
  }
  if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
    warn(`document ${Math.round(width)}x${Math.round(height)} ramené à ${DESIGN_WIDTH}x${DESIGN_HEIGHT}`);
  }
  return multiply([sx, 0, 0, sy, 0, 0], [1, 0, 0, 1, -minX, -minY]);
}

// ---------------------------------------------------------------------------
// Import d'un plan
// ---------------------------------------------------------------------------

function importScene(file, name) {
  const warnings = [];
  const errors = [];
  const warn = (msg) => warnings.push(msg);

  const svg = parseXml(readFileSync(file, 'utf8'));
  if (svg.tag !== 'svg') {
    errors.push('ce fichier ne contient pas de balise <svg>');
    return { warnings, errors };
  }

  const found = [];
  visit(svg, rootMatrix(svg, warn), found);

  const layout = { scene: name, source: file.split('\\').join('/'), design: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT }, hotspots: [], exits: [], decor: {} };
  const seen = new Map();

  for (const item of found) {
    const key = `${item.role}_${item.id}`;
    if (seen.has(key)) {
      errors.push(`« ${key} » est présent deux fois — chaque élément doit avoir un nom unique`);
      continue;
    }
    seen.set(key, item);

    // Le nom du groupe fait foi ; l'étiquette n'est qu'un rappel visuel. Si les
    // deux divergent, c'est presque toujours un renommage à moitié fait.
    if (item.etiquette && slug(item.etiquette) !== slug(key)) {
      warn(
        `« ${key} » porte l'étiquette « ${item.etiquette} » — c'est le nom du ` +
          `groupe qui compte, l'étiquette est à corriger`,
      );
    }

    if (!item.box) {
      errors.push(`« ${key} » n'a aucune géométrie (groupe vide ?)`);
      continue;
    }
    const box = round(item.box);
    if (box.w <= 0 || box.h <= 0) {
      errors.push(`« ${key} » est plat (${box.w}x${box.h})`);
      continue;
    }
    if (item.shape === 'path') {
      warn(`« ${key} » est un tracé : sa boîte est approximative, préférer un rectangle`);
    }
    if (box.x < 0 || box.y < 0 || box.x + box.w > DESIGN_WIDTH || box.y + box.h > DESIGN_HEIGHT) {
      warn(`« ${key} » déborde du cadre ${DESIGN_WIDTH}x${DESIGN_HEIGHT}`);
    }

    if (item.role === 'dec') {
      layout.decor[item.id] = box;
      continue;
    }
    // Une zone tactile plus petite que le pouce est élargie par touchRect() ;
    // on le signale, parce que l'élargissement peut faire mordre sur un voisin.
    if (box.w < MIN_TOUCH_SIZE || box.h < MIN_TOUCH_SIZE) {
      warn(
        `« ${key} » fait ${box.w}x${box.h}, sous la cible tactile de ${MIN_TOUCH_SIZE} — ` +
          `la zone sera élargie automatiquement`,
      );
    }
    layout[ROLES[item.role]].push({ id: item.id, ...box });
  }

  layout.hotspots.sort((a, b) => a.id.localeCompare(b.id));
  layout.exits.sort((a, b) => a.id.localeCompare(b.id));
  layout.decor = Object.fromEntries(Object.entries(layout.decor).sort(([a], [b]) => a.localeCompare(b)));

  if (layout.hotspots.length === 0 && layout.exits.length === 0) {
    warn('aucun hs_ ni exit_ trouvé — les noms d\'objets sont-ils bien renseignés ?');
  }
  return { layout, warnings, errors };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function listSvg(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listSvg(path));
    // Les fichiers commençant par « _ » sont des gabarits, pas des scènes.
    else if (extname(entry) === '.svg' && !entry.startsWith('_')) out.push(path);
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const nameFlag = argv.indexOf('--name');
  const explicitName = nameFlag >= 0 ? argv[nameFlag + 1] : null;
  const inputs = argv.filter((a, i) => !a.startsWith('--') && i !== nameFlag + 1);

  let files = inputs.map((f) => resolve(f));
  if (files.length === 0) {
    try {
      files = listSvg(SCENES_DIR).map((f) => resolve(f));
    } catch {
      console.log(`[scenes] ${SCENES_DIR}/ absent, rien à importer`);
      return;
    }
  }
  if (files.length === 0) {
    console.log('[scenes] aucun plan de scène à importer');
    return;
  }

  let failed = 0;
  for (const file of files) {
    const rel = relative(process.cwd(), file).split('\\').join('/');
    const name = explicitName ?? basename(file, extname(file));
    const { layout, warnings, errors } = importScene(rel, name);

    console.log(`\n[scenes] « ${name} » — ${rel}`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    if (errors.length > 0) {
      failed++;
      continue;
    }

    const counts = [
      `${layout.hotspots.length} hotspot(s)`,
      `${layout.exits.length} sortie(s)`,
      `${Object.keys(layout.decor).length} repère(s)`,
    ].join(', ');
    console.log(`  ${counts}`);

    if (check) continue;
    mkdirSync(OUT_DIR, { recursive: true });
    const out = join(OUT_DIR, `${name}.json`);
    writeFileSync(out, `${JSON.stringify(layout, null, 2)}\n`);
    console.log(`  ✓ ${out}`);
  }

  if (failed > 0) process.exit(1);
}

main();
