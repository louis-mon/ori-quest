import Phaser from 'phaser';
import { PREFERENCE_GPU } from '../gpu';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './config';

// Le jeu Phaser, sans aucune scène : c'est `Navigation` qui les ajoute et
// décide de la première.
export function creerLeMoteur(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: '#100e0c',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // `Scale.FIT` fige le tampon de rendu à 1280x720 et laisse le navigateur
    // l'agrandir : la densité de l'écran ne change rien au coût de remplissage.
    render: {
      antialias: true,
      powerPreference: PREFERENCE_GPU,
    },
    input: {
      // Par défaut Phaser double ses écouteurs sur `window` en phase de
      // CAPTURE : un tap sur un bouton de l'interface DOM était traité par le
      // jeu avant d'atteindre le bouton, et déclenchait le hotspot situé
      // dessous.
      //
      // Le canvas ne reçoit que des taps ; le seul glisser du jeu vit dans la
      // couche DOM et s'appuie sur `setPointerCapture`, qui suit le doigt hors
      // du cadre.
      windowEvents: false,
    },
    // Le son du jeu a son propre contexte (`src/sons/`). Celui de Phaser,
    // inutilisé, tournerait quand même dès le premier tap.
    audio: { noAudio: true },
    // Volontairement vide : listée ici, Phaser lancerait la première scène de
    // lui-même, sans les services que `Navigation` injecte — elle était créée
    // deux fois, et chaque création laissait un abonné `gameState` de plus.
    scene: [],
  });
}
