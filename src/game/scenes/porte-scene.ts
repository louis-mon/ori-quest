import Phaser from 'phaser';
import { COLORS, DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/porte.json';
import { boxOf, exitsFrom, hotspotsFrom, type SceneLayout } from './layout';
import { PointClickScene } from './point-click-scene';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerFeuille } from './feuille';
import { placeHeros, preloadHeros } from './heros';

/**
 * La porte — seconde scène du chapitre 1.
 * Voir game-design/scenes/chapter-1/la-porte.md.
 *
 * On arrive devant le village fortifié, et la porte manque : il n'y a qu'une
 * grande feuille posée contre le rempart, à sa place. Le renard, coincé dehors, apprend au héros que la
 * porte était en bois — et qu'une hache en ferait. Le chapitre se referme quand
 * la porte est pliée et qu'on la franchit.
 *
 * ⚠ Le décor de cette scène est un pis-aller : `dec_sol` et `dec_mur` ont été
 * posés au jugé, faute de croquis dans le plan. À corriger dans porte.svg.
 * Le battant, lui, n'est plus dessiné : c'est le modèle `porte.origami` rendu
 * tel quel (voir origami-decor.ts).
 */

const PLAN = plan as SceneLayout;

const RENARD = 'renard';

const SOL = boxOf(PLAN, 'dec_sol');
const MUR = boxOf(PLAN, 'dec_mur');

export class PorteScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'porte_arrivee', flag: 'porte_vue' };

  private battant!: OrigamiDecor;
  private feuillePorte!: Phaser.GameObjects.Graphics;
  private feuilleHache!: Phaser.GameObjects.Graphics;

  constructor() {
    // Même raison que PontScene : c'est main.ts qui décide de la scène à ouvrir.
    super({ key: 'porte', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadSprite(this, RENARD, 'assets/decor/renard.png');
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
        // Une fois pliée, la porte n'est plus un objet d'étude mais un passage :
        // c'est `exit_village`, posé au même endroit, qui prend le relais.
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
        label: 'Vers le pont',
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
    // possession de la hache : celle-ci se dépense en découpant le vieil arbre,
    // et le décor faisait alors réapparaître la feuille déjà pliée.
    this.feuilleHache?.setVisible(!gameState.flag('hache_pliee'));
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    const g = this.add.graphics();

    g.fillStyle(0x2c3138, 1).fillRect(0, 0, DESIGN_WIDTH, 220);
    g.fillStyle(0x3a3a3c, 1).fillRect(0, 220, DESIGN_WIDTH, SOL.y - 220);
    g.fillStyle(0x4a4038, 1).fillRect(SOL.x, SOL.y, SOL.w, SOL.h);
    g.fillStyle(COLORS.woodDark, 1).fillRect(SOL.x, SOL.y, SOL.w, 10);

    // Le rempart. Des assises régulières suffisent à le lire comme maçonnerie ;
    // ce qui compte ici est le trou, pas la pierre.
    g.fillStyle(0x574c45, 1).fillRect(MUR.x, MUR.y, MUR.w, MUR.h);
    g.lineStyle(1, 0x453b35, 1);
    for (let y = MUR.y + 40; y < MUR.y + MUR.h; y += 40) {
      g.beginPath().moveTo(MUR.x, y).lineTo(MUR.x + MUR.w, y).strokePath();
    }

    // Pas de trou dans le mur. Tant que la porte n'est pas pliée, on voit le
    // rempart et, devant lui, la grande feuille — une feuille carrée comme
    // partout ailleurs, dans le papier de son modèle. Une embrasure béante
    // dessinée en sombre se lisait comme un décor de fond, et le joueur n'avait
    // aucune raison de taper dedans.
    const ouverture = boxOf(PLAN, 'hs_porte');
    this.feuillePorte = this.add.graphics();
    this.caler('porte', dessinerFeuille(this.feuillePorte, ouverture, 'porte'));

    // La porte pliée : le modèle lui-même, pas un dessin de porte. Une fois
    // posée, c'est elle le passage, donc c'est elle qui porte la zone tactile
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
        color: '#f2ece1',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

}
