#!/usr/bin/env node
/**
 * bake-origami — crease pattern (SVG) -> animation de pliage (.origami)
 *
 *   npm run bake -- content/origami/crane.svg --name crane
 *
 * On pilote Origami Simulator (Amanda Ghassaei, MIT) dans un Chromium headless :
 * son solveur GPU résout la géométrie pliée, et on échantillonne la position des
 * sommets à N étapes. Le jeu ne fait ensuite qu'interpoler entre ces poses.
 *
 * Prérequis, une seule fois : npx playwright install chromium
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'tools/vendor/osim');
const OSIM_REPO = 'https://github.com/amandaghassaei/OrigamiSimulator.git';
const OUT_DIR = join(ROOT, 'public/assets/origami');

const ORIGAMI_MAGIC = 0x4f524951; // 'ORIQ'
const ORIGAMI_VERSION = 1;
const HEADER_BYTES = 24;

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const positional = [];
  const opts = { frames: 24, steps: 400, settle: 1500, name: null, keepOpen: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--frames') opts.frames = Number(argv[++i]);
    else if (a === '--steps') opts.steps = Number(argv[++i]);
    else if (a === '--settle') opts.settle = Number(argv[++i]);
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--debug') opts.keepOpen = true;
    else positional.push(a);
  }
  if (positional.length !== 1) {
    console.error(
      'Usage: npm run bake -- <crease-pattern.svg|.fold> [--name grue] [--frames 24] [--steps 400]',
    );
    process.exit(1);
  }
  opts.input = resolve(positional[0]);
  opts.name ??= basename(opts.input, extname(opts.input));
  return opts;
}

// ---------------------------------------------------------------- vendor

function ensureVendor() {
  if (existsSync(join(VENDOR, 'index.html'))) return;
  console.log("→ Clonage d'Origami Simulator (une seule fois)…");
  mkdirSync(dirname(VENDOR), { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', OSIM_REPO, VENDOR], { stdio: 'inherit' });
}

// ---------------------------------------------------------------- serveur

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.fold': 'application/json',
};

function serve(dir) {
  return new Promise((ready) => {
    const server = createServer(async (req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const file = join(dir, path === '/' ? 'index.html' : path);
      if (!file.startsWith(dir)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const info = await stat(file);
        if (!info.isFile()) throw new Error('not a file');
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        });
        createReadStream(file).pipe(res);
      } catch {
        res.writeHead(404).end();
      }
    });
    server.listen(0, '127.0.0.1', () => ready({ server, port: server.address().port }));
  });
}

// ---------------------------------------------------------------- écriture

function writeOrigami(outPath, { vertexCount, frameCount, indices, frames }) {
  const indexCount = indices.length;
  const positionBytes = frameCount * vertexCount * 3 * 4;
  const buf = Buffer.alloc(HEADER_BYTES + indexCount * 4 + positionBytes);

  buf.writeUInt32BE(ORIGAMI_MAGIC, 0);
  buf.writeUInt32LE(ORIGAMI_VERSION, 4);
  buf.writeUInt32LE(vertexCount, 8);
  buf.writeUInt32LE(frameCount, 12);
  buf.writeUInt32LE(indexCount, 16);
  buf.writeUInt32LE(0, 20);

  let off = HEADER_BYTES;
  for (const i of indices) {
    buf.writeUInt32LE(i, off);
    off += 4;
  }
  for (const frame of frames) {
    for (const v of frame) {
      buf.writeFloatLE(v, off);
      off += 4;
    }
  }
  writeFileSync(outPath, buf);
  return buf.length;
}

// ---------------------------------------------------------------- bake

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(opts.input)) {
    console.error(`✗ Introuvable : ${opts.input}`);
    process.exit(1);
  }

  ensureVendor();

  // Le CP est déposé dans les assets d'Origami Simulator : son importateur
  // résout les chemins relativement à ce dossier.
  const stagingDir = join(VENDOR, 'assets/_bake');
  mkdirSync(stagingDir, { recursive: true });
  const ext = extname(opts.input).toLowerCase();
  const stagedName = `input${ext}`;
  copyFileSync(opts.input, join(stagingDir, stagedName));

  const { server, port } = await serve(VENDOR);

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      '✗ Playwright absent. Installe-le :\n  npm i -D playwright && npx playwright install chromium',
    );
    process.exit(1);
  }

  console.log(`→ Chromium headless (WebGL logiciel)…`);
  const browser = await chromium.launch({
    headless: !opts.keepOpen,
    args: [
      // Origami Simulator résout le pliage dans des shaders WebGL avec textures
      // flottantes ; SwiftShader les fournit sans GPU physique.
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  // Coupe l'analytics : la requête pend en environnement isolé.
  await page.route('**://www.googletagmanager.com/**', (r) => r.abort());
  await page.addInitScript(() => {
    window.gtag = () => {};
    window.dataLayer = [];
  });

  page.on('pageerror', (e) => console.warn(`  [page] ${e.message}`));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.globals?.model && window.globals.pattern, null, {
    timeout: 30_000,
  });

  console.log(`→ Chargement du crease pattern : ${basename(opts.input)}`);
  await page.evaluate((file) => {
    window.globals.importer.importDemoFile(`_bake/${file}`);
  }, stagedName);

  // Le modèle est construit de façon asynchrone (parsing SVG, triangulation).
  await page.waitForFunction(
    () => (window.globals.model.getPositionsArray()?.length ?? 0) > 0,
    null,
    { timeout: 60_000 },
  );

  const info = await page.evaluate(() => ({
    vertexCount: window.globals.model.getPositionsArray().length / 3,
    faceCount: window.globals.model.getFaces().length,
  }));
  console.log(`  ${info.vertexCount} sommets, ${info.faceCount} faces`);

  // On reprend la main sur la boucle de simulation pour rendre le bake
  // déterministe : autant d'itérations par frame, quel que soit le débit rAF.
  await page.evaluate(() => {
    window.globals.simulationRunning = false;
    window.globals.simType = 'dynamic';
    window.globals.creasePercent = 0;
    window.globals.model.reset();
  });

  console.log(`→ Résolution de ${opts.frames} poses (${opts.steps} itérations chacune)…`);

  const frames = [];
  for (let i = 0; i < opts.frames; i++) {
    const t = opts.frames === 1 ? 1 : i / (opts.frames - 1);
    const frame = await page.evaluate(
      ({ t, steps, settle, isLast }) => {
        const g = window.globals;
        g.creasePercent = t;
        // Sans ce drapeau, le solveur ne repousse jamais le nouveau pourcentage
        // vers les uniformes GPU : la simulation tourne indéfiniment sur la
        // valeur figée à l'initialisation des shaders.
        g.shouldChangeCreasePercent = true;
        // La pose finale reçoit plus d'itérations : c'est celle qu'on regarde le
        // plus longtemps, elle doit être complètement relaxée.
        g.model.step(isLast ? Math.max(steps, settle) : steps);
        return Array.from(g.model.getPositionsArray());
      },
      { t, steps: opts.steps, settle: opts.settle, isLast: i === opts.frames - 1 },
    );

    const fail = async (why) => {
      console.error(`\n✗ ${why} à ${(t * 100).toFixed(0)}% de pliage.`);
      console.error(
        `  Ouvre le CP sur origamisimulator.org pour vérifier qu'il se plie,\n` +
          `  et/ou réduis --steps. Certains CP (multi-couches, auto-intersections)\n` +
          `  ne convergent pas : le solveur relaxe une feuille physique, il ne gère\n` +
          `  pas les collisions entre couches.`,
      );
      await browser.close();
      server.close();
      process.exit(1);
    };

    if (frame.some((v) => !Number.isFinite(v))) {
      await fail('La simulation a divergé (NaN)');
    }

    // Une géométrie qui s'effondre sur un point passe le test NaN sans rien
    // produire de visible : c'est l'autre façon dont ce solveur échoue.
    let extent = 0;
    for (let c = 0; c < 3; c++) {
      let min = Infinity;
      let max = -Infinity;
      for (let v = c; v < frame.length; v += 3) {
        if (frame[v] < min) min = frame[v];
        if (frame[v] > max) max = frame[v];
      }
      extent = Math.max(extent, max - min);
    }
    if (extent < 1e-3) {
      await fail("La géométrie s'est effondrée sur un point");
    }

    frames.push(frame);
    process.stdout.write(`\r  pose ${i + 1}/${opts.frames}`);
  }
  process.stdout.write('\n');

  const indices = await page.evaluate(() =>
    Array.from(window.globals.model.getGeometry().index.array),
  );

  if (!opts.keepOpen) await browser.close();
  server.close();

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${opts.name}.origami`);
  const bytes = writeOrigami(outPath, {
    vertexCount: info.vertexCount,
    frameCount: opts.frames,
    indices,
    frames,
  });

  writeFileSync(
    join(OUT_DIR, `${opts.name}.json`),
    JSON.stringify(
      {
        name: opts.name,
        source: basename(opts.input),
        vertexCount: info.vertexCount,
        faceCount: info.faceCount,
        frameCount: opts.frames,
        bakedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    `✓ ${outPath.replace(ROOT + '/', '')} — ${(bytes / 1024).toFixed(0)} Ko ` +
      `(${opts.frames} poses × ${info.vertexCount} sommets)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
