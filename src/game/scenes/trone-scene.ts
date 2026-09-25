import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/trone';
import { boxOf, cheminOf, exitsFrom, hotspotsFrom, type Box } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerDecorProvisoire } from './decor-provisoire';
import { dessinerFeuille } from './feuille';
import { finDuChemin } from './deplacement';

// La salle du trône — point d'entrée du chapitre 3, entre la cuisine (à gauche)
// et le jardin (à droite). Voir game-design/scenes/chapter-3/salle-du-trone.md.
//
// Les chats en partent pour la cuisine quand on les invite à manger, et y
// reviennent rassasiés ; le cœur plié, ils s'en approchent et se réconcilient.
//
// ⚠ Le fond n'est pas encore peint : `decor-provisoire.ts` tient la place.

const PLAN = plan;

const HIBOU = 'hibou';
const CHAT = 'chat';
const LUNE_CHAT = 'lune_chat';

// Deux chats qui ont faim ne traînent pas.
const VITESSE_SORTIE = 220;
// Deux chats qui se sont disputés, si.
const DUREE_RAPPROCHEMENT = 2400;

export class TroneScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'trone_arrivee', flag: 'trone_vu' };

  private chat!: Phaser.GameObjects.Image;
  private luneChat!: Phaser.GameObjects.Image;
  private feuilleRouge!: Phaser.GameObjects.Graphics;
  private coeur!: OrigamiDecor;
  private empriseFeuille?: Box;
  private empriseCoeur?: Box;
  // Les chats sont à la cuisine entre l'invitation et leur retour. Leurs zones
  // s'éteignent à la fin de leur sortie et non au drapeau : `refresh()` applique
  // la visibilité AVANT de jouer le mouvement — même piège que le passage de
  // Gros Diplo (entree-scene.ts).
  private chatsSortis = false;

  constructor() {
    super({ key: 'trone', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadSprite(this, HIBOU, 'assets/decor/hibou.png');
    preloadSprite(this, CHAT, 'assets/decor/chat.png');
    preloadSprite(this, LUNE_CHAT, 'assets/decor/lune_chat.png');
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      heros: {
        knot: 'heros',
      },
      libou: {
        knot: 'trone_libou',
      },
      chat: {
        knot: 'trone_chat',
        visibleIf: () => !this.chatsSortis,
      },
      lune_chat: {
        knot: 'trone_lune_chat',
        visibleIf: () => !this.chatsSortis,
      },
      // La feuille rouge, puis le cœur qu'elle devient : une seule zone, et
      // c'est la narration qui sait laquelle des deux on regarde. Elle n'est
      // au centre de la salle qu'une fois la couronne rendue.
      coeur: {
        knot: 'trone_coeur',
        visibleIf: () => gameState.flag('couronne_rendue'),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      cuisine: {
        room: 'cuisine',
      },
      jardin: {
        room: 'jardin',
      },
    });
  }

  protected onStateChange() {
    const donnee = gameState.flag('couronne_rendue');
    const plie = gameState.flag('coeur_plie');
    this.feuilleRouge?.setVisible(donnee && !plie);
    this.coeur?.montrer(plie);
    const emprise = plie ? this.empriseCoeur : this.empriseFeuille;
    if (emprise) this.caler('coeur', emprise);
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    dessinerDecorProvisoire(this, {
      sol: boxOf(PLAN, 'dec_sol'),
      masses: [boxOf(PLAN, 'dec_mur')],
      creux: [boxOf(PLAN, 'dec_porte_cuisine'), boxOf(PLAN, 'dec_porte_jardin')],
      meubles: [boxOf(PLAN, 'dec_trone')],
    });

    // Deux boîtes, comme la montagne du village : le modèle plié étirerait la
    // feuille s'il partageait la sienne.
    this.feuilleRouge = this.add.graphics();
    this.empriseFeuille = dessinerFeuille(this.feuilleRouge, boxOf(PLAN, 'hs_coeur'), 'coeur');
    this.coeur = poserOrigami(this, 'coeur', boxOf(PLAN, 'dec_coeur'), (emprise) => {
      this.empriseCoeur = emprise;
      this.refresh();
    });

    this.caler('libou', empriseDe(placeSprite(this, HIBOU, boxOf(PLAN, 'hs_libou'))));
    this.chat = placeSprite(this, CHAT, boxOf(PLAN, 'hs_chat'));
    this.calerSur('chat', this.chat);
    this.luneChat = placeSprite(this, LUNE_CHAT, boxOf(PLAN, 'hs_lune_chat'));
    this.calerSur('lune_chat', this.luneChat);
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.brancherLesMouvements();
    this.guetterLeDenouement();

    this.add
      .text(DESIGN_WIDTH / 2, 40, 'La salle du trône', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  private brancherLesMouvements() {
    // Phaser réutilise l'instance d'un passage à l'autre.
    this.chatsSortis = false;

    // Invités à manger, les deux chats partent vers la cuisine, et n'en
    // reviennent que rassasiés : repasser par ici entre-temps ne les montre pas.
    this.auLeverDe('chats_invites', {
      pose: () => {
        if (!gameState.flag('chats_rassasies')) this.cacherLesChats();
      },
      jouer: () => {
        void (async () => {
          await Promise.all([
            this.deplacer(this.chat, cheminOf(PLAN, 'sortie_chat'), {
              vitesse: VITESSE_SORTIE,
              sortie: true,
              bloquant: true,
            }),
            this.deplacer(this.luneChat, cheminOf(PLAN, 'sortie_lune_chat'), {
              vitesse: VITESSE_SORTIE,
              sortie: true,
              bloquant: true,
            }),
          ]);
          // La scène quittée en route n'a plus de décor : on repassera par
          // `pose()` en revenant.
          if (!this.scene.isActive()) return;
          this.cacherLesChats();
          this.refresh();
        })();
      },
    });

    const versLeCoeurChat = cheminOf(PLAN, 'rapprochement_chat');
    const versLeCoeurLune = cheminOf(PLAN, 'rapprochement_lune_chat');
    this.auLeverDe('reconciliation', {
      pose: () => {
        const chat = finDuChemin(versLeCoeurChat);
        const lune = finDuChemin(versLeCoeurLune);
        this.chat.setPosition(chat.x, chat.y);
        this.luneChat.setPosition(lune.x, lune.y);
        this.caler('chat', empriseDe(this.chat));
        this.caler('lune_chat', empriseDe(this.luneChat));
      },
      jouer: () => {
        void (async () => {
          const pas = { duree: DUREE_RAPPROCHEMENT, ease: 'Sine.easeInOut', bloquant: true };
          await Promise.all([
            this.deplacer(this.chat, versLeCoeurChat, pas),
            this.deplacer(this.luneChat, versLeCoeurLune, pas),
          ]);
          if (!this.scene.isActive()) return;
          // Les aveux commentent un rapprochement : ils viennent après lui, pas
          // à la suite du `# flag:` qui l'a déclenché.
          void this.services.dialogue.run('trone_reconciliation');
        })();
      },
    });
  }

  private cacherLesChats() {
    this.chatsSortis = true;
    this.chat.setVisible(false);
    this.luneChat.setVisible(false);
  }

  // Deux cas où la pièce reprend la parole d'elle-même en y entrant. Le cœur
  // plié AVANT que les chats ne reviennent repus : c'est ici qu'ils le
  // découvrent — dans l'autre ordre, `trone_coeur_issue` enchaîne seul. Et les
  // aveux interrompus par un rechargement : la réconciliation est acquise, sa
  // fin ne l'est pas encore.
  private guetterLeDenouement() {
    const knot = gameState.flag('reconciliation')
      ? gameState.flag('histoire_finie')
        ? null
        : 'trone_reconciliation'
      : gameState.flag('coeur_plie') && gameState.flag('chats_rassasies')
        ? 'trone_retrouvailles'
        : null;
    if (!knot) return;

    // Un tap sur le décor dans l'intervalle ouvre un autre dialogue, et `run()`
    // refuserait celui-ci : on attend qu'il se referme au lieu de le perdre.
    const lancer = () => {
      if (this.services.dialogue.isRunning || this.services.overlay.occupeLeJoueur) {
        this.time.delayedCall(200, lancer);
        return;
      }
      void this.services.dialogue.run(knot);
    };
    // Le même délai que le dialogue d'arrivée, sur l'horloge de la scène.
    this.time.delayedCall(400, lancer);
  }
}
