import Phaser from 'phaser';
import { incrustationsDOr, ORS, teintesDe } from '../../origami/papier';
import {
  dessinerFeuille,
  geometrieFeuille,
  type GeometrieFeuille,
  type Point,
  type Teintes,
} from './feuille';
import { alea } from './hasard';
import type { Box } from './layout';

// Les quatre feuilles que la reine offre, au centre de la salle du trône. On y
// choisit une couleur, puis un modèle (`trone_coeur` dans content/story.ink) :
// leur éclat est ce qui les distingue au premier regard, et ce que le menu
// nomme.
//
// Seule la rouge devient quelque chose — le cœur —, et son papier vient donc de
// son modèle, comme pour toute feuille du jeu : la teinte, et les éclats d'or
// que la texture du cœur porte aussi. Plié, il garde ses lumières
// (`eclatDuCoeur`). Les trois autres n'ont pas de modèle : leurs teintes sont
// écrites ici.

type Precieuse = 'rouge' | 'vert' | 'bleu' | 'mauve';

// De gauche à droite. Le menu de `trone_feuilles` garde son ordre à lui.
const ORDRE: readonly Precieuse[] = ['vert', 'rouge', 'bleu', 'mauve'];

const TEINTES: Record<Precieuse, Teintes> = {
  rouge: teintesDe('coeur'),
  vert: { recto: 0x1d7450, verso: 0xc9d1d6 },
  bleu: { recto: 0x23408f, verso: 0xd9b75a },
  mauve: { recto: 0x8d62ae, verso: 0xeadff2 },
};

// Les étoiles se posent en mélange normal, en teintes franches : ajoutées au
// papier, de l'or sur du bleu donnait du blanc, et les couleurs du diamant se
// délavaient sur le mauve.
const ETINCELLES_OR = [0xffb81f, 0xffcc3a, 0xffdd70] as const;
// Un diamant éclairé renvoie toutes les couleurs à la fois : chaque éclat
// parcourt l'arc-en-ciel pendant qu'il brille (voir `irise`). Un choix de
// couleurs figées, tirées dans une liste, faisait des confettis.
const SATURATION_DIAMANT = 0.7;

// Le papier s'allume autour de chaque éclat, comme un métal qui accroche la
// lumière là où elle tombe. `rayon` en fraction du côté, `force` à son plus fort.
const LUMIERES: Record<Exclude<Precieuse, 'vert'>, { rayon: number; force: number }> = {
  rouge: { rayon: 0.32, force: 0.3 },
  bleu: { rayon: 0.3, force: 0.32 },
  mauve: { rayon: 0.3, force: 0.34 },
};

// La lumière que chacune jette autour d'elle.
const LUEURS: Record<Precieuse, number> = {
  rouge: 0xff7a70,
  vert: 0xc8f5e2,
  bleu: 0xffd98a,
  mauve: 0xeec2ff,
};

// L'écart entre deux feuilles, en fraction du côté.
const ECART = 0.2;

// Le semis des paillettes et des veines : le même à chaque visite, sinon la
// feuille change sous les yeux de qui revient de la pièce d'à côté.
const GRAINE = 5813;

const ETINCELLE = 'eclat-etincelle';
const DIAMANT = 'eclat-diamant';
const HALO = 'eclat-halo';
const LUMIERE_COEUR = 'eclat-lumiere-coeur';

export interface FeuillesPrecieuses {
  // Les quatre, qu'on montre ou cache ensemble.
  groupe: Phaser.GameObjects.Container;
  // Les quatre carrés : c'est la zone tactile.
  emprise: Box;
}

// Posées sur une rangée, en bas de leur boîte et centrées dedans.
export function poserFeuillesPrecieuses(scene: Phaser.Scene, box: Box): FeuillesPrecieuses {
  peindreTextures(scene);
  const cote = Math.min(box.h, box.w / (ORDRE.length + (ORDRE.length - 1) * ECART));
  const largeur = cote * (ORDRE.length + (ORDRE.length - 1) * ECART);
  const x0 = box.x + (box.w - largeur) / 2;
  const cy = box.y + box.h - cote / 2;
  const hasard = alea(GRAINE);

  const groupe = scene.add.container(0, 0);
  ORDRE.forEach((precieuse, i) => {
    const feuille = poserFeuille(scene, groupe, precieuse, cote, hasard);
    feuille.setPosition(x0 + i * cote * (1 + ECART) + cote / 2, cy);
    groupe.add(feuille);
  });

  return { groupe, emprise: { x: x0, y: cy - cote / 2, w: largeur, h: cote } };
}

