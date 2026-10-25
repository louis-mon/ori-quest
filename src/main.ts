import Phaser from 'phaser';
import './ui/style.css';

import { debloquerLAudioAuPremierGeste } from './audio';
import { donner, effetsDuRecit } from './game/effets-du-recit';
import { couvrirLeJeu, figerLeJeu } from './game/gel';
import { creerLeMoteur } from './game/moteur';
import { Navigation } from './game/navigation';
import { Rideau } from './game/rideau';
import { DialogueRunner } from './game/systems/dialogue';
import { sauverALaSortie } from './game/systems/sauvegarde-a-la-sortie';
import { gameState } from './game/systems/state';
import { traduireLaPage } from './langues/page';
import { recitDansLaLangue } from './langues/traduire';
import { CoucheDuRecit } from './origami/couche-du-recit';
import { suivreLeCadre } from './ui/cadre';
import { figerLesCredits } from './ui/credits';
import { isolerLInterface } from './ui/isolation';
import { Menu } from './ui/menu';
import { Overlay } from './ui/overlay';
import { garderLePleinEcranAuRechargement } from './ui/plein-ecran';

// Rétablit requestAnimationFrame quand la page est masquée (volet de preview).
// Doit s'installer avant que Phaser ne capture la fonction native.
if (import.meta.env.DEV) {
  const { installHiddenPageRaf } = await import('./dev/hidden-page-raf');
  installHiddenPageRaf();
}

traduireLaPage();

const uiRoot = document.getElementById('ui')!;
isolerLInterface(uiRoot);
const overlay = new Overlay(uiRoot);

const game = creerLeMoteur();
const syncStage = suivreLeCadre(game, document.getElementById('stage')!);

const couche = new CoucheDuRecit(document.getElementById('origami-canvas') as HTMLCanvasElement);
overlay.brancherApercu(couche.apercu);

const rideau = new Rideau();

// Le récit a besoin de la navigation (`# goto:`), et les scènes que la
// navigation démarre ont besoin du récit : celle-ci le lit au démarrage.
const navigation: Navigation = new Navigation(game, uiRoot, () => ({
  overlay,
  dialogue,
  rideau,
}));
const dialogue: DialogueRunner = new DialogueRunner(
  recitDansLaLangue(),
  overlay,
  effetsDuRecit(uiRoot, overlay, couche, navigation, () => couvrirLeJeu(game)),
);

const menu = new Menu(uiRoot, {
  rideau,
  onLayoutChange: syncStage,
  onGel: (gele) => {
    figerLeJeu(game, gele);
    figerLesCredits(gele);
  },
});

game.events.once(Phaser.Core.Events.READY, () => {
  gameState.load();
  if (!gameState.commencee) menu.accueillir();
  navigation.demarrer();
});

sauverALaSortie();
garderLePleinEcranAuRechargement();
debloquerLAudioAuPremierGeste(game);

if (import.meta.env.DEV) {
  const { exposerALaConsole } = await import('./dev/console');
  exposerALaConsole({
    game,
    etat: gameState,
    plier: couche.plier,
    donner: (item: string) => donner(overlay, item),
  });
}
