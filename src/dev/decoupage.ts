// Éditeur de découpage des énigmes — développement seulement.
//
//     npm run dev  puis  http://localhost:5173/decoupage.html
//
// Trois choix, dont tout le reste découle :
//
// - on trace des coupes, on ne dessine pas des pièces : le carré entier est la
//   première pièce et chaque trait en fend une en deux, donc le pavage est exact
//   par construction (voir `couper.ts`) ;
// - rien ne se pose ailleurs que sur la grille d'ancrage, sans quoi une pièce ne
//   pourrait pas se caler sur le plateau du jeu ;
// - une coupe traverse une pièce à la fois, celle survolée au premier clic — la
//   position réelle du pointeur tranche, pas le point calé, sinon un point posé
//   sur une frontière serait ambigu.
//
// Le fichier écrit, `game-design/enigmes/<nom>.json`, fait foi comme la carte
// Tiled fait foi pour la géométrie d'une scène.

import './decoupage.css';
import { DECOUPAGES } from '../generated/enigmes';
import { aire, boite, pointDans, surLeBord, type Point } from '../game/puzzle/decoupage';
import { couper, longeUnPli, type Segment } from './couper';

// Côté de la zone de dessin quand la page n'est pas encore mesurée.
const COTE = 640;

// En pixels d'écran : les traits de bord y respirent.
const MARGE = 14;

// Celles qui ont déjà un découpage, et celles qui n'ont qu'un crease pattern :
// les secondes démarrent sur le carré entier et le premier enregistrement crée
// le fichier. Sans ça, ouvrir une énigme neuve demanderait d'écrire un JSON à la
// main avant de pouvoir la découper.
const AVEC_MOTIF = Object.keys(import.meta.glob('/public/assets/enigmes/*/solution.svg')).map(
  (chemin) => chemin.split('/').at(-2)!,
);
const ENIGMES = [...new Set([...Object.keys(DECOUPAGES), ...AVEC_MOTIF])].sort();

// Relu comme un annuaire : une énigme peut y manquer.
const DECOUPES = DECOUPAGES as Record<
  string,
  { grille: number; pieces: readonly { readonly points: readonly Point[] }[] } | undefined
>;

let enigme = ENIGMES[0];
// Grille par défaut d'une énigme encore vierge.
let grille = 4;
let pieces: Point[][] = [];

// Pile d'annulation : l'état complet avant chaque coupe.
const historique: Point[][][] = [];

// En unités de grille : une coupe n'a pas le droit de les suivre. Chargés à part
// de l'image, que le navigateur affiche sans nous en dire les points.
let plis: Segment[] = [];

// Coupe en cours de tracé, et la pièce qu'elle fend.
let trait: Point[] = [];
let pieceCoupee = -1;

// Pièce survolée et intersection visée, recalculées à chaque mouvement.
let survol = -1;
let vise: Point | null = null;

let modifie = false;

const liste = document.getElementById('liste')!;
const plan = document.getElementById('plan') as unknown as SVGSVGElement;
const statut = document.getElementById('statut')!;
const aide = document.getElementById('aide')!;
const inventaire = document.getElementById('inventaire')!;
const champGrille = document.getElementById('grille') as HTMLInputElement;
const verdict = document.getElementById('verdict')!;
const fichier = document.getElementById('fichier')!;

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

function charger(nom: string) {
  enigme = nom;
  const source = DECOUPES[nom];
  grille = source?.grille ?? 4;
  pieces = source ? source.pieces.map((p) => p.points.map(([x, y]) => [x, y] as Point)) : [carre()];
  historique.length = 0;
  annulerCoupe();
  modifie = false;
  location.hash = nom;
  champGrille.value = String(grille);
  void chargerPlis(nom);
  dessinerListe();
  fichier.textContent = `game-design/enigmes/${nom}.json`;
  rendre();
  verifierUnicite();
  dire(source ? `${nom} — ${pieces.length} pièce(s)` : `${nom} — jamais découpée`);
}

