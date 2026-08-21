import Phaser from 'phaser';
import { COLORS, DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/pont';
import { boxOf, exitsFrom, hotspotsFrom, type Box } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerCiel, preloadCiel, semerNuages } from './ciel';
import { dessinerFeuille } from './feuille';

/**
 * Le ravin — première scène du chapitre 1.
 * Voir game-design/scenes/chapter-1/le-pont.md.
 *
 * La **zone** s'appelle le ravin, et c'est ce que le joueur lit : ce qui l'y
 * arrête est le vide, le pont n'existe pas encore. L'identifiant de la scène,
 * lui, reste `pont` — il est gravé dans les knots d'ink, les drapeaux et les
 * sauvegardes, où il désigne aussi bien l'objet que la pièce.
 *
 * Le héros arrive par la gauche, le vide s'ouvre devant lui. Le pont n'est pas
 * cassé : il a **disparu**, il ne reste que la coupure. Une feuille de papier
 * traîne au sol : l'examiner ouvre le choix du modèle, et choisir le pont lance
 * l'énigme. Le pont posé, la rive d'en face devient accessible — avec la feuille
 * du vieil arbre et la sortie vers la porte.
 *
 * Toute la géométrie est lue dans game-design/scenes/chapter-1/pont.tmj. Ce
 * fichier ne décide que du sens.
 *
 * Le décor est dessiné en primitives, comme le reste du prototype. Les PNG de
 * l'artiste ne sont pas encore intégrés : ils sont détourés sur fond
 * transparent et destinés aux origamis, pas aux fonds.
 *
 * Deux exceptions : le pont posé et le vieil arbre ne sont pas dessinés du tout,
 * ce sont les modèles `pont.origami` et `arbre.origami` rendus tels quels (voir
 * origami-decor.ts). Ce que le joueur vient de plier est ce qu'il retrouve.
 */

const PLAN = plan;

/**
 * Le jeune arbre. Même pliage que le vieil arbre du fond — le père et le fils —
 * mais celui-ci est une photo posée dans le décor, quand l'autre est le modèle
 * `arbre.origami` rendu en 3D : lui, le joueur le plie.
 */
const JEUNE_ARBRE = 'jeune-arbre';

/**
 * Graine du semis de nuages. Une valeur par scène : deux ciels tirés de la même
 * graine se ressembleraient trait pour trait, et le passage d'une scène à
 * l'autre le montrerait.
 */
const GRAINE_DU_CIEL = 1907;

const SOL = boxOf(PLAN, 'dec_sol');
const RIVE = boxOf(PLAN, 'dec_rive');

