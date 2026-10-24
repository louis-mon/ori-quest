import Phaser from 'phaser';
import { canvasDe, finitRetourne } from '../../origami/papier';
import type { Box } from './layout';

// La feuille en primitives, à des teintes données : celles de la salle du trône,
// dont la scène peint elle-même le motif (`motif`, sur le recto, sous le coin
// rabattu) et fait scintiller les éclats. Partout ailleurs, `imprimerFeuille`.
export function dessinerFeuille(
  g: Phaser.GameObjects.Graphics,
  box: Box,
  { recto, verso }: Teintes,
  motif?: (g: Phaser.GameObjects.Graphics, geometrie: GeometrieFeuille) => void,
): Box {
  const geometrie = geometrieFeuille(box);
  const { x, y, w: cote } = geometrie.carre;
  const [[ax, ay], [bx, by], [cx, cy]] = geometrie.rabat;
  const pli = bx - ax;

  const polygone = (points: readonly Point[]) => {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
  };

  // Pas de `clear()` : il effacerait le décalage que `figer()` pose avant.
  g.fillStyle(recto, 1);
  polygone(geometrie.feuille);
  g.fillPath();

  // Sans ce coup de lumière, un aplat sur un carré se lit comme un bloc, surtout
  // en papier métallisé. Phaser ne remplit pas en dégradé : deux polygones à
  // faible opacité font le travail.
  //
  // La coupure suit la diagonale du carré. Calée sur le pli, elle donnait deux
  // moitiés inégales et une brisure au milieu de la feuille. Le clair est en haut
  // à droite, du côté d'où vient la clé du jeu, pour que feuille dépliée et
  // modèle plié soient éclairés du même côté.
  g.fillStyle(0xffffff, 0.14);
  polygone([
    [x, y],
    [ax, ay],
    [bx, by],
    [x + cote, y + cote],
  ]);
  g.fillPath();
  g.fillStyle(0x000000, 0.1);
  polygone([
    [x, y],
    [x + cote, y + cote],
    [x, y + cote],
  ]);
  g.fillPath();

  motif?.(g, geometrie);

  // Le rabat : le dos du papier, puisqu'on le voit à l'envers.
  g.fillStyle(verso, 1);
  polygone(geometrie.rabat);
  g.fillPath();
  // Son ombre du côté de la pliure : c'est ce qui donne son épaisseur au papier.
  g.fillStyle(0x000000, 0.18);
  polygone([
    [ax, ay],
    [cx, cy],
    [ax + pli * 0.28, cy],
  ]);
  g.fillPath();

  // La pliure n'est pas soulignée : c'est un pli, pas une découpe.
  g.lineStyle(1.5, 0x000000, 0.28);
  polygone(geometrie.feuille);
  g.strokePath();
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(cx, cy);
  g.lineTo(bx, by);
  g.strokePath();

  return geometrie.carre;
}

// La feuille sur le papier même du modèle : le canvas que sa texture 3D lit
// (`canvasDe`), recto dans le carré moins le coin, verso dans le coin rabattu.
// Grain, éclats et gemmes y sont ceux qui se plieront ensuite. La lumière, le
// rabat et le contour sont ceux de `dessinerFeuille`.
//
// Composée une fois dans un canvas, à la taille de l'écran : Phaser ne sait pas
// découper une image à un polygone sans masque, le Canvas 2D si.
//
// En canvas et pas en 3D : charger three.js pour un carré de papier condamnerait
// le premier écran du jeu, où rien n'est encore plié.
export function imprimerFeuille(
  scene: Phaser.Scene,
  box: Box,
  modele: string,
): { image: Phaser.GameObjects.Image; carre: Box } {
  const image = scene.add.image(0, 0, '__DEFAULT');
  return { image, carre: imprimerSur(image, box, modele) };
}

// La même, sur une image déjà dans la scène : une touffe de la pâture ne connaît
// sa place qu'une fois rendue, et sa feuille, créée avec elle, garde ainsi son
// rang dans le décor.
export function imprimerSur(image: Phaser.GameObjects.Image, box: Box, modele: string): Box {
  const geometrie = geometrieFeuille(box);
  const { x, y, w: cote } = geometrie.carre;
  const cle = `feuille:${modele}:${cote}`;
  const { textures } = image.scene;
  if (!textures.exists(cle)) textures.addCanvas(cle, composer(geometrie, modele));
  // La marge de `composer`, pour que le carré retombe sur le plan.
  image
    .setTexture(cle)
    .setOrigin(0)
    .setPosition(x - MARGE_TRAIT, y - MARGE_TRAIT);
  return geometrie.carre;
}

// Le contour déborde du carré de la moitié de son épaisseur.
const MARGE_TRAIT = 2;

