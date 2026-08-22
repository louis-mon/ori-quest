import Phaser from 'phaser';
import './ui/style.css';

import storyJson from './generated/story.json';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './game/config';

import { PontScene } from './game/scenes/pont-scene';
import { PorteScene } from './game/scenes/porte-scene';
import { runCreasePuzzle } from './game/puzzle/crease-puzzle';
import { PUZZLES } from './game/puzzle/puzzles';
import { lanceurTutoriel } from './game/puzzle/tutoriel';
import { DialogueRunner } from './game/systems/dialogue';
import { gameState } from './game/systems/state';
import { OrigamiLayer } from './origami/origami-layer';
import { pliageDe } from './origami/vue';
import { Menu } from './ui/menu';
import { Overlay } from './ui/overlay';

// Rétablit requestAnimationFrame quand la page est masquée (volet de preview).
// Doit s'installer avant que Phaser ne capture la fonction native.
if (import.meta.env.DEV) {
  const { installHiddenPageRaf } = await import('./dev/hidden-page-raf');
  installHiddenPageRaf();
}

const uiRoot = document.getElementById('ui')!;

/**
 * Empêche les taps sur l'interface de se propager au-delà de la couche DOM.
 *
 * Filet de sécurité pour les écouteurs de niveau fenêtre (fermeture du menu au
 * tap extérieur, par exemple). L'étanchéité vis-à-vis du jeu, elle, vient de
 * `input.windowEvents: false` dans la configuration Phaser plus bas : Phaser
 * écoutait en phase de *capture*, donc traitait l'événement avant qu'il ne
 * parvienne ici.
 *
 * On écoute en bouillonnement : la cible doit d'abord traiter l'événement
 * normalement ; on ne fait que l'empêcher d'aller plus loin. `#ui` a
 * `pointer-events: none`, donc seul un vrai élément d'interface peut être cible.
 */
for (const type of ['pointerdown', 'pointerup'] as const) {
  uiRoot.addEventListener(type, (event) => {
    if (event.target !== uiRoot) event.stopPropagation();
  });
}

const overlay = new Overlay(uiRoot);
const origamiCanvas = document.getElementById('origami-canvas') as HTMLCanvasElement;
const stage = document.getElementById('stage')!;

/**
 * Recale la couche DOM/3D sur le canvas Phaser.
 *
 * En Scale.FIT le canvas est letterboxé : sa taille et sa position ne suivent
 * pas celles de la fenêtre. Sans cette synchro, l'inventaire et la 3D
 * atterrissent sur les bandes noires — très visible dès qu'on quitte le 16:9,
 * c'est-à-dire sur à peu près tous les téléphones.
 */
function syncStage() {
  const canvas = game.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  stage.style.left = `${rect.left}px`;
  stage.style.top = `${rect.top}px`;
  stage.style.width = `${rect.width}px`;
  stage.style.height = `${rect.height}px`;

  // L'UI est en DOM, donc en pixels CSS : sans ce facteur elle garderait sa
  // taille absolue pendant que le jeu rétrécit, et mangerait tout le cadre sur
  // un petit écran. Plancher à 0.62 pour que le texte reste lisible et les
  // cibles tactiles utilisables.
  const scale = Math.max(Math.min(rect.width / DESIGN_WIDTH, 1), 0.62);
  stage.style.setProperty('--ui-scale', String(scale));
}

/**
 * La couche origami (et donc three.js) n'est instanciée qu'à la première
 * demande de pliage. Tant que le joueur n'en a pas déclenché un, elle ne coûte
 * ni téléchargement ni contexte WebGL supplémentaire.
 */
let origamiLayer: OrigamiLayer | null = null;

/**
 * Temps pendant lequel le modèle reste à l'écran une fois plié.
 *
 * C'est le moment que le jeu doit récompenser : l'objet vient d'apparaître, il
 * se balance doucement, on le regarde. Trop court, on ne voyait que la fin du
 * mouvement et l'écran était déjà rendu à la scène. Le joueur pourra ensuite le
 * revoir tourner sur lui-même en le tapant dans son inventaire.
 */
