// Sur téléphone, le drapeau ne choisit rien. Sur un portable à deux cartes,
// `low-power` prenait la plus faible : facteur 10 en remplissage entre l'Intel
// UHD 630 et la Radeon Pro 5500M d'un MacBook Pro 16" 2019.
//
// ⚠ Les trois contextes WebGL de la page — Phaser, la couche de pliage,
// l'atelier d'aperçus — doivent demander la MÊME chose : sur deux cartes
// différentes, le compositeur recopie chaque frame de l'une à l'autre.
//
// Le critère est le pointeur et non l'agent utilisateur : la question est
// « faut-il ménager une batterie ».
export const PREFERENCE_GPU: WebGLPowerPreference = window.matchMedia('(pointer: coarse)').matches
  ? 'low-power'
  : 'high-performance';
