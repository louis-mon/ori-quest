// Éditeur de découpage des énigmes — développement seulement.
//
//     npm run dev  puis  http://localhost:5173/decoupage.html
//
// Trois choix, dont tout le reste découle :
//
// - on trace des coupes, on ne dessine pas des pièces : le carré entier est la
//   première pièce et chaque trait en fend une en deux, donc le pavage reste
//   exact (voir `couper.ts`). Une coupe qui se referme sur son point de départ
//   détache en un geste la pièce qu'elle entoure, mais laisse le reste **pincé**
//   en ce point, ou **troué** si le départ était à l'intérieur. Ce sont les deux
//   seuls états que le découpage ne sait pas rendre au jeu : le verdict les dit
//   pendant qu'on travaille, et l'enregistrement les refuse ;
// - rien ne se pose ailleurs que sur la grille d'ancrage, sans quoi une pièce ne
//   pourrait pas se caler sur le plateau du jeu ;
// - une coupe traverse une pièce à la fois, et part d'un de ses points — un
//   bord, qui est aussi bien une rive du carré qu'une coupe déjà tracée, ou
//   n'importe où pour une boucle. Laquelle on fend se décide au deuxième point :
//   un départ posé sur une coupe existante est sur le bord des deux pièces
//   qu'elle sépare, et le pixel survolé au premier clic en choisirait une au
//   hasard, pour l'annoncer un clic trop tard.
//
// Le fichier écrit, `game-design/enigmes/<nom>.json`, fait foi comme la carte
// Tiled fait foi pour la géométrie d'une scène.

import './decoupage.css';
import { DECOUPAGES } from '../generated/enigmes';
import { aire, boite, type Point } from '../game/puzzle/decoupage';
import { anneauDe, couper, dansLaPiece, longeUnPli, type Morceau, type Segment } from './couper';

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
let pieces: Morceau[] = [];

// Pile d'annulation : l'état complet avant chaque coupe.
const historique: Morceau[][] = [];

// En unités de grille : une coupe n'a pas le droit de les suivre. Chargés à part
// de l'image, que le navigateur affiche sans nous en dire les points.
let plis: Segment[] = [];

// Coupe en cours de tracé, la pièce qu'elle fend, et celles qui pourraient
// encore l'être : tant que le trait n'a qu'un point, toutes celles dont le bord
// passe par ce point, la survolée en tête.
let trait: Point[] = [];
let pieceCoupee = -1;
let candidats: number[] = [];

const enJeu = () => (trait.length === 1 ? candidats : pieceCoupee >= 0 ? [pieceCoupee] : []);

// Les pièces que le dernier verdict a dites pincées. C'est de l'affichage, pas
// la garde : le verdict arrive après coup, et c'est le serveur qui refuse
// d'écrire un découpage pincé.
let pincees: number[] = [];

// Les pièces trouées, elles, se voient d'ici : une pièce trouée a plus d'un
// anneau. C'est même le seul verdict que l'éditeur rend seul — une pièce trouée
// ne s'envoie pas, le fichier n'ayant qu'une liste de sommets par pièce.
const troues = () => pieces.flatMap((p, i) => (p.length > 1 ? [i] : []));

const VERROU = 'Une pièce pincée ou trouée n’est pas une pièce : il reste à la fendre.';

function verrouiller(bloque: boolean) {
  enregistrer.disabled = bloque;
  enregistrer.title = bloque ? VERROU : '';
}

const memePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

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
const enregistrer = document.getElementById('enregistrer') as HTMLButtonElement;
const verdict = document.getElementById('verdict')!;
const fichier = document.getElementById('fichier')!;

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