const POSE_MS = 2600;

/**
 * Vrai pendant qu'un pliage se joue.
 *
 * La couche 3D est unique : présenter un objet d'inventaire pendant qu'un
 * pliage est à l'écran remplacerait le modèle en cours de route. Le cas est
 * rare — l'inventaire est inerte pendant une réplique — mais un pliage se joue
 * justement entre deux répliques.
 */
let pliageEnCours = false;

/** Instancie la couche 3D à la première demande, quelle qu'elle soit. */
async function couche(): Promise<OrigamiLayer> {
  origamiLayer ??= await OrigamiLayer.create(origamiCanvas);
  return origamiLayer;
}

async function playFold(name: string) {
  pliageEnCours = true;
  try {
    const layer = await couche();
    await layer.load(name);
    layer.setFold(0);
    layer.show();
    // On s'arrête au pliage de ce modèle-là, pas à 1 : c'est exactement la pose
    // que le décor et l'inventaire montreront ensuite (voir origami/vue.ts), et
    // la pose finale du solveur est souvent tout à fait plate.
    await layer.playTo(pliageDe(name), 2600);
    await new Promise((r) => setTimeout(r, POSE_MS));
    layer.hide();
  } catch (err) {
    // Une animation manquante ne doit jamais bloquer la progression.
    console.error(`[origami] lecture de "${name}" impossible`, err);
    origamiLayer?.hide();
  } finally {
    pliageEnCours = false;
  }
}

/**
 * Montre un modèle plié en grand, tournant sur lui-même, tant que le joueur
 * regarde l'objet correspondant dans son inventaire.
 */
overlay.brancherApercu({
  montrer(modele) {
    if (pliageEnCours) return;
    void (async () => {
      try {
        const layer = await couche();
        // La couche a pu être rendue à autre chose pendant le chargement.
        if (pliageEnCours) return;
        await layer.load(modele);
        layer.presenter(pliageDe(modele));
      } catch (err) {
        // Regarder un objet ne doit jamais rien casser : sans modèle, il reste
        // sa description.
        console.error(`[origami] aperçu de "${modele}" impossible`, err);
      }
    })();
  },
  cacher() {
    if (!pliageEnCours) origamiLayer?.hide();
  },
});

/**
 * Ouvre l'énigme demandée et publie son issue dans un drapeau `<nom>_resolu`,
 * que la narration relit juste après (voir content/story.ink).
 *
 * L'énigme est montée dans la couche DOM, au-dessus du canvas : c'est là que
 * vit toute l'interface, et c'est ce qui permet un glisser-déposer fiable
 * malgré `input.windowEvents: false`.
 */
async function playPuzzle(name: string) {
  const def = PUZZLES[name];
  if (!def) {
    console.error(`[puzzle] énigme inconnue : "${name}"`);
    return;
  }
  try {
    overlay.hideDialogue();
    const outcome = await runCreasePuzzle(uiRoot, def, {
      tutoriel: lanceurTutoriel(uiRoot, overlay, def),
    });
    gameState.setFlag(`${name}_resolu`, outcome === 'solved');
  } catch (err) {
    // Un crease pattern manquant ne doit pas bloquer la partie : on repart
    // comme d'un abandon, la narration a déjà une branche pour ça.
    console.error(`[puzzle] "${name}" n'a pas pu s'ouvrir`, err);
    gameState.setFlag(`${name}_resolu`, false);
  }
}

/**
 * Change de scène. Un seul chemin pour les deux façons d'en changer — le tag
 * ink `# goto:` et la flèche de navigation d'une scène — sinon l'une des deux
 * finit par oublier d'enregistrer la pièce courante.
 */
