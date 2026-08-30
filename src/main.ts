import Phaser from 'phaser';
import './ui/style.css';

import storyJson from './generated/story.json';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './game/config';
import { PREFERENCE_GPU } from './gpu';

import { estLivree, scenesLivrees } from './game/chapitres';
import { runCreasePuzzle } from './game/puzzle/crease-puzzle';
import { PUZZLES } from './game/puzzle/puzzles';
import { lanceurTutoriel } from './game/puzzle/tutoriel';
import { DialogueRunner } from './game/systems/dialogue';
import { FIRST_ROOM, gameState } from './game/systems/state';
import { OrigamiLayer } from './origami/origami-layer';
import { pliageDe } from './origami/vue';
import { montrerFin } from './ui/fin';
import { Menu } from './ui/menu';
import { Overlay } from './ui/overlay';

// Rétablit requestAnimationFrame quand la page est masquée (volet de preview).
// Doit s'installer avant que Phaser ne capture la fonction native.
if (import.meta.env.DEV) {
  const { installHiddenPageRaf } = await import('./dev/hidden-page-raf');
  installHiddenPageRaf();
}

const uiRoot = document.getElementById('ui')!;

// Filet de sécurité pour les écouteurs de niveau fenêtre. L'étanchéité
// vis-à-vis du jeu vient de `input.windowEvents: false` plus bas.
//
// En bouillonnement : la cible traite l'événement normalement, on l'empêche
// seulement d'aller plus loin.
for (const type of ['pointerdown', 'pointerup'] as const) {
  uiRoot.addEventListener(type, (event) => {
    if (event.target !== uiRoot) event.stopPropagation();
  });
}

const overlay = new Overlay(uiRoot);
const origamiCanvas = document.getElementById('origami-canvas') as HTMLCanvasElement;
const stage = document.getElementById('stage')!;

// En Scale.FIT le canvas est letterboxé : sa taille et sa position ne suivent
// pas celles de la fenêtre. Sans cette synchro, l'inventaire et la 3D dérivent
// sur les bandes noires — dès qu'on quitte le 16:9, donc sur presque tous les
// téléphones.
function syncStage() {
  const canvas = game.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  stage.style.left = `${rect.left}px`;
  stage.style.top = `${rect.top}px`;
  stage.style.width = `${rect.width}px`;
  stage.style.height = `${rect.height}px`;

  // L'UI est en pixels CSS : sans ce facteur elle garderait sa taille absolue
  // pendant que le jeu rétrécit. Plancher à 0.62 pour que le texte reste lisible
  // et les cibles tactiles utilisables.
  const scale = Math.max(Math.min(rect.width / DESIGN_WIDTH, 1), 0.62);
  stage.style.setProperty('--ui-scale', String(scale));
}

// Instanciée à la première demande de pliage : tant que le joueur n'en a pas
// déclenché un, three.js ne coûte ni téléchargement ni contexte WebGL.
let origamiLayer: OrigamiLayer | null = null;

// Temps où le modèle reste à l'écran une fois plié. Trop court, on ne voit que
// la fin du mouvement et l'écran est déjà rendu à la scène.
const POSE_MS = 2600;

// La couche 3D est unique : présenter un objet d'inventaire pendant qu'un pliage
// est à l'écran remplacerait le modèle en cours de route. Le cas est rare, mais
// un pliage se joue justement entre deux répliques.
let pliageEnCours = false;

// Mémorisée EN PROMESSE, pas en objet : `x ??= await créer()` laisse passer deux
// appels rapprochés — l'`await` rend la main avant l'affectation — et chacun
// fabriquerait son contexte WebGL sur la même toile, dont l'un resterait
// orphelin. `origamiLayer` reste à côté pour les appels synchrones (`hide()`).
let couchePromesse: Promise<OrigamiLayer> | null = null;

function couche(): Promise<OrigamiLayer> {
  couchePromesse ??= OrigamiLayer.create(origamiCanvas)
    .then((layer) => {
      origamiLayer = layer;
      return layer;
    })
    .catch((err) => {
      // Une création ratée ne doit pas condamner les pliages suivants.
      couchePromesse = null;
      throw err;
    });
  return couchePromesse;
}

