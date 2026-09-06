import Phaser from 'phaser';
import { dessinerFeuille } from './feuille';
import { alea } from './hasard';
import type { Box, PlanSurface } from './layout';
import { poserOrigami, type OrigamiDecor } from './origami-decor';

// Le terrain qui reverdit une fois l'herbe pliée : des feuilles apparaissent en
// fondu sur la surface tracée dans Tiled, puis se plient en touffes.
//
// Chaque touffe est le modèle `herbe` rendu en 3D, comme celle du hotspot et pas
// un dessin qui lui ressemble. Le rendu est mutualisé — `apercuOrigami` mémorise
// sa promesse — donc tout le semis ne coûte qu'une image.

const MODELE = 'herbe';

// De quoi couvrir le terrain sans en faire une pelouse : ce sont des touffes, et
// le vide entre elles se voit autant qu'elles.
const TOUFFES = 26;

// Hauteur d'une touffe, en fraction de la hauteur du terrain. La touffe du
// hotspot fait 118 px : les semées restent nettement en dessous, sinon on ne
// sait plus laquelle est celle qu'on peut examiner.
const TAILLE_MIN = 0.14;
const TAILLE_ETENDUE = 0.16;

// Part de la taille qui vient de la profondeur plutôt que du hasard : à taille
// purement tirée, les touffes du fond et celles du bord se valent et le terrain
// s'aplatit.
const PART_PROFONDEUR = 0.6;

// Tirages avant d'accepter un pied hors du tracé. Largement de quoi tomber dans
// la forme d'un pré ; au-delà, un peu d'herbe qui déborde vaut mieux qu'une
// touffe manquante.
const ESSAIS = 20;

// En millisecondes. Le semis part du fond vers l'avant : toutes les touffes
// ensemble, c'est un fondu de calque, et le pliage ne se voit plus.
const DECALAGE = 45;
const FONDU = 240;
// Le temps de voir la feuille avant qu'elle bouge.
const ATTENTE = 100;
const PLIAGE = 260;

// Ce qui reste de la hauteur d'une touffe quand son pliage commence : elle se
// dresse depuis son pied, comme une pousse.
const NAISSANCE = 0.45;

export interface SemisHerbe {
  // Le drapeau était déjà levé en entrant : les touffes sont là, sans rien
  // rejouer.
  poser(): void;
  // Il vient de se lever : les feuilles arrivent, puis se plient.
  jouer(): void;
  // La vache broute, et le terrain s'en va avec la touffe du hotspot.
  //
  // ⚠ Ne déclenche aucun rendu, contrairement au `montrer()` d'un origami de
  // décor : `onStateChange()` passe avant le déclencheur d'`auLeverDe()`, et un
  // rendu lancé là poserait tout le semis d'un coup au lieu de le jouer.
  montrer(visible: boolean): void;
}

interface Touffe {
  origami: OrigamiDecor;
  feuille: Phaser.GameObjects.Graphics;
}

