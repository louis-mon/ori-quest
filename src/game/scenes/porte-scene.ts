import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/porte';
import { boxOf, exitsFrom, hotspotsFrom } from './layout';
import { PointClickScene } from './point-click-scene';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerFeuille } from './feuille';
import { placeHeros, preloadHeros } from './heros';
import { dessinerCiel, preloadCiel, semerNuages } from './ciel';
import { dessinerFond, preloadFond } from './fond';

// La porte — seconde scène du chapitre 1.
// Voir game-design/scenes/chapter-1/la-porte.md.

const PLAN = plan;

const RENARD = 'renard';

// Une valeur par scène — voir `semerNuages()`.
const GRAINE_DU_CIEL = 4211;

const SOL = boxOf(PLAN, 'dec_sol');

export class PorteScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'porte_arrivee', flag: 'porte_vue' };

  private battant!: OrigamiDecor;
  private feuillePorte!: Phaser.GameObjects.Graphics;
  private feuilleHache!: Phaser.GameObjects.Graphics;

  constructor() {
    // Même raison que PontScene : c'est main.ts qui décide de la scène à
    // ouvrir.
    super({ key: 'porte', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadSprite(this, RENARD, 'assets/decor/renard.png');
    preloadCiel(this);
    preloadFond(this, PLAN.fond);
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      heros: {
        label: 'Moi',
        knots: { analyser: 'heros' },
      },
      renard: {
        label: 'Le renard',
        knots: { analyser: 'porte_renard' },
      },
      porte: {
        label: 'La porte',
        knots: { analyser: 'porte_porte' },
        // Une fois pliée, la porte est un passage : c'est `exit_village`, posé
        // au même endroit, qui prend le relais.
        visibleIf: () => !gameState.flag('porte_plie'),
      },
      feuille_hache: {
        label: 'Un papier métallisé',
        knots: { analyser: 'porte_feuille_hache' },
        // C'est le PLIAGE qui la fait disparaître, pas la possession de la
        // hache : celle-ci se dépense en découpant le vieil arbre, et une
        // condition sur l'inventaire ferait revenir la feuille à ce moment-là.
        visibleIf: () => !gameState.flag('hache_pliee'),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      pont: {
        label: 'Vers le ravin',
        room: 'pont',
      },
      village: {
        label: 'Entrer dans le village',
        // Passe par la narration : franchir la porte termine le chapitre, et
        // c'est au récit de le dire avant que la scène ne change.
        knot: 'porte_fin_chapitre',
        visibleIf: () => gameState.flag('porte_plie'),
      },
    });
  }

  protected onStateChange() {
    const plie = gameState.flag('porte_plie');
    this.battant?.montrer(plie);
    this.feuillePorte?.setVisible(!plie);
    // Sur le drapeau de PLIAGE, comme le hotspot au-dessus — jamais sur la
    // possession de la hache, qui se dépense en découpant le vieil arbre : le
    // décor faisait alors réapparaître la feuille déjà pliée.
    this.feuilleHache?.setVisible(!gameState.flag('hache_pliee'));
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    // Autre graine qu'au pont, sinon les deux scènes partagent le même ciel et
    // l'aller-retour le montre. Les nuages passent derrière le rempart.
    dessinerCiel(this, SOL.y, boxOf(PLAN, 'dec_soleil'));
    semerNuages(this, boxOf(PLAN, 'dec_nuages'), GRAINE_DU_CIEL, 5);

    // Le terrain et le rempart, d'un seul tenant.
    dessinerFond(this, PLAN.fond);

    // Pas de trou dans le mur : une embrasure béante se lisait comme un décor de
    // fond, et le joueur n'avait aucune raison de taper dedans.
    const ouverture = boxOf(PLAN, 'hs_porte');
    this.feuillePorte = this.add.graphics();
    this.caler('porte', dessinerFeuille(this.feuillePorte, ouverture, 'porte'));

    // Une fois posée, c'est elle le passage, donc elle qui porte la zone tactile
    // de la sortie `village`.
    this.battant = poserOrigami(this, 'porte', ouverture, (emprise) => {
      this.caler('village', emprise);
      this.refresh();
    });

    this.feuilleHache = this.add.graphics();
    this.caler(
      'feuille_hache',
      dessinerFeuille(this.feuilleHache, boxOf(PLAN, 'hs_feuille_hache'), 'hache'),
    );

    this.caler('renard', empriseDe(placeSprite(this, RENARD, boxOf(PLAN, 'hs_renard'))));
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.add
      .text(DESIGN_WIDTH / 2, 40, 'La porte', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }
}
