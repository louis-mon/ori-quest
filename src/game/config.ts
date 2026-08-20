/**
 * Résolution logique de référence. Tout le jeu est conçu dans cet espace de
 * coordonnées ; Phaser.Scale.FIT s'occupe de la mise à l'échelle et du
 * letterbox sur les écrans réels (du 16:9 au 20:9 des téléphones récents).
 */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/**
 * Taille tactile minimale recommandée (~44px CSS sur un écran de téléphone,
 * converti dans notre espace logique). Toute zone cliquable plus petite que
 * ça est injouable au doigt.
 */
export const MIN_TOUCH_SIZE = 88;

export const COLORS = {
  paper: 0xf2ece1,
  paperDark: 0xd8cdb9,
  ink: 0x1a1714,
  wood: 0x6b4c35,
  woodDark: 0x4a3524,
  accent: 0xc4553d,
  glow: 0xf0c987,
} as const;