function composer(geometrie: GeometrieFeuille, modele: string): HTMLCanvasElement {
  const { recto, verso } = canvasDe(modele);
  const { carre, feuille, rabat } = geometrie;
  const { x, y, w: cote } = carre;
  const [a, b, c] = rabat;
  const pli = b[0] - a[0];

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(cote + 2 * MARGE_TRAIT);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // Tout se trace dans les coordonnées du plan, comme `dessinerFeuille`.
  ctx.translate(MARGE_TRAIT - x, MARGE_TRAIT - y);

  const trace = (points: readonly Point[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) ctx.lineTo(px, py);
    ctx.closePath();
  };
  // Retourné de haut en bas : c'est ainsi que la couche de pliage montre la
  // feuille à plat au premier instant (constaté sur les gemmes de la couronne).
  // Droit, les gemmes changeaient de place quand le pliage prenait le relais.
  // Sauf si le pliage part retourné : son demi-tour redresse l'image.
  const droit = finitRetourne(modele);
  const imprimer = (papier: HTMLCanvasElement) => {
    ctx.save();
    ctx.translate(x, droit ? y : y + cote);
    ctx.scale(1, droit ? 1 : -1);
    ctx.drawImage(papier, 0, 0, cote, cote);
    ctx.restore();
  };

  ctx.save();
  trace(feuille);
  ctx.clip();
  imprimer(recto);
  // Le coup de lumière de `dessinerFeuille`, et pour la même raison.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  trace([[x, y], a, b, [x + cote, y + cote]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  trace([
    [x, y],
    [x + cote, y + cote],
    [x, y + cote],
  ]);
  ctx.fill();
  ctx.restore();

  // Le coin rabattu montre le dos de ce même coin, retourné autour de la
  // pliure : la symétrie par rapport à la droite (a, b), à 45°, qui envoie le
  // coin du carré sur c.
  ctx.save();
  trace(rabat);
  ctx.clip();
  ctx.save();
  ctx.transform(0, 1, 1, 0, a[0] - a[1], a[1] - a[0]);
  imprimer(verso);
  ctx.restore();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  trace([a, c, [a[0] + pli * 0.28, c[1]]]);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  trace(feuille);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();

  return canvas;
}

export interface Teintes {
  recto: number;
  verso: number;
}

// Sutherland–Hodgman : un polygone découpé par un contour convexe, en sens
// horaire à l'écran comme ceux de `geometrieFeuille`.
export function decouper(sujet: readonly Point[], contour: readonly Point[]): Point[] {
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

export type Point = readonly [number, number];

export interface GeometrieFeuille {
  carre: Box;
  // Le carré MOINS le coin, puisque celui-ci s'est rabattu : c'est ce manque qui
  // fait tout. Un triangle de verso posé sur un carré entier ressemblait à une
  // décoration collée, pas à un pli.
  feuille: readonly Point[];
  // Le coin rabattu, posé sur la feuille : les deux extrémités de la pliure,
  // puis le point où il retombe.
  rabat: readonly [Point, Point, Point];
}

// Carrée, comme toute feuille d'origami. Elle occupe le bas de son emprise : la
// boîte du plan est dimensionnée pour ce que la feuille deviendra, souvent bien
// plus haut qu'un carré posé au sol.
export function geometrieFeuille(box: Box): GeometrieFeuille {
  const cote = Math.min(box.w, box.h);
  const x = box.x + (box.w - cote) / 2;
  const y = box.y + box.h - cote;

  // En haut à droite. `pli` est la longueur du côté rabattu.
  const pli = Math.round(cote * 0.24);
  const a: Point = [x + cote - pli, y];
  const b: Point = [x + cote, y + pli];
  // Le triangle étant rectangle et isocèle, le symétrique du coin tombe
  // exactement en (ax, by).
  const c: Point = [a[0], b[1]];

  return {
    carre: { x, y, w: cote, h: cote },
    feuille: [[x, y], a, b, [x + cote, y + cote], [x, y + cote]],
    rabat: [a, b, c],
  };
}

// Une feuille qui doit pouvoir se déplacer — celle de l'os, suspendue puis
// tombée. Le dessin est le même ; il vit dans un conteneur posé au centre du
// carré, donc en coordonnées locales, et c'est le conteneur que `deplacer()`
// emmène. Dessinée à ses coordonnées du plan, la feuille ne saurait que sauter
// d'un endroit à l'autre.
export interface FeuilleMobile {
  // Ce qu'on donne à `deplacer()`, et ce qu'on montre ou cache.
  conteneur: Phaser.GameObjects.Container;
  // L'emprise réelle, qui suit le conteneur : c'est elle, et pas la boîte du
  // plan, qui doit servir de zone tactile une fois la feuille tombée.
  emprise(): Box;
}

export function poserFeuille(scene: Phaser.Scene, box: Box, modele: string): FeuilleMobile {
  const { image, carre } = imprimerFeuille(scene, box, modele);
  const depart = { x: carre.x + carre.w / 2, y: carre.y + carre.h / 2 };

  // L'image est placée en coordonnées du plan : on la décale d'autant pour
  // qu'elle retombe au bon endroit une fois le conteneur posé sur le centre.
  image.setPosition(image.x - depart.x, image.y - depart.y);
  const conteneur = scene.add.container(depart.x, depart.y, [image]);

  return {
    conteneur,
    emprise: () => ({
      x: carre.x + conteneur.x - depart.x,
      y: carre.y + conteneur.y - depart.y,
      w: carre.w,
      h: carre.h,
    }),
  };
}
