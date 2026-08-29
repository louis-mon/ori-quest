import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/pont';
import { boxOf, exitsFrom, hotspotsFrom, type Box } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerCiel, preloadCiel, semerNuages } from './ciel';
import { dessinerFond, preloadFond } from './fond';
import { dessinerFeuille } from './feuille';

// Le ravin — première scène du chapitre 1.
// Voir game-design/scenes/chapter-1/le-pont.md.
//
// La zone s'appelle le ravin, et c'est ce que le joueur lit : ce qui l'arrête
// est le vide, le pont n'existe pas encore. L'identifiant de la scène reste
// `pont`, gravé dans les knots d'ink, les drapeaux et les sauvegardes.
//
// La géométrie est lue dans game-design/scenes/chapter-1/pont.tmj ; ce fichier
// ne décide que du sens.

const PLAN = plan;

const JEUNE_ARBRE = 'jeune-arbre';

// Une valeur par scène : deux ciels tirés de la même graine se ressembleraient
// trait pour trait, et l'aller-retour le montrerait.
const GRAINE_DU_CIEL = 1907;

const SOL = boxOf(PLAN, 'dec_sol');

export class PontScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'pont_arrivee', flag: 'pont_vu' };

  private folded!: OrigamiDecor;
  private sheet!: Phaser.GameObjects.Graphics;
  private feuilleArbre!: Phaser.GameObjects.Graphics;
  private vieilArbre!: OrigamiDecor;

  // Emprise de la grande feuille à plat, et celle de l'arbre une fois plié.
  private empriseFeuilleArbre?: Box;
  private empriseVieilArbre?: Box;

  constructor() {
    // `active: false` est indispensable : Phaser démarre tout seul la première
    // scène du tableau `scene:`, sans les services que main.ts lui passe. La
    // scène était créée deux fois, et le redémarrage en pleine initialisation
    // laissait une horloge à l'arrêt — les `time.delayedCall` ne partaient
    // jamais.
    super({ key: 'pont', active: false });
  }

  // Libellé, knot, condition d'apparition. Les coordonnées viennent du plan.
  protected preloadAssets() {
    preloadHeros(this);
    preloadCiel(this);
    preloadFond(this, PLAN.fond);
    preloadSprite(this, JEUNE_ARBRE, 'assets/decor/jeune-arbre.png');
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      precipice: {
        label: 'Le précipice',
        knots: { analyser: 'pont_precipice' },
        // Le vide ne s'examine que tant qu'il barre la route : une fois le pont
        // posé, `pont_precipice` ferait dire au héros qu'il ne voit aucune trace
        // de pont alors qu'il en a un sous les yeux.
        visibleIf: () => !gameState.flag('pont_plie'),
      },
      // Rien à examiner avant le pliage : le pont n'est pas cassé, il a disparu.
      pont_repare: {
        label: 'Le pont',
        knots: { analyser: 'pont_pont' },
        visibleIf: () => gameState.flag('pont_plie'),
      },
      feuille: {
        label: 'Feuille de papier',
        knots: { analyser: 'pont_feuille' },
        // Une fois pliée, la feuille est devenue le pont : plus rien à examiner.
        visibleIf: () => !gameState.flag('pont_plie'),
      },
      heros: {
        label: 'Moi',
        knots: { analyser: 'heros' },
      },
      arbre: {
        label: 'Le jeune arbre',
        knots: { analyser: 'pont_arbre' },
      },
      feuille_vieil_arbre: {
        label: 'Une grande feuille',
        knots: { analyser: 'pont_feuille_vieil_arbre' },
        // Sur la rive d'en face, donc inatteignable tant que le pont n'est pas
        // posé. Une fois découpée, elle est devenue du bois.
        visibleIf: () => gameState.flag('pont_plie') && !gameState.flag('vieil_arbre_decoupe'),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      porte: {
        label: 'Vers la porte',
        room: 'porte',
        // Sans le pont, la flèche promettrait un passage qui n'existe pas.
        visibleIf: () => gameState.flag('pont_plie'),
      },
    });
  }

  protected onStateChange() {
    const plie = gameState.flag('pont_plie');
    this.folded?.montrer(plie);
    this.sheet?.setVisible(!plie);

    const arbrePlie = gameState.flag('arbre_plie');
    const decoupe = gameState.flag('vieil_arbre_decoupe');
    this.feuilleArbre?.setVisible(!arbrePlie && !decoupe);
    this.vieilArbre?.montrer(arbrePlie && !decoupe);

    // Le même hotspot désigne deux choses de tailles très différentes : une
    // feuille à plat, puis un arbre debout.
    const emprise = arbrePlie ? this.empriseVieilArbre : this.empriseFeuilleArbre;
    if (emprise) this.caler('feuille_vieil_arbre', emprise);
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    // L'horizon est le haut du sol : le dégradé s'y cale plutôt que sur des
    // hauteurs recopiées à la main.
    dessinerCiel(this, SOL.y, boxOf(PLAN, 'dec_soleil'));
    semerNuages(this, boxOf(PLAN, 'dec_nuages'), GRAINE_DU_CIEL, 6);

    // Le vide n'est pas un fond de gorge qu'on pourrait mesurer des yeux : c'est
    // ce qui rend la traversée inquiétante.
    dessinerFond(this, PLAN.fond);

    // La zone tactile suit l'emprise réelle du sprite, pas la boîte du plan.
    this.caler('arbre', empriseDe(placeSprite(this, JEUNE_ARBRE, boxOf(PLAN, 'hs_arbre'))));
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    // Calé au CENTRE de son emprise : c'est le seul élément du décor qui ne
    // repose sur rien, et le caler par le bas le faisait glisser selon la hauteur
    // de son rendu.
    this.folded = poserOrigami(
      this,
      'pont',
      boxOf(PLAN, 'dec_pont'),
      (emprise) => {
        this.caler('pont_repare', emprise);
        this.refresh();
      },
      { ancrage: 'centre' },
    );

    // Elle occupe exactement sa zone tactile : le seul objet du décor dont le
    // dessin et la cible se confondent.
    this.sheet = this.add.graphics();
    this.caler('feuille', dessinerFeuille(this.sheet, boxOf(PLAN, 'hs_feuille'), 'pont'));

    // La feuille du vieil arbre, et l'arbre qu'elle devient. Deux boîtes : la
    // boîte donne sa taille au modèle, et l'arbre déborde largement la feuille.
    this.feuilleArbre = this.add.graphics();
    this.empriseFeuilleArbre = dessinerFeuille(
      this.feuilleArbre,
      boxOf(PLAN, 'hs_feuille_vieil_arbre'),
      'arbre',
    );
    this.vieilArbre = poserOrigami(this, 'arbre', boxOf(PLAN, 'dec_vieil_arbre'), (emprise) => {
      this.empriseVieilArbre = emprise;
      this.refresh();
    });

    this.add
      .text(DESIGN_WIDTH / 2, 40, 'Le ravin', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }
}
