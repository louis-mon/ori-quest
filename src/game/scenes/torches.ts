import Phaser from 'phaser';
import { alea } from './hasard';
import type { Box } from './layout';
import { REGLAGES_TORCHES } from './torches-reglages';

// Les torches de la salle du trône sont dans le fond de l'artiste : seule leur
// lumière est ajoutée. Une lueur large, jetée sur le mur, et un halo serré
// autour de la flamme, qui vacillent ensemble — c'est la même flamme.
//
// Le mur est presque blanc : de la lumière ajoutée n'y trouve plus de place, et
// ne fait que le jaunir. Ce qui se lit comme une torche sur un mur clair, c'est
// qu'il vire à l'ambre — d'où la chaleur, qui le teinte par multiplication,
// sous la lueur qui l'éclaire.

// Le sens de chaque champ ; les valeurs vivent dans `torches-reglages.ts`.
export interface ReglagesTorches {
  // Teinte de la lumière, en `#rrggbb`.
  teinte: string;
  // Rayon de la lueur sur le mur, en largeurs de flamme.
  portee: number;
  // Ce que le mur prend de la teinte, en son centre, de 0 à 1.
  chaleur: number;
  // Ce qu'il gagne en clarté, en son centre, de 0 à 1.
  lueur: number;
  // Opacité du halo autour de la flamme, de 0 à 1.
  halo: number;
  // Ce que la flamme perd ou gagne en vacillant, en fraction de sa force.
  vacillement: number;
  // Ce que cette ampleur dérive dans le temps, de 0 à 1 : à 0, la flamme
  // vacille toujours autant ; à 1, elle passe du calme plat au coup de vent.
  rafales: number;
  // Vitesse du vacillement : à 1, la flamme change d'élan deux fois par
  // seconde, et le reste suit à proportion.
  vitesse: number;
}

export interface Torches {
  // Pour l'outil de réglage : la scène s'en tient à l'enregistré.
  regler(reglages: ReglagesTorches): void;
}

const TEXTURE = 'lueur-torche';
const COTE = 256;

// Sur le fond (-5), sous le décor (0) : c'est le mur qu'elles éclairent, et un
// personnage passé devant reste devant.
const PROFONDEUR = -4;

// Rayon du halo, en largeurs de flamme.
const HALO = 1.3;
// Une lueur qui s'avive s'étend aussi, mais moins qu'elle ne s'avive.
const SOUFFLE = 0.25;

// Du bruit, pas des sinus : à fréquences égales, deux torches gardent entre
// elles un écart de phase fixe, et leurs lueurs alternent en mesure. Chaque
// couche dit combien de fois par seconde elle change d'élan, à la vitesse 1.
const FREMISSEMENT = [
  { frequence: 2, poids: 0.55 },
  { frequence: 5.3, poids: 0.3 },
  { frequence: 13, poids: 0.15 },
] as const;
// Les rafales changent bien plus lentement que la flamme qu'elles agitent.
const FREQUENCE_RAFALES = 0.3;

// Une graine par torche : deux flammes qui battraient en mesure se liraient
// comme une seule lumière.
const GRAINE = 1453;

export function allumerLesTorches(
  scene: Phaser.Scene,
  flammes: readonly Box[],
  reglages: ReglagesTorches = REGLAGES_TORCHES,
): Torches {
  let r = { ...reglages };
  const texture = peindreLueur(scene);

  const torches = flammes.map((flamme, i) => {
    const x = flamme.x + flamme.w / 2;
    const y = flamme.y + flamme.h / 2;
    const poser = (mode: Phaser.BlendModes) =>
      scene.add.image(x, y, texture).setBlendMode(mode).setDepth(PROFONDEUR);
    const hasard = alea(GRAINE + i);
    return {
      largeur: flamme.w,
      // Dans l'ordre d'affichage : la teinte d'abord, la clarté par-dessus.
      chaleur: poser(Phaser.BlendModes.MULTIPLY),
      lueur: poser(Phaser.BlendModes.ADD),
      halo: poser(Phaser.BlendModes.ADD),
      // Un tirage par couche, et un pour les rafales.
      graines: [...FREMISSEMENT, null].map(() => Math.floor(hasard() * 2 ** 32)),
    };
  });

  const teindre = () => {
    const teinte = Phaser.Display.Color.HexStringToColor(r.teinte).color;
    for (const torche of torches) {
      for (const image of [torche.chaleur, torche.lueur, torche.halo]) image.setTint(teinte);
    }
  };
  teindre();

  // L'horloge avance à la vitesse réglée, plutôt que d'en être le produit :
  // changer la vitesse ne fait pas sauter la flamme d'un coup.
  let horloge = 0;
  let avant = scene.time.now;

  // Un compteur et non un écouteur d'`update` : il meurt avec la scène.
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1000,
    repeat: -1,
    onUpdate: () => {
      horloge += ((scene.time.now - avant) / 1000) * r.vitesse;
      avant = scene.time.now;
      for (const { largeur, chaleur, lueur, halo, graines } of torches) {
        let ecart = 0;
        FREMISSEMENT.forEach(({ frequence, poids }, k) => {
          ecart += poids * bruit(graines[k], horloge * frequence);
        });
        const accalmie = (bruit(graines[FREMISSEMENT.length], horloge * FREQUENCE_RAFALES) + 1) / 2;
        ecart *= 1 - r.rafales * accalmie;
        const force = 1 + ecart * r.vacillement;
        const etendue = 1 + ecart * r.vacillement * SOUFFLE;
        const mur = ((r.portee * largeur * 2) / COTE) * etendue;
        chaleur.setAlpha(Math.min(1, r.chaleur * force)).setScale(mur);
        lueur.setAlpha(Math.min(1, r.lueur * force)).setScale(mur);
        halo
          .setAlpha(Math.min(1, r.halo * force))
          .setScale(((HALO * largeur * 2) / COTE) * etendue);
      }
    },
  });

  return {
    regler(nouveaux) {
      const reteindre = nouveaux.teinte !== r.teinte;
      r = { ...nouveaux };
      if (reteindre) teindre();
    },
  };
}

// Des valeurs tirées au hasard à intervalles réguliers, raccordées en douceur :
// entre -1 et 1, sans rythme qui se répète. Le tirage dépend du seul rang de
// l'intervalle, donc rien n'est à garder d'une image à l'autre.
function bruit(graine: number, t: number): number {
  const rang = Math.floor(t);
  const f = t - rang;
  const lisse = f * f * (3 - 2 * f);
  const a = alea(graine + rang)();
  const b = alea(graine + rang + 1)();
  return (a + (b - a) * lisse) * 2 - 1;
}

// Blanche, et teintée à la pose : la teinte se règle sans repeindre. Peinte une
// fois : les textures survivent au changement de pièce.
function peindreLueur(scene: Phaser.Scene): string {
  if (scene.textures.exists(TEXTURE)) return TEXTURE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = COTE;
  const ctx = canvas.getContext('2d')!;
  const c = COTE / 2;
  const degrade = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [position, opacite] of [
    [0, 1],
    [0.2, 0.6],
    [0.45, 0.25],
    [0.7, 0.07],
    [1, 0],
  ]) {
    degrade.addColorStop(position, `rgba(255, 255, 255, ${opacite})`);
  }
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, COTE, COTE);
  scene.textures.addCanvas(TEXTURE, canvas);
  return TEXTURE;
}