// Tout est en coordonnées locales, centré sur la feuille.
function poserFeuille(
  scene: Phaser.Scene,
  groupe: Phaser.GameObjects.Container,
  precieuse: Precieuse,
  cote: number,
  hasard: () => number,
): Phaser.GameObjects.Container {
  const geo = geometrieFeuille({ x: -cote / 2, y: -cote / 2, w: cote, h: cote });
  const recto: Surface = { cote, point: (h) => pointSurLeRecto(geo, h) };
  const feuille = scene.add.container(0, 0);

  const lueur = allumerLaLueur(scene, LUEURS[precieuse], cote * 2, cote * 1.7, hasard);
  const dessin = scene.add.graphics();
  feuille.add([lueur, dessin]);
  const imprimer = (motif: (g: Phaser.GameObjects.Graphics) => void) =>
    dessinerFeuille(dessin, geo.carre, TEINTES[precieuse], motif);
  // Posé avant les étoiles : c'est le papier qu'elles éclairent, pas elles.
  const eclairage =
    precieuse === 'vert' ? undefined : eclairer(scene, groupe, feuille, geo, LUMIERES[precieuse]);

  switch (precieuse) {
    case 'rouge':
      imprimer((g) => incruster(g, geo, hasard));
      scintiller(scene, feuille, recto, hasard, eclairage, ETOILES_ROUGE);
      break;
    case 'vert':
      imprimer((g) => brosser(g, geo, hasard));
      balayer(scene, groupe, feuille, geo, hasard);
      break;
    case 'bleu': {
      const veines = tracerVeines(geo, hasard);
      imprimer((g) => dessinerVeines(g, veines));
      parcourirLesVeines(scene, feuille, geo, veines, hasard, eclairage);
      // Des points d'or qui s'allument sur le réseau, là où la lueur ne passe pas.
      scintiller(scene, feuille, recto, hasard, eclairage, {
        nombre: 4,
        texture: ETINCELLE,
        teintes: ETINCELLES_OR,
        taille: [0.16, 0.26],
        duree: 480,
        pause: [400, 1800],
        points: veines
          .flatMap((v) => v.points)
          .filter((p) => dansLeRecto(geo, p)),
      });
      break;
    }
    case 'mauve': {
      const taille = tailler(geo, hasard);
      imprimer((g) => taille.dessiner(g));
      allumerLesFacettes(scene, groupe, feuille, taille.facettes, hasard);
      // Des éclats petits et nombreux, qui se relaient sans répit : c'est leur
      // chevauchement qui fait le diamant. Peu nombreux et espacés, on voyait
      // les salves arriver par paquets ; gros et rapides, la feuille clignotait.
      scintiller(scene, feuille, recto, hasard, eclairage, {
        nombre: 9,
        texture: DIAMANT,
        teintes: [],
        taille: [0.16, 0.28],
        duree: 520,
        pause: [100, 400],
        points: taille.sommets,
        irise: true,
      });
      scintiller(scene, feuille, recto, hasard, undefined, {
        nombre: 8,
        texture: ETINCELLE,
        teintes: [],
        taille: [0.08, 0.14],
        duree: 380,
        pause: [80, 320],
        irise: true,
      });
      break;
    }
  }
  return feuille;
}

// La lueur, sous la feuille : c'est elle qui fait lire « précieux » de loin,
// quand les détails du papier ne se voient plus.
function allumerLaLueur(
  scene: Phaser.Scene,
  teinte: number,
  largeur: number,
  hauteur: number,
  hasard: () => number,
): Phaser.GameObjects.Image {
  const lueur = scene.add
    .image(0, 0, HALO)
    .setDisplaySize(largeur, hauteur)
    .setTint(teinte)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.35);
  scene.tweens.add({
    targets: lueur,
    alpha: 0.7,
    duration: 1500 + hasard() * 900,
    delay: hasard() * 1200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return lueur;
}

// ------------------------------------------------------------------
// Le cœur plié
// ------------------------------------------------------------------

export interface EclatDuCoeur {
  setVisible(visible: boolean): void;
}

// Le cœur garde l'éclat de la feuille rouge qu'il était : la même lueur
// dessous, les mêmes étoiles d'or, le même papier qui s'allume autour d'elles.
// Ses éclats d'or, eux, sont dans la texture du modèle.
//
// `image` est le rendu du modèle, déjà posé sur `emprise` : tout se cale sur ses
// pixels, la silhouette d'un cœur n'ayant rien d'un carré.
export function eclatDuCoeur(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  emprise: Box,
): EclatDuCoeur {
  peindreTextures(scene);
  // `poserOrigami` l'a posé par `addCanvas`.
  const rendu = image.texture as Phaser.Textures.CanvasTexture;
  const silhouette = mesurerLaSilhouette(rendu, emprise.w / rendu.width);
  const hasard = alea(GRAINE);

  const lueur = allumerLaLueur(scene, LUEURS.rouge, emprise.w * 2, emprise.h * 1.7, hasard)
    .setPosition(emprise.x + emprise.w / 2, emprise.y + emprise.h / 2)
    .setBelow(image);
  const eclats = scene.add.container(emprise.x, emprise.y).setAbove(image);
  const { rayon, force } = LUMIERES.rouge;
  const eclairage = eclairerLaSilhouette(scene, eclats, rendu.getCanvas(), emprise, {
    rayon: rayon * silhouette.cote,
    force,
  });
  scintiller(scene, eclats, silhouette, hasard, eclairage, ETOILES_ROUGE);

  return {
    setVisible(visible) {
      lueur.setVisible(visible);
      eclats.setVisible(visible);
    },
  };
}

// Le cœur vu de face, ramené à l'écran. Son `cote` est celui d'un carré de même
// aire : les étoiles y gardent la taille et la densité qu'elles avaient sur la
// feuille. Ses points restent à distance du bord, comme sur le recto.
//
// Les pixels sont ceux que Phaser a lus en créant la texture : les relire, c'est
// une deuxième lecture du même canvas, et Chrome s'en plaint dans la console.
function mesurerLaSilhouette(rendu: Phaser.Textures.CanvasTexture, echelle: number): Surface {
  const { width: l, height: h, data } = rendu;
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < l && y < h && data[(y * l + x) * 4 + 3] > 128;

  let aire = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) if (opaque(x, y)) aire++;

  const marge = Math.round(Math.sqrt(aire) * 0.06);
  // Un point par pixel d'écran : le rendu est plus fin que son affichage.
  const pas = Math.max(1, Math.round(1 / echelle));
  const points: Point[] = [];
  for (let y = 0; y < h; y += pas) {
    for (let x = 0; x < l; x += pas) {
      if (
        opaque(x, y) &&
        opaque(x - marge, y) &&
        opaque(x + marge, y) &&
        opaque(x, y - marge) &&
        opaque(x, y + marge)
      ) {
        points.push([x * echelle, y * echelle]);
      }
    }
  }
  const centre: Point = [(l * echelle) / 2, (h * echelle) / 2];
  return {
    cote: Math.sqrt(aire) * echelle,
    point: (hasard) => (points.length ? points[Math.floor(hasard() * points.length)] : centre),
  };
}

