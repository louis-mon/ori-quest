import type Phaser from 'phaser';

// L'audio Web ne démarre qu'après un vrai geste utilisateur sur iOS/Safari.
export function debloquerLAudioAuPremierGeste(game: Phaser.Game) {
  const debloquer = () => {
    const ctx = (game.sound as unknown as { context?: AudioContext }).context;
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  };
  window.addEventListener('pointerdown', debloquer, { once: true });
  window.addEventListener('touchstart', debloquer, { once: true });
}
