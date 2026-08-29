import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/village';
import { boxOf, exitsFrom, hotspotsFrom, type Box } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerCiel, preloadCiel, semerNuages } from './ciel';
import { dessinerDecorProvisoire } from './decor-provisoire';
import { dessinerFeuille } from './feuille';

// Le village — première scène du chapitre 2.
// Voir game-design/scenes/chapter-2/le-village.md.
//
// La géométrie est lue dans game-design/scenes/chapter-2/village.tmj ; ce
// fichier ne décide que du sens.
//
// ⚠ Le fond n'est pas encore peint : le sol vient de `decor-provisoire.ts`, et
// c'est un calque image de classe `fond` dans la carte qui le remplacera.

const PLAN = plan;

const PINGOUIN = 'pingouin';
const VACHE = 'vache';

// Une valeur par scène — voir `semerNuages()`.
const GRAINE_DU_CIEL = 8317;

const SOL = boxOf(PLAN, 'dec_sol');

export class VillageScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'village_arrivee', flag: 'village_vu' };

  private feuilleMontagne!: Phaser.GameObjects.Graphics;
  private montagne!: OrigamiDecor;
  private feuilleHerbe!: Phaser.GameObjects.Graphics;
  private herbe!: OrigamiDecor;
  private feuillePot!: Phaser.GameObjects.Graphics;

  // Le papier à plat et le relief plié n'occupent pas la même place dans leur
  // boîte. Voir `caler()`.
  private empriseFeuilleMontagne?: Box;
  private empriseMontagne?: Box;
  private empriseFeuilleHerbe?: Box;
  private empriseHerbe?: Box;

  constructor() {
    // Même raison qu'au chapitre 1 : c'est main.ts qui décide de la scène à
    // ouvrir, avec les services qu'elle attend.
    super({ key: 'village', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadCiel(this);
    preloadSprite(this, PINGOUIN, 'assets/decor/pingouin.png');
    preloadSprite(this, VACHE, 'assets/decor/vache.png');
  }

  // À ÉCRIRE : les libellés des trois papiers sont un premier jet — ils nomment
  // ce qu'on va toucher, et c'est la seule phrase française d'un hotspot.
  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      heros: {
        label: 'Moi',
        knots: { analyser: 'heros' },
      },
      pingouin: {
        label: 'Pingouin Glagla',
        knots: { analyser: 'village_pingouin' },
      },
      vache: {
        label: 'Vache à Lait',
        knots: { analyser: 'village_vache' },
      },
      // Le papier gris, puis la montagne qu'il devient : une seule zone, et
      // c'est la narration qui sait laquelle des deux on regarde.
      montagne: {
        label: 'Un papier gris',
        knots: { analyser: 'village_montagne' },
      },
      herbe: {
        label: 'Un papier vert',
        knots: { analyser: 'village_herbe' },
        // La touffe pliée disparaît quand la vache la broute — c'est le seul
        // moment où elle quitte le décor.
        visibleIf: () => !gameState.flag('herbe_broutee'),
      },
      pot: {
        label: 'Un papier crème',
        knots: { analyser: 'village_pot' },
        // Sur le PLIAGE et non sur la possession du pot : celui-ci se dépense en
        // le donnant au Petit Chat, et la feuille reviendrait à ce moment-là.
        visibleIf: () => !gameState.flag('pot_plie'),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      entree: {
        label: "Vers l'entrée du château",
        room: 'entree',
      },
    });
  }

  protected onStateChange() {
    const montagnePliee = gameState.flag('montagne_pliee');
    this.feuilleMontagne?.setVisible(!montagnePliee);
    this.montagne?.montrer(montagnePliee);
    const emprise = montagnePliee ? this.empriseMontagne : this.empriseFeuilleMontagne;
    if (emprise) this.caler('montagne', emprise);

    const herbePliee = gameState.flag('herbe_pliee');
    const broutee = gameState.flag('herbe_broutee');
    this.feuilleHerbe?.setVisible(!herbePliee && !broutee);
    this.herbe?.montrer(herbePliee && !broutee);
    const touffe = herbePliee ? this.empriseHerbe : this.empriseFeuilleHerbe;
    if (touffe) this.caler('herbe', touffe);

    this.feuillePot?.setVisible(!gameState.flag('pot_plie'));
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    // Le soleil est à droite ici, du côté d'où l'on arrive : le village se
    // regarde en venant de la porte.
    dessinerCiel(this, SOL.y, boxOf(PLAN, 'dec_soleil'));
    semerNuages(this, boxOf(PLAN, 'dec_nuages'), GRAINE_DU_CIEL, 5);
    dessinerDecorProvisoire(this, { sol: SOL });

    // La montagne du pingouin, au fond : le papier d'abord, le relief ensuite.
    // Deux boîtes, comme au vieil arbre — le relief déborde largement la feuille
    // qu'on plie pour l'obtenir.
    this.feuilleMontagne = this.add.graphics();
    this.empriseFeuilleMontagne = dessinerFeuille(
      this.feuilleMontagne,
      boxOf(PLAN, 'hs_montagne'),
      'montagne',
    );
    this.montagne = poserOrigami(this, 'montagne', boxOf(PLAN, 'dec_montagne'), (emprise) => {
      this.empriseMontagne = emprise;
      this.refresh();
    });

    const pature = boxOf(PLAN, 'hs_herbe');
    this.feuilleHerbe = this.add.graphics();
    this.empriseFeuilleHerbe = dessinerFeuille(this.feuilleHerbe, pature, 'herbe');
    this.herbe = poserOrigami(this, 'herbe', pature, (emprise) => {
      this.empriseHerbe = emprise;
      this.refresh();
    });

    // Rien à poser pour le pot : une fois plié, il part dans l'inventaire.
    this.feuillePot = this.add.graphics();
    this.caler('pot', dessinerFeuille(this.feuillePot, boxOf(PLAN, 'hs_pot'), 'pot'));

    this.caler('pingouin', empriseDe(placeSprite(this, PINGOUIN, boxOf(PLAN, 'hs_pingouin'))));
    this.caler('vache', empriseDe(placeSprite(this, VACHE, boxOf(PLAN, 'hs_vache'))));
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.add
      .text(DESIGN_WIDTH / 2, 40, 'Le village', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }
}
