import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import type { Box, Contour } from './layout';

// Déplacer un objet du décor. Comme le reste de la géométrie, ça se dessine dans
// Tiled : un chemin (polyligne), un repère où arriver, un point d'ancrage. La
// scène ne dit que ce qui bouge, à quelle vitesse, et si le joueur doit attendre.
//
// Le déplacement part TOUJOURS de là où l'objet est. Un chemin dont le premier
// sommet est ailleurs n'est donc pas une erreur : l'objet le rejoint, il ne s'y
// téléporte pas.

// Tout ce qui a une position et une emprise : un sprite, un modèle plié, un
// conteneur. `Origin` est facultatif — un conteneur n'en a pas, et le repli
// vaut le centre.
export type Mobile = Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.GetBounds &
  Partial<Phaser.GameObjects.Components.Origin>;

export interface Position {
  x: number;
  y: number;
}

// Un tracé, une boîte du plan, ou une position — la même fonction les prend
// toutes. Un objet Phaser en est une : il a `x` et `y`, donc « rejoins-le » ne
// demande rien de plus. Sa position est lue au départ, pas suivie en route.
export type Destination = Contour | Box | Position;

export interface OptionsDeplacement {
  // En unités du jeu par seconde. Une vitesse plutôt qu'une durée : un chemin
  // prolongé hors cadre allongerait le trajet, et à durée fixe l'objet
  // accélérerait d'autant.
  vitesse?: number;
  // Quand c'est le minutage qui compte — se caler sur une réplique, par exemple.
  duree?: number;
  // Poursuit le dernier segment jusqu'à ce que l'objet ait entièrement quitté le
  // cadre. C'est du code et non du tracé parce que la distance dépend de la
  // taille de l'objet à l'écran, que la carte ne connaît pas.
  sortie?: boolean;
  // Parcourt le tracé dans l'autre sens. Le même chemin sert alors à l'aller et
  // au retour, plutôt que d'en dessiner deux qui divergeront.
  inverse?: boolean;
  // Lu par `PointClickScene.deplacer()` : la scène cesse de répondre aux taps
  // pendant le trajet. Par défaut elle continue.
  bloquant?: boolean;
  // Un objet qui traverse ne freine pas en arrivant.
  ease?: string;
}

// Traverser le cadre en cinq secondes environ. À régler à l'œil au cas par cas.
const VITESSE = 260;

// Un pixel de plus que le strict nécessaire pour être hors champ.
const MARGE_SORTIE = 1;

export function deplacer(
  scene: Phaser.Scene,
  objet: Mobile,
  destination: Destination,
  options: OptionsDeplacement = {},
): Promise<void> {
  const trace = etapesDe(objet, destination);
  const etapes: [number, number][] = [
    [objet.x, objet.y],
    ...(options.inverse ? [...trace].reverse() : trace),
  ];
  if (options.sortie) prolongerHorsCadre(objet, etapes);

  const longueurs = etapes
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - etapes[i][0], y - etapes[i][1]));
  const total = longueurs.reduce((a, b) => a + b, 0);
  if (total === 0) return Promise.resolve();

  const duree = options.duree ?? (total / (options.vitesse ?? VITESSE)) * 1000;

  return new Promise((resolve) => {
    // Phaser tue les tweens de la scène en la quittant : sans cette sortie de
    // secours, un `await deplacer(...)` d'un changement de pièce n'aurait jamais
    // sa réponse.
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, terminer);
      resolve();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, terminer);

    // Un tween sur une valeur intermédiaire plutôt que sur `objet` : c'est la
    // seule façon de tenir une vitesse constante d'un segment à l'autre, là où
    // un tween par segment ralentirait sur les courts.
    const avance = { p: 0 };
    scene.tweens.add({
      targets: avance,
      p: 1,
      duration: duree,
      ease: options.ease ?? 'Linear',
      onUpdate: () => poser(objet, etapes, longueurs, total * avance.p),
      onComplete: terminer,
    });
  });
}

// Le point d'arrivée est celui où l'objet se poserait si on le plaçait dans
// cette boîte : c'est son origine qui décide, comme pour `placeSprite`. Un
// repère tracé au point a une boîte de taille nulle et donne donc exactement ses
// coordonnées.
function etapesDe(objet: Mobile, destination: Destination): [number, number][] {
  if (!('x' in destination)) return destination.map(([x, y]) => [x, y]);
  if ('w' in destination) {
    return [
      [
        destination.x + destination.w * (objet.originX ?? 0.5),
        destination.y + destination.h * (objet.originY ?? 0.5),
      ],
    ];
  }
  return [[destination.x, destination.y]];
}

// L'emprise est mesurée maintenant, et c'est son écart à l'ancre qui sert : il
// ne change pas en route. Un modèle plié pas encore rendu n'a que la texture
// vide de Phaser, donc une emprise d'un pixel — le faire sortir avant son rendu
// l'arrêterait à cheval sur le bord.
function prolongerHorsCadre(objet: Mobile, etapes: [number, number][]): void {
  if (etapes.length < 2) return;
  const [ax, ay] = etapes[etapes.length - 2];
  const [bx, by] = etapes[etapes.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return;

  const bornes = objet.getBounds();
  const gauche = objet.x - bornes.x;
  const droite = bornes.right - objet.x;
  const haut = objet.y - bornes.y;
  const bas = bornes.bottom - objet.y;

  // Franchir un seul bord suffit à disparaître : on garde donc la plus courte
  // des distances, en multiples du dernier segment.
  const sorties: number[] = [];
  if (dx > 0) sorties.push((DESIGN_WIDTH + gauche - bx) / dx);
  if (dx < 0) sorties.push((bx + droite) / -dx);
  if (dy > 0) sorties.push((DESIGN_HEIGHT + haut - by) / dy);
  if (dy < 0) sorties.push((by + bas) / -dy);
  if (sorties.length === 0) return;

  const t = Math.max(Math.min(...sorties), 0) + MARGE_SORTIE / Math.hypot(dx, dy);
  etapes.push([bx + dx * t, by + dy * t]);
}

function poser(
  objet: Mobile,
  etapes: [number, number][],
  longueurs: number[],
  parcouru: number,
): void {
  let reste = parcouru;
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i] || i === longueurs.length - 1) {
      // Un segment de longueur nulle — l'objet est déjà sur le premier sommet du
      // chemin, le cas normal — se franchit d'un coup.
      const k = longueurs[i] === 0 ? 1 : Math.min(reste / longueurs[i], 1);
      objet.setPosition(
        etapes[i][0] + (etapes[i + 1][0] - etapes[i][0]) * k,
        etapes[i][1] + (etapes[i + 1][1] - etapes[i][1]) * k,
      );
      return;
    }
    reste -= longueurs[i];
  }
}
