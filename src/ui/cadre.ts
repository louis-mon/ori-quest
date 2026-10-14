import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../game/config';

// En Scale.FIT le canvas est letterboxé : sa taille et sa position ne suivent
// pas celles de la fenêtre. Sans cette synchro, l'inventaire et la 3D dérivent
// sur les bandes noires — dès qu'on quitte le 16:9, donc sur presque tous les
// téléphones.
//
// Rend `syncStage`, pour qui change la mise en page sans redimensionner la
// fenêtre (le plein écran du menu).
export function suivreLeCadre(game: Phaser.Game, stage: HTMLElement): () => void {
  const syncStage = () => {
    const canvas = game.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stage.style.left = `${rect.left}px`;
    stage.style.top = `${rect.top}px`;
    stage.style.width = `${rect.width}px`;
    stage.style.height = `${rect.height}px`;

    // L'UI est en pixels CSS : sans ce facteur elle garderait sa taille absolue
    // pendant que le jeu rétrécit. Plancher à 0.62 pour que le texte reste
    // lisible et les cibles tactiles utilisables.
    const scale = Math.max(Math.min(rect.width / DESIGN_WIDTH, 1), 0.62);
    stage.style.setProperty('--ui-scale', String(scale));
  };

  game.events.once(Phaser.Core.Events.READY, () => {
    syncStage();
    game.scale.on(Phaser.Scale.Events.RESIZE, syncStage);
  });
  window.addEventListener('resize', syncStage);
  // L'orientation change avant que le navigateur n'ait fini de recalculer la
  // mise en page : un tick de retard évite de mesurer l'ancien cadre.
  window.addEventListener('orientationchange', () => setTimeout(syncStage, 100));

  return syncStage;
}