async function playFold(name: string) {
  pliageEnCours = true;
  try {
    const layer = await couche();
    await layer.load(name);
    layer.setFold(0);
    layer.show();
    // Au pliage de ce modèle-là, pas à 1 : c'est la pose que le décor et
    // l'inventaire montreront ensuite, et la pose finale du solveur est souvent
    // tout à fait plate.
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

// Un aperçu se demande, puis s'abandonne — la description refermée, un pliage
// qui prend la couche. Le jeton dit si celui qu'on vient de charger est encore
// celui qu'on attend : sans lui, le modèle se posait sur la scène APRÈS la
// fermeture de la boîte, et son voile restait là.
let apercuDemande = 0;

overlay.brancherApercu({
  montrer(modele) {
    if (pliageEnCours) return;
    const jeton = ++apercuDemande;
    void (async () => {
      try {
        const layer = await couche();
        // Revérifié après CHAQUE attente : la couche est unique, et un pliage
        // qui démarre entre-temps lui volerait sa pose.
        if (pliageEnCours || jeton !== apercuDemande) return;
        await layer.load(modele);
        if (pliageEnCours || jeton !== apercuDemande) return;
        layer.presenter(pliageDe(modele));
      } catch (err) {
        // Regarder un objet ne doit rien casser : sans modèle, il reste sa
        // description.
        console.error(`[origami] aperçu de "${modele}" impossible`, err);
      }
    })();
  },
  cacher() {
    apercuDemande++;
    if (!pliageEnCours) origamiLayer?.hide();
  },
});

// Publie l'issue dans un drapeau `<nom>_resolu`, que la narration relit juste
// après. Montée dans la couche DOM, ce qui permet un glisser-déposer fiable
// malgré `input.windowEvents: false`.
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
    // Un crease pattern manquant ne doit pas bloquer la partie : on repart comme
    // d'un abandon, la narration a déjà une branche pour ça.
    console.error(`[puzzle] "${name}" n'a pas pu s'ouvrir`, err);
    gameState.setFlag(`${name}_resolu`, false);
  }
}

// Un seul chemin pour les deux façons de changer de scène — le tag `# goto:` et
// la flèche — sinon l'une des deux oublie d'enregistrer la pièce courante.
const goto = (room: string) => {
  // Une destination absente de cette version termine la partie sur « À suivre… »
  // (src/game/chapitres.ts). Et surtout sans `goTo()` : la sauvegarde doit rester
  // sur une pièce que ce build sait rouvrir.
  if (!estLivree(room)) {
    finirLaPartie();
    return;
  }

  gameState.goTo(room);

  // `start` démarre la scène demandée mais n'arrête pas celle qu'on quitte : les
  // deux resteraient actives, avec deux décors superposés et deux jeux de zones
  // tactiles.
  for (const active of game.scene.getScenes(true)) {
    if (active.scene.key !== room) game.scene.stop(active.scene.key);
  }

  game.scene.start(room, { overlay, dialogue, goto });
};

// Ici et pas dans l'état : `gameState.give()` sert aussi à restaurer une
// sauvegarde et à sauter à un point d'étape, où il n'y a rien à annoncer. Seul
// le tag `# give:` est une obtention — et pas quand l'objet est déjà là, sinon
// un `# give:` rejoué ferait voler une seconde hache.
function donner(item: string) {
  if (!gameState.has(item)) overlay.annoncerObtention(item);
  gameState.give(item);
}

const dialogue = new DialogueRunner(storyJson, overlay, {
  origami: playFold,
  puzzle: playPuzzle,
  goto,
  donner,
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
  // `Scale.FIT` fige le tampon de rendu à 1280x720 et laisse le navigateur
  // l'agrandir : la densité de l'écran ne change rien au coût de remplissage.
  render: {
    antialias: true,
    powerPreference: PREFERENCE_GPU,
  },
  input: {
    // Par défaut Phaser double ses écouteurs sur `window` en phase de CAPTURE :
    // un tap sur un bouton de l'interface DOM était traité par le jeu avant
    // d'atteindre le bouton, et déclenchait le hotspot situé dessous.
    //
    // Le canvas ne reçoit que des taps ; le seul glisser du jeu vit dans la
    // couche DOM et s'appuie sur `setPointerCapture`, qui suit le doigt hors du
    // cadre.
    windowEvents: false,
  },
  // Volontairement vide : listée ici, Phaser lancerait la première scène de
  // lui-même, sans les services que main.ts injecte — elle était créée deux fois,
  // et chaque création laissait un abonné `gameState` de plus.
  scene: [],
});

