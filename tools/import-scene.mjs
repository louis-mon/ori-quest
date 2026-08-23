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
 *   marqueur  où se pose la cocotte  -> point rattaché à la zone du même nom
 *
 * Le **nom** de l'objet est son identifiant côté code (`feuille`, `precipice`).
 * Un `marqueur` ne s'en invente donc pas un : il porte le nom de la zone qu'il
 * désigne, et c'est ce nom qui les relie — le code n'a rien à câbler.
 *
 * Un **calque image** de classe `fond` porte le terrain peint par l'artiste, et
 * il entre dans le jeu. Les autres — le croquis posé dessous pour placer les
 * zones — restent ignorés : c'est la classe qui départage, comme pour les
 * objets.
 *
 * La sortie est du **TypeScript** et non du JSON, et c'est délibéré : figée en
 * `as const`, elle donne au compilateur la liste exacte des noms du plan. Une
 * zone inventée dans le code — `dec_nuages` qui n'existe dans aucune carte —
 * devient une erreur de `tsc`, pas une découverte à l'exécution. Voir
 * src/game/scenes/layout.ts.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';

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

/**
 * La quatrième classe, à part : un marqueur n'est pas une zone du plan, c'est un
 * point posé **sur** une zone. Il ne sort donc pas dans une liste à lui — il
 * vient s'accrocher au hotspot ou à la sortie qui porte le même nom.
 */
const CLASSE_MARQUEUR = 'marqueur';

/** Classe du calque image qui porte le fond de la scène. */
const CLASSE_FOND = 'fond';

/** Le dossier que Vite sert tel quel : un fond doit y vivre pour arriver au jeu. */
const PUBLIC_DIR = 'public';

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

/**
 * Les calques image, les groupes aplatis. Même accumulation du décalage que
 * ci-dessus — à ceci près qu'un calque image n'a pas de coordonnées propres :
 * sa position **est** son décalage.
 */
