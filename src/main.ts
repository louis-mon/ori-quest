import Phaser from 'phaser';
import './ui/style.css';

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
import { demarrerLeSonAuPremierGeste } from './sons/contexte';
import { suivreLeCadre } from './ui/cadre';
import { figerLesCredits } from './ui/credits';
import { isolerLInterface } from './ui/isolation';
import { EcranDeChargement } from './ui/chargement';
import { Menu } from './ui/menu';
import { Overlay } from './ui/overlay';
import { garderLePleinEcranAuRechargement } from './ui/plein-ecran';
import { retirerLePrechargement } from './ui/prechargement';
import { direQueWebGLManque, webglDisponible } from './ui/sans-webgl';

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
const chargement = new EcranDeChargement(uiRoot);
if (!webglDisponible()) direQueWebGLManque(uiRoot);

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
  chargement,
}));
const dialogue: DialogueRunner = new DialogueRunner(
  recitDansLaLangue(),
  overlay,
  effetsDuRecit(uiRoot, overlay, chargement, couche, navigation, () => couvrirLeJeu(game)),
);

const menu = new Menu(uiRoot, {
  rideau,
  chargement,
  onLayoutChange: syncStage,
  onGel: (gele) => {
    figerLeJeu(game, gele);
    figerLesCredits(gele);
  },
});

game.events.once(Phaser.Core.Events.READY, () => {
  retirerLePrechargement();
  gameState.load();
  if (!gameState.commencee) menu.accueillir();
  navigation.demarrer();
});

sauverALaSortie();
garderLePleinEcranAuRechargement();
demarrerLeSonAuPremierGeste();

if (import.meta.env.DEV) {
  const { exposerALaConsole } = await import('./dev/console');
  exposerALaConsole({
    game,
    etat: gameState,
    plier: couche.plier,
    donner: (item: string) => donner(overlay, item),
  });
}
