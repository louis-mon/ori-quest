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
import { poserFeuillesPrecieuses, type FeuillesPrecieuses } from './feuilles-precieuses';
import { finDuChemin } from './deplacement';
import { placerLuneChat, preloadLuneChat, type LuneChat } from './lune-chat';

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

// Deux chats qui ont faim ne traînent pas.
const VITESSE_SORTIE = 220;
// Deux chats qui se sont disputés, si.
const DUREE_RAPPROCHEMENT = 2400;
// Le délai du dialogue d'arrivée : la pièce peint sa première image d'abord.
const DELAI_DENOUEMENT = 400;

export class TroneScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'trone_arrivee', flag: 'trone_vu' };

  private chat!: Phaser.GameObjects.Image;
  private luneChat!: LuneChat;
  private feuilles!: FeuillesPrecieuses;
  private coeur!: OrigamiDecor;
  private empriseCoeur?: Box;
  // Les chats sont à la cuisine entre l'invitation et leur retour. Leurs zones
  // s'éteignent à la fin de leur sortie et non au drapeau : `refresh()` applique
  // la visibilité AVANT de jouer le mouvement — même piège que le passage de
  // Gros Diplo (entree-scene.ts).
  private chatsSortis = false;
  private denouementArme = false;

  constructor() {
    super({ key: 'trone', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadSprite(this, HIBOU, 'assets/decor/hibou.png');
    preloadSprite(this, CHAT, 'assets/decor/chat.png');
    preloadLuneChat(this);
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
      // Les quatre feuilles de la reine, puis le cœur que la rouge devient :
      // une seule zone, et c'est la narration qui sait lequel des deux on
      // regarde. Elles ne sont au centre de la salle qu'une fois la couronne
      // rendue.
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
    // Plié, le cœur prend toute la place : les trois autres feuilles, restées
    // là, se liraient comme une chose de plus à examiner.
    this.feuilles?.groupe.setVisible(donnee && !plie);
    this.coeur?.montrer(plie);
    const emprise = plie ? this.empriseCoeur : this.feuilles?.emprise;
    if (emprise) this.caler('coeur', emprise);

    if (plie && gameState.flag('chats_rassasies') && !gameState.flag('histoire_finie')) {
      this.armerLeDenouement();
    }
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

    // Deux boîtes, comme la montagne du village : la rangée de feuilles et le
    // cœur plié n'ont ni la même forme ni la même place.
    this.feuilles = poserFeuillesPrecieuses(this, boxOf(PLAN, 'hs_coeur'));
    this.coeur = poserOrigami(this, 'coeur', boxOf(PLAN, 'dec_coeur'), (emprise) => {
      this.empriseCoeur = emprise;
      this.refresh();
    });

    this.caler('libou', empriseDe(placeSprite(this, HIBOU, boxOf(PLAN, 'hs_libou'))));
    this.chat = placeSprite(this, CHAT, boxOf(PLAN, 'hs_chat'));
    this.calerSur('chat', this.chat);
    this.luneChat = placerLuneChat(this, boxOf(PLAN, 'hs_lune_chat'));
    this.calerSur('lune_chat', this.luneChat.conteneur, this.luneChat.emprise);
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.brancherLesMouvements();

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
    this.denouementArme = false;

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
            this.deplacer(this.luneChat.conteneur, cheminOf(PLAN, 'sortie_lune_chat'), {
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

    // Seulement derrière l'écran de fin, rouvert au chargement (main.ts).
    if (gameState.flag('histoire_finie')) {
      const chat = finDuChemin(cheminOf(PLAN, 'rapprochement_chat'));
      const lune = finDuChemin(cheminOf(PLAN, 'rapprochement_lune_chat'));
      this.chat.setPosition(chat.x, chat.y);
      this.luneChat.conteneur.setPosition(lune.x, lune.y);
      this.caler('chat', empriseDe(this.chat));
      this.caler('lune_chat', this.luneChat.emprise());
    }
  }

  private cacherLesChats() {
    this.chatsSortis = true;
    this.chat.setVisible(false);
    this.luneChat.conteneur.setVisible(false);
  }

  // Le cœur plié et les chats repus, dans un ordre ou dans l'autre : la scène
  // finale — retrouvailles, rapprochement, aveux — se joue d'un seul tenant.
  //
  // Le décor se ferme dès cet instant, pas au lancement : entre les deux, un
  // tap sur un personnage ouvrirait une conversation hors récit, qui retarderait
  // la fin et parlerait d'une réconciliation qui n'a pas eu lieu.
  private armerLeDenouement() {
    if (this.denouementArme) return;
    this.denouementArme = true;
    void this.enAttendant(this.jouerLeDenouement());
  }

  // UNE transaction pour les trois temps, comme une conversation (state.ts) :
  // rechargée en route, la scène finale n'a pas eu lieu, et se rejoue depuis
  // les retrouvailles. Ouverte seulement une fois la boîte du cœur refermée, pour
  // que le pliage, lui, reste acquis.
  private async jouerLeDenouement() {
    await this.quandLeRecitSeTait(DELAI_DENOUEMENT);
    let quittee = false;
    const fermer = gameState.ouvrirUneTransaction();
    const surShutdown = () => {
      quittee = true;
      fermer();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, surShutdown);
    try {
      await this.services.dialogue.run('trone_retrouvailles');
      if (quittee) return;
      const pas = { duree: DUREE_RAPPROCHEMENT, ease: 'Sine.easeInOut' };
      await Promise.all([
        this.deplacer(this.chat, cheminOf(PLAN, 'rapprochement_chat'), pas),
        this.deplacer(this.luneChat.conteneur, cheminOf(PLAN, 'rapprochement_lune_chat'), pas),
      ]);
      if (quittee) return;
      await this.services.dialogue.run('trone_reconciliation');
    } finally {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, surShutdown);
      fermer();
    }
  }
}
