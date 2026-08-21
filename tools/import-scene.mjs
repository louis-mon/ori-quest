#!/usr/bin/env node
/**
 * import-scene — une carte Tiled devient des données de jeu.
 *
 *   npm run scenes                                    # tout game-design/scenes/
 *   npm run scenes -- game-design/scenes/chapter-1/pont.tmj
 *   npm run scenes -- --check                         # valide sans écrire
 *
 * Le problème résolu : décrire une scène en français ne donne jamais de
 * coordonnées. « La feuille est à gauche du pont » demande trois allers-retours
 * avant d'être jouable. Un plan dessiné à l'échelle, lui, EST la coordonnée.
 *
 * Le plan se dessine dans Tiled (gratuit, libre) sur un cadre 1280x720 — la
 * résolution logique du jeu, cf. src/game/config.ts. Un objet par élément, et
 * c'est sa **classe** qui porte son rôle :
 *
 *   hotspot   zone à examiner        -> hotspot, avec sa cocotte
 *   exit      passage vers une scène -> hotspot de navigation
 *   decor     repère de décor        -> bord, surface, position
 *
 * Le **nom** de l'objet est son identifiant côté code (`feuille`, `precipice`).
 * Les calques image — le croquis posé dessous pour placer les zones — sont
 * ignorés : ils n'entrent jamais dans le jeu.
 *
 * La sortie est du **TypeScript** et non du JSON, et c'est délibéré : figée en
 * `as const`, elle donne au compilateur la liste exacte des noms du plan. Une
 * zone inventée dans le code — `dec_nuages` qui n'existe dans aucune carte —
 * devient une erreur de `tsc`, pas une découverte à l'exécution. Voir
 * src/game/scenes/layout.ts.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

/**
 * Recopiés de src/game/config.ts : un outil Node ne peut pas importer du
 * TypeScript. Ces trois valeurs doivent rester synchronisées à la main.
 */
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const MIN_TOUCH_SIZE = 88;

const SCENES_DIR = 'game-design/scenes';
const OUT_DIR = 'src/generated/scenes';

/** Classes reconnues -> clé du plan produit. */
const ROLES = { hotspot: 'hotspots', exit: 'exits', decor: 'decor' };

/** Un identifiant doit rester écrivable tel quel dans le code généré. */
const ID_VALIDE = /^[a-z][a-z0-9_]*$/;

// ---------------------------------------------------------------------------
// Lecture de la carte
// ---------------------------------------------------------------------------

/**
 * Les objets de tous les calques, les groupes aplatis.
 *
 * Tiled autorise des calques de groupe imbriqués, avec leur propre décalage
 * (`offsetx`/`offsety`). On l'accumule en descendant plutôt que de l'ignorer :
 * un plan rangé dans un groupe déplacé sortirait sinon décalé du même montant.
 */
function collecterObjets(calques, dx = 0, dy = 0) {
  const objets = [];
  for (const calque of calques ?? []) {
    const ox = dx + (calque.offsetx ?? 0);
    const oy = dy + (calque.offsety ?? 0);
    if (calque.type === 'group') objets.push(...collecterObjets(calque.layers, ox, oy));
    else if (calque.type === 'objectgroup') {
      for (const objet of calque.objects ?? []) {
        objets.push({ ...objet, x: objet.x + ox, y: objet.y + oy });
      }
    }
  }
  return objets;
}

const arrondir = (b) => ({
  x: Math.round(b.x),
  y: Math.round(b.y),
  w: Math.round(b.w),
  h: Math.round(b.h),
});

