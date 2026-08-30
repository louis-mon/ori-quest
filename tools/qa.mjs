#!/usr/bin/env node
/**
 * Tests de non-régression, joués dans un vrai navigateur.
 *
 * Ils tournent sur le BUILD DE PRODUCTION, et c'est délibéré : la moitié de ce
 * qu'on protège ici n'existe pas ailleurs — le délai anti-tap réel, l'arrêt sur
 * « À suivre… », le menu des étapes réduit au chapitre livré, les chemins
 * relatifs et le découpage en chunks. Le serveur de dev répondrait « tout va
 * bien » sur un jeu qui n'est pas celui qu'on publie.
 *
 *   npm run qa                       # bâtit dist/, le sert, joue tout
 *   npm run qa -- renard webgl       # seulement ces essais-là
 *   npm run qa -- --sans-build       # sur le dist/ déjà là
 *   BASE_URL=http://localhost:5173 npm run qa
 *
 * `BASE_URL` pointe une cible déjà servie — le serveur de dev, quand on met au
 * point un essai et qu'on veut des piles d'appels lisibles. Les essais marqués
 * `livre` s'y sautent au lieu d'échouer : ils parlent de ce que le build
 * embarque, pas du jeu.
 *
 * Playwright est en dépendance optionnelle (il sert déjà à `npm run bake`).
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import {
  attendreLePliage,
  avancer,
  choisir,
  deroulerDialogue,
  etape,
  etat,
  ouvrir,
  pause,
  pointDe,
  RACINE,
  resoudreEnigme,
  taper,
  taperZone,
  tutoriel,
} from './lib/pilote.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('✗ Playwright manque : npm install playwright && npx playwright install chromium');
  process.exit(1);
}

// ------------------------------------------------------------------
// Le registre
// ------------------------------------------------------------------

const args = process.argv.slice(2);
const sansBuild = args.includes('--sans-build');
const filtres = args.filter((a) => !a.startsWith('--'));

const essais = [];
// `attendu` : ce que l'essai provoque LUI-MÊME en console et qu'on ne compte pas
// comme régression. Déclaré essai par essai, jamais globalement — un filtre trop
// large rendrait la console muette, alors que c'est elle qui voit les gels.
const essai = (nom, fn, { livre = false, attendu = null } = {}) =>
  essais.push({ nom, fn, livre, attendu });

// Un état de départ complet, comme un point d'étape.
const AU_RAVIN = null;
const DEVANT_LA_PORTE = etape(
  'porte',
  ['pont_vu', 'pont_resolu', 'pont_plie', 'porte_vue', 'porte_disparue', 'renard_vu'],
  [],
);
const BOIS_EN_POCHE = etape(
  'porte',
  [
    'pont_vu',
    'pont_resolu',
    'pont_plie',
    'porte_vue',
    'porte_disparue',
    'renard_vu',
    'renard_bois_su',
    'hache_resolu',
    'hache_pliee',
    'arbre_parle',
    'arbre_resolu',
    'arbre_plie',
    'arbre_demande',
    'vieil_arbre_decoupe',
  ],
  ['bois'],
);

// ------------------------------------------------------------------
// Les essais
// ------------------------------------------------------------------

// La régression qui a coûté une session : un menu de dialogue vidé de toutes ses
// options faisait dérailler ink, et l'instance restait muette — plus un hotspot
// ne répondait, alors que les sorties marchaient encore.
essai('renard', async (page, dire) => {
  const depart = etape('porte', [
    'pont_vu',
    'pont_resolu',
    'pont_plie',
    'porte_vue',
    'porte_disparue',
    'renard_vu',
    'renard_bois_su',
  ]);
  return {
    sauvegarde: depart,
    jouer: async () => {
      await taperZone(page(), 'porte', 'renard');
      await choisir(page(), 'bois');
      await deroulerDialogue(page());
      await pause(2500);
      dire("l'idée de la hache est donnée", (await etat(page())).inventaire.includes('idee_hache'));

      // Le renard n'a plus rien à dire : son menu est vide.
      await taperZone(page(), 'porte', 'renard');
      const e = await etat(page());
      dire('le renard épuisé referme sa boîte sans rien casser', !e.boite || e.choix.length > 0);

      // LE test : un knot sain répond-il encore ?
      await taperZone(page(), 'porte', 'heros');
      dire('un hotspot répond après le renard épuisé', (await etat(page())).boite);
      await deroulerDialogue(page());
      await taperZone(page(), 'porte', 'pont');
      await pause(1800);
      dire('la sortie fonctionne toujours', (await etat(page())).piece === 'pont');
    },
  };
});

// Un contexte WebGL perdu pendant un pliage laissait `playTo()` sans réponse :
// le récit restait suspendu sur sa réplique, définitivement et en silence.
essai(
  'webgl',
  async (page, dire) => ({
    sauvegarde: BOIS_EN_POCHE,
    jouer: async () => {
      await taperZone(page(), 'porte', 'porte');
      await deroulerDialogue(page());
      await pause(2000);
      await tutoriel(page(), false);
      await resoudreEnigme(page(), 'porte');

      dire('le pliage démarre', await attendreLePliage(page()));
      await pause(900);
      const coupe = await page().evaluate(() => {
        const c = document.getElementById('origami-canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        const ext = gl?.getExtension('WEBGL_lose_context');
        if (!ext) return false;
        ext.loseContext();
        return true;
      });
      dire('le contexte WebGL a pu être coupé', coupe);
      await pause(5000);

      const avant = (await etat(page())).texte;
      for (let i = 0; i < 4; i++) await avancer(page());
      dire('le récit repart après la perte de contexte', (await etat(page())).texte !== avant);

      await taperZone(page(), 'porte', 'heros');
      const e = await etat(page());
      dire('un hotspot répond après la perte de contexte', e.boite && e.texte !== avant);
    },
  }),
  { attendu: /\[origami\] contexte WebGL perdu/ },
);

// Sur itch.io le plein écran est un bouton du SITE : il tombe pendant qu'une
// énigme est ouverte, et `eparpiller()` doit se rejouer.
essai('redimensionnement', async (page, dire) => ({
  sauvegarde: BOIS_EN_POCHE,
  jouer: async () => {
    await taperZone(page(), 'porte', 'porte');
    await deroulerDialogue(page());
    await pause(2000);
    await tutoriel(page(), false);
    dire("l'énigme est ouverte", (await etat(page())).enigme);

    const avant = await page().locator('.puzzle__piece').count();
    for (const [w, h] of [
      [900, 620],
      [1440, 900],
      [1280, 720],
    ]) {
      await page().setViewportSize({ width: w, height: h });
      await pause(1200);
    }
    const visibles = await page().evaluate(
      () =>
        [...document.querySelectorAll('.puzzle__piece')].filter(
          (p) => p.getBoundingClientRect().width > 4,
        ).length,
    );
    const dansLeCadre = await page().evaluate(() =>
      [...document.querySelectorAll('.puzzle__piece')].every((p) => {
        const r = p.getBoundingClientRect();
        return (
          r.left >= -2 && r.top >= -2 && r.right <= innerWidth + 2 && r.bottom <= innerHeight + 2
        );
      }),
    );
    dire(
      'toutes les pièces survivent au redimensionnement',
      visibles === avant,
      `${visibles}/${avant}`,
    );
    dire('aucune pièce ne sort du cadre', dansLeCadre);

    await resoudreEnigme(page(), 'porte');
    dire("l'énigme reste résoluble après coup", !(await etat(page())).enigme);
  },
}));

// Un rechargement ne doit ni perdre la pièce ni laisser une énigme fantôme.
essai('rechargement', async (page, dire) => ({
  sauvegarde: BOIS_EN_POCHE,
  jouer: async () => {
    await taperZone(page(), 'porte', 'porte');
    await deroulerDialogue(page());
    await pause(2000);
    await tutoriel(page(), false);
    dire("l'énigme est ouverte avant le rechargement", (await etat(page())).enigme);

    await page().reload({ waitUntil: 'networkidle' });
    await pause(2500);
    const e = await etat(page());
    dire("le rechargement rouvre la bonne pièce sans l'énigme", !e.enigme && e.piece === 'porte');

    await taperZone(page(), 'porte', 'heros');
    dire('le décor répond après rechargement', (await etat(page())).boite);
  },
}));

// Le jeu est verrouillé en paysage, et l'UI est calée sur le canvas à la main.
essai('rotation', async (page, dire) => ({
  sauvegarde: DEVANT_LA_PORTE,
  jouer: async () => {
    await page().setViewportSize({ width: 720, height: 1280 });
    await pause(1200);
    const invite = await page().evaluate(() => {
      const el = document.querySelector('#rotate-hint');
      return el ? getComputedStyle(el).display : 'absent';
    });
    dire(
      "l'invite de rotation couvre le portrait",
      invite !== 'none' && invite !== 'absent',
      invite,
    );

    await page().setViewportSize({ width: 1280, height: 720 });
    await pause(1500);
    const cale = await page().evaluate(() => {
      const c = document.querySelector('#game canvas').getBoundingClientRect();
      const s = document.querySelector('#stage').getBoundingClientRect();
      return Math.abs(c.left - s.left) + Math.abs(c.top - s.top) + Math.abs(c.width - s.width);
    });
    dire("l'UI se recale sur le canvas au retour", cale < 2, `écart ${cale}px`);

    await taperZone(page(), 'porte', 'heros');
    dire('le décor répond après rotation', (await etat(page())).boite);
  },
}));

// Deux contacts rapprochés ne doivent dépenser qu'une réplique — et le délai ne
// doit pas non plus avaler le tap volontaire d'un lecteur rapide.
essai(
  'anti-tap',
  async (page, dire) => ({
    sauvegarde: AU_RAVIN,
    jouer: async () => {
      const l1 = (await etat(page())).texte;
      await page().mouse.click(640, 660);
      await pause(60);
      await page().mouse.click(640, 660);
      await pause(600);
      const l2 = (await etat(page())).texte;
      await avancer(page());
      const l3 = (await etat(page())).texte;
      dire('un double contact n’avance que d’une réplique', l1 !== l2 && l2 !== l3 && l1 !== l3);
    },
  }),
  { livre: true },
);

// Le décor martelé ne doit ni empiler les dialogues ni rester sourd.
essai('martelage', async (page, dire) => ({
  sauvegarde: DEVANT_LA_PORTE,
  jouer: async () => {
    for (let i = 0; i < 6; i++) {
      await taper(page(), ...pointDe('porte', 'heros'));
      await pause(60);
    }
    await pause(1000);
    dire('un seul dialogue à l’écran', (await page().locator('.dialogue').count()) === 1);
    await deroulerDialogue(page());

    for (let i = 0; i < 5; i++) {
      await page().mouse.click(...(await coin(page(), pointDe('porte', 'pont'))));
      await pause(70);
    }
    await pause(2500);
    dire('la sortie martelée mène bien au ravin', (await etat(page())).piece === 'pont');
    await taperZone(page(), 'pont', 'heros');
    dire('le décor du ravin répond', (await etat(page())).boite);
  },
}));

// Une sauvegarde née d'un build de développement nomme une pièce que celui-ci
// n'embarque pas : elle doit retomber sur une scène jouable, pas sur du noir.
essai(
  'sauvegarde-etrangere',
  async (page, dire) => ({
    sauvegarde: etape('village', ['village_vu', 'pont_plie', 'porte_plie'], ['idee_chien']),
    jouer: async () => {
      dire('le jeu a une scène à l’écran', !!(await page().locator('#game canvas').count()));
      await taperZone(page(), 'pont', 'heros');
      dire('le décor répond', (await etat(page())).boite);
    },
  }),
  { livre: true },
);

// Ce que le build embarque, et lui seul.
essai(
  'fin-de-chapitre',
  async (page, dire) => ({
    sauvegarde: BOIS_EN_POCHE,
    jouer: async () => {
      await page().locator('.menu__button').click();
      await pause(600);
      const chapitres = await page().locator('.menu__panel [data-action="chapitre"]').count();
      dire('le menu ne propose que le chapitre livré', chapitres === 1, `${chapitres} chapitre(s)`);
      await page().locator('.menu__voile').click();
      await pause(600);

      await taperZone(page(), 'porte', 'porte');
      await deroulerDialogue(page());
      await pause(2000);
      await tutoriel(page(), false);
      await resoudreEnigme(page(), 'porte');
      await attendreLePliage(page());
      await deroulerDialogue(page());
      await pause(8000);
      await deroulerDialogue(page());

      await taperZone(page(), 'porte', 'village');
      await deroulerDialogue(page());
      await pause(1800);
      const e = await etat(page());
      dire('« À suivre… » clôt la partie', e.fin);
      dire('la sauvegarde reste sur une pièce livrée', e.piece === 'porte', `room=${e.piece}`);
    },
  }),
  { livre: true },
);

// La traversée complète : le seul essai qui éprouve les quatre énigmes, le
// tutoriel joué en entier, les pliages, l'inventaire et les deux scènes.
essai('traversee', async (page, dire) => ({
  sauvegarde: AU_RAVIN,
  jouer: async () => {
    const p = page;
    dire("le dialogue d'arrivée se joue", (await etat(p())).boite);
    await deroulerDialogue(p());

    await taperZone(p(), 'pont', 'feuille');
    await deroulerDialogue(p());
    await choisir(p(), 'plier un pont');
    await deroulerDialogue(p());
    await pause(2000);
    dire("la première énigme s'ouvre avec son tutoriel", (await etat(p())).tuto);
    await tutoriel(p(), true);
    dire("l'énigme survit au tutoriel", (await etat(p())).enigme);
    await resoudreEnigme(p(), 'pont');
    await attendreLePliage(p());
    await deroulerDialogue(p());
    await pause(8000);
    await deroulerDialogue(p());
    await taperZone(p(), 'pont', 'pont_repare');
    dire('le pont posé est examinable', (await etat(p())).boite);
    await deroulerDialogue(p());

    await taperZone(p(), 'pont', 'arbre');
    await deroulerDialogue(p());
    await pause(2000);
    dire(
      "l'idée de l'arbre entre en inventaire",
      (await etat(p())).inventaire.includes('idee_arbre'),
    );

    await pause(400);
    await p().locator('.inventory__item').first().click();
    await pause(1500);
    dire('un objet d’inventaire s’examine', (await etat(p())).boite);
    await deroulerDialogue(p());
    await pause(1500);
    dire("l'aperçu 3D se retire après la description", !(await etat(p())).origami);

    await taperZone(p(), 'pont', 'feuille_vieil_arbre');
    await deroulerDialogue(p());
    await pause(2000);
    await tutoriel(p(), false);
    await resoudreEnigme(p(), 'arbre');
    await attendreLePliage(p());
    await deroulerDialogue(p());
    await pause(8000);
    await deroulerDialogue(p());

    await taperZone(p(), 'pont', 'porte');
    await pause(2000);
    dire('la sortie mène à la porte', (await etat(p())).piece === 'porte');
    await deroulerDialogue(p());

    for (let tour = 0; tour < 6; tour++) {
      await taperZone(p(), 'porte', 'renard');
      const e = await etat(p());
      if (!e.boite && !e.choix.length) break;
      if (e.choix.length) {
        const utile = e.choix.find((c) => !/Partir/.test(c));
        if (!utile) {
          await choisir(p(), 'Partir');
          break;
        }
        await choisir(p(), utile);
      }
      await deroulerDialogue(p());
      await pause(1500);
    }
    await taperZone(p(), 'porte', 'heros');
    dire('le décor répond après avoir épuisé le renard', (await etat(p())).boite);
    await deroulerDialogue(p());

    await taperZone(p(), 'porte', 'feuille_hache');
    await deroulerDialogue(p());
    await pause(2000);
    await tutoriel(p(), false);
    await resoudreEnigme(p(), 'hache');
    await attendreLePliage(p());
    await deroulerDialogue(p());
    await pause(8000);
    await deroulerDialogue(p());
    await pause(2000);
    dire('la hache entre en inventaire', (await etat(p())).inventaire.includes('hache'));

    await taperZone(p(), 'porte', 'pont');
    await pause(2000);
    await deroulerDialogue(p());
    await taperZone(p(), 'pont', 'arbre');
    await deroulerDialogue(p());
    await taperZone(p(), 'pont', 'feuille_vieil_arbre');
    const e = await deroulerDialogue(p());
    dire(
      'la découpe est proposée',
      e.choix.some((c) => /découper/i.test(c)),
      JSON.stringify(e.choix),
    );
    await choisir(p(), /découper/i);
    await deroulerDialogue(p());
    await pause(2000);
    const s = await etat(p());
    dire(
      'le bois remplace la hache',
      s.inventaire.includes('bois') && !s.inventaire.includes('hache'),
    );

    await taperZone(p(), 'pont', 'porte');
    await pause(2000);
    await deroulerDialogue(p());
    await taperZone(p(), 'porte', 'porte');
    await deroulerDialogue(p());
    await pause(2000);
    await tutoriel(p(), false);
    await resoudreEnigme(p(), 'porte');
    await attendreLePliage(p());
    await deroulerDialogue(p());
    await pause(8000);
    await deroulerDialogue(p());
    await taperZone(p(), 'porte', 'heros');
    dire('le décor répond au bout du chapitre', (await etat(p())).boite);
  },
}));

// Coordonnées page d'un point de design, pour les clics hors `taper()`.
async function coin(page, [x, y]) {
  const cadre = await page.locator('#game canvas').boundingBox();
  return [cadre.x + (x / 1280) * cadre.width, cadre.y + (y / 720) * cadre.height];
}

// ------------------------------------------------------------------
// Le serveur
// ------------------------------------------------------------------

async function servir() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, livre: false, arreter: () => {} };

  if (!sansBuild) {
    console.log('· build de production…');
    await commande('npm', ['run', 'build']);
  }
  const serveur = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: RACINE,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((ok, ko) => {
    const minuteur = setTimeout(() => ko(new Error('vite preview ne démarre pas')), 30_000);
    serveur.stdout.on('data', (b) => {
      if (String(b).includes('localhost:4173')) {
        clearTimeout(minuteur);
        ok();
      }
    });
    serveur.on('exit', (c) => ko(new Error(`vite preview s'est arrêté (${c})`)));
  });
  return { url: 'http://localhost:4173/', livre: true, arreter: () => serveur.kill() };
}

function commande(cmd, args) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { cwd: RACINE, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${args.join(' ')} → ${c}`))));
  });
}

// ------------------------------------------------------------------
// Le tour
// ------------------------------------------------------------------

const cible = await servir();
console.log(`· cible : ${cible.url}${cible.livre ? ' (build livré)' : ' (hors build livré)'}\n`);

const navigateur = await chromium.launch({ headless: !process.env.QA_VISIBLE });
let total = 0;
let ratees = 0;
const echecs = [];

for (const { nom, fn, livre, attendu } of essais) {
  if (filtres.length && !filtres.includes(nom)) continue;
  if (livre && !cible.livre) {
    console.log(`~ ${nom} — sauté : parle du build livré, et la cible n'en est pas un`);
    continue;
  }

  console.log(`▸ ${nom}`);
  let courante = null;
  const dire = (quoi, ok, detail = '') => {
    total++;
    if (!ok) {
      ratees++;
      echecs.push(`${nom} : ${quoi}${detail ? ` — ${detail}` : ''}`);
    }
    console.log(`   ${ok ? '✓' : '✗'} ${quoi}${detail ? ` — ${detail}` : ''}`);
  };

  const { sauvegarde, jouer } = await fn(() => courante, dire);
  const { page, contexte, journal } = await ouvrir(navigateur, cible.url, { sauvegarde });
  courante = page;
  try {
    await jouer();
  } catch (err) {
    total++;
    ratees++;
    const message = String(err.message ?? err).split('\n')[0];
    echecs.push(`${nom} : ${message}`);
    console.log(`   ✗ ${message}`);
  }
  // La console de la page est une assertion à elle seule : les deux gels de
  // cette session y étaient — ou justement PAS, ce qui était le problème.
  const cris = attendu ? journal.filter((l) => !attendu.test(l)) : journal;
  dire('rien dans la console de la page', cris.length === 0, cris[0] ?? '');
  await contexte.close();
}

await navigateur.close();
cible.arreter();

console.log(`\n${total - ratees}/${total} vérifications passées`);
if (ratees) {
  console.log('\néchecs :');
  for (const e of echecs) console.log(`  ✗ ${e}`);
  process.exitCode = 1;
}
