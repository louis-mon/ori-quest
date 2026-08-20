import Phaser from 'phaser';
import { COLORS } from '../config';

/**
 * Le marqueur de sortie : un pli de papier qui pointe.
 *
 * Deux signes, deux fonctions (game-design/03-langage-visuel.md) : la cocotte
 * dit « ici, on analyse », la flèche dit « ici, on change de scène ». Ils ne
 * doivent jamais se confondre, d'où trois écarts délibérés avec la cocotte —
 * la **couleur** (papier clair, pas le jaune chaud), la **forme** (deux volets
 * anguleux, pas une silhouette), et le **mouvement** (une dérive latérale
 * souple, pas un battement sur place).
 *
 * C'est un pli, pas une flèche d'interface : le volet du bas est plus sombre,
 * comme une feuille repliée qui prend la lumière d'un seul côté.
 */

export const FLECHE_TEXTURE = 'exit-pli';

const BOX = 44;

/**
 * Marge autour du pli, pour loger le détourage — la texture grandit, le pli
 * non. Voir `hotspot-marker.ts`, même raison et même mesure.
 */
const MARGE = 5;

/** Épaisseur du détourage, en fraction de la silhouette. */
const DETOURAGE = 0.16;

/** Volet supérieur, éclairé. Pointe vers la droite ; on le retourne au besoin. */
const VOLET_HAUT = [
  { x: 8, y: 6 },
  { x: 38, y: 22 },
  { x: 8, y: 22 },
];

/** Volet inférieur, dans l'ombre du pli. */
const VOLET_BAS = [
  { x: 8, y: 22 },
  { x: 38, y: 22 },
  { x: 8, y: 38 },
];

interface Point {
  x: number;
  y: number;
}

const SILHOUETTE = [...VOLET_HAUT, ...VOLET_BAS];

function centreDe(points: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

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

function ensureFlecheTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FLECHE_TEXTURE)) return;

  const g = scene.add.graphics();
  const centre = centreDe(SILHOUETTE);

  // Le détourage : le pli redessiné en sombre et un peu dilaté, en dessous. Un
  // pli de papier clair sur une rive claire disparaissait, et c'est la seule
  // promesse de passage que la scène fasse au joueur. Dilaté autour d'un centre
  // commun aux deux volets, sinon ils s'écartent l'un de l'autre et le pli
  // s'ouvre en deux morceaux.
  g.fillStyle(COLORS.ink, 0.85);
  for (const volet of [VOLET_HAUT, VOLET_BAS]) {
    tracer(g, volet, 1 + DETOURAGE, centre);
    g.fillPath();
  }

  const poly = (points: Point[], couleur: number, alpha: number) => {
    g.fillStyle(couleur, alpha);
    tracer(g, points, 1, centre);
    g.fillPath();
  };

  poly(VOLET_HAUT, COLORS.paper, 0.95);
  poly(VOLET_BAS, COLORS.paperDark, 0.95);

  g.generateTexture(FLECHE_TEXTURE, BOX + MARGE * 2, BOX + MARGE * 2);
  g.destroy();
}

/**
 * Pose une flèche animée. `sens` vaut 1 vers la droite, -1 vers la gauche.
 *
 * La dérive est volontairement courte (6 px) et lente : sur un bord d'écran,
 * un mouvement ample attire l'œil hors du décor, ce que le langage visuel du
 * jeu refuse — le marqueur signale, il ne réclame pas.
 */
export function createExitMarker(
  scene: Phaser.Scene,
  x: number,
  y: number,
  sens: 1 | -1,
): Phaser.GameObjects.Image {
  ensureFlecheTexture(scene);

  const marker = scene.add.image(x, y, FLECHE_TEXTURE).setDepth(50).setFlipX(sens < 0);

  scene.tweens.add({
    targets: marker,
    x: { from: x - 6 * sens, to: x + 6 * sens },
    alpha: { from: 0.55, to: 0.95 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return marker;
}