// Seuls les plis montagne et vallée comptent : les traits de bord sont les rives
// du carré, qu'une coupe longe forcément à ses extrémités, et les traits de
// facette ne sont pas des plis.
async function chargerPlis(nom: string) {
  plis = [];
  try {
    const reponse = await fetch(`assets/enigmes/${nom}/solution.svg`);
    if (!reponse.ok) return;
    const svg = new DOMParser().parseFromString(await reponse.text(), 'image/svg+xml');
    const [vx, vy, vw, vh] = (svg.documentElement.getAttribute('viewBox') ?? '0 0 1000 1000')
      .split(/[\s,]+/)
      .map(Number);

    if (nom !== enigme) return; // l'utilisateur a changé d'énigme entre-temps
    plis = [...svg.querySelectorAll('line.mo, line.va')].map((ligne) => {
      const n = (attr: string) => Number(ligne.getAttribute(attr));
      return {
        x1: ((n('x1') - vx) / vw) * grille,
        y1: ((n('y1') - vy) / vh) * grille,
        x2: ((n('x2') - vx) / vw) * grille,
        y2: ((n('y2') - vy) / vh) * grille,
      };
    });
  } catch {
    // Sans motif, on découpe quand même : la vérification d'unicité le
    // signalera.
  }
}

// Le point de départ de tout découpage.
function carre(): Point[] {
  return [
    [0, 0],
    [grille, 0],
    [grille, grille],
    [0, grille],
  ];
}

function memoriser() {
  historique.push(pieces.map((p) => p.map((q) => [...q] as Point)));
  modifie = true;
}

function annulerCoupe() {
  trait = [];
  pieceCoupee = -1;
}

// ---------------------------------------------------------------------------
// Dessin
// ---------------------------------------------------------------------------

// Recalculé à chaque rendu : la zone de dessin suit la fenêtre, et des repères
// dimensionnés une fois pour toutes seraient minuscules sur un grand écran.
let unite = grille / COTE;

// Une longueur en pixels d'écran, exprimée dans les unités de la grille.
const px = (n: number) => n * unite;

