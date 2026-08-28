import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { placeSprite, preloadSprite } from './decor-sprite';
import type { Box } from './layout';

// Le ciel des scènes d'extérieur : un dégradé peint au canvas, pas des bandes
// unies — trois aplats empilés donnaient deux lignes franches qui se lisaient
// comme des horizons flottant au-dessus du vrai. Le halo part du soleil, donc la
// lumière a la source que le plan de scène désigne.
//
// Le soleil et les nuages sont les pliages de l'artiste, pas des polygones. Tout
// cela vit sous le reste du décor, en profondeurs négatives.

// Tous le même pliage vu sous un autre angle. Semer plus de nuages que de
// modèles est prévu : le cycle repasse dans la liste sans jamais mettre deux
// jumeaux côte à côte.
const MODELES = ['nuage1', 'nuage2', 'nuage3'] as const;

const SOLEIL = 'soleil';

// Le fond, du zénith à l'horizon.
const CIEL_ZENITH = '#5d92bd';
const CIEL_MEDIAN = '#9dc2db';
// Brume d'horizon, tirée vers le chaud : c'est elle qui dit l'après-midi.
const CIEL_HORIZON = '#e2dcc6';

// La dernière teinte reprend l'avant-dernière à opacité nulle : un halo qui
// s'éteint vers du blanc transparent passe par un gris laiteux au milieu du
// dégradé, et le ciel paraît sale tout autour du soleil.
const HALO = [
  [0, 'rgba(255, 246, 214, 0.92)'],
  [0.3, 'rgba(255, 234, 178, 0.5)'],
  [0.62, 'rgba(250, 224, 172, 0.2)'],
  [1, 'rgba(250, 224, 172, 0)'],
] as const;

// Portée du halo, en pixels du jeu, avant aplatissement.
const HALO_RAYON = 700;

// Un halo circulaire se lit comme une bulle posée dans le ciel ; écrasé, il
// devient la nappe de lumière d'un après-midi.
const HALO_APLATISSEMENT = 0.62;

// La moitié de la définition du jeu : un dégradé n'a aucun détail à perdre, et
// l'agrandissement bilinéaire le rend plus doux pour quatre fois moins de
// mémoire vidéo.
const TEXTURE_LARGEUR = 640;
const TEXTURE_HAUTEUR = 360;

// Le fond du fond, le soleil, les nuages, puis le décor à 0.
const PROFONDEUR_CIEL = -30;
const PROFONDEUR_SOLEIL = -20;
const PROFONDEUR_NUAGES = -10;

// En pixels du jeu par seconde.
const DERIVE_MIN = 4;
const DERIVE_ETENDUE = 7;

// En fraction de la bande, et donc indirectement la largeur : les modèles sont
// deux fois plus larges que hauts. Un nuage qui remplit sa bande touche ses
// voisins et la rangée se lit comme une seule masse ; la marge qui reste sert à
// les décaler en hauteur, ce qui compte plus que leur taille.
const TAILLE_MIN = 0.3;
const TAILLE_ETENDUE = 0.3;

// À appeler dans le `preload()` d'une scène d'extérieur.
export function preloadCiel(scene: Phaser.Scene): void {
  for (const modele of MODELES) preloadSprite(scene, modele, `assets/decor/${modele}.png`);
  preloadSprite(scene, SOLEIL, `assets/decor/${SOLEIL}.png`);
}

// `horizon` est la hauteur où le sol commence : le dégradé s'y cale, donc une
// scène dont le sol est plus bas garde le même ciel, simplement étiré.
export function dessinerCiel(scene: Phaser.Scene, horizon: number, soleil: Box): void {
  // Une texture par scène : le halo dépend de la position du soleil, qui change
  // d'un plan à l'autre. Elle survit au changement de pièce.
  const cle = `ciel-${scene.scene.key}`;
  if (!scene.textures.exists(cle)) peindreCiel(scene, cle, horizon, soleil);

  scene.add
    .image(0, 0, cle)
    .setOrigin(0)
    .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT)
    .setDepth(PROFONDEUR_CIEL);

  // Centré dans sa boîte, là où les sprites du décor sont calés sur le bas :
  // une boîte de plan marque un appui au sol, et le soleil ne repose sur rien.
  placeSprite(scene, SOLEIL, soleil, 'centre').setDepth(PROFONDEUR_SOLEIL);
}