// ------------------------------------------------------------------
// Les motifs, imprimés sur le recto
// ------------------------------------------------------------------

// Une bande perpendiculaire à la diagonale haut-gauche → bas-droite, centrée à
// `s` sur cet axe, de demi-largeur `l`.
function bande(s: number, l: number, cote: number): Point[] {
  const u = [Math.SQRT1_2, Math.SQRT1_2];
  const v = [-Math.SQRT1_2, Math.SQRT1_2];
  const L = cote * 2;
  return [
    [u[0] * (s - l) - v[0] * L, u[1] * (s - l) - v[1] * L],
    [u[0] * (s + l) - v[0] * L, u[1] * (s + l) - v[1] * L],
    [u[0] * (s + l) + v[0] * L, u[1] * (s + l) + v[1] * L],
    [u[0] * (s - l) + v[0] * L, u[1] * (s - l) + v[1] * L],
  ];
}

// Des éclats d'or pris dans le papier, ceux de la texture du cœur.
function incruster(g: Phaser.GameObjects.Graphics, geo: GeometrieFeuille, hasard: () => number) {
  const { eclats, poussiere, arete } = incrustationsDOr(
    geo.carre.w,
    () => pointSurLeRecto(geo, hasard),
    hasard,
  );
  for (const { sommets, teinte } of eclats) {
    g.fillStyle(ORS[teinte], 0.95);
    remplir(g, sommets);
    g.lineStyle(arete, ORS[3], 0.9);
    g.lineBetween(sommets[0][0], sommets[0][1], sommets[1][0], sommets[1][1]);
  }
  for (const { x, y, l, h, teinte, alpha } of poussiere) {
    g.fillStyle(ORS[teinte], alpha);
    g.fillRect(x, y, l, h);
  }
}

// Un argent brossé : de courts traits dans le sens du reflet qui passera.
function brosser(g: Phaser.GameObjects.Graphics, geo: GeometrieFeuille, hasard: () => number) {
  const { w } = geo.carre;
  for (let i = 0; i < 70; i++) {
    const [x, y] = pointSurLeRecto(geo, hasard);
    const l = w * (0.05 + hasard() * 0.1);
    g.lineStyle(1, 0xe4ecef, 0.08 + hasard() * 0.14);
    g.lineBetween(x - l / 2, y - l / 2, x + l / 2, y + l / 2);
  }
  for (let i = 0; i < 25; i++) {
    const [x, y] = pointSurLeRecto(geo, hasard);
    g.fillStyle(0xf2f6f8, 0.3 + hasard() * 0.4);
    g.fillCircle(x, y, 0.5 + hasard() * 0.6);
  }
}

// Une veine et son rang dans le réseau : 0 pour les maîtresses, puis leurs
// ramifications, de plus en plus fines.
interface Veine {
  points: Point[];
  rang: number;
}

// Largeur et opacité par rang. Fines dès les maîtresses : épaisses, elles
// faisaient des fissures, pas des veines.
const RANGS = [
  { largeur: 0.8, alpha: 0.95 },
  { largeur: 0.5, alpha: 0.8 },
  { largeur: 0.35, alpha: 0.6 },
] as const;