function rendre() {
  // Le viewBox se déduit de la marge, qui se déduit de l'échelle, qui se déduit
  // du viewBox : on résout au lieu de tourner en rond.
  const cote = plan.clientWidth || COTE;
  const vue = grille / (1 - (2 * MARGE) / cote);
  unite = vue / cote;

  const marge = px(MARGE);
  plan.setAttribute('viewBox', `${-marge} ${-marge} ${vue} ${vue}`);

  const traits: string[] = [];
  for (let i = 0; i <= grille; i++) {
    traits.push(`M0 ${i} H${grille}`, `M${i} 0 V${grille}`);
  }

  // Mis en avant selon ce qu'on peut en faire à cet instant : les bords de la
  // pièce survolée tant qu'aucune coupe n'est commencée, puis tout l'intérieur
  // de la pièce coupée une fois le trait entamé.
  const cible = pieceCoupee >= 0 ? pieces[pieceCoupee] : survol >= 0 ? pieces[survol] : null;
  const visable = (x: number, y: number) =>
    !!cible && (surLeBord(cible, x, y) || (trait.length > 0 && pointDans(cible, x, y)));

  const points: string[] = [];
  for (let y = 0; y <= grille; y++) {
    for (let x = 0; x <= grille; x++) {
      const ouvert = visable(x, y);
      points.push(
        `<circle class="ancre${ouvert ? ' ancre--ouverte' : ''}" cx="${x}" cy="${y}" r="${px(ouvert ? 4 : 1.5)}" />`,
      );
    }
  }

  // Une coupe ne doit pas se confondre avec un pli : trait épais en pointillés
  // qui défilent, sur un liseré de papier pour rester lisible là où elle en
  // croise un. D'où le dessin en deux temps — tous les fonds, puis tous les
  // bords : sinon le fond d'une pièce recouvrirait le bord de sa voisine.
  const fonds = pieces
    .map((p, i) => {
      const classes = [
        'piece',
        i === survol ? 'piece--survol' : '',
        i === pieceCoupee ? 'piece--coupee' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<path class="${classes}" style="--teinte: ${(i * 137.5) % 360}" d="${chemin(p)}" />`;
    })
    .join('');

  const bords = pieces
    .map((p, i) => {
      const d = chemin(p);
      return (
        `<path class="bord-halo" d="${d}" />` +
        `<path class="bord${i === pieceCoupee ? ' bord--coupee' : ''}" d="${d}" />`
      );
    })
    .join('');

  const trace = [...trait, ...(vise ? [vise] : [])].map((p) => p.join(',')).join(' ');
  const coupe = trait.length
    ? `<polyline class="bord-halo" points="${trace}" />` +
      `<polyline class="coupe" points="${trace}" />` +
      trait
        .map((p) => `<circle class="coupe-point" cx="${p[0]}" cy="${p[1]}" r="${px(4)}" />`)
        .join('')
    : '';

  const curseur = vise
    ? `<circle class="curseur" cx="${vise[0]}" cy="${vise[1]}" r="${px(6)}" />`
    : '';

  plan.innerHTML =
    `<rect class="papier" x="0" y="0" width="${grille}" height="${grille}" />` +
    `<image href="assets/enigmes/${enigme}/solution.svg" x="0" y="0" width="${grille}" height="${grille}" />` +
    `<path class="grille" d="${traits.join(' ')}" />` +
    fonds +
    bords +
    points.join('') +
    coupe +
    curseur;

  dessinerInventaire();
}

const chemin = (p: readonly Point[]) => `M${p.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;

// ---------------------------------------------------------------------------
// Unicité de la solution
// ---------------------------------------------------------------------------

// Le calcul n'est PAS refait ici : c'est le solveur de `tools/lib/decoupage.mjs`,
// celui-là même qui garde l'import et `npm run check-puzzle`. Une seconde
// implémentation finirait par répondre autre chose que le jeu.
//
// L'énumération est exponentielle, donc bornée côté serveur, qui répond
// « indécis » plutôt que de faire attendre.
let enVol = 0;
let minuteur = 0;

// Attente avant la première tentative, puis entre deux relances.
const DELAI = 250;
const RELANCE_MAX = 10_000;

function verifierUnicite(delai = DELAI, relance = 1000, silencieux = false) {
  window.clearTimeout(minuteur);
  const jeton = ++enVol;
  // Une relance ne remet pas le panneau à « … » : l'explication qu'on vient
  // d'écrire disparaîtrait aussitôt, sans jamais être lue.
  if (!silencieux) ecrireVerdict('…', 'attente');

  // Une coupe se trace en plusieurs clics et l'énumération n'est pas gratuite :
  // on ne la lance qu'une fois le geste retombé.
  minuteur = window.setTimeout(async () => {
    try {
      const rapport = await interroger();
      if (jeton === enVol) afficherVerdict(rapport);
    } catch (err) {
      if (jeton !== enVol) return; // une coupe plus récente est déjà partie

      // Un `fetch` qui échoue au niveau réseau lève un TypeError : le serveur de
      // dev redémarre ou est arrêté. Ce n'est pas une réponse sur le découpage,
      // donc on retente, de plus en plus espacé.
      if (err instanceof TypeError) {
        ecrireVerdict(
          'Serveur de développement injoignable — le verdict revient dès qu’il répond.',
          'attente',
        );
        verifierUnicite(relance, Math.min(relance * 2, RELANCE_MAX), true);
        return;
      }
      ecrireVerdict(`Vérification impossible : ${message(err)}`, 'attention');
    }
  }, delai);
}

async function interroger() {
  const reponse = await fetch('/__unicite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enigme, grille, pieces: pieces.map((points) => ({ points })) }),
  });
  const rapport = await reponse.json();
  if (!reponse.ok || !rapport.ok) throw new Error(rapport.erreur ?? reponse.statusText);
  return rapport as { etat: string; dispositions: number };
}

function afficherVerdict(r: { etat: string; dispositions: number }) {
  if (r.etat === 'unique') {
    ecrireVerdict('✓ Solution unique — aucune autre disposition ne donne la même image.', 'ok');
  } else if (r.etat === 'multiple') {
    ecrireVerdict(
      `⚠ ${r.dispositions} dispositions donnent la même image : le joueur peut en trouver ` +
        'une que la validation refusera.',
      'attention',
    );
  } else if (r.etat === 'trop-long') {
    ecrireVerdict('Trop de dispositions à énumérer : unicité indécise.', 'attente');
  } else if (r.etat === 'sans-motif') {
    ecrireVerdict('Crease pattern introuvable : unicité non vérifiée.', 'attente');
  } else {
    ecrireVerdict('⚠ Le découpage ne pave pas le carré.', 'attention');
  }
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function ecrireVerdict(texte: string, etat: 'ok' | 'attention' | 'attente') {
  verdict.textContent = texte;
  verdict.className = `verdict verdict--${etat}`;
}

function dessinerInventaire() {
  inventaire.innerHTML = pieces
    .map((p, i) => {
      const b = boite(p);
      const a = aire(p);
      const petite = a < 1 ? ' class="petite"' : '';
      return (
        `<li${petite}><span class="pastille" style="--teinte: ${(i * 137.5) % 360}"></span>` +
        `(${b.x}, ${b.y}) ${b.w}×${b.h} — ${p.length} sommets, ${arrondi(a)} cellules</li>`
      );
    })
    .join('');
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

function dessinerListe() {
  liste.innerHTML = ENIGMES.map(
    (nom) =>
      `<button type="button" data-enigme="${nom}"${nom === enigme ? ' class="actif"' : ''}>` +
      `${nom} <small>${DECOUPES[nom]?.pieces.length ?? '—'} p.</small></button>`,
  ).join('');
}

function dire(texte: string, erreur = false) {
  statut.textContent = texte;
  statut.classList.toggle('is-erreur', erreur);
}

function rappeler() {
  aide.textContent = trait.length
    ? 'Clique les points du milieu, puis un point du bord pour finir. Échap annule, Retour arrière retire le dernier point.'
    : 'Clique un point du bord d’une pièce pour commencer une coupe.';
}

// ---------------------------------------------------------------------------
// Tracé
// ---------------------------------------------------------------------------

// La vraie position, et l'intersection visée.
function ou(e: PointerEvent): { brut: [number, number]; cale: Point } {
  const cadre = plan.getBoundingClientRect();
  const vb = plan.viewBox.baseVal;
  const x = ((e.clientX - cadre.left) / cadre.width) * vb.width + vb.x;
  const y = ((e.clientY - cadre.top) / cadre.height) * vb.height + vb.y;
  return {
    brut: [x, y],
    cale: [borne(Math.round(x)), borne(Math.round(y))],
  };
}

const borne = (n: number) => Math.min(Math.max(n, 0), grille);

plan.addEventListener('pointermove', (e) => {
  const { brut, cale } = ou(e);
  vise = cale;
  // La pièce se décide sur la position réelle du pointeur : le point calé,
  // souvent sur une frontière, appartiendrait à deux pièces à la fois.
  if (!trait.length) survol = pieces.findIndex((p) => pointDans(p, ...brut));
  rendre();
});

plan.addEventListener('pointerleave', () => {
  vise = null;
  survol = -1;
  rendre();
});

plan.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const { brut, cale } = ou(e);

  if (!trait.length) {
    // La pièce se relit sur le clic lui-même : un tap n'est précédé d'aucun
    // déplacement, et le survol serait resté à ce qu'il était.
    const cible = pieces.findIndex((p) => pointDans(p, ...brut));
    if (cible < 0) return dire('Commence dans une pièce.', true);
    if (!surLeBord(pieces[cible], ...cale)) {
      return dire('Une coupe part du bord de la pièce, pas de son intérieur.', true);
    }
    survol = cible;
    pieceCoupee = cible;
    trait = [cale];
    dire(`Coupe de la pièce ${cible} en cours…`);
    rappeler();
    return rendre();
  }

  const forme = pieces[pieceCoupee];
  const dernier = trait[trait.length - 1];
  if (cale[0] === dernier[0] && cale[1] === dernier[1]) return;

  // Refusé au clic, et non à la fin du tracé : on ne laisse pas dessiner trois
  // segments pour annoncer ensuite que le premier ne convenait pas.
  if (longeUnPli(plis, dernier, cale)) {
    return dire(
      'Ce segment suivrait un pli : il serait fendu en deux et se verrait sur les deux pièces.',
      true,
    );
  }

  if (surLeBord(forme, ...cale)) return terminer([...trait, cale]);

  if (!pointDans(forme, ...cale)) {
    return dire('Ce point est hors de la pièce coupée.', true);
  }
  trait.push(cale);
  rendre();
});

// Laisse la pièce intacte si la coupe ne tient pas debout.
function terminer(complet: Point[]) {
  const resultat = couper(pieces[pieceCoupee], complet);
  if (!resultat.ok) {
    dire(resultat.erreur, true);
    return rendre();
  }

  memoriser();
  pieces.splice(pieceCoupee, 1, ...resultat.pieces);
  annulerCoupe();
  rappeler();
  dire(`${pieces.length} pièces.`);
  rendre();
  verifierUnicite();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    annulerCoupe();
    rappeler();
    dire('Coupe abandonnée.');
    return rendre();
  }
  if (e.key === 'Backspace' && trait.length) {
    e.preventDefault();
    trait.pop();
    if (!trait.length) annulerCoupe();
    rappeler();
    return rendre();
  }
  if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    annuler();
  }
});

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

liste.addEventListener('click', (e) => {
  const nom = (e.target as HTMLElement).closest<HTMLElement>('[data-enigme]')?.dataset.enigme;
  if (!nom) return;
  if (modifie && !confirm('Le découpage en cours n’est pas enregistré. Changer d’énigme ?')) return;
  charger(nom);
});

function annuler() {
  const avant = historique.pop();
  if (!avant) return dire('Rien à annuler.');
  pieces = avant;
  annulerCoupe();
  dire(`${pieces.length} pièces.`);
  rendre();
  verifierUnicite();
}

document.getElementById('annuler')!.addEventListener('click', annuler);

document.getElementById('recommencer')!.addEventListener('click', () => {
  if (!confirm('Repartir du carré entier ?')) return;
  memoriser();
  pieces = [carre()];
  annulerCoupe();
  dire('Carré entier.');
  rendre();
  verifierUnicite();
});

// Les coupes sont gardées si elles s'y retrouvent — passer de 4 à 8 double les
// coordonnées. Sinon on refuse : recaler des sommets à l'arrondi déplacerait des
// coupes déjà réglées sans le dire.
champGrille.addEventListener('change', () => {
  const n = Number(champGrille.value);
  if (!Number.isInteger(n) || n < 2 || n > 24) {
    champGrille.value = String(grille);
    return dire('Grille entre 2 et 24.', true);
  }

  const facteur = n / grille;
  const converties = pieces.map((p) => p.map(([x, y]) => [x * facteur, y * facteur] as Point));
  if (converties.some((p) => p.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y)))) {
    champGrille.value = String(grille);
    return dire(`Une grille de ${n} ne retomberait pas sur les coupes déjà tracées.`, true);
  }

  memoriser();
  grille = n;
  pieces = converties;
  annulerCoupe();
  dire(`Grille ${n}×${n}.`);
  rendre();
  verifierUnicite();
});

