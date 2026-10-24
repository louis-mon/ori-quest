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
  // Une scène en pause est redessinée quand même, à l'identique, et le flou du
  // menu se recalcule sur chacune de ces images.
  couvrir(game, 'gel', gele);
}

// Ce qui couvre tout le décor arrête Phaser, rendu compris : sous l'énigme, il
// redessinait à chaque image une scène que personne ne voit, et c'était l'essentiel
// du travail du GPU pendant qu'on glisse une pièce — sans compter les effets de
// la pièce, qui saturaient le processeur sur celle du cœur. Le canvas garde sa
// dernière image.
//
// `game.pause()` et non `loop.sleep()` : Phaser réveille sa boucle quand
// l'onglet redevient visible, il ne touche pas à sa pause. Le cadre suit
// toujours la fenêtre, Phaser se redimensionnant sur l'événement lui-même.
export function couvrirLeJeu(game: Phaser.Game): () => void {
  const jeton = {};
  couvrir(game, jeton, true);
  return () => couvrir(game, jeton, false);
}

// Le menu peut s'ouvrir sur l'énigme : le jeu ne repart qu'une fois tout levé.
const couvertures = new Set<unknown>();

function couvrir(game: Phaser.Game, raison: unknown, couvert: boolean) {
  if (couvert) couvertures.add(raison);
  else couvertures.delete(raison);
  if (couvertures.size > 0) game.pause();
  else game.resume();
}
