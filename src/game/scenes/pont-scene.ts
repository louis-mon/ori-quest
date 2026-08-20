import Phaser from 'phaser';
import { COLORS, DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/pont.json';
import { boxOf, exitsFrom, hotspotsFrom, type Box, type SceneLayout } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerFeuille } from './feuille';

/**
 * Le pont — première scène du chapitre 1.
 * Voir game-design/scenes/chapter-1/le-pont.md.
 *
 * Le héros arrive par la gauche, le vide s'ouvre devant lui. Le pont n'est pas
 * cassé : il a **disparu**, il ne reste que la coupure. Une feuille de papier
 * traîne au sol : l'examiner ouvre le choix du modèle, et choisir le pont lance
 * l'énigme. Le pont posé, la rive d'en face devient accessible — avec la feuille
 * du vieil arbre et la sortie vers la porte.
 *
 * Toute la géométrie est lue dans game-design/scenes/chapter-1/pont.svg. Ce
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

const PLAN = plan as SceneLayout;

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
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      precipice: {
        label: 'Le précipice',
        knots: { analyser: 'pont_precipice' },
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
    const g = this.add.graphics();

    // Ciel de fin d'après-midi, en bandes plutôt qu'en dégradé : Graphics ne
    // sait pas interpoler un remplissage, et trois bandes suffisent de loin.
    g.fillStyle(0x2c3138, 1).fillRect(0, 0, DESIGN_WIDTH, 200);
    g.fillStyle(0x3a3a3c, 1).fillRect(0, 200, DESIGN_WIDTH, 140);
    g.fillStyle(0x46403c, 1).fillRect(0, 340, DESIGN_WIDTH, DESIGN_HEIGHT - 340);

    // Le vide. Un noir franc plutôt qu'un fond de gorge dessiné : on ne doit pas
    // pouvoir estimer la profondeur, c'est ce qui rend la traversée inquiétante.
    const vide = boxOf(PLAN, 'dec_precipice');
    g.fillStyle(0x14110f, 1).fillRect(vide.x, vide.y, vide.w, vide.h);

    // Sol du héros (gauche) et rive d'en face (droite).
    g.fillStyle(0x6d5843, 1).fillRect(SOL.x, SOL.y, SOL.w, SOL.h);
    g.fillStyle(COLORS.woodDark, 1).fillRect(SOL.x, SOL.y, SOL.w, 12);
    g.fillStyle(0x5b4a3a, 1).fillRect(RIVE.x, RIVE.y, RIVE.w, RIVE.h);
    g.fillStyle(COLORS.woodDark, 1).fillRect(RIVE.x, RIVE.y, RIVE.w, 12);

    this.drawJeuneArbre(g);
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
      .text(DESIGN_WIDTH / 2, 40, 'Le pont', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#f2ece1',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  /**
   * Le jeune arbre : un tronc et deux étages de feuillage anguleux. Tout est en
   * papier dans ce monde, y compris ce qui pousse — d'où les plis droits plutôt
   * qu'une silhouette organique.
   */
  private drawJeuneArbre(g: Phaser.GameObjects.Graphics) {
    const box = boxOf(PLAN, 'hs_arbre');
    const cx = box.x + box.w / 2;
    const base = box.y + box.h;

    g.fillStyle(COLORS.woodDark, 1).fillRect(cx - 7, base - 54, 14, 54);

    const etage = (sommet: number, demi: number, bas: number, couleur: number) => {
      g.fillStyle(couleur, 1)
        .beginPath()
        .moveTo(cx, sommet)
        .lineTo(cx + demi, bas)
        .lineTo(cx - demi, bas)
        .closePath()
        .fillPath();
    };
    etage(box.y, box.w * 0.42, base - 62, COLORS.paperDark);
    etage(box.y + 34, box.w * 0.5, base - 40, COLORS.paper);
  }

}
