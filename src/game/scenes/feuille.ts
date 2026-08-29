import Phaser from 'phaser';
import { teintesDe } from '../../origami/papier';
import type { Box } from './layout';

// Carrée, comme toute feuille d'origami. Elle occupe le bas de son emprise : la
// boîte du plan est dimensionnée pour ce que la feuille deviendra, souvent bien
// plus haut qu'un carré posé au sol.
//
// Sa teinte vient du recto du modèle qu'elle deviendra (`teintesDe`), donc de la
// même source que la texture 3D : le pliage ne change pas de matériau en route.
//
// En primitives et pas en 3D : charger three.js pour un carré de papier
// condamnerait le premier écran du jeu, où rien n'est encore plié.
export function dessinerFeuille(g: Phaser.GameObjects.Graphics, box: Box, modele: string): Box {
  const { recto, verso } = teintesDe(modele);
  const cote = Math.min(box.w, box.h);
  const x = box.x + (box.w - cote) / 2;
  const y = box.y + box.h - cote;

  // Le coin replié, en haut à droite. `pli` est la longueur du côté rabattu.
  const pli = Math.round(cote * 0.24);
  // Les deux extrémités de la pliure…
  const ax = x + cote - pli;
  const ay = y;
  const bx = x + cote;
  const by = y + pli;
  // …et le point où le coin retombe. Le triangle étant rectangle et isocèle, ce
  // symétrique tombe exactement en (ax, by).
  const cx = ax;
  const cy = by;

  const polygone = (points: number[][]) => {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
  };

  g.clear();

  // Le carré MOINS le coin, puisque celui-ci s'est rabattu : c'est ce manque qui
  // fait tout. Un triangle de verso posé sur un carré entier ressemblait à une
  // décoration collée, pas à un pli.
  const feuille = [
    [x, y],
    [ax, ay],
    [bx, by],
    [x + cote, y + cote],
    [x, y + cote],
  ];
  g.fillStyle(recto, 1);
  polygone(feuille);
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

  // Le rabat : le dos du papier, puisqu'on le voit à l'envers.
  g.fillStyle(verso, 1);
  polygone([
    [ax, ay],
    [bx, by],
    [cx, cy],
  ]);
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
  polygone(feuille);
  g.strokePath();
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(cx, cy);
  g.lineTo(bx, by);
  g.strokePath();

  return { x, y, w: cote, h: cote };
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
  const dessin = scene.add.graphics();
  const carre = dessinerFeuille(dessin, box, modele);
  const depart = { x: carre.x + carre.w / 2, y: carre.y + carre.h / 2 };

  // Le tracé est en coordonnées du plan : on décale le graphique d'autant pour
  // qu'il retombe au bon endroit une fois le conteneur posé sur le centre.
  dessin.setPosition(-depart.x, -depart.y);
  const conteneur = scene.add.container(depart.x, depart.y, [dessin]);

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
