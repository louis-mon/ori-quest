import Phaser from 'phaser';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/cuisine';
import { boxOf, cheminOf, exitsFrom, hotspotsFrom } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { dessinerFond, preloadFond } from './fond';
import { placerLuneChat, preloadLuneChat, type LuneChat } from './lune-chat';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { allumerLesTorches } from './torches';
import { poserVapeur, type Vapeur } from './vapeur';

// La cuisine — entre la salle du trône (à gauche) et le jardin (à droite),
// chapitre 3.
// Voir game-design/scenes/chapter-3/cuisine.md.
//
// Les chats n'y sont qu'entre l'invitation à manger et la fin du repas, chacun
// sur une chaise de la table ; on leur parle, et ils repartent vers la salle du
// trône.
//
// La daurade cuisinée attend sur la table, fumante, et n'y laisse que son
// squelette une fois les chats repus.

const PLAN = plan;

const ELEPHANT = 'elephant_humain';
const CHAT = 'chat';
const ASSIETTE = 'assiette';
const SQUELETTE = 'squelette_poisson';

// Des chats repus ne courent plus.
const VITESSE_RETOUR = 170;

export class CuisineScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'cuisine_arrivee', flag: 'cuisine_vue' };

  private chat!: Phaser.GameObjects.Image;
  private luneChat!: LuneChat;
  private assiette!: Phaser.GameObjects.Image;
  private daurade!: OrigamiDecor;
  private vapeur!: Vapeur;
  private squelette!: Phaser.GameObjects.Image;
  // Même raison qu'à la salle du trône : la zone s'éteint au bout du trajet, pas
  // au drapeau que la narration lève avant lui.
  private chatsRepartis = false;

  constructor() {
    super({ key: 'cuisine', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadFond(this, PLAN.fond);
    preloadSprite(this, ELEPHANT, 'assets/decor/elephant_humain.png');
    preloadSprite(this, CHAT, 'assets/decor/chat.png');
    preloadSprite(this, ASSIETTE, 'assets/decor/assiette.png');
    preloadSprite(this, SQUELETTE, 'assets/decor/squelette_poisson.png');
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
      jardin: {
        room: 'jardin',
      },
    });
  }

  protected onStateChange() {
    const aTable = this.chatsATable();
    this.chat?.setVisible(aTable);
    this.luneChat?.conteneur.setVisible(aTable);

    const servie = gameState.flag('repas_pret');
    const mangee = gameState.flag('chats_rassasies');
    this.assiette?.setVisible(servie);
    this.daurade?.montrer(servie && !mangee);
    this.vapeur?.fumer(servie && !mangee);
    this.squelette?.setVisible(mangee);
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    dessinerFond(this, PLAN.fond);
    // Les mêmes torches que dans la salle du trône, et le même réglage.
    allumerLesTorches(this, [boxOf(PLAN, 'dec_flamme_gauche'), boxOf(PLAN, 'dec_flamme_droite')]);

    // Avant les chats : ils repartent devant la table.
    this.assiette = placeSprite(this, ASSIETTE, boxOf(PLAN, 'dec_assiette'));
    const repas = boxOf(PLAN, 'dec_repas');
    this.daurade = poserOrigami(this, 'poisson', repas, (emprise) => this.vapeur.poser(emprise));
    this.vapeur = poserVapeur(this);
    this.squelette = placeSprite(this, SQUELETTE, repas);

    this.caler('cheffe', empriseDe(placeSprite(this, ELEPHANT, boxOf(PLAN, 'hs_cheffe'))));
    this.chat = placeSprite(this, CHAT, boxOf(PLAN, 'hs_chat'));
    this.calerSur('chat', this.chat);
    // Il flotte au-dessus de l'assise de la chaise, lisse : l'ombre réglée pour
    // le pavé de la salle du trône y faisait tache.
    this.luneChat = placerLuneChat(this, boxOf(PLAN, 'hs_lune_chat'), 0.6);
    this.calerSur('lune_chat', this.luneChat.conteneur, this.luneChat.emprise);
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.brancherLesMouvements();
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
