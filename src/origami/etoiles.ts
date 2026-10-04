// Les étoiles qui s'allument sur un papier précieux. Celles du papier rouge
// brillent sur la feuille posée et sur le cœur plié du décor
// (feuilles-precieuses.ts), puis pendant le pliage (etoiles-pliage.ts) : une
// seule description pour les trois, sinon le cœur changerait d'éclat en se
// pliant. Ni Phaser ni three.js ici, les deux la lisent.

export interface Etoiles {
  nombre: number;
  teintes: readonly number[];
  // En fraction du côté, tirée entre les deux.
  taille: readonly [number, number];
  // Le temps de s'allumer, autant pour s'éteindre.
  duree: number;
  // Le noir entre deux éclats d'une même étoile, tiré entre les deux, en ms.
  pause: readonly [number, number];
}

// Le papier s'allume autour de chaque éclat, comme un métal qui accroche la
// lumière là où elle tombe. `rayon` en fraction du côté, `force` à son plus fort.
export interface Lumiere {
  rayon: number;
  force: number;
}

export interface Eclat {
  etoiles: Etoiles;
  lumiere: Lumiere;
}

// Les étoiles se posent en mélange normal, en teintes franches : ajoutées au
// papier, de l'or sur du bleu donnait du blanc, et les couleurs du diamant se
// délavaient sur le mauve.
export const ETINCELLES_OR = [0xffb81f, 0xffcc3a, 0xffdd70] as const;

// Le papier rouge de la reine, celui du cœur.
export const ECLAT_OR: Eclat = {
  etoiles: {
    nombre: 8,
    teintes: ETINCELLES_OR,
    taille: [0.2, 0.34],
    duree: 560,
    pause: [200, 1400],
  },
  lumiere: { rayon: 0.32, force: 0.3 },
};

// Le tour qu'une étoile fait, en degrés, le temps de s'allumer et de s'éteindre :
// c'est ce qui la fait crépiter plutôt que gonfler.
export const ROTATION = 90;

// Chaque paire de branches est un losange effilé, `longueur` en fraction du
// rayon, tourné de `angle`. `epaisseur` en pixels de texture, `coeur` en
// fraction du rayon.
export interface FormeEtoile {
  paires: readonly (readonly [number, number])[];
  epaisseur: number;
  coeur: number;
}

// L'étincelle : des branches effilées et un cœur minuscule. Un cœur rond et
// large, ajouté au papier, se lisait comme une boule blanche.
// Les branches restent épaisses dans la texture : affichée à une vingtaine de
// pixels, une branche fine y disparaît, et il ne reste que le cœur.
export const ETINCELLE: FormeEtoile = {
  paires: [
    [1, 0],
    [0.5, Math.PI / 4],
  ],
  epaisseur: 2.8,
  coeur: 0.08,
};

// Le diamant : quatre longues branches, quatre courtes en diagonale.
export const DIAMANT: FormeEtoile = {
  paires: [
    [1, 0],
    [0.62, Math.PI / 4],
  ],
  epaisseur: 3,
  coeur: 0.1,
};

// En blanc : chaque étoile prend sa teinte au moment de s'allumer.
export const TAILLE_ETOILE = 64;

export function peindreEtoile(ctx: CanvasRenderingContext2D, forme: FormeEtoile) {
  const c = TAILLE_ETOILE / 2;
  const { paires, epaisseur, coeur } = forme;

  // La lumière tient jusqu'au bout des branches au lieu de s'éteindre au
  // premier quart : c'est la branche qui fait l'étincelle, pas le cœur.
  // Définie autour de l'origine : les branches sont peintes dans le repère
  // déplacé au centre, où un dégradé centré sur (c, c) tomberait dans le coin.
  const lumiere = (ox: number) => {
    const d = ctx.createRadialGradient(ox, ox, 0, ox, ox, c);
    d.addColorStop(0, 'rgba(255, 255, 255, 1)');
    d.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
    d.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
    d.addColorStop(1, 'rgba(255, 255, 255, 0)');
    return d;
  };
  for (const [longueur, angle] of paires) {
    for (const quart of [0, Math.PI / 2]) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angle + quart);
      ctx.fillStyle = lumiere(0);
      ctx.beginPath();
      ctx.moveTo(-c * longueur, 0);
      ctx.lineTo(0, -epaisseur);
      ctx.lineTo(c * longueur, 0);
      ctx.lineTo(0, epaisseur);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = lumiere(c);
  ctx.beginPath();
  ctx.arc(c, c, c * coeur, 0, Math.PI * 2);
  ctx.fill();
}