// Un réseau innervé, comme les nervures d'une feuille ou le filon d'un marbre :
// quelques veines maîtresses qui traversent le papier, et sur chacune des
// ramifications qui partent en biais, elles-mêmes ramifiées. Chacune est une
// marche au hasard, échantillonnée fin et coupée à la feuille.
function tracerVeines(geo: GeometrieFeuille, hasard: () => number): Veine[] {
  const { x, y, w } = geo.carre;
  const veines: Veine[] = [];

  const marcher = (depart: Point, angle: number, rang: number) => {
    const longueur = [70, 22, 9][rang];
    const saut = [1.8, 1.4, 1.1][rang];
    let [px, py] = depart;
    let a = angle;
    const points: Point[] = [];
    for (let i = 0; i < longueur * (0.6 + hasard() * 0.6); i++) {
      points.push([px, py]);
      a += (hasard() - 0.5) * (rang ? 0.6 : 0.35);
      px += Math.cos(a) * saut;
      py += Math.sin(a) * saut;
      if (px < x - 2 || py < y - 2 || px > x + w + 2 || py > y + w + 2) break;
      // Une ramification de temps en temps, du côté qu'elle veut.
      if (rang < 2 && i > 4 && hasard() < [0.09, 0.1][rang]) {
        const cote = hasard() > 0.5 ? 1 : -1;
        marcher([px, py], a + cote * (0.5 + hasard() * 0.6), rang + 1);
      }
    }
    for (const morceau of morceaux(points, (p) => dansLaFeuille(geo, p))) {
      veines.push({ points: morceau, rang });
    }
  };

  // Réparties le long des bords gauche et haut, qu'elles ne partent pas en
  // touffe d'un même coin.
  const MAITRESSES = 4;
  for (let i = 0; i < MAITRESSES; i++) {
    const t = (i + 0.2 + hasard() * 0.6) / MAITRESSES;
    const depuisLeHaut = t > 0.5;
    const depart: Point = depuisLeHaut ? [x + w * (t - 0.5) * 1.6, y] : [x, y + w * (1 - t * 1.8)];
    const angle = depuisLeHaut ? Math.PI / 2 - 0.6 + hasard() * 0.8 : 0.1 + hasard() * 0.7;
    marcher(depart, angle, 0);
  }
  // Les plus fines d'abord : les maîtresses passent par-dessus leurs branches.
  return veines.sort((a, b) => b.rang - a.rang);
}

// Une rainure plutôt qu'un trait : un sillon sombre, l'or dedans, et un fil de
// lumière sur les maîtresses.
function dessinerVeines(g: Phaser.GameObjects.Graphics, veines: Veine[]) {
  const trait = (veine: Veine, largeur: number, teinte: number, alpha: number, dy = 0) => {
    g.lineStyle(largeur, teinte, alpha);
    g.beginPath();
    g.moveTo(veine.points[0][0], veine.points[0][1] + dy);
    for (const [px, py] of veine.points.slice(1)) g.lineTo(px, py + dy);
    g.strokePath();
  };
  for (const veine of veines) {
    const { largeur, alpha } = RANGS[veine.rang];
    trait(veine, largeur + 0.5, 0x0e1f4d, 0.35, 0.5);
    trait(veine, largeur, veine.rang ? ORS[1] : ORS[2], alpha);
    if (veine.rang === 0) trait(veine, 0.35, ORS[3], 0.8, -0.2);
  }
}

// Des facettes en losange, chacune un peu plus claire ou plus sombre que sa
// voisine : c'est l'irrégularité qui fait lire « taillé » plutôt que « quadrillé ».
// La géométrie est tirée d'abord, le dessin se fait sur le recto : les éclats et
// les facettes qui s'allument ont besoin des mêmes formes.
function tailler(geo: GeometrieFeuille, hasard: () => number) {
  const { x, y, w } = geo.carre;
  const pas = w / 4;
  const facettes: { points: Point[]; clair: boolean; force: number }[] = [];
  const sommets: Point[] = [];
  for (let rangee = -1; rangee <= 8; rangee++) {
    for (let col = -1; col <= 4; col++) {
      const cx = x + col * pas + (rangee % 2 ? pas / 2 : 0);
      const cy = y + (rangee * pas) / 2;
      const losange: Point[] = [
        [cx, cy - pas / 2],
        [cx + pas / 2, cy],
        [cx, cy + pas / 2],
        [cx - pas / 2, cy],
      ];
      const points = decouper(losange, geo.feuille);
      if (points.length < 3) continue;
      facettes.push({ points, clair: hasard() > 0.5, force: hasard() });
      for (const sommet of [losange[0], losange[1]]) {
        if (dansLeRecto(geo, sommet)) sommets.push(sommet);
      }
    }
  }
  // Seules les facettes visibles s'allument : le rabat recouvre les autres.
  const visibles = facettes
    .filter((f) => dansLeRecto(geo, centre(f.points)))
    .map((f) => f.points);

  return {
    facettes: visibles,
    sommets,
    dessiner: (g: Phaser.GameObjects.Graphics) => {
      for (const f of facettes) {
        g.fillStyle(f.clair ? 0xffffff : 0x000000, f.clair ? f.force * 0.16 : f.force * 0.1);
        contour(g, f.points);
        g.fillPath();
        g.lineStyle(0.8, 0xf6ecff, 0.3);
        contour(g, f.points);
        g.strokePath();
      }
    },
  };
}

function centre(points: readonly Point[]): Point {
  const n = points.length;
  return [points.reduce((a, p) => a + p[0], 0) / n, points.reduce((a, p) => a + p[1], 0) / n];
}

// ------------------------------------------------------------------
// Les lumières, qui jouent dessus
// ------------------------------------------------------------------

