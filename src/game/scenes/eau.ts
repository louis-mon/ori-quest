import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import { REGLAGES_EAU } from './eau-reglages';
import { alea } from './hasard';
import type { Box } from './layout';

// L'eau du ravin : un papier bleu froissé, TexEau, qui défile vers le bas sous
// une houle plus lente que lui. L'artiste livre le fond transparent dans la
// brèche, où l'on voit le ciel ; l'eau passe derrière le fond, dans la zone
// `eau`, dont le bord haut est la surface.

// Le sens de chaque champ ; les valeurs vivent dans `eau-reglages.ts`.
export interface ReglagesEau {
  // Teinte du papier, en `#rrggbb`.
  couleur: string;
  // Ombrage des facettes ; 0 met le papier à plat.
  relief: number;
  // Force des traits de pli.
  plis: number;
  // Vitesse du papier, en pixels du jeu par seconde.
  defilement: number;
  // Vitesse des vagues en fraction du défilement : tant qu'elle reste sous 1,
  // les vagues vont moins vite que le papier.
  vagues: number;
  // Soulèvement du papier par la houle, en pixels.
  amplitude: number;
  // D'une crête à la suivante, en pixels.
  longueur: number;
  // Lumière prise par les crêtes, de 0 à 1.
  reflet: number;
  // Ombre des berges sur l'eau, de 0 à 1.
  berges: number;
  // Le plan d'eau pivote vers l'arrière sur son bord bas, en degrés : à 0, il
  // fait face ; plus l'angle monte, plus il fuit vers l'horizon.
  inclinaison: number;
}

export interface Eau {
  // Pour l'outil de réglage : la scène s'en tient à l'enregistré.
  regler(reglages: ReglagesEau): void;
}

export const TEXTURE_EAU = 'TexEau';

// Une puissance de deux : WebGL 1, celui que Phaser demande, ne répète que
// celles-là, et c'est cette répétition qui fait boucler le défilement.
const COTE = 512;

const GRAINE = 1911;

// Derrière le fond (-5), qui ne la laisse voir que par la brèche, devant les
// nuages (-10).
const PROFONDEUR = -6;

interface Couche {
  n: number;
  rayon: readonly [number, number];
  pente: readonly [number, number];
  trait: number;
}

// Réglées à côté du papier vert de l'artiste : c'est le réseau serré des plis
// courts qui fait lire du papier froissé. Longs, leurs traits passaient pour des
// rayures sur du verre ; les grands plis n'apportent que des nappes d'ombre.
const COUCHES: readonly Couche[] = [
  { n: 18, rayon: [80, 160], pente: [0.04, 0.09], trait: 0 },
  { n: 120, rayon: [30, 60], pente: [0.03, 0.07], trait: 0.25 },
  { n: 700, rayon: [12, 28], pente: [0.05, 0.11], trait: 0.3 },
  { n: 1800, rayon: [5, 11], pente: [0.04, 0.09], trait: 0.12 },
];

// D'en haut à gauche, comme sur les papiers photographiés du fond.
const LUMIERE = unitaire(-0.45, -0.6, 0.9);

const GRAIN = 0.05;

// En pixels, et horizontale seulement : la surface, en haut, ne touche aucune
// berge.
const PORTEE_OMBRE = 6;

// Plus court et un peu plus lent que le premier : un train de vagues seul se
// lisait comme un store qu'on déroule.
const SECOND_TRAIN = { longueur: 0.61, vitesse: 0.83, poids: 0.45 };

// En pixels : un objectif « normal » pour un cadre de 1280 de large. Plus long,
// le plan ne fuirait vers l'horizon qu'à des angles rasants.
const FOCALE = 1280;

