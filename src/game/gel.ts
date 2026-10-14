import type Phaser from 'phaser';

// Le menu reste atteignable pendant un déplacement bloquant, où plus rien
// d'autre ne l'est : la scène s'arrête donc tant qu'il est ouvert, sinon l'objet
// qu'on regardait traverser finit sa course derrière le panneau et le joueur
// rouvre les yeux sur une pièce qui a changé sans lui.
//
// Une scène en pause ne se contente pas de suspendre ses tweens : Phaser coupe
// aussi son plugin d'entrée, donc le décor ne répond plus non plus. Et on
// interroge TOUTES les scènes, pas seulement les actives — une scène en pause
// n'est justement plus « active », et personne ne la relancerait.
export function figerLeJeu(game: Phaser.Game, gele: boolean) {
  for (const scene of game.scene.getScenes(false)) {
    const cle = scene.scene.key;
    if (gele) {
      if (scene.scene.isActive()) game.scene.pause(cle);
    } else if (scene.scene.isPaused()) {
      game.scene.resume(cle);
    }
  }
}