// Tout est tiré dans le terrain, donc le déplacer dans Tiled emmène le semis.
// Son épaisseur et le nombre de touffes sont une décision de dessin et vivent
// ici : on ne pose pas un repère de plan par touffe.
export function semerHerbe(
  scene: Phaser.Scene,
  terrain: PlanSurface,
  graine: number,
  nombre = TOUFFES,
): SemisHerbe {
  const hasard = alea(graine);
  const contour = terrain.points
    ? new Phaser.Geom.Polygon(terrain.points.flatMap(([x, y]) => [x, y]))
    : undefined;

  const places = [];
  for (let i = 0; i < nombre; i++) {
    const pied = tirerUnPied(terrain, contour, hasard);
    const profondeur = (pied.y - terrain.y) / terrain.h;
    const vigueur = PART_PROFONDEUR * profondeur + (1 - PART_PROFONDEUR) * hasard();
    places.push({
      ...pied,
      hauteur: terrain.h * (TAILLE_MIN + vigueur * TAILLE_ETENDUE),
      // Le même pliage vu des deux côtés : sans ça, vingt-six touffes penchent
      // toutes du même bord et le semis se lit comme une frise.
      miroir: hasard() < 0.5,
    });
  }

  // Du fond vers l'avant : la profondeur du décor est l'ordre de création, donc
  // une touffe lointaine tirée en dernier se dessinerait par-dessus une proche.
  // C'est aussi l'ordre dans lequel le semis se joue.
  places.sort((a, b) => a.y - b.y);

  const touffes: Touffe[] = [];
  let seme = false;
  let anime = false;

  places.forEach((place, rang) => {
    const box: Box = {
      x: place.x - place.hauteur / 2,
      y: place.y - place.hauteur,
      w: place.hauteur,
      h: place.hauteur,
    };
    const feuille = scene.add.graphics().setVisible(false);
    const origami = poserOrigami(scene, MODELE, box, (emprise) => {
      if (!anime) return;
      // L'emprise réelle, et pas la boîte : la feuille doit tenir sous la touffe
      // qui la remplace, pas sous la place qu'on lui avait réservée.
      dessinerFeuille(feuille, emprise, MODELE);
      plier(scene, { origami, feuille }, rang);
    });
    origami.image.setFlipX(place.miroir);
    touffes.push({ origami, feuille });
  });

  return {
    poser() {
      seme = true;
      for (const { origami } of touffes) origami.montrer(true);
    },
    jouer() {
      seme = true;
      anime = true;
      for (const { origami } of touffes) origami.montrer(true);
    },
    montrer(visible) {
      for (const { origami, feuille } of touffes) {
        origami.image.setVisible(visible && seme);
        if (!visible) feuille.setVisible(false);
      }
    },
  };
}

// Le pied de la touffe. Sur un repère tracé au polygone, les tirages hors du
// tracé sont rejetés plutôt que semés dans la boîte englobante — ses coins
// tombent en dehors du terrain que la carte dessine.
function tirerUnPied(
  terrain: Box,
  contour: Phaser.Geom.Polygon | undefined,
  hasard: () => number,
): { x: number; y: number } {
  let pied = { x: terrain.x + terrain.w / 2, y: terrain.y + terrain.h / 2 };
  for (let essai = 0; essai < ESSAIS; essai++) {
    pied = { x: terrain.x + hasard() * terrain.w, y: terrain.y + hasard() * terrain.h };
    if (!contour || Phaser.Geom.Polygon.Contains(contour, pied.x, pied.y)) break;
  }
  return pied;
}

// La feuille apparaît, se tient un instant, puis s'efface pendant que la touffe
// se dresse : le même échange que dans le récit, la feuille qu'on plie et le
// modèle qui prend sa place.
function plier(scene: Phaser.Scene, touffe: Touffe, rang: number): void {
  const { feuille } = touffe;
  const image = touffe.origami.image;
  // L'échelle posée par `poserOrigami` une fois le rendu arrivé : c'est elle
  // qu'on retrouve à la fin du pliage.
  const echelle = image.scaleY;
  const debut = rang * DECALAGE;

  feuille.setAlpha(0).setVisible(true);
  image.setAlpha(0).setScale(echelle, echelle * NAISSANCE);

  scene.tweens.add({
    targets: feuille,
    alpha: 1,
    duration: FONDU,
    delay: debut,
    ease: 'Sine.easeOut',
  });
  scene.tweens.add({
    targets: feuille,
    alpha: 0,
    duration: PLIAGE,
    delay: debut + FONDU + ATTENTE,
    ease: 'Sine.easeIn',
    onComplete: () => feuille.setVisible(false),
  });
  scene.tweens.add({
    targets: image,
    alpha: 1,
    scaleY: echelle,
    duration: PLIAGE,
    delay: debut + FONDU + ATTENTE,
    ease: 'Sine.easeOut',
  });
}
