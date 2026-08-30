/**
 * Piloter le jeu depuis Playwright : ouvrir une page, taper le décor, dérouler
 * un dialogue, résoudre une énigme.
 *
 * Rien ici ne connaît de scénario — seulement les gestes. Les scénarios vivent
 * dans tools/qa.mjs.
 *
 * ⚠ Les coordonnées ne sont PAS écrites ici : elles se lisent dans les plans
 * générés (`src/generated/scenes/`), comme le jeu. Une zone déplacée dans Tiled
 * déplace le tap du test avec elle, au lieu de le laisser taper le vide.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const SAUVEGARDE = 'ori-quest.save.v1';

// Ce qu'il faut attendre entre deux taps pour que le jeu les compte tous les
// deux. Sur le build livré c'est `DELAI_ANTI_TAP` (300 ms) plus une marge ; sur
// un build bâti avec `VITE_DELAI_TAP=0`, il n'y a rien à attendre.
//
// La distinction n'est pas une commodité : à 380 ms le tap, la traversée du
// chapitre passe l'essentiel de son temps à ne rien faire, et une suite lente
// finit par ne plus être lancée. Un seul essai a besoin du délai réel — celui
// qui le teste.
export const DELAI_LIVRE = 380;
export const DELAI_NUL = 40;

let delaiTap = DELAI_LIVRE;
export const reglerDelaiTap = (ms) => {
  delaiTap = ms;
};

// De quoi mesurer ce que l'attente coûte vraiment.
export const compteur = { taps: 0 };

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------
// Géométrie, lue dans les plans générés
// ------------------------------------------------------------------

const plans = new Map();

function plan(scene) {
  if (!plans.has(scene)) {
    const src = readFileSync(resolve(RACINE, `src/generated/scenes/${scene}.ts`), 'utf8');
    const zones = new Map();
    for (const m of src.matchAll(
      /\{ id: '(\w+)', x: (-?\d+), y: (-?\d+), w: (\d+), h: (\d+)(?:, marqueur: \[(-?\d+), (-?\d+)\])? \}/g,
    )) {
      const [, id, x, y, w, h, mx, my] = m;
      zones.set(id, {
        // Le marqueur quand la carte en donne un : il est garanti dans la zone,
        // là où le centre d'une emprise généreuse peut tomber à côté du sujet
        // une fois la zone recalée sur le dessin (`caler()`).
        point: mx
          ? [Number(mx), Number(my)]
          : [Number(x) + Number(w) / 2, Number(y) + Number(h) / 2],
      });
    }
    plans.set(scene, zones);
  }
  return plans.get(scene);
}

// Le point où taper pour atteindre une zone, en pixels de design (1280x720).
export function pointDe(scene, id) {
  const zone = plan(scene).get(id);
  if (!zone) throw new Error(`plan « ${scene} » : zone « ${id} » inconnue`);
  return zone.point;
}

export function decoupage(nom) {
  return JSON.parse(readFileSync(resolve(RACINE, `game-design/enigmes/${nom}.json`), 'utf8'));
}

// ------------------------------------------------------------------
// Ouvrir une page
// ------------------------------------------------------------------

// Le bruit du pilote graphique n'est pas du jeu : on ne le compte pas.
const BRUIT = /GL Driver Message|GPU stall|Phaser v/;

export async function ouvrir(navigateur, url, { sauvegarde = null } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await contexte.newPage();

  // Tout ce que la page crie est une régression en puissance : le gel du renard
  // ne se voyait QUE là, et celui du contexte WebGL nulle part.
  const journal = [];
  page.on('console', (m) => {
    const t = m.text();
    if ((m.type() === 'error' || m.type() === 'warning') && !BRUIT.test(t)) {
      journal.push(`[${m.type()}] ${t.split('\n')[0].slice(0, 200)}`);
    }
  });
  page.on('pageerror', (e) =>
    journal.push(`[pageerror] ${e.message.split('\n')[0].slice(0, 200)}`),
  );

  if (sauvegarde) {
    await page.addInitScript(
      ([cle, save]) => localStorage.setItem(cle, JSON.stringify(save)),
      [SAUVEGARDE, sauvegarde],
    );
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await pause(2000);
  return { page, contexte, journal };
}

// Un état de départ complet, comme les points d'étape : ce qu'on a en poche à
// ce moment-là, pas un delta.
export function etape(piece, drapeaux, objets = []) {
  return {
    room: piece,
    flags: Object.fromEntries(drapeaux.map((d) => [d, true])),
    inventory: objets,
  };
}

// ------------------------------------------------------------------
// Lire l'écran
// ------------------------------------------------------------------

export const etat = (page) =>
  page.evaluate(() => ({
    boite: !document.querySelector('.dialogue')?.hidden,
    texte: document.querySelector('.dialogue__text')?.textContent ?? '',
    qui: document.querySelector('.dialogue__nom')?.textContent ?? '',
    choix: [...document.querySelectorAll('.dialogue__choices button')].map((b) => b.textContent),
    enigme: !!document.querySelector('.puzzle'),
    tuto: !!document.querySelector('.tuto'),
    fin: !!document.querySelector('.fin'),
    menu: !document.querySelector('.menu__panel')?.hidden,
    inventaire: [...document.querySelectorAll('.inventory__item')].map((e) => e.dataset.objet),
    piece: JSON.parse(localStorage.getItem('ori-quest.save.v1') || '{}').room,
    origami: !!document.querySelector('#origami-canvas')?.classList.contains('is-visible'),
  }));

// ------------------------------------------------------------------
// Agir
// ------------------------------------------------------------------

// Le décor est en pixels de design ; le canvas fait la même taille dans nos
// contextes, mais on passe quand même par sa boîte : un jour il sera letterboxé.
export async function taper(page, x, y) {
  const cadre = await page.locator('#game canvas').boundingBox();
  await pause(delaiTap);
  compteur.taps++;
  await page.mouse.click(cadre.x + (x / 1280) * cadre.width, cadre.y + (y / 720) * cadre.height);
  await pause(250);
}

export const taperZone = (page, scene, id) => taper(page, ...pointDe(scene, id));

// Avance d'une réplique et attend que le texte change vraiment : un `pause()`
// fixe suffirait aujourd'hui, mais ferait passer un dialogue gelé pour un
// dialogue lent.
export async function avancer(page) {
  const avant = (await etat(page)).texte;
  await pause(delaiTap);
  compteur.taps++;
  await page.mouse.click(640, 660);
  for (let i = 0; i < 30; i++) {
    const e = await etat(page);
    if (!e.boite || e.texte !== avant || e.choix.length) return e;
    await pause(100);
  }
  return etat(page);
}

// Déroule jusqu'à la fermeture de la boîte ou un menu de choix.
export async function deroulerDialogue(page, max = 40) {
  for (let i = 0; i < max; i++) {
    const e = await etat(page);
    if (!e.boite || e.choix.length) return e;
    await avancer(page);
  }
  return etat(page);
}

export async function choisir(page, motif) {
  const bouton = page.locator('.dialogue__choices button', { hasText: motif });
  await bouton.first().waitFor({ timeout: 8000 });
  await pause(delaiTap);
  compteur.taps++;
  await bouton.first().click();
  await pause(250);
}

// ------------------------------------------------------------------
// Les énigmes
// ------------------------------------------------------------------

const boiteDe = (points) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

const dansLePolygone = (points, x, y) => {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
};

// Un point réellement sur le papier : le détourage rend le vide de la boîte
// traversant, donc le centre de la boîte n'attrape pas toujours la pièce.
function prise(points) {
  const b = boiteDe(points);
  for (let k = 0; k < 400; k++) {
    const x = b.x + b.w * (0.15 + 0.7 * ((k * 0.618) % 1));
    const y = b.y + b.h * (0.15 + 0.7 * ((k * 0.382) % 1));
    if (dansLePolygone(points, x, y)) return [x, y];
  }
  return [b.x + b.w / 2, b.y + b.h / 2];
}

// Résout l'énigme au vrai glisser-déposer, comme un joueur : c'est le seul
// moyen d'éprouver `setPointerCapture`, le recalage du bac et les masques.
export async function resoudreEnigme(page, nom) {
  const d = decoupage(nom);
  for (let i = 0; i < d.pieces.length; i++) {
    const points = d.pieces[i].points;
    const b = boiteDe(points);

    // Le vrac empile les pièces : sans la remonter, le doigt attrape la voisine
    // qui la recouvre. C'est ce que fait `mettreEnAvant` pour le tutoriel.
    await page.evaluate((n) => {
      const p = document.querySelector(`.puzzle__piece[data-piece="${n}"]`);
      if (p?.parentElement?.classList.contains('puzzle__tray')) p.parentElement.appendChild(p);
    }, i);

    const cadre = await page.locator(`.puzzle__piece[data-piece="${i}"]`).boundingBox();
    const plateau = await page.locator('.puzzle__board').boundingBox();
    if (!cadre || !plateau) throw new Error(`énigme « ${nom} » : pièce ${i} introuvable`);

    const [px, py] = prise(points);
    // Le glisser centre la pièce sous le doigt : on vise le centre de sa case.
    await page.mouse.move(
      cadre.x + ((px - b.x) / b.w) * cadre.width,
      cadre.y + ((py - b.y) / b.h) * cadre.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      plateau.x + ((b.x + b.w / 2) / d.grille) * plateau.width,
      plateau.y + ((b.y + b.h / 2) / d.grille) * plateau.height,
      { steps: 10 },
    );
    await page.mouse.up();
    await pause(120);
  }

  const reste = await page.locator('.puzzle__tray .puzzle__piece').count();
  if (reste) throw new Error(`énigme « ${nom} » : ${reste} pièce(s) restée(s) au bac`);

  await page.locator('.puzzle__check').click();
  await pause(1500);
}

// `entier` joue le tutoriel jusqu'au bout ; sinon on le passe à l'invite.
export async function tutoriel(page, entier) {
  // La couche du tutoriel se monte APRÈS l'énigme : on lui laisse le temps.
  for (let i = 0; i < 40 && !(await etat(page)).tuto; i++) await pause(100);
  if (!(await etat(page)).tuto) return 'absent';

  // Et il s'annonce par une réplique AVANT de proposer son choix. Sans la
  // dérouler, on cherche un bouton qui n'est pas encore à l'écran.
  for (let i = 0; i < 30; i++) {
    const e = await etat(page);
    if (!e.tuto) return 'absent';
    if (e.choix.length) break;
    if (e.boite) await avancer(page);
    else await pause(300);
  }

  if (!entier) {
    await choisir(page, 'Passer le tutoriel');
    await pause(800);
    return 'passé';
  }
  await choisir(page, 'Lancer le tutoriel');
  const debut = Date.now();
  while (Date.now() - debut < 180_000) {
    const e = await etat(page);
    if (!e.tuto) return `joué (${Math.round((Date.now() - debut) / 1000)} s)`;
    if (e.boite && !e.choix.length) await avancer(page);
    else await pause(400);
  }
  throw new Error('le tutoriel ne se termine pas');
}

// Attend que la couche 3D s'allume — sans taper, sinon on manque la fenêtre.
export async function attendreLePliage(page, ms = 12_000) {
  for (let i = 0; i < ms / 100; i++) {
    if ((await etat(page)).origami) return true;
    await pause(100);
  }
  return false;
}

// Et qu'elle s'éteigne. Un `pause()` calé sur la durée annoncée du pliage
// obligerait à reprendre la marge à chaque réglage d'animation, et ferait
// passer un pliage qui ne finit jamais pour un pliage un peu long.
export async function attendreLaFinDuPliage(page, ms = 20_000) {
  for (let i = 0; i < ms / 100; i++) {
    if (!(await etat(page)).origami) return true;
    await pause(100);
  }
  return false;
}
