import Phaser from 'phaser';
import { COLORS } from '../config';

/**
 * Le marqueur de hotspot : la cocotte en papier — le modèle **poule**, pas la
 * salière à quatre volets qu'on manipule au bout des doigts. Les deux portent le
 * même nom ; c'est la poule qu'on veut, sa silhouette est bien plus lisible en
 * petit.
 *
 * Sur écran tactile il n'y a pas de survol, donc rien n'indique qu'un élément
 * est actif. Ce marqueur remplace le curseur qui change de forme. Il est dessiné
 * une fois dans une texture puis réutilisé par tous les hotspots : c'est un seul
 * draw call, et les instances restent animables indépendamment.
 *
 * Voir game-design/03-langage-visuel.md — la cocotte signale « ici, on analyse »,
 * par opposition à la flèche qui signale « ici, on change de scène ».
 */

export const COCOTTE_TEXTURE = 'hotspot-cocotte';

/**
 * Point de remplacement du marqueur : déposer un dessin dans
 * `src/assets/ui/cocotte.png` et il est utilisé partout, sans toucher au code.
 *
 * La détection se fait à la compilation via `import.meta.glob` — le motif ne
 * correspond à rien tant que le fichier n'existe pas, et aucune requête n'est
 * tentée. Charger l'image « au cas où » déclenchait une 404/500 et deux erreurs
 * de console à chaque démarrage, pour une absence pourtant parfaitement normale.
 *
 * Format attendu : PNG à fond transparent, ~80×80, la poule tournée vers la
 * gauche.
 */
const overrides = import.meta.glob<{ default: string }>('../../assets/ui/cocotte.png', {
  eager: true,
});
const COCOTTE_URL: string | undefined = Object.values(overrides)[0]?.default;

/** À appeler dans le `preload()` d'une scène. Sans dessin fourni, ne fait rien. */
export function preloadCocotte(scene: Phaser.Scene): void {
  if (COCOTTE_URL) scene.load.image(COCOTTE_TEXTURE, COCOTTE_URL);
}

/**
 * Silhouette de profil, tournée vers la gauche, dans une boîte de 40×40.
 *
 * Ce qui rend la forme reconnaissable en tout petit, ce sont les deux pointes —
 * le bec en haut à gauche, la queue en haut à droite — de part et d'autre d'un
 * corps compact. Les détails intermédiaires disparaissent à l'écran ; ces deux
 * pointes, non.
 */
const BOX = 40;

/**
 * Marge autour de la silhouette, pour loger le détourage.
 *
 * La texture grandit, la poule non : les points restent tracés à leur taille,
 * simplement décalés. Sans cette marge, le contour serait rogné par le bord de
 * la texture et la poule perdrait son bec d'un côté.
 */
const MARGE = 5;

/** Épaisseur du détourage, en fraction de la silhouette. */
const DETOURAGE = 0.14;

/**
 * La forme est composée de deux masses qui se recouvrent, pas d'un contour
 * unique. Tracé d'un seul tenant, tête et queue montaient à la même hauteur et
 * l'ensemble se lisait comme une masse à deux pointes, jamais comme une poule.
 *
 * Ici le cou part franchement en diagonale au-dessus du corps : c'est ce
 * décrochement qui fait la lecture.
 */
const BODY = [
  { x: 11, y: 21 }, // poitrail
  { x: 25, y: 17 }, // dos
  { x: 37, y: 10 }, // pointe de la queue
  { x: 31, y: 23 }, // dessous de la queue
  { x: 28, y: 31 }, // croupion
  { x: 19, y: 35 }, // ventre arrière
  { x: 11, y: 32 }, // ventre avant
];

const HEAD = [
  { x: 18, y: 20 }, // attache du cou, côté dos
  { x: 12, y: 3 }, // sommet de la tête
  { x: 3, y: 10 }, // bec
  { x: 12, y: 23 }, // attache du cou, côté poitrail
];

interface Point {
  x: number;
  y: number;
}

/** Centre d'un nuage de points, autour duquel on dilate le détourage. */
function centreDe(points: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Trace un polygone, éventuellement dilaté autour d'un centre commun. */
function tracer(
  g: Phaser.GameObjects.Graphics,
  points: Point[],
  facteur: number,
  centre: Point,
) {
  const p = (i: number) => ({
    x: MARGE + centre.x + (points[i].x - centre.x) * facteur,
    y: MARGE + centre.y + (points[i].y - centre.y) * facteur,
  });
  g.beginPath();
  const d = p(0);
  g.moveTo(d.x, d.y);
  for (let i = 1; i < points.length; i++) {
    const q = p(i);
    g.lineTo(q.x, q.y);
  }
  g.closePath();
}

/**
 * Le détourage : la silhouette redessinée en sombre, un peu dilatée, sous le
 * marqueur.
 *
 * Un marqueur clair posé sur un décor clair — la feuille de papier, la rive au
 * soleil — devenait invisible, alors qu'il est le seul signe qui dise « ici, on
 * peut agir ». Le contour lui donne un fond quel que soit ce qu'il y a derrière.
 *
 * Dilaté autour d'un centre **commun** à toutes les parties, et non de chacune :
 * chaque partie garde ainsi sa place dans l'ensemble, là où des dilatations
 * indépendantes les écarteraient les unes des autres et casseraient la forme.
 */
function detourer(
  g: Phaser.GameObjects.Graphics,
  parties: Point[][],
  silhouette: Point[],
) {
  const centre = centreDe(silhouette);
  const facteur = 1 + DETOURAGE;
  g.fillStyle(COLORS.ink, 0.85);
  for (const partie of parties) {
    tracer(g, partie, facteur, centre);
    g.fillPath();
  }
}

/** L'aile, posée par-dessus : le seul pli qu'on garde à cette taille. */
const WING = [
  { x: 16, y: 21 },
  { x: 27, y: 20 },
  { x: 25, y: 29 },
  { x: 17, y: 29 },
];

export function ensureCocotteTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(COCOTTE_TEXTURE)) return;

  const g = scene.add.graphics();
  const silhouette = [...BODY, ...HEAD];

  detourer(g, [BODY, HEAD], silhouette);

  const poly = (points: Point[], alpha: number) => {
    g.fillStyle(COLORS.glow, alpha);
    tracer(g, points, 1, centreDe(silhouette));
    g.fillPath();
  };

  // Corps et tête à la même opacité : ils fusionnent en une seule silhouette.
  // Des volets d'opacités différentes produisaient une bouillie illisible dès
  // qu'on descendait sous ~30 px. L'aile est le seul contraste conservé.
  poly(BODY, 0.92);
  poly(HEAD, 0.92);
  poly(WING, 0.45);

  g.generateTexture(COCOTTE_TEXTURE, BOX + MARGE * 2, BOX + MARGE * 2);
  g.destroy();
}

/**
 * Pose un marqueur animé. Le battement lent doit rester discret : il signale
 * sans réclamer l'attention, sinon une scène à cinq hotspots clignote de partout.
 */
export function createHotspotMarker(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Image {
  ensureCocotteTexture(scene);

  const marker = scene.add.image(x, y, COCOTTE_TEXTURE).setDepth(50);

  scene.tweens.add({
    targets: marker,
    scale: { from: 0.72, to: 1 },
    alpha: { from: 0.4, to: 0.9 },
    angle: { from: -8, to: 8 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return marker;
}
