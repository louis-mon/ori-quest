import Phaser from 'phaser';
import { alea, bruit } from './hasard';
import type { Box } from './layout';
import { REGLAGES_VAPEUR } from './vapeur-reglages';

// La vapeur d'un plat chaud : quelques filets blancs qui montent du modèle en
// volutes, s'élargissent et se dissipent. Rien ne se plie ici, donc rien ne se
// photographie : c'est un effet, comme la lueur des torches.
//
// Un filet est une file de bouffées serrées, chacune à la place d'une parcelle
// de vapeur partie du plat un peu plus tôt, et cette place ne dépend que de
// l'instant du départ. Les volutes montent donc avec la vapeur, comme sur une
// vraie fumée, au lieu d'onduler sur place.
//
// Les tailles se comptent en largeurs de plat, celle du modèle à l'écran : un
// plat redessiné plus grand dans Tiled fume à proportion.

// Le sens de chaque champ ; les valeurs vivent dans `vapeur-reglages.ts`.
export interface ReglagesVapeur {
  // Filets qui montent du plat.
  filets: number;
  // Le temps qu'une volute met à monter, en secondes.
  duree: number;
  // Hauteur où un filet se dissipe, au-dessus du plat.
  hauteur: number;
  // Épaisseur d'un filet au départ.
  epaisseur: number;
  // Ce qu'il a grossi en arrivant en haut : à 1, rien.
  epanouissement: number;
  // Opacité au plus fort, de 0 à 1.
  opacite: number;
  // Largeur de plat d'où partent les filets, de 0 (le milieu) à 1 (tout).
  etalement: number;
  // Écart d'une volute de part et d'autre de son filet, arrivée en haut.
  ondulation: number;
  // Volutes qui partent du plat par seconde.
  boucles: number;
  // À 0, un filet qui serpente ; plus c'est fort, plus les volutes reviennent
  // sur elles-mêmes.
  enroulement: number;
  // À 0, des filets continus ; à 1, de la vapeur qui va et vient.
  intermittence: number;
}

export interface Vapeur {
  // Le modèle plié n'a d'emprise qu'une fois rendu : rien ne monte avant.
  poser(plat: Box): void;
  // Coupée, elle ne s'arrête pas net : ce qui monte finit de se dissiper.
  fumer(actif: boolean): void;
  // Pour l'outil de réglage : la scène s'en tient à l'enregistré.
  regler(reglages: ReglagesVapeur): void;
}

const TEXTURE = 'bouffee-vapeur';
const COTE = 64;

// La borne de `filets` dans vapeur.html.
const FILETS_MAX = 5;
// Deux bouffées par diamètre au moins, sinon un filet se lit comme un chapelet ;
// et une limite, pour qu'un réglage extrême ne coûte pas des milliers d'images.
const SERRAGE = 2;
const BOUFFEES_MAX = 160;

// D'où elle sort, en hauteur de plat depuis son sommet : du dessus du poisson,
// pas du bord du canvas.
const SOURCE = 0.35;
// La part du trajet où un filet apparaît : né opaque, il sortirait d'un trait
// de la surface du plat.
const APPARITION = 0.12;
// Ce que le hasard tord les volutes, en radians : sans lui, elles se répètent.
const TORSION = 1.2;
// Bouffées par seconde, quand la vapeur va et vient.
const RYTHME_BOUFFEES = 0.6;
// Un courant d'air qui penche toute la colonne, très lentement : en largeurs de
// plat au sommet, puis en changements d'élan par seconde.
const DERIVE = 0.06;
const RYTHME_DERIVE = 0.15;
// Au retour d'un onglet masqué, le temps écoulé ne doit pas tomber d'un bloc.
const PAS_MAX = 0.1;

const GRAINE = 5113;