const FRAGMENT = `
#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uPapier;
uniform sampler2D uOmbre;
uniform vec2 uTaille;
uniform float uDecalage;
uniform vec2 uPhases;
uniform float uLongueur;
uniform float uAmplitude;
uniform float uReflet;
uniform float uBerges;
uniform float uInclinaison;
uniform float uCentre;

varying vec2 outTexCoord;

const float TAU = 6.2831853;
const float LONGUEUR_2 = ${SECOND_TRAIN.longueur.toFixed(3)};
const float POIDS_2 = ${SECOND_TRAIN.poids.toFixed(3)};
const float FOCALE = ${FOCALE.toFixed(1)};

void main ()
{
    // De l'écran au plan d'eau, qui pivote vers l'arrière sur son bord bas :
    // x depuis le point de fuite, y en remontant depuis ce bord. Tout ce qui
    // suit se passe sur le plan, donc plis et vagues rapetissent au loin. Le
    // plan est mesuré en pixels du bord bas, où il garde l'échelle de l'écran :
    // vitesses, longueurs et amplitudes s'y lisent telles qu'on les a réglées.
    vec2 e = vec2(outTexCoord.x * uTaille.x - uCentre, outTexCoord.y * uTaille.y);
    float c = FOCALE * cos(uInclinaison);
    vec2 p = e * c / max(c - e.y * sin(uInclinaison), 1.0);

    // Les crêtes s'infléchissent un peu en travers : droites, elles faisaient
    // des bandes tirées à la règle.
    float k1 = TAU / uLongueur;
    float k2 = k1 / LONGUEUR_2;
    float a1 = k1 * (p.y + uPhases.x) + 0.7 * sin(p.x * k1 * 0.37 + 1.3);
    float a2 = k2 * (p.y + uPhases.y) + 0.9 * sin(p.x * k2 * 0.23 + 4.1);
    float houle = (sin(a1) + POIDS_2 * sin(a2)) / (1.0 + POIDS_2);
    float r = POIDS_2 / LONGUEUR_2;
    float pente = (cos(a1) + r * cos(a2)) / (1.0 + r);

    vec2 q = p + uAmplitude * vec2(0.35 * sin(a1 + 1.7), houle);
    vec3 couleur = texture2D(uPapier, vec2(q.x, q.y + uDecalage) / ${COTE.toFixed(1)}).rgb;
    couleur *= 1.0 + uReflet * pente;

    couleur *= 1.0 - uBerges * (1.0 - texture2D(uOmbre, outTexCoord).r);
    gl_FragColor = vec4(couleur, 1.0);
}
`;

// Ce que calcule `froisser()` : la pente du papier et ses traits de pli.
interface Froissage {
  gx: Float32Array;
  gy: Float32Array;
  traits: Float32Array;
}

// Ne dépend d'aucun réglage : calculé une fois, reteint à volonté.
let froissage: Froissage | undefined;

export function poserEau(
  scene: Phaser.Scene,
  fond: Phaser.GameObjects.Image,
  zone: Box,
  reglages: ReglagesEau = REGLAGES_EAU,
): Eau | undefined {
  // Sans WebGL, pas de shader : on voit le ciel au fond du ravin.
  if (scene.sys.renderer.type !== Phaser.WEBGL) return undefined;

  let r = { ...reglages };
  const papier = scene.textures.exists(TEXTURE_EAU)
    ? (scene.textures.get(TEXTURE_EAU) as Phaser.Textures.CanvasTexture)
    : peindrePapier(scene, r);

  // Les zones du plan sont en pixels du jeu, le canevas du fond en pixels de
  // l'image : le fond est posé à sa taille naturelle, seule l'origine diffère.
  const versImage = (b: Box): Box => ({
    x: Math.round(b.x - fond.x),
    y: Math.round(b.y - fond.y),
    w: Math.round(b.w),
    h: Math.round(b.h),
  });

  const x = Math.round(zone.x);
  const y = Math.round(zone.y);
  const w = Math.round(zone.w);
  const h = Math.round(zone.h);
  const cleOmbre = `${fond.texture.key}-ombre`;
  if (!scene.textures.exists(cleOmbre)) ombrer(scene, fond, cleOmbre, versImage(zone));

  const taille = [w, h];
  const phases = [0, 0];
  let decalage = 0;

  scene.add
    .shader(
      {
        name: 'EauDuRavin',
        fragmentSource: FRAGMENT,
        setupUniforms: (set: (nom: string, valeur: unknown) => void) => {
          set('uPapier', 0);
          set('uOmbre', 1);
          set('uTaille', taille);
          set('uDecalage', decalage);
          set('uPhases', phases);
          set('uLongueur', r.longueur);
          set('uAmplitude', r.amplitude);
          set('uReflet', r.reflet);
          set('uBerges', r.berges);
          set('uInclinaison', (r.inclinaison * Math.PI) / 180);
          set('uCentre', DESIGN_WIDTH / 2 - x);
        },
      },
      x,
      y,
      w,
      h,
      [TEXTURE_EAU, cleOmbre],
    )
    .setOrigin(0)
    .setDepth(PROFONDEUR);

  // Cumulé image par image et ramené à sa période : un calcul sur l'horloge
  // sauterait d'un coup à la sortie du menu, qui met la scène en pause. Et la
  // précision du GPU s'effrite sur les grands nombres.
  const avancer = (_temps: number, delta: number) => {
    const s = delta / 1000;
    const vagues = r.defilement * r.vagues;
    decalage = (decalage + r.defilement * s) % COTE;
    phases[0] = (phases[0] + vagues * s) % r.longueur;
    phases[1] =
      (phases[1] + vagues * SECOND_TRAIN.vitesse * s) % (r.longueur * SECOND_TRAIN.longueur);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, avancer);
  // Les événements de la scène survivent à son arrêt : sans ça, chaque passage
  // laisserait un écouteur de plus pousser un shader détruit.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, avancer);
  });

  return {
    regler(nouveaux) {
      const reteindre =
        nouveaux.couleur !== r.couleur || nouveaux.relief !== r.relief || nouveaux.plis !== r.plis;
      r = { ...nouveaux };
      if (reteindre) teindre(papier, r);
    },
  };
}