interface Scintillement {
  nombre: number;
  texture: string;
  teintes: readonly number[];
  // En fraction du côté, tirée entre les deux.
  taille: readonly [number, number];
  // Le temps de s'allumer, autant pour s'éteindre.
  duree: number;
  // Le noir entre deux éclats d'une même étoile, tiré entre les deux, en ms.
  pause: readonly [number, number];
  // Là où ils peuvent paraître ; partout sur la surface sinon.
  points?: readonly Point[];
  // Le feu d'un diamant : l'éclat parcourt l'arc-en-ciel pendant qu'il brille,
  // entouré de deux franges aux teintes voisines, un peu plus grandes et
  // décalées d'angle — la lumière décomposée par la taille. `teintes` est alors
  // ignoré.
  irise?: boolean;
}

// Les étoiles d'or de la feuille rouge, que le cœur garde une fois plié.
const ETOILES_ROUGE: Scintillement = {
  nombre: 8,
  texture: ETINCELLE,
  teintes: ETINCELLES_OR,
  taille: [0.2, 0.34],
  duree: 560,
  pause: [200, 1400],
};

// Là où se posent les étoiles : le recto d'une feuille, ou le cœur plié.
interface Surface {
  // La mesure des étoiles et de leur lumière.
  cote: number;
  point(hasard: () => number): Point;
}

// Le tour qu'une étoile fait, en degrés, le temps de s'allumer et de s'éteindre :
// c'est ce qui la fait crépiter plutôt que gonfler.
const ROTATION = 90;

// Des étoiles qui s'allument et s'éteignent, chacune à son rythme, et
// changent de place une fois éteintes.
function scintiller(
  scene: Phaser.Scene,
  feuille: Phaser.GameObjects.Container,
  surface: Surface,
  hasard: () => number,
  eclairage: Eclairage | undefined,
  s: Scintillement,
) {
  const { cote } = surface;
  const placer = (etoile: Phaser.GameObjects.Image) => {
    const [px, py] =
      s.points && s.points.length
        ? s.points[Math.floor(hasard() * s.points.length)]
        : surface.point(hasard);
    etoile.setPosition(px, py);
    if (!s.irise) etoile.setTint(s.teintes[Math.floor(hasard() * s.teintes.length)]);
  };

  const [tmin, tmax] = s.taille;
  const [pmin, pmax] = s.pause;
  for (let i = 0; i < s.nombre; i++) {
    const franges = s.irise
      ? [0, 1].map(() =>
          scene.add.image(0, 0, s.texture).setBlendMode(Phaser.BlendModes.ADD).setScale(0),
        )
      : [];
    const etoile = scene.add.image(0, 0, s.texture).setScale(0);
    placer(etoile);
    feuille.add([...franges, etoile]);
    const source = {};
    let teinte = hasard();
    const echelle = (cote * (tmin + hasard() * (tmax - tmin))) / etoile.width;
    const duree = 2 * s.duree * (0.8 + hasard() * 0.4);
    const pause = pmin + hasard() * (pmax - pmin);
    let depart = hasard() * 90;
    let sens = hasard() > 0.5 ? 1 : -1;
    // Un compteur plutôt qu'un yoyo sur l'objet : le yoyo ramènerait aussi la
    // rotation, et l'étoile ferait l'aller-retour au lieu de tourner.
    const vie = { p: 0 };
    scene.tweens.add({
      targets: vie,
      p: 1,
      duration: duree,
      // Déphasées sur un cycle entier : parties ensemble, elles brilleraient
      // par vagues.
      delay: hasard() * (duree + pause),
      repeatDelay: pause,
      repeat: -1,
      onUpdate: () => {
        const eclat = Math.sin(vie.p * Math.PI);
        const angle = depart + sens * ROTATION * vie.p;
        etoile.setScale(echelle * eclat).setAngle(angle);
        // Un tiers du cercle chromatique parcouru par éclat : assez pour qu'on
        // le voie changer de couleur, pas au point de clignoter.
        const h = (teinte + vie.p * 0.35) % 1;
        if (s.irise) etoile.setTint(spectre(h, SATURATION_DIAMANT));
        franges.forEach((frange, k) => {
          frange
            .setPosition(etoile.x, etoile.y)
            .setScale(echelle * eclat * (1.25 + k * 0.2))
            .setAngle(angle + (k ? 14 : -14))
            .setTint(spectre((h + (k ? 0.12 : -0.12) + 1) % 1, 0.9))
            .setAlpha(0.8 * eclat);
        });
        eclairage?.poser(
          source,
          etoile.x,
          etoile.y,
          eclat,
          s.irise ? spectre(h, SATURATION_DIAMANT) : etoile.tintTopLeft,
        );
      },
      onRepeat: () => {
        placer(etoile);
        teinte = hasard();
        depart = hasard() * 90;
        sens = hasard() > 0.5 ? 1 : -1;
      },
    });
  }
}

// Le papier qui s'allume autour des éclats : une flaque de lumière de la
// couleur de l'éclat, qui monte et retombe avec lui. C'est elle qui fait lire
// « métallisé » — un métal ne brille pas partout, il accroche la lumière là où
// elle tombe. Découpée au contour de la feuille : elle éclaire le papier, pas
// le sol autour.
interface Eclairage {
  // `force` entre 0 et 1 ; une source à 0 s'éteint.
  poser(source: object, x: number, y: number, force: number, teinte: number): void;
}