export function poserVapeur(
  scene: Phaser.Scene,
  reglages: ReglagesVapeur = REGLAGES_VAPEUR,
): Vapeur {
  let r = { ...reglages };
  const texture = peindreBouffee(scene);
  // Créé tout de suite, pour prendre sa place dans l'ordre d'affichage : juste
  // au-dessus du plat, et sous ce qui passe devant la table.
  const calque = scene.add.container(0, 0);
  const images: Phaser.GameObjects.Image[] = [];

  const hasard = alea(GRAINE);
  const tirages = Array.from({ length: FILETS_MAX }, () => ({
    decalage: hasard() - 0.5,
    phase: hasard() * Math.PI * 2,
    // Deux filets voisins qui tournent dans le même sens se liraient comme un
    // seul motif.
    sens: hasard() < 0.5 ? -1 : 1,
    graineTorsion: Math.floor(hasard() * 2 ** 32),
    graineBouffees: Math.floor(hasard() * 2 ** 32),
  }));

  let plat: Box | undefined;
  // La vapeur partie après cet instant n'existe pas. À -∞ le plat n'a jamais
  // fumé, à +∞ il fume depuis toujours : servi, il fume déjà, on ne le voit
  // pas commencer.
  let arret = -Infinity;
  let horloge = 0;
  let avant = scene.time.now;

  const bouffee = (n: number) => {
    if (!images[n]) images[n] = scene.add.image(0, 0, texture);
    if (!images[n].parentContainer) calque.add(images[n]);
    return images[n].setVisible(true);
  };

  const dessiner = (p: Box) => {
    const largeur = p.w;
    const x0 = p.x + p.w / 2;
    const y0 = p.y + p.h * SOURCE;
    const haut = r.hauteur * largeur;
    const mince = r.epaisseur * largeur;
    const ample = r.ondulation * largeur;
    const filets = Math.round(r.filets);

    // Le chemin d'un filet s'allonge de ses volutes : on compte assez de
    // bouffées pour le plus serré de ses deux bouts.
    const tour = ample * 2 * Math.PI * r.boucles * r.duree * Math.max(1, r.enroulement);
    const parBout = Math.max(haut / mince, (haut + tour) / (mince * r.epanouissement));
    const nombre = Math.min(BOUFFEES_MAX, Math.max(8, Math.ceil(SERRAGE * parBout)));

    const derive = DERIVE * largeur * bruit(GRAINE, horloge * RYTHME_DERIVE);
    let n = 0;
    for (let f = 0; f < filets; f++) {
      const t = tirages[f];
      const base = x0 + ((f + 0.5 + t.decalage * 0.3) / filets - 0.5) * r.etalement * largeur;
      let avantX = base;
      let avantY = y0;
      for (let i = 0; i < nombre; i++) {
        const montee = (i + 0.5) / nombre;
        const depart = horloge - montee * r.duree;
        const angle =
          t.phase +
          t.sens * 2 * Math.PI * r.boucles * depart +
          TORSION * bruit(t.graineTorsion, depart * 0.5);
        const ecart = ample * montee;
        const x = base + derive * montee + ecart * Math.sin(angle);
        const y = y0 - montee * haut + ecart * r.enroulement * Math.cos(angle);
        const pas = Math.hypot(x - avantX, y - avantY);
        avantX = x;
        avantY = y;
        if (depart > arret) continue;

        const souffle = (bruit(t.graineBouffees, depart * RYTHME_BOUFFEES) + 1) / 2;
        const intensite = 1 - r.intermittence * (1 - lisser(0.25, 0.75, souffle));
        const opacite = r.opacite * Math.min(1, montee / APPARITION) * (1 - montee) * intensite;
        if (opacite < 0.005) continue;

        const diametre = mince * (1 + (r.epanouissement - 1) * montee);
        bouffee(n++)
          .setPosition(x, y)
          .setScale(diametre / COTE)
          // Les bouffées d'un filet se recouvrent : chacune ne porte que sa part
          // de l'opacité voulue, sinon un filet serré serait plus blanc qu'un
          // filet lâche.
          .setAlpha(1 - (1 - opacite) ** (Math.max(pas, 0.5) / diametre));
      }
    }
    for (let i = n; i < images.length; i++) images[i].setVisible(false);
  };

  // Un compteur et non un écouteur d'`update` : il meurt avec la scène.
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1000,
    repeat: -1,
    onUpdate: () => {
      horloge += Math.min(PAS_MAX, (scene.time.now - avant) / 1000);
      avant = scene.time.now;
      if (plat) dessiner(plat);
    },
  });

  return {
    poser(nouveau) {
      plat = nouveau;
    },
    fumer(allume) {
      if (allume) arret = Infinity;
      else if (arret === Infinity) arret = horloge;
    },
    regler(nouveaux) {
      r = { ...nouveaux };
    },
  };
}

function lisser(debut: number, fin: number, x: number): number {
  const f = Math.min(1, Math.max(0, (x - debut) / (fin - debut)));
  return f * f * (3 - 2 * f);
}

// Blanche, floue sur tout son rayon : les bouffées d'un filet se fondent sans
// qu'on en voie le bord. Peinte une fois : les textures survivent au changement
// de pièce.
function peindreBouffee(scene: Phaser.Scene): string {
  if (scene.textures.exists(TEXTURE)) return TEXTURE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = COTE;
  const ctx = canvas.getContext('2d')!;
  const c = COTE / 2;
  const degrade = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [position, opacite] of [
    [0, 1],
    [0.5, 0.8],
    [0.8, 0.3],
    [1, 0],
  ]) {
    degrade.addColorStop(position, `rgba(255, 255, 255, ${opacite})`);
  }
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, COTE, COTE);
  scene.textures.addCanvas(TEXTURE, canvas);
  return TEXTURE;
}