function peindrePapier(scene: Phaser.Scene, r: ReglagesEau): Phaser.Textures.CanvasTexture {
  const texture = scene.textures.createCanvas(TEXTURE_EAU, COTE, COTE);
  if (!texture) throw new Error(`[eau] texture ${TEXTURE_EAU} impossible à créer`);
  teindre(texture, r);
  return texture;
}

// Chaque pli est une droite qui incline le papier en sens contraires de part et
// d'autre, estompée sur un disque. On cumule la pente et non une hauteur :
// dérivée ensuite, la hauteur arrondissait les facettes en bosses de plastique.
// Les indices sont pris modulo COTE, donc la feuille se raccorde à elle-même
// dans les deux sens.
function froisser(): Froissage {
  const gx = new Float32Array(COTE * COTE);
  const gy = new Float32Array(COTE * COTE);
  const traits = new Float32Array(COTE * COTE);
  const hasard = alea(GRAINE);
  // `& BORD` vaut un modulo, négatifs compris, parce que COTE est une puissance
  // de deux.
  const BORD = COTE - 1;

  for (const couche of COUCHES) {
    for (let i = 0; i < couche.n; i++) {
      const cx = hasard() * COTE;
      const cy = hasard() * COTE;
      const angle = hasard() * Math.PI;
      const rayon = entre(couche.rayon, hasard());
      const creux = hasard() < 0.5;
      const pente = (creux ? 1 : -1) * entre(couche.pente, hasard());
      // Un creux se lit en trait sombre, une crête en reflet plus discret.
      const trait = (creux ? 1 : -0.5) * couche.trait * (0.5 + hasard());
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      const r2 = rayon * rayon;

      for (let y = Math.floor(cy - rayon); y <= Math.ceil(cy + rayon); y++) {
        const dy = y + 0.5 - cy;
        if (dy * dy >= r2) continue;
        const ligne = (y & BORD) * COTE;
        const demi = Math.sqrt(r2 - dy * dy);
        for (let x = Math.ceil(cx - demi - 0.5); x <= Math.floor(cx + demi - 0.5); x++) {
          const dx = x + 0.5 - cx;
          const q = (dx * dx + dy * dy) / r2;
          if (q >= 1) continue;
          const estompe = (1 - q) * (1 - q);
          const d = dx * nx + dy * ny;
          // Adouci sur un pixel, sinon l'arête crénelle.
          const cote = d > 0.8 ? 1 : d < -0.8 ? -1 : d / 0.8;
          const k = ligne + (x & BORD);
          gx[k] += cote * pente * estompe * nx;
          gy[k] += cote * pente * estompe * ny;
          const largeur = 1 - (d < 0 ? -d : d);
          if (largeur > 0) traits[k] += trait * largeur * estompe;
        }
      }
    }
  }
  return { gx, gy, traits };
}

