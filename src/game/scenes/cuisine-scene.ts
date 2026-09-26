import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/cuisine';
import { boxOf, cheminOf, exitsFrom, hotspotsFrom } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { dessinerDecorProvisoire } from './decor-provisoire';
import { placerLuneChat, preloadLuneChat, type LuneChat } from './lune-chat';

// La cuisine — à gauche de la salle du trône, chapitre 3.
// Voir game-design/scenes/chapter-3/cuisine.md.
//
// Les chats n'y sont qu'entre l'invitation à manger et la fin du repas ; on leur
// parle, et ils repartent vers la salle du trône.
//
// ⚠ Le fond n'est pas encore peint : `decor-provisoire.ts` tient la place.

const PLAN = plan;

const ELEPHANT = 'elephant_humain';
const CHAT = 'chat';

// Des chats repus ne courent plus.
const VITESSE_RETOUR = 170;

export class CuisineScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'cuisine_arrivee', flag: 'cuisine_vue' };

  private chat!: Phaser.GameObjects.Image;
  private luneChat!: LuneChat;
  // Même raison qu'à la salle du trône : la zone s'éteint au bout du trajet, pas
  // au drapeau que la narration lève avant lui.
  private chatsRepartis = false;

  constructor() {
    super({ key: 'cuisine', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadSprite(this, ELEPHANT, 'assets/decor/elephant_humain.png');
    preloadSprite(this, CHAT, 'assets/decor/chat.png');
    preloadLuneChat(this);
  }

  private chatsATable(): boolean {
    return gameState.flag('chats_invites') && !this.chatsRepartis;
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      heros: {
        knot: 'heros',
      },
      cheffe: {
        knot: 'cuisine_cheffe',
      },
      // Les deux chats mangent ensemble et répondent ensemble.
      chat: {
        knot: 'cuisine_chats',
        visibleIf: () => this.chatsATable(),
      },
      lune_chat: {
        knot: 'cuisine_chats',
        visibleIf: () => this.chatsATable(),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      trone: {
        room: 'trone',
      },
    });
  }

  protected onStateChange() {
    const aTable = this.chatsATable();
    this.chat?.setVisible(aTable);
    this.luneChat?.conteneur.setVisible(aTable);
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    dessinerDecorProvisoire(this, {
      sol: boxOf(PLAN, 'dec_sol'),
      masses: [boxOf(PLAN, 'dec_mur')],
      creux: [boxOf(PLAN, 'dec_porte_trone')],
      meubles: [boxOf(PLAN, 'dec_fourneau')],
    });

    this.caler('cheffe', empriseDe(placeSprite(this, ELEPHANT, boxOf(PLAN, 'hs_cheffe'))));
    this.chat = placeSprite(this, CHAT, boxOf(PLAN, 'hs_chat'));
    this.calerSur('chat', this.chat);
    this.luneChat = placerLuneChat(this, boxOf(PLAN, 'hs_lune_chat'));
    this.calerSur('lune_chat', this.luneChat.conteneur, this.luneChat.emprise);
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.brancherLesMouvements();

    this.add
      .text(DESIGN_WIDTH / 2, 40, 'La cuisine', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  private brancherLesMouvements() {
    // Phaser réutilise l'instance d'un passage à l'autre.
    this.chatsRepartis = false;

    this.auLeverDe('chats_rassasies', {
      pose: () => {
        this.chatsRepartis = true;
      },
      jouer: () => {
        void (async () => {
          const pas = { vitesse: VITESSE_RETOUR, sortie: true, bloquant: true };
          await Promise.all([
            this.deplacer(this.chat, cheminOf(PLAN, 'retour_chat'), pas),
            this.deplacer(this.luneChat.conteneur, cheminOf(PLAN, 'retour_lune_chat'), pas),
          ]);
          if (!this.scene.isActive()) return;
          this.chatsRepartis = true;
          this.refresh();
        })();
      },
    });
  }
}