function peindreCiel(scene: Phaser.Scene, cle: string, horizon: number, soleil: Box): void {
  const texture = scene.textures.createCanvas(cle, TEXTURE_LARGEUR, TEXTURE_HAUTEUR);
  if (!texture) return;

  const ctx = texture.getContext();
  const e = TEXTURE_LARGEUR / DESIGN_WIDTH;

  // En dessous de l'horizon, `createLinearGradient` prolonge sa dernière
  // teinte : ce bas est recouvert par le sol, mais il ne doit pas laisser de
  // bande noire si une scène décale le sien.
  const fond = ctx.createLinearGradient(0, 0, 0, horizon * e);
  fond.addColorStop(0, CIEL_ZENITH);
  fond.addColorStop(0.55, CIEL_MEDIAN);
  fond.addColorStop(1, CIEL_HORIZON);
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, TEXTURE_LARGEUR, TEXTURE_HAUTEUR);

  const sx = (soleil.x + soleil.w / 2) * e;
  const sy = (soleil.y + soleil.h / 2) * e;

  // On écrase le repère autour du soleil avant de tracer un halo circulaire :
  // `createRadialGradient` ne connaît que des cercles.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, HALO_APLATISSEMENT);
  ctx.translate(-sx, -sy);

  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, HALO_RAYON * e);
  for (const [position, teinte] of HALO) halo.addColorStop(position, teinte);
  ctx.fillStyle = halo;
  // Exprimé dans le repère écrasé, où la texture couvre plus de hauteur qu'elle
  // n'en a : on déborde largement plutôt que de calculer.
  ctx.fillRect(-TEXTURE_LARGEUR, -TEXTURE_HAUTEUR, TEXTURE_LARGEUR * 3, TEXTURE_HAUTEUR * 3);
  ctx.restore();

  texture.refresh();
}

// Le semis est tiré au hasard mais toujours le même, d'une graine fixe propre à
// la scène : un joueur qui revient de la pièce d'à côté doit retrouver son ciel,
// sinon le retour se lit comme un bug.
//
// Tout est en proportions de la bande, donc la déplacer dans Tiled emmène les
// nuages. Leur nombre et leur dispersion sont une décision de dessin et vivent
// ici : on ne pose pas un repère de plan par nuage.
export function semerNuages(scene: Phaser.Scene, bande: Box, graine: number, nombre = 5): void {
  const hasard = alea(graine);
  // Un modèle de départ tiré au sort, puis on avance dans la liste : deux nuages
  // voisins ne sont jamais le même pliage.
  const premier = Math.floor(hasard() * MODELES.length);

  for (let i = 0; i < nombre; i++) {
    // Une case de la bande par nuage, le tirage jouant à l'intérieur : évite
    // l'amas que donne un tirage libre sur toute la largeur.
    const t = (i + 0.15 + hasard() * 0.7) / nombre;
    const proche = hasard();
    const montee = hasard();

    const image = scene.add
      .image(0, 0, MODELES[(premier + i) % MODELES.length])
      .setDepth(PROFONDEUR_NUAGES);

    const source = scene.textures.get(image.texture.key).getSourceImage();
    const hauteur = bande.h * (TAILLE_MIN + proche * TAILLE_ETENDUE);
    const largeur = (source.width / source.height) * hauteur;
    image.setScale(hauteur / source.height);
    image.setPosition(bande.x + bande.w * t, bande.y + (bande.h - hauteur) * montee + hauteur / 2);
    // Les petits sont les plus lointains : un peu de brume les mange…
    image.setAlpha(0.76 + proche * 0.18);
    // …et dérivent d'autant plus lentement : à vitesse commune, la rangée
    // entière glisse comme un seul décor peint.
    deriver(scene, image, bande, largeur, DERIVE_MIN + proche * DERIVE_ETENDUE);
  }
}

// La position est un modulo d'un compteur plutôt qu'une remise à zéro en fin de
// course : le nuage repart là où il s'arrête, donc la boucle est invisible.
//
// Un tween plutôt qu'un écouteur d'`update` : le gestionnaire de tweens
// appartient à la scène et s'arrête avec elle, là où un écouteur survivrait au
// changement de pièce et pousserait des images détruites.
function deriver(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  bande: Box,
  largeur: number,
  vitesse: number,
): void {
  const gauche = bande.x - largeur / 2;
  const parcours = bande.w + largeur;
  const depart = image.x - gauche;
  const glisse = { p: 0 };

  scene.tweens.add({
    targets: glisse,
    p: 1,
    duration: (parcours / vitesse) * 1000,
    repeat: -1,
    ease: 'Linear',
    onUpdate: () => {
      image.x = gauche + ((depart + glisse.p * parcours) % parcours);
    },
  });
}

// mulberry32 : `Math.random()` donnerait deux ciels différents pour deux visites
// de la même scène.
function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