/** Boîte englobante d'une liste de points. */
function boiteDe(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Applique la rotation Tiled (degrés, autour de l'origine de l'objet). */
function tourner(points, ox, oy, degres) {
  if (!degres) return points;
  const a = (degres * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return points.map(([x, y]) => {
    const px = x - ox;
    const py = y - oy;
    return [ox + px * cos - py * sin, oy + px * sin + py * cos];
  });
}

/**
 * Géométrie d'un objet Tiled, ramenée au vocabulaire du jeu : une boîte, et un
 * contour quand la zone est un polygone.
 */
function geometrieDe(objet) {
  const { x, y, width = 0, height = 0, rotation = 0 } = objet;

  if (objet.polygon) {
    const points = tourner(
      objet.polygon.map((p) => [x + p.x, y + p.y]),
      x,
      y,
      rotation,
    );
    return { box: boiteDe(points), points, forme: 'polygone' };
  }
  if (objet.point) {
    return { box: { x, y, w: 0, h: 0 }, forme: 'point' };
  }
  if (objet.polyline) {
    return { erreur: 'une polyligne est un trait, pas une zone — utiliser un polygone' };
  }
  if (objet.gid !== undefined) {
    return { erreur: "un objet-tuile n'a pas de sens dans un plan — utiliser un rectangle" };
  }

  const coins = tourner(
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
    x,
    y,
    rotation,
  );
  return { box: boiteDe(coins), forme: objet.ellipse ? 'ellipse' : 'rectangle', rotation };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function importScene(fichier, nom) {
  const warnings = [];
  const errors = [];
  const warn = (m) => warnings.push(m);

  const layout = { scene: nom, source: fichier, design: {}, hotspots: [], exits: [], decor: {} };

  let carte;
  try {
    carte = JSON.parse(readFileSync(fichier, 'utf8'));
  } catch (e) {
    return { layout, warnings, errors: [`carte illisible : ${e.message}`] };
  }

  if (carte.type !== 'map') {
    return { layout, warnings, errors: ['ce fichier n\'est pas une carte Tiled (.tmj)'] };
  }
  if (carte.infinite) {
    return { layout, warnings, errors: ['carte « infinie » : la passer en taille fixe 1280x720'] };
  }

  const largeur = carte.width * carte.tilewidth;
  const hauteur = carte.height * carte.tileheight;
  layout.design = { width: largeur, height: hauteur };
  if (largeur !== DESIGN_WIDTH || hauteur !== DESIGN_HEIGHT) {
    errors.push(
      `la carte fait ${largeur}x${hauteur}, le jeu attend ${DESIGN_WIDTH}x${DESIGN_HEIGHT} ` +
        '(Map > Map Properties, ou tuiles de 80x80 sur 16x9)',
    );
    return { layout, warnings, errors };
  }

  const vus = { hotspot: new Set(), exit: new Set(), decor: new Set() };

  for (const objet of collecterObjets(carte.layers)) {
    // Tiled a renommé `type` en `class` en 1.9, mais écrit encore `type` dans
    // les formats de carte antérieurs à 1.10 : les deux sont acceptés.
    const role = objet.class || objet.type || '';
    const nomObjet = (objet.name || '').trim();
    const ou = nomObjet ? `« ${nomObjet} »` : `l'objet #${objet.id}`;

    if (!role) {
      errors.push(`${ou} n'a pas de classe — la choisir dans Properties > Class`);
      continue;
    }
    if (!ROLES[role]) {
      errors.push(`${ou} a la classe « ${role} », inconnue (${Object.keys(ROLES).join(', ')})`);
      continue;
    }
    if (!nomObjet) {
      errors.push(`un objet « ${role} » n'a pas de nom — le code n'a aucun moyen de le désigner`);
      continue;
    }
    if (!ID_VALIDE.test(nomObjet)) {
      errors.push(
        `« ${nomObjet} » n'est pas un identifiant valide — minuscules, chiffres et « _ » seulement`,
      );
      continue;
    }
    // L'unicité est **par classe** : `porte` peut être à la fois un hotspot et
    // un repère de décor, ce sont deux choses différentes au même endroit.
    if (vus[role].has(nomObjet)) {
      errors.push(`« ${nomObjet} » apparaît deux fois en « ${role} »`);
      continue;
    }
    vus[role].add(nomObjet);

    const geo = geometrieDe(objet);
    if (geo.erreur) {
      errors.push(`« ${nomObjet} » : ${geo.erreur}`);
      continue;
    }

    const box = arrondir(geo.box);
    if (geo.forme !== 'point' && (box.w <= 0 || box.h <= 0)) {
      errors.push(`« ${nomObjet} » est plat (${box.w}x${box.h})`);
      continue;
    }
    if (geo.forme === 'ellipse') {
      warn(`« ${nomObjet} » est une ellipse : ramenée à sa boîte, préférer un rectangle`);
    }
    if (geo.rotation) {
      warn(
        `« ${nomObjet} » est tourné de ${geo.rotation}° : ramené à sa boîte englobante — ` +
          'le jeu ne sait pas gérer une zone oblique',
      );
    }
    if (box.x < 0 || box.y < 0 || box.x + box.w > largeur || box.y + box.h > hauteur) {
      warn(`« ${nomObjet} » déborde du cadre ${largeur}x${hauteur}`);
    }

    if (role === 'decor') {
      layout.decor[nomObjet] = box;
      continue;
    }
    // Une zone tactile plus petite que le pouce est élargie par touchRect() ;
    // on le signale, parce que l'élargissement peut faire mordre sur un voisin.
    // Un polygone, lui, n'est pas élargissable : sa forme est le propos.
    if (geo.points) {
      if (box.w < MIN_TOUCH_SIZE || box.h < MIN_TOUCH_SIZE) {
        warn(
          `« ${nomObjet} » est un polygone de ${box.w}x${box.h}, sous la cible tactile de ` +
            `${MIN_TOUCH_SIZE} — un polygone n'est pas élargi, il sera dur à toucher`,
        );
      }
    } else if (box.w < MIN_TOUCH_SIZE || box.h < MIN_TOUCH_SIZE) {
      warn(
        `« ${nomObjet} » fait ${box.w}x${box.h}, sous la cible tactile de ${MIN_TOUCH_SIZE} — ` +
          'la zone sera élargie automatiquement',
      );
    }

    const zone = { id: nomObjet, ...box };
    if (geo.points) zone.points = geo.points.map(([x, y]) => [Math.round(x), Math.round(y)]);
    layout[ROLES[role]].push(zone);
  }

  layout.hotspots.sort((a, b) => a.id.localeCompare(b.id));
  layout.exits.sort((a, b) => a.id.localeCompare(b.id));
  layout.decor = Object.fromEntries(
    Object.entries(layout.decor).sort(([a], [b]) => a.localeCompare(b)),
  );

  if (layout.hotspots.length === 0 && layout.exits.length === 0) {
    warn('aucun hotspot ni exit — les classes des objets sont-elles renseignées ?');
  }
  return { layout, warnings, errors };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

const boiteLitterale = (b) => `{ x: ${b.x}, y: ${b.y}, w: ${b.w}, h: ${b.h} }`;

function zoneLitterale(z) {
  const base = `{ id: '${z.id}', x: ${z.x}, y: ${z.y}, w: ${z.w}, h: ${z.h}`;
  if (!z.points) return `${base} }`;
  const points = z.points.map(([x, y]) => `[${x}, ${y}]`).join(', ');
  return `${base}, points: [${points}] }`;
}

function rendre(layout) {
  const liste = (zones) =>
    zones.length === 0 ? '[]' : `[\n${zones.map((z) => `    ${zoneLitterale(z)},`).join('\n')}\n  ]`;
  const reperes = Object.entries(layout.decor);
  const decor =
    reperes.length === 0
      ? '{}'
      : `{\n${reperes.map(([id, b]) => `    ${id}: ${boiteLitterale(b)},`).join('\n')}\n  }`;

  return `/**
 * Généré par « npm run scenes » — ne pas modifier à la main.
 * Source : ${layout.source}
 */
export default {
  scene: '${layout.scene}',
  source: '${layout.source}',
  design: { width: ${layout.design.width}, height: ${layout.design.height} },
  hotspots: ${liste(layout.hotspots)},
  exits: ${liste(layout.exits)},
  decor: ${decor},
} as const;
`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function listerCartes(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listerCartes(path));
    // Les fichiers commençant par « _ » sont des gabarits, pas des scènes.
    else if (extname(entry) === '.tmj' && !entry.startsWith('_')) out.push(path);
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
      files = listerCartes(SCENES_DIR).map((f) => resolve(f));
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
    const out = join(OUT_DIR, `${name}.ts`);
    writeFileSync(out, rendre(layout));
    console.log(`  ✓ ${out}`);
  }

  if (failed > 0) process.exit(1);
}

main();