export class PontScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'pont_arrivee', flag: 'pont_vu' };

  private folded!: OrigamiDecor;
  private sheet!: Phaser.GameObjects.Graphics;
  private feuilleArbre!: Phaser.GameObjects.Graphics;
  private vieilArbre!: OrigamiDecor;

  /** Emprise de la grande feuille à plat, et celle de l'arbre une fois plié. */
  private empriseFeuilleArbre?: Box;
  private empriseVieilArbre?: Box;

  constructor() {
    // `active: false` est indispensable : Phaser démarre tout seul la première
    // scène du tableau `scene:`, sans les services que main.ts lui passe. La
    // scène était donc créée deux fois, et le redémarrage en pleine
    // initialisation laissait une horloge à l'arrêt — les `time.delayedCall`
    // ne se déclenchaient jamais. C'est main.ts qui décide de la scène à
    // ouvrir, à partir de la sauvegarde.
    super({ key: 'pont', active: false });
  }

  /**
   * Le sens de chaque zone du plan : son libellé, son knot, sa condition
   * d'apparition. Les coordonnées viennent du SVG, pas d'ici.
   */
  protected preloadAssets() {
    preloadHeros(this);
    preloadCiel(this);
    preloadSprite(this, JEUNE_ARBRE, 'assets/decor/jeune-arbre.png');
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      precipice: {
        label: 'Le précipice',
        knots: { analyser: 'pont_precipice' },
        // Le vide ne s'examine que tant qu'il barre la route : une fois le pont
        // posé, `pont_precipice` ferait dire au héros qu'il ne voit aucune
        // trace de pont alors qu'il en a un sous les yeux.
        visibleIf: () => !gameState.flag('pont_plie'),
      },
      // Rien à examiner avant le pliage : le pont n'est pas cassé, il a disparu.
      // Ce qu'on regarde à sa place, c'est le vide.
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
        // Elle est sur la rive d'en face : inatteignable tant que le pont
        // n'est pas posé. Une fois découpée, elle est devenue du bois et il ne
        // reste rien.
        visibleIf: () =>
          gameState.flag('pont_plie') && !gameState.flag('vieil_arbre_decoupe'),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      porte: {
        label: 'Vers la porte',
        room: 'porte',
        // Sans le pont, la rive d'en face est inatteignable : la flèche ne doit
        // pas promettre un passage qui n'existe pas.
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
    // feuille à plat sur la rive, puis un arbre debout. La zone tactile suit
    // celle qui est effectivement à l'écran.
    const emprise = arbrePlie ? this.empriseVieilArbre : this.empriseFeuilleArbre;
    if (emprise) this.caler('feuille_vieil_arbre', emprise);
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    // Le ciel et ses nuages, sous tout le reste (voir ciel.ts). L'horizon est le
    // haut du sol : le dégradé se cale dessus plutôt que sur des hauteurs
    // recopiées à la main.
    dessinerCiel(this, SOL.y, boxOf(PLAN, 'dec_soleil'));
    semerNuages(this, boxOf(PLAN, 'dec_nuages'), GRAINE_DU_CIEL, 6);

    const g = this.add.graphics();

    // Le vide. Un noir franc plutôt qu'un fond de gorge dessiné : on ne doit pas
    // pouvoir estimer la profondeur, c'est ce qui rend la traversée inquiétante.
    const vide = boxOf(PLAN, 'dec_precipice');
    g.fillStyle(0x14110f, 1).fillRect(vide.x, vide.y, vide.w, vide.h);

    // Sol du héros (gauche) et rive d'en face (droite), en terre de plein jour :
    // sous le ciel d'après-midi, les bruns sourds d'avant se lisaient comme une
    // scène restée dans l'ombre.
    g.fillStyle(0x8a6d4e, 1).fillRect(SOL.x, SOL.y, SOL.w, SOL.h);
    g.fillStyle(COLORS.wood, 1).fillRect(SOL.x, SOL.y, SOL.w, 12);
    g.fillStyle(0x7a6144, 1).fillRect(RIVE.x, RIVE.y, RIVE.w, RIVE.h);
    g.fillStyle(COLORS.wood, 1).fillRect(RIVE.x, RIVE.y, RIVE.w, 12);

    // Le jeune arbre : le pliage de l'artiste, comme les personnages. La zone
    // tactile suit l'emprise réelle du sprite, pas la boîte du plan — il y est
    // ajusté sans déformation et n'en occupe donc qu'une partie.
    this.caler('arbre', empriseDe(placeSprite(this, JEUNE_ARBRE, boxOf(PLAN, 'hs_arbre'))));
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    // Le pont plié, révélé après l'énigme : le modèle, pas un dessin de pont.
    // Calé au **centre** de son emprise, elle-même centrée sur le ravin : c'est
    // le seul élément du décor qui ne repose sur rien, et le caler par le bas le
    // faisait glisser d'un côté ou de l'autre selon la hauteur de son rendu.
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

    // La feuille de papier, posée au sol près du héros. Elle occupe exactement
    // sa zone tactile : c'est le seul objet du décor dont le dessin et la cible
    // se confondent, autant le lire au même endroit.
    this.sheet = this.add.graphics();
    this.caler('feuille', dessinerFeuille(this.sheet, boxOf(PLAN, 'hs_feuille'), 'pont'));

    // La feuille du vieil arbre, sur la rive d'en face, et l'arbre qu'elle
    // devient une fois plié.
    const grande = boxOf(PLAN, 'hs_feuille_vieil_arbre');
    this.feuilleArbre = this.add.graphics();
    this.empriseFeuilleArbre = dessinerFeuille(this.feuilleArbre, grande, 'arbre');
    this.vieilArbre = poserOrigami(this, 'arbre', grande, (emprise) => {
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
