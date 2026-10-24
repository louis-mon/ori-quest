import type Phaser from 'phaser';
import { montrerFin, type RaisonDeFin } from '../ui/fin';
import { estLivree, scenesLivrees, sortDeLaTraversee } from './chapitres';
import { figerLeJeu } from './gel';
import type { SceneServices } from './scenes/point-click-scene';
import { FIRST_ROOM, gameState } from './systems/state';

// Quelle pièce est à l'écran : celle de la sauvegarde au lancement, celle d'un
// `# goto:` ou d'une flèche ensuite — ou l'écran de fin, quand la partie ne va
// pas plus loin.
//
// Les services sont lus à chaque démarrage de scène, et non reçus une fois pour
// toutes : le récit a besoin de `goto` pour exister, et les scènes du récit.
export class Navigation {
  constructor(
    private game: Phaser.Game,
    private uiRoot: HTMLElement,
    private services: () => Omit<SceneServices, 'goto'>,
  ) {}

  // Les scènes livrées, puis la pièce de la sauvegarde. À l'événement READY de
  // Phaser, l'état déjà chargé.
  demarrer() {
    // Troisième argument à false : les scènes ne démarrent pas d'elles-mêmes.
    for (const [piece, Scene] of scenesLivrees()) this.game.scene.add(piece, Scene, false);

    // La scène restaurée depuis la sauvegarde : repartir systématiquement de la
    // première renverrait le joueur en arrière à chaque retour dans le jeu. Une
    // sauvegarde peut toutefois nommer une pièce absente de ce build — une
    // partie commencée sur une version de développement —, et démarrer une
    // scène jamais enregistrée ne donne qu'un écran noir.
    const piece = estLivree(gameState.room) ? gameState.room : FIRST_ROOM;
    this.lancer(piece);

    // Une histoire finie ne se rouvre pas au rechargement, seulement au
    // « Recommencer » de l'écran de fin (`fin.ts`) : sans ce garde, une partie
    // terminée reprenait comme si de rien n'était, château rendu jouable à
    // volonté — la scène est démarrée d'abord pour lui servir de fond, comme au
    // fondu de fin de chapitre.
    if (gameState.flag('histoire_finie')) this.finir('histoire');
  }

  // Un seul chemin pour les deux façons de changer de scène — le tag `# goto:`
  // et la flèche — sinon l'une des deux oublie d'enregistrer la pièce courante.
  goto = (room: string) => {
    // Deux façons de finir ici plutôt que de changer de scène : une destination
    // que ce build ne contient pas, et une qui sort de la traversée livrée — un
    // chapitre qu'on n'atteint que par le menu (src/game/chapitres.ts). Et
    // surtout sans `goTo()` : la sauvegarde doit rester sur une pièce que ce
    // build sait rouvrir.
    if (!estLivree(room) || sortDeLaTraversee(gameState.room, room)) {
      this.finir();
      return;
    }

    gameState.goTo(room);

    // `start` démarre la scène demandée mais n'arrête pas celle qu'on quitte :
    // les deux resteraient actives, avec deux décors superposés et deux jeux de
    // zones tactiles.
    for (const active of this.game.scene.getScenes(true)) {
      if (active.scene.key !== room) this.game.scene.stop(active.scene.key);
    }

    this.lancer(room);
  };

  // Fin de la version — le chapitre suivant n'est pas dans ce build —, ou de
  // l'histoire. La scène est gelée plutôt qu'arrêtée — une scène en pause reste
  // dessinée, et le décor qu'on vient de quitter fait un meilleur fond de fin
  // qu'un cadre noir —, et l'écran couvre le menu : il n'y a plus rien à
  // reprendre, seulement à recommencer.
  finir = (raison: RaisonDeFin = 'version') => {
    figerLeJeu(this.game, true);
    montrerFin(this.uiRoot, raison);
  };

  private lancer(piece: string) {
    const services: SceneServices = { ...this.services(), goto: this.goto };
    this.game.scene.start(piece, services);
  }
}
