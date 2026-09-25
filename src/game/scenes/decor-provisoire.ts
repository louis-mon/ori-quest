import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import type { Box } from './layout';

// Le décor des scènes dont le fond n'est pas encore peint. Il tient la place, et
// **il doit se voir comme provisoire** : des aplats francs, une mention en clair,
// jamais un dessin qui prétendrait au fond définitif. C'est le même travers que
// les graphismes « qui ressemblent » aux pliages — on finit par ajuster les zones
// tactiles sur une image que personne ne livrera.
//
// Le jour où l'artiste livre le fond, il entre par un calque image de classe
// `fond` dans la carte Tiled (voir `fond.ts`), et l'appel disparaît de la scène :
// les boîtes du plan, elles, ne bougent pas.

// Les mêmes profondeurs que `fond.ts` : sous le décor, au-dessus du ciel.
const PROFONDEUR = -5;

// Terre et herbe rase, sans détail : ce qui compte est de savoir où est le sol.
const SOL_PROCHE = 0x9d8a63;
const SOL_LOINTAIN = 0xb6a67f;
const HORIZON = 0x6f6046;

// Ce qui se dresse au fond — un rempart, une masse de village.
const MASSE = 0x8d8578;
const MASSE_CRETE = 0xa9a094;
// Une ouverture est un trou, pas une porte : sombre et sans battant.
const CREUX = 0x2a2622;

// Ce qui repose sur le sol — un trône, un fourneau, un banc. Un ton de bois
// plutôt que le gris des masses : du même gris, un meuble posé devant un mur se
// fondait dedans.
const MEUBLE = 0x7a6246;
const MEUBLE_DESSUS = 0x98805f;

// Un bassin : sa margelle et l'eau, deux aplats.
const MARGELLE = 0xb3aea4;
const EAU = 0x6d9cb5;

export interface PlanProvisoire {
  // Le sol, tel que le plan le donne : son bord haut est l'horizon.
  sol: Box;
  // Les masses du fond, du plus loin au plus près.
  masses?: readonly Box[];
  // Les ouvertures creusées dedans.
  creux?: readonly Box[];
  // Posés sur le sol, donc dessinés après lui.
  meubles?: readonly Box[];
  eaux?: readonly Box[];
}

export function dessinerDecorProvisoire(scene: Phaser.Scene, plan: PlanProvisoire): void {
  const g = scene.add.graphics().setDepth(PROFONDEUR);

  for (const masse of plan.masses ?? []) {
    g.fillStyle(MASSE, 1);
    g.fillRect(masse.x, masse.y, masse.w, masse.h);
    // Une crête claire : sans elle, la masse et le sol se touchent en un seul
    // aplat et la scène n'a plus de profondeur du tout.
    g.fillStyle(MASSE_CRETE, 1);
    g.fillRect(masse.x, masse.y, masse.w, 10);
  }

  for (const creux of plan.creux ?? []) {
    g.fillStyle(CREUX, 1);
    g.fillRect(creux.x, creux.y, creux.w, creux.h);
  }

  const { sol } = plan;
  g.fillStyle(SOL_LOINTAIN, 1);
  g.fillRect(sol.x, sol.y, sol.w, sol.h);
  // La bande proche est plus sombre : c'est le seul indice de distance qu'un
  // aplat puisse donner.
  g.fillStyle(SOL_PROCHE, 1);
  g.fillRect(sol.x, sol.y + sol.h * 0.45, sol.w, sol.h * 0.55);
  g.fillStyle(HORIZON, 1);
  g.fillRect(sol.x, sol.y, sol.w, 3);

  for (const meuble of plan.meubles ?? []) {
    g.fillStyle(MEUBLE, 1);
    g.fillRect(meuble.x, meuble.y, meuble.w, meuble.h);
    g.fillStyle(MEUBLE_DESSUS, 1);
    g.fillRect(meuble.x, meuble.y, meuble.w, 8);
  }

  for (const eau of plan.eaux ?? []) {
    const bord = 8;
    g.fillStyle(MARGELLE, 1);
    g.fillRect(eau.x - bord, eau.y - bord, eau.w + 2 * bord, eau.h + 2 * bord);
    g.fillStyle(EAU, 1);
    g.fillRect(eau.x, eau.y, eau.w, eau.h);
  }

  // Dit en toutes lettres ce que le joueur a sous les yeux. À supprimer avec
  // l'appel le jour où le fond arrive.
  scene.add
    .text(DESIGN_WIDTH - 16, DESIGN_HEIGHT - 14, 'décor provisoire', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      color: '#f2ece1',
    })
    .setOrigin(1)
    .setAlpha(0.45)
    .setDepth(PROFONDEUR);
}
