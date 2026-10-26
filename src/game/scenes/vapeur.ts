import Phaser from 'phaser';
import { alea } from './hasard';
import type { Box } from './layout';
import { REGLAGES_VAPEUR } from './vapeur-reglages';

// La vapeur d'un plat chaud : des bouffées blanches qui montent du modèle en
// ondulant, s'élargissent et se dissipent. Rien ne se plie ici, donc rien ne se
// photographie : c'est un effet, comme la lueur des torches.
//
// Les tailles se comptent en largeurs de plat, celle du modèle à l'écran : un
// plat redessiné plus grand dans Tiled fume à proportion.

// Le sens de chaque champ ; les valeurs vivent dans `vapeur-reglages.ts`.
export interface ReglagesVapeur {
  // Bouffées qui naissent par seconde.
  debit: number;
  // Durée de vie d'une bouffée, en secondes.
  duree: number;
  // Hauteur où elle se dissipe, au-dessus du plat.
  hauteur: number;
  // Sa largeur à la naissance.
  taille: number;
  // Ce qu'elle a grossi en arrivant en haut : à 1, rien.
  epanouissement: number;
  // Sa hauteur rapportée à sa largeur : à 1 une boule, au-delà un filet.
  etirement: number;
  // Opacité au plus fort, de 0 à 1.
  opacite: number;
  // Largeur de plat d'où elle peut partir, de 0 (le milieu) à 1 (tout).
  etalement: number;
  // Amplitude du balancement, qui s'accentue en montant.
  ondulation: number;
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

// D'où elle sort, en hauteur de plat depuis son sommet : du dessus du poisson,
// pas du bord du canvas.
const SOURCE = 0.35;
// Le temps d'apparaître, en fraction de sa vie : une bouffée qui naît opaque se
// voit naître.
const APPARITION = 0.15;
// Allers-retours par seconde ; chaque bouffée tire le sien autour de cette valeur,
// sans quoi elles oscilleraient en mesure.
const BALANCEMENT = 0.45;
// Au retour d'un onglet masqué, le temps écoulé ne doit pas tomber d'un bloc.
const PAS_MAX = 0.1;

const GRAINE = 5113;

interface Bouffee {
  image: Phaser.GameObjects.Image;
  // En secondes de l'horloge de la vapeur.
  naissance: number;
  // Tirés à la naissance, en fraction des réglages.
  depart: number;
  phase: number;
  rythme: number;
  ampleur: number;
  vie: number;
}

export function poserVapeur(
  scene: Phaser.Scene,
  reglages: ReglagesVapeur = REGLAGES_VAPEUR,
): Vapeur {
  let r = { ...reglages };
  const texture = peindreBouffee(scene);
  const hasard = alea(GRAINE);
  // Créé tout de suite, pour prendre sa place dans l'ordre d'affichage : juste
  // au-dessus du plat, et sous ce qui passe devant la table.
  const calque = scene.add.container(0, 0);

  let plat: Box | undefined;
  let actif = false;
  let horloge = 0;
  let avant = scene.time.now;
  let reste = 0;
  const vivantes: Bouffee[] = [];
  const libres: Phaser.GameObjects.Image[] = [];

  const naitre = (age: number) => {
    const image = libres.pop() ?? scene.add.image(0, 0, texture);
    if (!image.parentContainer) calque.add(image);
    vivantes.push({
      image: image.setVisible(true),
      naissance: horloge - age,
      depart: hasard() - 0.5,
      phase: hasard() * Math.PI * 2,
      rythme: 0.7 + hasard() * 0.6,
      ampleur: 0.8 + hasard() * 0.4,
      vie: 0.8 + hasard() * 0.4,
    });
  };

  // Un plat servi fume déjà : on ne le voit pas commencer.
  const amorcer = () => {
    if (vivantes.length > 0) return;
    const n = Math.round(r.debit * r.duree);
    for (let i = 0; i < n; i++) naitre((i / n) * r.duree);
  };

  const dessiner = (b: Bouffee, largeur: number, x0: number, y0: number): boolean => {
    const age = horloge - b.naissance;
    const p = age / (r.duree * b.vie);
    if (p >= 1) return false;
    const monte = 1 - (1 - p) ** 2;
    const balance =
      Math.sin(b.phase + age * BALANCEMENT * b.rythme * Math.PI * 2) * r.ondulation * largeur * p;
    const echelle = ((r.taille * b.ampleur * largeur) / COTE) * (1 + (r.epanouissement - 1) * p);
    b.image
      .setPosition(
        x0 + b.depart * r.etalement * largeur + balance,
        y0 - monte * r.hauteur * largeur,
      )
      .setScale(echelle, echelle * r.etirement)
      .setAlpha(r.opacite * Math.min(1, p / APPARITION) * (1 - p));
    return true;
  };

  // Un compteur et non un écouteur d'`update` : il meurt avec la scène.
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1000,
    repeat: -1,
    onUpdate: () => {
      const pas = Math.min(PAS_MAX, (scene.time.now - avant) / 1000);
      avant = scene.time.now;
      if (!plat) return;
      horloge += pas;

      if (actif) {
        reste += pas * r.debit;
        while (reste >= 1) {
          reste -= 1;
          naitre(reste / r.debit);
        }
      }

      const x0 = plat.x + plat.w / 2;
      const y0 = plat.y + plat.h * SOURCE;
      for (let i = vivantes.length - 1; i >= 0; i--) {
        if (dessiner(vivantes[i], plat.w, x0, y0)) continue;
        libres.push(vivantes[i].image.setVisible(false));
        vivantes.splice(i, 1);
      }
    },
  });

  return {
    poser(nouveau) {
      plat = nouveau;
      if (actif) amorcer();
    },
    fumer(allume) {
      if (allume && !actif && plat) amorcer();
      actif = allume;
    },
    regler(nouveaux) {
      r = { ...nouveaux };
    },
  };
}

// Blanche, floue sur tout son rayon : les bouffées se chevauchent sans qu'on en
// voie le bord. Peinte une fois : les textures survivent au changement de pièce.
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