if (import.meta.env.DEV) {
  // Accès depuis la console, en développement : `etat.setFlag('pont_plie')`
  // vérifie une branche de dialogue sans sauvegarde bricolée, `plier('arbre')`
  // rejoue un pliage sans refaire l'énigme, `donner('bois')` rejoue une
  // obtention sans retraverser le dialogue.
  Object.assign(window, { game, etat: gameState, plier: playFold, donner });
}

// Le menu reste atteignable pendant un déplacement bloquant, où plus rien
// d'autre ne l'est : la scène s'arrête donc tant qu'il est ouvert, sinon l'objet
// qu'on regardait traverser finit sa course derrière le panneau et le joueur
// rouvre les yeux sur une pièce qui a changé sans lui.
//
// Une scène en pause ne se contente pas de suspendre ses tweens : Phaser coupe
// aussi son plugin d'entrée, donc le décor ne répond plus non plus. Et on
// interroge TOUTES les scènes, pas seulement les actives — une scène en pause
// n'est justement plus « active », et personne ne la relancerait.
function figerLeJeu(gele: boolean) {
  for (const scene of game.scene.getScenes(false)) {
    const cle = scene.scene.key;
    if (gele) {
      if (scene.scene.isActive()) game.scene.pause(cle);
    } else if (scene.scene.isPaused()) {
      game.scene.resume(cle);
    }
  }
}

// Fin de la version : le chapitre suivant n'est pas dans ce build. La scène est
// gelée plutôt qu'arrêtée — une scène en pause reste dessinée, et le décor qu'on
// vient de quitter fait un meilleur fond de fin qu'un cadre noir —, et l'écran
// couvre le menu : il n'y a plus rien à reprendre, seulement à recommencer.
function finirLaPartie() {
  figerLeJeu(true);
  montrerFin(uiRoot);
}

new Menu(uiRoot, { onLayoutChange: syncStage, onGel: figerLeJeu });

game.events.once(Phaser.Core.Events.READY, () => {
  gameState.load();
  syncStage();
  game.scale.on(Phaser.Scale.Events.RESIZE, syncStage);

  // Troisième argument à false : les scènes ne démarrent pas d'elles-mêmes.
  for (const [piece, Scene] of scenesLivrees()) game.scene.add(piece, Scene, false);

  // La scène restaurée depuis la sauvegarde : repartir systématiquement de la
  // première renverrait le joueur en arrière à chaque retour dans le jeu. Une
  // sauvegarde peut toutefois nommer une pièce absente de ce build — une partie
  // commencée sur une version de développement —, et démarrer une scène jamais
  // enregistrée ne donne qu'un écran noir.
  const piece = estLivree(gameState.room) ? gameState.room : FIRST_ROOM;
  game.scene.start(piece, { overlay, dialogue, goto });
});

window.addEventListener('resize', syncStage);
// L'orientation change avant que le navigateur n'ait fini de recalculer la mise
// en page : un tick de retard évite de mesurer l'ancien cadre.
window.addEventListener('orientationchange', () => setTimeout(syncStage, 100));

// Dernier moment fiable pour écrire sur iOS : l'onglet peut être tué ensuite.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') gameState.save();
});
window.addEventListener('pagehide', () => gameState.save());

// L'audio Web ne démarre qu'après un vrai geste utilisateur sur iOS/Safari.
const unlockAudio = () => {
  const ctx = (game.sound as unknown as { context?: AudioContext }).context;
  if (ctx && ctx.state === 'suspended') void ctx.resume();
};
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('touchstart', unlockAudio, { once: true });