function collecterCalquesImage(calques, dx = 0, dy = 0) {
  const images = [];
  for (const calque of calques ?? []) {
    const ox = dx + (calque.offsetx ?? 0);
    const oy = dy + (calque.offsety ?? 0);
    if (calque.type === 'group') images.push(...collecterCalquesImage(calque.layers, ox, oy));
    else if (calque.type === 'imagelayer') {
      images.push({ ...calque, x: (calque.x ?? 0) + ox, y: (calque.y ?? 0) + oy });
    }
  }
  return images;
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

/**
 * Un point est-il dans un polygone ? Lancer de rayon, la recette habituelle.
 *
 * Sert au seul contrôle des marqueurs : sur une zone tracée au polygone, la
 * boîte englobante ne dit rien — c'est le contour qui est le sujet, et un
 * marqueur posé dans un coin vide de la boîte tomberait à côté du dessin.
 */
function dansLePolygone(px, py, points) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
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

/**
 * Dimensions réelles d'une image, en pixels.
 *
 * PNG et WebP seulement — les deux formats que l'artiste livre. Tout le reste
 * rend `null` : on préfère ne pas vérifier ce qu'on ne sait pas lire plutôt que
 * de refuser une carte par ailleurs valide.
 */
function dimensionsImage(chemin) {
  const o = readFileSync(chemin);

  // PNG : 8 octets de signature, puis le chunk IHDR — largeur et hauteur en
  // gros-boutiste aux offsets 16 et 20.
  if (o.length > 24 && o.toString('latin1', 1, 4) === 'PNG') {
    return { w: o.readUInt32BE(16), h: o.readUInt32BE(20) };
  }

  if (
    o.length > 30 &&
    o.toString('latin1', 0, 4) === 'RIFF' &&
    o.toString('latin1', 8, 12) === 'WEBP'
  ) {
    switch (o.toString('latin1', 12, 16)) {
      // VP8X, le WebP « étendu » — celui qui porte une couche alpha. Les
      // dimensions du canevas y sont stockées sur 24 bits, moins un.
      case 'VP8X':
        return { w: o.readUIntLE(24, 3) + 1, h: o.readUIntLE(27, 3) + 1 };
      // VP8, avec perte : en-tête de trame clé, 14 bits par dimension.
      case 'VP8 ':
        return { w: o.readUInt16LE(26) & 0x3fff, h: o.readUInt16LE(28) & 0x3fff };
      // VP8L, sans perte : 14 bits chacune, moins un, empaquetées à la suite.
      case 'VP8L': {
        const bits = o.readUInt32LE(21);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
  }
  return null;
}

/**
 * Le fond de la scène : le terrain peint par l'artiste, posé sous le décor et
 * au-dessus du ciel.
 *
 * Le calque pointe **directement** le fichier que le jeu charge, dans
 * `public/`. C'est ce qui garantit qu'on place les zones, dans Tiled, sur les
 * pixels exacts que le joueur aura sous les yeux ; une copie de travail rangée
 * à côté de la carte finirait par diverger de celle du build.
 *
 * Rend `null` si tout va bien, le message d'erreur sinon.
 */
function lireFond(calque, fichierCarte, layout, warn) {
  const ou = `« ${calque.name || CLASSE_FOND} »`;
  if (!calque.image) return `${ou} est de classe « ${CLASSE_FOND} » mais n'a pas d'image`;

  const absolu = resolve(dirname(fichierCarte), calque.image);
  const racine = resolve(PUBLIC_DIR);
  if (!absolu.startsWith(racine + sep)) {
    return (
      `le fond ${ou} est hors de ${PUBLIC_DIR}/ — le jeu ne saurait pas le servir.\n` +
      `    L'intégrer dans ${PUBLIC_DIR}/assets/decor/ et repointer le calque dessus (cf. README).`
    );
  }
  if (!existsSync(absolu)) return `le fond ${ou} pointe « ${calque.image} », introuvable`;

  const w = Math.round(calque.imagewidth ?? 0);
  const h = Math.round(calque.imageheight ?? 0);
  if (w <= 0 || h <= 0) return `le fond ${ou} n'a pas de dimensions`;

  // Tiled ne redimensionne jamais un calque image : ce qu'il affiche est la
  // taille du fichier, et c'est cette taille-là que le jeu doit reprendre. Si
  // les deux ont divergé, c'est que le fichier a changé depuis que la carte l'a
  // lu — le jeu dessinerait alors autre chose que l'éditeur.
  const reel = dimensionsImage(absolu);
  if (reel && (reel.w !== w || reel.h !== h)) {
    return (
      `le fond ${ou} fait ${reel.w}x${reel.h}, la carte en a retenu ${w}x${h} — ` +
      'rouvrir la carte dans Tiled, qui relira le fichier'
    );
  }

  const x = Math.round(calque.x ?? 0);
  const y = Math.round(calque.y ?? 0);
  if (x < 0 || y < 0 || x + w > layout.design.width || y + h > layout.design.height) {
    warn(`le fond ${ou} déborde du cadre ${layout.design.width}x${layout.design.height}`);
  }

  layout.fond = { image: relative(racine, absolu).split(sep).join('/'), x, y, w, h };
  return null;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function importScene(fichier, nom) {
  const warnings = [];
  const errors = [];
  const warn = (m) => warnings.push(m);

  const layout = {
    scene: nom,
    source: fichier,
    design: {},
    fond: null,
    hotspots: [],
    exits: [],
    decor: {},
  };

  let carte;
  try {
    carte = JSON.parse(readFileSync(fichier, 'utf8'));
  } catch (e) {
    return { layout, warnings, errors: [`carte illisible : ${e.message}`] };
  }

  if (carte.type !== 'map') {
    return { layout, warnings, errors: ["ce fichier n'est pas une carte Tiled (.tmj)"] };
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

  // Les calques image sans classe sont ignorés : le croquis posé sous le plan
  // pour placer les zones est un outil de travail, il n'entre pas dans le jeu.
  const fonds = collecterCalquesImage(carte.layers).filter((c) => c.class === CLASSE_FOND);
  if (fonds.length > 1) {
    errors.push(`${fonds.length} calques de classe « ${CLASSE_FOND} » — une scène n'a qu'un fond`);
  } else if (fonds.length === 1) {
    const erreur = lireFond(fonds[0], fichier, layout, warn);
    if (erreur) errors.push(erreur);
  }

  const vus = { hotspot: new Set(), exit: new Set(), decor: new Set(), marqueur: new Set() };
  /** Marqueurs lus, rattachés à leur zone une fois toutes les zones connues. */
  const marqueurs = [];

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
    if (!ROLES[role] && role !== CLASSE_MARQUEUR) {
      const connues = [...Object.keys(ROLES), CLASSE_MARQUEUR].join(', ');
      errors.push(`${ou} a la classe « ${role} », inconnue (${connues})`);
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

    if (role === CLASSE_MARQUEUR) {
      // Un marqueur est une position, pas une emprise : la cocotte a sa taille
      // à elle, et un rectangle laisserait croire qu'on la dimensionne ici.
      if (geo.forme !== 'point') {
        errors.push(
          `« ${nomObjet} » est un marqueur ${geo.forme} — un marqueur est un ` +
            "point, à tracer avec l'outil Point (raccourci I)",
        );
        continue;
      }
      marqueurs.push({ nom: nomObjet, x: box.x, y: box.y, ou });
      continue;
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

  // Les marqueurs se rattachent une fois toutes les zones lues : l'ordre des
  // objets dans Tiled ne doit rien décider.
  for (const m of marqueurs) {
    const zones = [...layout.hotspots, ...layout.exits].filter((z) => z.id === m.nom);
    if (zones.length === 0) {
      const noms = [...layout.hotspots, ...layout.exits].map((z) => z.id).sort();
      errors.push(
        `le marqueur ${m.ou} ne désigne aucune zone — un marqueur porte le nom du ` +
          `hotspot ou de la sortie sur lequel il se pose` +
          (noms.length > 0 ? ` (${noms.join(', ')})` : ''),
      );
      continue;
    }
    // Un même nom peut être un hotspot ET une sortie — c'est permis, l'unicité
    // est par classe. Le marqueur, lui, ne saurait pas lequel des deux il vise.
    if (zones.length > 1) {
      errors.push(
        `le marqueur ${m.ou} est ambigu : « ${m.nom} » est à la fois un hotspot et ` +
          'une sortie — les renommer, ou poser un marqueur sur chacun',
      );
      continue;
    }

    const zone = zones[0];
    const dedans = zone.points
      ? dansLePolygone(m.x, m.y, zone.points)
      : m.x >= zone.x && m.x <= zone.x + zone.w && m.y >= zone.y && m.y <= zone.y + zone.h;
    if (!dedans) {
      // Sur un polygone, citer la boîte englobante induirait en erreur : le
      // point peut y être et rester hors du contour, qui est le vrai sujet.
      const dehors = zone.points
        ? 'hors de son contour'
        : `hors de sa boîte (${zone.x}, ${zone.y} → ${zone.x + zone.w}, ${zone.y + zone.h})`;
      errors.push(
        `le marqueur ${m.ou} est en (${m.x}, ${m.y}), ${dehors} — la cocotte se poserait ` +
          'à côté de son sujet',
      );
      continue;
    }
    zone.marqueur = [m.x, m.y];
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
  let out = `{ id: '${z.id}', x: ${z.x}, y: ${z.y}, w: ${z.w}, h: ${z.h}`;
  if (z.points) out += `, points: [${z.points.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`;
  if (z.marqueur) out += `, marqueur: [${z.marqueur[0]}, ${z.marqueur[1]}]`;
  return `${out} }`;
}

function rendre(layout) {
  const f = layout.fond;
  const fond = f
    ? `\n  fond: { image: '${f.image}', x: ${f.x}, y: ${f.y}, w: ${f.w}, h: ${f.h} },`
    : '';
  const liste = (zones) =>
    zones.length === 0
      ? '[]'
      : `[\n${zones.map((z) => `    ${zoneLitterale(z)},`).join('\n')}\n  ]`;
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
  design: { width: ${layout.design.width}, height: ${layout.design.height} },${fond}
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
      layout.fond ? `fond ${layout.fond.image}` : 'pas de fond',
      `${layout.hotspots.length} hotspot(s)`,
      `${layout.exits.length} sortie(s)`,
      `${Object.keys(layout.decor).length} repère(s)`,
      `${[...layout.hotspots, ...layout.exits].filter((z) => z.marqueur).length} marqueur(s)`,
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