const goto = (room: string) => {
  gameState.goTo(room);

  // `start` démarre la scène demandée mais **n'arrête pas** celle qu'on quitte :
  // les deux resteraient actives, avec deux décors superposés et deux jeux de
  // zones tactiles. Invisible tant que le jeu n'avait qu'une pièce.
  for (const active of game.scene.getScenes(true)) {
    if (active.scene.key !== room) game.scene.stop(active.scene.key);
  }

  game.scene.start(room, { overlay, dialogue, goto });
};

const dialogue = new DialogueRunner(storyJson, overlay, {
  origami: playFold,
  puzzle: playPuzzle,
  goto,
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#100e0c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Sur mobile, un devicePixelRatio de 3 triple le coût de remplissage pour
  // un gain visuel marginal sur un décor 2D. On plafonne à 2.
  render: {
    antialias: true,
    powerPreference: 'low-power',
  },
  input: {
    // Par défaut Phaser double ses écouteurs sur `window`, en phase de
    // *capture*, pour rattraper les relâchements hors canvas. Résultat : un tap
    // sur un bouton de l'interface DOM était traité par le jeu avant même
    // d'atteindre le bouton, et déclenchait le hotspot situé dessous.
    //
    // Le canvas ne reçoit que des taps. Le seul glisser du jeu — les pièces
    // d'énigme — vit dans la couche DOM et s'appuie sur `setPointerCapture`,
    // qui suit le doigt même hors du cadre. Se limiter au canvas ne coûte donc
    // rien et rend la couche DOM réellement étanche.
    windowEvents: false,
  },
  // Volontairement vide : les scènes sont enregistrées plus bas *sans* démarrage
  // automatique. Listée ici, Phaser lancerait la première de lui-même, sans les
  // services que main.ts injecte — la scène était alors créée deux fois, et
  // chaque création laissait un abonné `gameState` de plus derrière elle.
  scene: [],
});

if (import.meta.env.DEV) {
  // Accès au jeu et à l'état depuis la console, en développement seulement.
  // `etat` évite d'avoir à passer par une sauvegarde bricolée dans localStorage
  // pour vérifier une branche de dialogue : `etat.setFlag('pont_plie')` suffit,
  // et les scènes se mettent à jour toutes seules par l'abonnement.
  // `plier('arbre')` rejoue une animation de pliage sans avoir à refaire
  // l'énigme : c'est l'outil de réglage de la caméra et des textures.
  Object.assign(window, { game, etat: gameState, plier: playFold });
}

new Menu(uiRoot, { onLayoutChange: syncStage });

game.events.once(Phaser.Core.Events.READY, () => {
  gameState.load();
  syncStage();
  game.scale.on(Phaser.Scale.Events.RESIZE, syncStage);

  // Troisième argument à false : les scènes ne démarrent pas d'elles-mêmes.
  game.scene.add('pont', PontScene, false);
  game.scene.add('porte', PorteScene, false);

  // La scène restaurée depuis la sauvegarde, ou FIRST_ROOM pour une partie
  // neuve : reprendre systématiquement à la première scène renverrait le joueur
  // en arrière à chaque retour dans le jeu.
  game.scene.start(gameState.room, { overlay, dialogue, goto });
});

window.addEventListener('resize', syncStage);
// L'orientation change avant que le navigateur n'ait fini de recalculer la
// mise en page : un tick de retard évite de mesurer l'ancien cadre.
window.addEventListener('orientationchange', () => setTimeout(syncStage, 100));

// Sauvegarde opportuniste : quand l'onglet passe en arrière-plan, c'est le
// dernier moment fiable pour écrire sur iOS (l'onglet peut être tué ensuite).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') gameState.save();
});
window.addEventListener('pagehide', () => gameState.save());

// L'audio Web ne démarre qu'après un vrai geste utilisateur sur iOS/Safari.
// On débloque le contexte au premier contact, quel qu'il soit.
const unlockAudio = () => {
  const ctx = (game.sound as unknown as { context?: AudioContext }).context;
  if (ctx && ctx.state === 'suspended') void ctx.resume();
};
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('touchstart', unlockAudio, { once: true });
