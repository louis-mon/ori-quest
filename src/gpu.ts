/**
 * Quelle carte graphique le jeu demande au navigateur.
 *
 * Sur téléphone le drapeau ne choisit rien — un seul GPU. Sur un portable à
 * deux cartes il choisit, et `low-power` prenait la plus faible : mesuré sur le
 * MacBook Pro 16" 2019, un facteur 10 en remplissage entre l'Intel UHD 630 et
 * la Radeon Pro 5500M. D'où un réglage invisible là où on teste le jeu, et
 * décisif ailleurs.
 *
 * ⚠ Les trois contextes WebGL de la page — Phaser, la couche de pliage,
 * l'atelier d'aperçus — doivent demander la même chose. Sur deux cartes
 * différentes, le compositeur recopie chaque frame de l'une à l'autre, ce qui
 * coûte plus cher que de tout laisser sur la carte lente.
 *
 * Le critère est le pointeur, pas l'agent utilisateur : la question est « faut-il
 * ménager une batterie », et un tap y répond mieux qu'un nom de système.
 */
export const PREFERENCE_GPU: WebGLPowerPreference = window.matchMedia('(pointer: coarse)').matches
  ? 'low-power'
  : 'high-performance';