interface Source {
  x: number;
  y: number;
  force: number;
  teinte: number;
}

// Un dessin par image au plus, quel que soit le nombre de sources qui bougent.
// Un tween et non un écouteur d'`update` : il meurt avec la scène, là où
// l'écouteur survivrait au changement de pièce.
function eclairage(scene: Phaser.Scene, dessiner: (sources: Iterable<Source>) => void): Eclairage {
  const sources = new Map<object, Source>();
  let aDessiner = false;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1000,
    repeat: -1,
    onUpdate: () => {
      if (!aDessiner) return;
      aDessiner = false;
      dessiner(sources.values());
    },
  });

  return {
    poser(source, x, y, force, teinte) {
      sources.set(source, { x, y, force, teinte });
      aDessiner = true;
    },
  };
}

function eclairer(
  scene: Phaser.Scene,
  groupe: Phaser.GameObjects.Container,
  feuille: Phaser.GameObjects.Container,
  geo: GeometrieFeuille,
  reglage: { rayon: number; force: number },
): Eclairage {
  const lumiere = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  feuille.add(lumiere);
  const rayon = geo.carre.w * reglage.rayon;
  // Des disques emboîtés, du plus large au plus serré : un dégradé radial que
  // Phaser ne sait pas remplir d'un coup. À cinq, les anneaux se voyaient.
  const ANNEAUX = 12;
  const COTES = 20;

  return eclairage(scene, (sources) => {
    lumiere.clear();
    if (!groupe.visible) return;
    for (const { x, y, force, teinte } of sources) {
      if (force < 0.02) continue;
      for (let k = ANNEAUX; k >= 1; k--) {
        const r = (rayon * k) / ANNEAUX;
        const disque: Point[] = [];
        for (let c = 0; c < COTES; c++) {
          const a = (c / COTES) * Math.PI * 2;
          disque.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        lumiere.fillStyle(teinte, (reglage.force * force) / ANNEAUX);
        remplir(lumiere, decouper(disque, geo.feuille));
      }
    }
  });
}

// La même lumière sur le cœur plié, dont le contour n'est pas un polygone
// convexe que `decouper` saurait suivre : elle est peinte dans un canvas, puis
// gommée hors du modèle par son propre rendu. `rayon` est ici en pixels.
function eclairerLaSilhouette(
  scene: Phaser.Scene,
  eclats: Phaser.GameObjects.Container,
  rendu: HTMLCanvasElement,
  emprise: Box,
  reglage: { rayon: number; force: number },
): Eclairage {
  // La texture survit au changement de pièce, l'image qui la montrait non.
  if (scene.textures.exists(LUMIERE_COEUR)) scene.textures.remove(LUMIERE_COEUR);
  const texture = scene.textures.createCanvas(
    LUMIERE_COEUR,
    Math.ceil(emprise.w),
    Math.ceil(emprise.h),
  );
  const ctx = texture?.getContext();
  if (!texture || !ctx) return { poser() {} };
  eclats.add(scene.add.image(0, 0, LUMIERE_COEUR).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
  const { rayon } = reglage;

  return eclairage(scene, (sources) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, texture.width, texture.height);
    if (eclats.visible) {
      // Les sources s'additionnent, comme les disques de `eclairer`.
      ctx.globalCompositeOperation = 'lighter';
      for (const { x, y, force, teinte } of sources) {
        if (force < 0.02) continue;
        const { r, g, b } = Phaser.Display.Color.IntegerToRGB(teinte);
        const flaque = ctx.createRadialGradient(x, y, 0, x, y, rayon);
        flaque.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${reglage.force * force})`);
        flaque.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = flaque;
        ctx.fillRect(x - rayon, y - rayon, rayon * 2, rayon * 2);
      }
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(rendu, 0, 0, emprise.w, emprise.h);
    }
    texture.refresh();
  });
}

// L'éclat argenté : un reflet qui balaie la feuille en diagonale, puis se fait
// attendre. Redessiné à chaque image, découpé au contour de la feuille, rabat
// compris : un reflet s'arrête au bord du papier, pas à celui de son recto.
function balayer(
  scene: Phaser.Scene,
  groupe: Phaser.GameObjects.Container,
  feuille: Phaser.GameObjects.Container,
  geo: GeometrieFeuille,
  hasard: () => number,
) {
  const reflet = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  feuille.add(reflet);
  const cote = geo.carre.w;
  const demi = (cote / 2) * Math.SQRT2;
  const course = { p: 0 };

  scene.tweens.add({
    targets: course,
    p: 1,
    duration: 1100,
    delay: hasard() * 1500,
    repeatDelay: 2300,
    repeat: -1,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      reflet.clear();
      if (!groupe.visible) return;
      const s = -demi - cote * 0.3 + course.p * (2 * demi + cote * 0.6);
      reflet.fillStyle(0xffffff, 0.14);
      remplir(reflet, decouper(bande(s, cote * 0.2, cote), geo.feuille));
      reflet.fillStyle(0xffffff, 0.3);
      remplir(reflet, decouper(bande(s, cote * 0.06, cote), geo.feuille));
    },
    onRepeat: () => reflet.clear(),
  });
}

// Une lueur d'or qui court le long d'une veine, puis d'une autre.
function parcourirLesVeines(
  scene: Phaser.Scene,
  feuille: Phaser.GameObjects.Container,
  geo: GeometrieFeuille,
  veines: Veine[],
  hasard: () => number,
  eclairage: Eclairage | undefined,
) {
  // Les morceaux visibles : le rabat recouvre le reste.
  const pistes = veines
    .flatMap((veine) => morceaux(veine.points, (p) => dansLeRecto(geo, p)))
    .filter((piste) => piste.length > 8);
  if (pistes.length === 0) return;

  for (let i = 0; i < 3; i++) {
    const lueur = scene.add
      .image(0, 0, ETINCELLE)
      .setTint(ETINCELLES_OR[i % ETINCELLES_OR.length])
      .setScale(0);
    feuille.add(lueur);
    const taille = (geo.carre.w * 0.28) / lueur.width;
    let piste = pistes[Math.floor(hasard() * pistes.length)];
    const course = { p: 0 };
    scene.tweens.add({
      targets: course,
      p: 1,
      duration: 1600,
      delay: i * 900 + hasard() * 600,
      repeatDelay: 300 + hasard() * 1000,
      repeat: -1,
      onUpdate: () => {
        const k = Math.min(Math.floor(course.p * piste.length), piste.length - 1);
        lueur.setPosition(piste[k][0], piste[k][1]);
        lueur.setScale(taille * Math.sin(course.p * Math.PI));
        lueur.setAngle(course.p * ROTATION);
        eclairage?.poser(lueur, lueur.x, lueur.y, Math.sin(course.p * Math.PI), lueur.tintTopLeft);
      },
      onRepeat: () => {
        piste = pistes[Math.floor(hasard() * pistes.length)];
      },
    });
  }
}

// Des facettes qui s'embrasent une à une, d'un blanc à peine irisé : ce
// qu'on voit en tournant un diamant, avant même les éclats. Six à la fois,
// décalées d'un sixième de cycle : il y en a toujours une qui monte.
function allumerLesFacettes(
  scene: Phaser.Scene,
  groupe: Phaser.GameObjects.Container,
  feuille: Phaser.GameObjects.Container,
  facettes: readonly Point[][],
  hasard: () => number,
) {
  if (facettes.length === 0) return;
  const lueurs = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  feuille.add(lueurs);
  const CYCLE = 1800;
  const FOYERS = 6;
  const graine = Math.floor(hasard() * 1e6);
  // Un tirage par foyer et par cycle, rejouable : la même facette tant que le
  // foyer brûle, une autre au cycle suivant.
  const tirer = (foyer: number, cycle: number) => alea(graine + foyer * 7919 + cycle * 104729);
  const temps = { t: 0 };

  scene.tweens.add({
    targets: temps,
    t: 1,
    duration: CYCLE,
    repeat: -1,
    onUpdate: () => {
      lueurs.clear();
      if (!groupe.visible) return;
      const maintenant = scene.time.now;
      for (let foyer = 0; foyer < FOYERS; foyer++) {
        const t = maintenant + (foyer * CYCLE) / FOYERS;
        const cycle = Math.floor(t / CYCLE);
        const phase = (t % CYCLE) / CYCLE;
        const tirage = tirer(foyer, cycle);
        const facette = facettes[Math.floor(tirage() * facettes.length)];
        // Un blanc à peine teinté : la facette renvoie la lumière, elle ne
        // change pas de couleur.
        const teinte = spectre(tirage(), 0.18);
        lueurs.fillStyle(teinte, 0.22 * Math.sin(phase * Math.PI) ** 2);
        remplir(lueurs, facette);
      }
    },
  });
}

// Une teinte du cercle chromatique, `h` entre 0 et 1, à pleine valeur :
// `saturation` basse pour un blanc irisé, haute pour une frange de couleur.
function spectre(h: number, saturation = 0.55): number {
  const c = Phaser.Display.Color.HSVToRGB(h, saturation, 1) as Phaser.Types.Display.ColorObject;
  return (c.r << 16) | (c.g << 8) | c.b;
}

// ------------------------------------------------------------------
// Géométrie
// ------------------------------------------------------------------

// Le contour de la feuille est convexe, en sens horaire à l'écran : un point
// est dedans s'il est à droite de chaque arête.
function dansLeConvexe(contour: readonly Point[], [px, py]: Point): boolean {
  for (let i = 0; i < contour.length; i++) {
    const [ax, ay] = contour[i];
    const [bx, by] = contour[(i + 1) % contour.length];
    if ((bx - ax) * (py - ay) - (by - ay) * (px - ax) < 0) return false;
  }
  return true;
}

function dansLaFeuille(geo: GeometrieFeuille, p: Point): boolean {
  return dansLeConvexe(geo.feuille, p);
}

// Ce qu'on voit du recto : la feuille, moins le rabat posé dessus.
function dansLeRecto(geo: GeometrieFeuille, p: Point): boolean {
  return dansLaFeuille(geo, p) && !dansLeConvexe(geo.rabat, p);
}

function pointSurLeRecto(geo: GeometrieFeuille, hasard: () => number): Point {
  const { x, y, w } = geo.carre;
  for (let essai = 0; essai < 30; essai++) {
    const p: Point = [x + w * (0.06 + hasard() * 0.88), y + w * (0.06 + hasard() * 0.88)];
    if (dansLeRecto(geo, p)) return p;
  }
  return [x + w * 0.3, y + w * 0.7];
}

// Les suites de points consécutifs qui passent le test.
function morceaux(points: readonly Point[], garder: (p: Point) => boolean): Point[][] {
  const resultat: Point[][] = [];
  let courant: Point[] = [];
  for (const p of points) {
    if (garder(p)) {
      courant.push(p);
      continue;
    }
    if (courant.length > 1) resultat.push(courant);
    courant = [];
  }
  if (courant.length > 1) resultat.push(courant);
  return resultat;
}

// Sutherland–Hodgman : un polygone découpé par un contour convexe.
function decouper(sujet: readonly Point[], contour: readonly Point[]): Point[] {
  let sortie: Point[] = [...sujet];
  for (let i = 0; i < contour.length && sortie.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const cote = (p: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const entree = sortie;
    sortie = [];
    entree.forEach((p, j) => {
      const q = entree[(j + 1) % entree.length];
      const cp = cote(p);
      const cq = cote(q);
      if (cp >= 0) sortie.push(p);
      if (cp >= 0 !== cq >= 0) {
        const t = cp / (cp - cq);
        sortie.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    });
  }
  return sortie;
}

function contour(g: Phaser.GameObjects.Graphics, points: readonly Point[]) {
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (const [px, py] of points.slice(1)) g.lineTo(px, py);
  g.closePath();
}

function remplir(g: Phaser.GameObjects.Graphics, points: readonly Point[]) {
  if (points.length < 3) return;
  contour(g, points);
  g.fillPath();
}

// ------------------------------------------------------------------
// Textures
// ------------------------------------------------------------------

// Peintes une fois pour la partie : les textures survivent au changement de
// pièce.
function peindreTextures(scene: Phaser.Scene) {
  const taille = 64;
  const c = taille / 2;

  if (!scene.textures.exists(HALO)) {
    const texture = scene.textures.createCanvas(HALO, taille, taille);
    const ctx = texture?.getContext();
    if (texture && ctx) {
      const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
      halo.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      halo.addColorStop(0.45, 'rgba(255, 255, 255, 0.35)');
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, taille, taille);
      texture.refresh();
    }
  }

  // L'étincelle : des branches effilées et un cœur minuscule. Un cœur rond et
  // large, ajouté au papier, se lisait comme une boule blanche.
  // Les branches restent épaisses dans la texture : affichée à une vingtaine de
  // pixels, une branche fine y disparaît, et il ne reste que le cœur.
  peindreEtoile(
    scene,
    ETINCELLE,
    [
      [1, 0],
      [0.5, Math.PI / 4],
    ],
    2.8,
    0.08,
  );
  // Le diamant : quatre longues branches, quatre courtes en diagonale.
  peindreEtoile(
    scene,
    DIAMANT,
    [
      [1, 0],
      [0.62, Math.PI / 4],
    ],
    3,
    0.1,
  );
}

// Chaque paire de branches est un losange effilé, `longueur` en fraction du
// rayon, tourné de `angle`. `epaisseur` en pixels de texture, `coeur` en
// fraction du rayon.
function peindreEtoile(
  scene: Phaser.Scene,
  cle: string,
  paires: readonly [number, number][],
  epaisseur: number,
  coeur: number,
) {
  if (scene.textures.exists(cle)) return;
  const taille = 64;
  const c = taille / 2;
  const texture = scene.textures.createCanvas(cle, taille, taille);
  const ctx = texture?.getContext();
  if (!texture || !ctx) return;

  // La lumière tient jusqu'au bout des branches au lieu de s'éteindre au
  // premier quart : c'est la branche qui fait l'étincelle, pas le cœur.
  // Définie autour de l'origine : les branches sont peintes dans le repère
  // déplacé au centre, où un dégradé centré sur (c, c) tomberait dans le coin.
  const lumiere = (ox: number) => {
    const d = ctx.createRadialGradient(ox, ox, 0, ox, ox, c);
    d.addColorStop(0, 'rgba(255, 255, 255, 1)');
    d.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
    d.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
    d.addColorStop(1, 'rgba(255, 255, 255, 0)');
    return d;
  };
  for (const [longueur, angle] of paires) {
    for (const quart of [0, Math.PI / 2]) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angle + quart);
      ctx.fillStyle = lumiere(0);
      ctx.beginPath();
      ctx.moveTo(-c * longueur, 0);
      ctx.lineTo(0, -epaisseur);
      ctx.lineTo(c * longueur, 0);
      ctx.lineTo(0, epaisseur);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = lumiere(c);
  ctx.beginPath();
  ctx.arc(c, c, c * coeur, 0, Math.PI * 2);
  ctx.fill();
  texture.refresh();
}