function teindre(texture: Phaser.Textures.CanvasTexture, { couleur, relief, plis }: ReglagesEau) {
  froissage ??= froisser();
  const { gx, gy, traits } = froissage;
  const [rouge, vert, bleu] = composantes(couleur);
  const [lx, ly, lz] = LUMIERE;
  const grain = alea(GRAINE + 1);

  const ctx = texture.getContext();
  const image = ctx.createImageData(COTE, COTE);
  const px = image.data;

  for (let i = 0; i < gx.length; i++) {
    const nx = -gx[i] * relief;
    const ny = -gy[i] * relief;
    // Rapportée au papier à plat, qui vaut 1.
    let clarte = Math.max(0, nx * lx + ny * ly + lz) / Math.sqrt(nx * nx + ny * ny + 1) / lz;
    clarte *= 1 - Math.min(0.6, Math.max(-0.35, traits[i] * plis));
    clarte *= 1 + (grain() - 0.5) * GRAIN;

    const o = i * 4;
    if (clarte <= 1) {
      px[o] = rouge * clarte;
      px[o + 1] = vert * clarte;
      px[o + 2] = bleu * clarte;
    } else {
      // Au-delà, le papier blanchit plutôt que de saturer sa teinte.
      const blanc = Math.min(1, (clarte - 1) * 0.9);
      px[o] = rouge + (255 - rouge) * blanc;
      px[o + 1] = vert + (255 - vert) * blanc;
      px[o + 2] = bleu + (255 - bleu) * blanc;
    }
    px[o + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);

  // Avec mipmaps : vu de biais, le papier se resserre vers le fond, et ses plis
  // y scintillaient en défilant. Demandé à cette texture seule, `refresh()`
  // n'en ferait pas — il ne les accorde qu'à la configuration globale du jeu.
  const source = texture.source[0];
  const gl = (source.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
  const verre = source.glTexture;
  if (!verre) return;
  verre.update(
    texture.getCanvas(),
    COTE,
    COTE,
    verre.flipY,
    gl.REPEAT,
    gl.REPEAT,
    gl.LINEAR_MIPMAP_LINEAR,
    gl.LINEAR,
    verre.format,
  );
}

// L'ouverture de la brèche sur la zone de l'eau, floutée en travers : 1 au
// milieu, moins au pied des berges, qui y portent leur ombre. L'alpha reste
// plein, sinon l'envoi au GPU prémultiplierait la valeur par lui.
function ombrer(scene: Phaser.Scene, fond: Phaser.GameObjects.Image, cle: string, eau: Box): void {
  const lecture = document.createElement('canvas');
  lecture.width = eau.w;
  lecture.height = eau.h;
  const ctxLecture = lecture.getContext('2d', { willReadFrequently: true });
  if (!ctxLecture) throw new Error(`[eau] fond illisible pour ${cle}`);
  ctxLecture.drawImage(fond.texture.getSourceImage() as HTMLImageElement, -eau.x, -eau.y);
  const px = ctxLecture.getImageData(0, 0, eau.w, eau.h).data;
  const ouvert = new Float32Array(eau.w * eau.h);
  for (let i = 0; i < ouvert.length; i++) ouvert[i] = 1 - px[i * 4 + 3] / 255;

  const demi = PORTEE_OMBRE / 2;
  const flou = flouEnTravers(flouEnTravers(ouvert, eau.w, demi), eau.w, demi);

  const texture = scene.textures.createCanvas(cle, eau.w, eau.h);
  if (!texture) throw new Error(`[eau] texture ${cle} impossible à créer`);
  const ctx = texture.getContext();
  const image = ctx.createImageData(eau.w, eau.h);
  for (let i = 0; i < flou.length; i++) {
    const v = flou[i] * 255;
    image.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  texture.refresh();
}

// Deux passes de moyenne glissante approchent un flou gaussien.
function flouEnTravers(source: Float32Array, largeur: number, rayon: number): Float32Array {
  const r = Math.max(1, Math.round(rayon));
  const flou = new Float32Array(source.length);
  for (let debut = 0; debut < source.length; debut += largeur) {
    for (let x = 0; x < largeur; x++) {
      let somme = 0;
      let n = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(largeur - 1, x + r); k++) {
        somme += source[debut + k];
        n++;
      }
      flou[debut + x] = somme / n;
    }
  }
  return flou;
}

function entre([min, max]: readonly [number, number], t: number): number {
  return min + (max - min) * t;
}

function unitaire(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

function composantes(couleur: string): [number, number, number] {
  const n = parseInt(couleur.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