function charger(nom: string) {
  enigme = nom;
  const source = DECOUPES[nom];
  grille = source?.grille ?? 4;
  pieces = source
    ? source.pieces.map((p) => [p.points.map(([x, y]) => [x, y] as Point)])
    : [carre()];
  historique.length = 0;
  annulerCoupe();
  oublierLeSurvol();
  pincees = [];
  verrouiller(false);
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
function carre(): Morceau {
  return [
    [
      [0, 0],
      [grille, 0],
      [grille, grille],
      [0, grille],
    ],
  ];
}

function memoriser() {
  historique.push(pieces.map((p) => p.map((a) => a.map((q) => [...q] as Point))));
  modifie = true;
}

function annulerCoupe() {
  trait = [];
  pieceCoupee = -1;
  candidats = [];
}

// Les pièces changent en bloc — chargement, annulation, retour au carré — et le
// survol désignait l'une des anciennes par son rang. Gardé, il fait rendre une
// pièce qui n'existe plus : le pointeur est de toute façon sur un bouton.
function oublierLeSurvol() {
  survol = -1;
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
  // des pièces encore en jeu une fois le trait entamé.
  const fendues = enJeu();
  const cibles = fendues.length
    ? fendues.map((i) => pieces[i])
    : survol >= 0
      ? [pieces[survol]]
      : [];
  // Un point est visable s'il est sur un bord de la pièce ou dedans : une coupe
  // part maintenant d'où on veut, à condition d'y revenir.
  const visable = (x: number, y: number) =>
    cibles.some((c) => anneauDe(c, [x, y]) >= 0 || dansLaPiece(c, [x, y]));

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
        fendues.includes(i) ? 'piece--coupee' : '',
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
        `<path class="bord${fendues.includes(i) ? ' bord--coupee' : ''}" d="${d}" />`
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

// Tous les anneaux dans un seul chemin : le trou se creuse à la règle pair-impair
// (`fill-rule`, dans la CSS), comme le masque du jeu.
const chemin = (piece: Morceau) =>
  piece.map((a) => `M${a.map(([x, y]) => `${x} ${y}`).join(' L')} Z`).join(' ');

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

  const trous = troues();
  if (trous.length) {
    verrouiller(true);
    dessinerInventaire();
    ecrireVerdict(
      `⚠ Pièce(s) ${trous.join(', ')} trouée(s) : la boucle a détaché son morceau et laissé sa ` +
        'forme en creux. À rejoindre au bord avant d’enregistrer — il y faut deux coupes.',
      'attention',
    );
    return;
  }
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

// Le contour seul : on n'arrive ici qu'une fois les trous refermés.
const pourLeServeur = () => pieces.map((p) => ({ points: p[0] }));

async function interroger() {
  const reponse = await fetch('/__unicite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enigme, grille, pieces: pourLeServeur() }),
  });
  const rapport = await reponse.json();
  if (!reponse.ok || !rapport.ok) throw new Error(rapport.erreur ?? reponse.statusText);
  return rapport as Verdict;
}

interface Verdict {
  etat: string;
  dispositions: number;
  pincees?: number[];
}

function afficherVerdict(r: Verdict) {
  pincees = r.pincees ?? [];
  verrouiller(pincees.length > 0);
  dessinerInventaire();

  if (r.etat === 'pincee') {
    ecrireVerdict(
      `⚠ Pièce(s) ${pincees.join(', ')} pincée(s) : une boucle a détaché son morceau, et ce qui ` +
        'reste ne tient plus que par un point. À fendre avant d’enregistrer.',
      'attention',
    );
  } else if (r.etat === 'unique') {
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
      const b = boite(p[0]);
      const a = p.reduce((reste, anneau, r) => reste + (r ? -aire(anneau) : aire(anneau)), 0);
      const troue = p.length > 1;
      const pincee = pincees.includes(i);
      const classes = [a < 1 ? 'petite' : '', pincee || troue ? 'pincee' : '']
        .filter(Boolean)
        .join(' ');
      const sommets = p.reduce((n, anneau) => n + anneau.length, 0);
      return (
        `<li${classes ? ` class="${classes}"` : ''}>` +
        `<span class="pastille" style="--teinte: ${(i * 137.5) % 360}"></span>` +
        `(${b.x}, ${b.y}) ${b.w}×${b.h} — ${sommets} sommets, ${arrondi(a)} cellules` +
        `${troue ? ' — trouée' : pincee ? ' — pincée' : ''}</li>`
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
    ? 'Clique les points du milieu, puis un point du bord pour finir — ou le point de départ pour refermer la pièce. Échap annule, Retour arrière retire le dernier point.'
    : 'Clique un point d’une pièce pour commencer une coupe : sur un bord pour la traverser, n’importe où pour dessiner une pièce d’un seul trait.';
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
  if (!trait.length) survol = pieces.findIndex((p) => dansLaPiece(p, brut));
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
    const cible = pieces.findIndex((p) => dansLaPiece(p, brut));
    if (cible < 0) return dire('Commence dans une pièce.', true);
    if (!dansLaPiece(pieces[cible], cale) && anneauDe(pieces[cible], cale) < 0) {
      return dire('Ce point est hors de la pièce.', true);
    }
    survol = cible;
    pieceCoupee = cible;
    const voisines = pieces
      .map((_, i) => i)
      .filter((i) => i !== cible && anneauDe(pieces[i], cale) >= 0);
    candidats = [cible, ...voisines];
    trait = [cale];
    dire(
      candidats.length > 1
        ? 'Coupe en cours — le point suivant dira quelle pièce est fendue.'
        : `Coupe de la pièce ${cible} en cours…`,
    );
    rappeler();
    return rendre();
  }

  // Le deuxième point choisit la pièce : celle où il entre, ou celle qu'il
  // traverse d'un bord à l'autre. Tant qu'il n'est pas posé, les autres restent
  // en jeu — un point repris au Retour arrière rouvre donc le choix.
  if (trait.length === 1 && candidats.length > 1) {
    const choisi =
      candidats.find((i) => dansLaPiece(pieces[i], cale)) ??
      candidats.find(
        (i) => anneauDe(pieces[i], cale) >= 0 && couper(pieces[i], [trait[0], cale]).ok,
      );
    if (choisi !== undefined) pieceCoupee = choisi;
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

  // Refermer sur le point de départ finit la coupe, où qu'il soit ; sinon il
  // faut un bord. Une coupe partie du dedans n'a donc qu'une façon de finir.
  const depart = trait[0];
  if (memePoint(cale, depart) || anneauDe(forme, cale) >= 0) {
    return terminer([...trait, cale]);
  }

  if (!dansLaPiece(forme, cale)) {
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
  oublierLeSurvol();
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
  oublierLeSurvol();
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
  const converties = pieces.map((p) =>
    p.map((a) => a.map(([x, y]) => [x * facteur, y * facteur] as Point)),
  );
  if (
    converties.some((p) =>
      p.some((a) => a.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y))),
    )
  ) {
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
enregistrer.addEventListener('click', async () => {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__decoupage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enigme,
        grille,
        pieces: pourLeServeur(),
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
