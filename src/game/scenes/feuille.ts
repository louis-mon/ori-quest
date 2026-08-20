import Phaser from 'phaser';
import { teintesDe } from '../../origami/papier';
import type { Box } from './layout';

/**
 * Une feuille d'origami encore dépliée, posée dans le décor.
 *
 * **Carrée**, comme toute feuille d'origami — c'est la seule forme dont on part,
 * et un rectangle quelconque ne se lit pas comme du papier à plier. Elle occupe
 * le bas de son emprise : la boîte du plan est dimensionnée pour ce que la
 * feuille *deviendra*, souvent bien plus haut qu'un carré posé au sol.
 *
 * Elle prend la **teinte du recto du modèle** qu'elle deviendra
 * (`teintesDe`) : la grande feuille du vieil arbre est verte parce que l'arbre
 * plié l'est, le papier de la hache est métallisé parce que la lame le sera.
 * Rien n'est choisi ici — la matière vient du même endroit que la texture 3D,
 * donc le pliage ne change pas de matériau en cours de route.
 *
 * Dessinée en primitives et pas en 3D, volontairement : charger three.js pour
 * un carré de papier condamnerait le premier écran du jeu, où la feuille du
 * pont est déjà là et où rien n'est encore plié.
 */
export function dessinerFeuille(
  g: Phaser.GameObjects.Graphics,
  box: Box,
  modele: string,
): Box {
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
  // …et le point où le coin retombe : le sommet du carré, retourné de l'autre
  // côté de la pliure. Le triangle du coin étant rectangle et isocèle, ce
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

  // La feuille : le carré **moins** le coin, puisque celui-ci s'est rabattu.
  // C'est ce manque qui fait tout — un simple triangle de verso posé sur un
  // carré entier ressemblait à une décoration collée, pas à un pli.
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

  // Un coup de lumière très léger. Sans lui, un aplat de couleur sur un carré ne
  // se lit pas comme du papier mais comme un bloc — c'est surtout vrai du papier
  // métallisé, dont tout l'intérêt est de renvoyer la lumière. Phaser ne sait
  // pas remplir en dégradé : deux polygones à faible opacité font le travail.
  //
  // La coupure suit la **diagonale du carré**, d'un coin à l'autre. Calée sur le
  // pli, elle donnait deux moitiés très inégales et une brisure au milieu de la
  // feuille : on ne voyait plus une feuille éclairée mais deux morceaux de
  // couleurs différentes. La diagonale, elle, ne se voit pas — elle se ressent.
  //
  // Le clair est en haut à droite, du côté d'où vient la lumière du jeu (la clé
  // est en (2, 4, 3), voir `eclairer`), pour que la feuille dépliée et le modèle
  // plié soient éclairés du même côté.
  g.fillStyle(0xffffff, 0.14);
  polygone([[x, y], [ax, ay], [bx, by], [x + cote, y + cote]]);
  g.fillPath();
  g.fillStyle(0x000000, 0.1);
  polygone([[x, y], [x + cote, y + cote], [x, y + cote]]);
  g.fillPath();

  // Le rabat, par-dessus : le dos du papier, forcément, puisqu'on le voit à
  // l'envers.
  g.fillStyle(verso, 1);
  polygone([[ax, ay], [bx, by], [cx, cy]]);
  g.fillPath();
  // Il porte sa propre ombre du côté de la pliure : c'est ce qui le décolle de
  // la feuille et donne son épaisseur au papier.
  g.fillStyle(0x000000, 0.18);
  polygone([[ax, ay], [cx, cy], [ax + pli * 0.28, cy]]);
  g.fillPath();

  // Contours : la feuille entière, puis les deux bords libres du rabat. La
  // pliure elle-même n'est pas soulignée — c'est un pli, pas une découpe.
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