// Écrit par le serveur de développement, comme l'outil de pose écrit
// `poses.ts` : le point d'entrée n'existe qu'en dev et ne garde que des entiers
// bornés. Vite recharge la page dans la foulée, d'où le message qui traverse le
// rechargement par `sessionStorage`.
document.getElementById('enregistrer')!.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__decoupage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enigme,
        grille,
        pieces: pieces.map((points) => ({ points })),
      }),
    });
    const resultat = await reponse.json();
    if (!reponse.ok || !resultat.ok) throw new Error(resultat.erreur ?? reponse.statusText);
    modifie = false;
    sessionStorage.setItem('decoupage-enregistre', enigme);
    dire('Enregistré ✓');
  } catch (err) {
    // Même distinction que pour la vérification : « serveur absent » et
    // « découpage refusé » ne demandent pas la même chose à l'utilisateur.
    dire(
      err instanceof TypeError
        ? 'Rien enregistré : le serveur de développement ne répond pas (npm run dev).'
        : `Échec : ${message(err)}`,
      true,
    );
  }
});

// ---------------------------------------------------------------------------
// Départ
// ---------------------------------------------------------------------------

const demandee = location.hash.slice(1);
charger(ENIGMES.includes(demandee) ? demandee : ENIGMES[0]);
rappeler();

const enregistree = sessionStorage.getItem('decoupage-enregistre');
if (enregistree) {
  sessionStorage.removeItem('decoupage-enregistre');
  dire(`Enregistré ✓ (${enregistree})`);
}
