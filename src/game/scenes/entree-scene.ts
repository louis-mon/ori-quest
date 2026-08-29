import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/entree';
import { boxOf, cheminOf, exitsFrom, hotspotsFrom, type Contour } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { poserOrigami, type OrigamiDecor } from './origami-decor';
import { dessinerCiel, preloadCiel, semerNuages } from './ciel';
import { dessinerDecorProvisoire } from './decor-provisoire';
import { dessinerFeuille, poserFeuille, type FeuilleMobile } from './feuille';

// L'entrée du château — seconde scène du chapitre 2.
// Voir game-design/scenes/chapter-2/entree-chateau.md.
//
// C'est la scène qui bouge : le Petit Chat saute pour décrocher le papier de
// l'os, Chouaf saute pour effrayer Gros Diplo, qui s'écarte. Les trajets sont
// tracés dans la carte (classe `chemin`), la scène ne dit que la vitesse et le
// fait qu'on doit les regarder — `bloquant: true`.
//
// ⚠ Le fond n'est pas encore peint : rempart et sol viennent de
// `decor-provisoire.ts`, et un calque image de classe `fond` les remplacera.

const PLAN = plan;

const CHAT = 'chat';
const DIPLO = 'diplodocus';

// Une valeur par scène — voir `semerNuages()`.
const GRAINE_DU_CIEL = 5623;

const SOL = boxOf(PLAN, 'dec_sol');

// Le papier tombe vite et s'écrase ; le dinosaure pèse trois tonnes.
const VITESSE_CHUTE = 520;
const VITESSE_DIPLO = 170;
// Un saut se mesure en durée, pas en vitesse : c'est son rythme qui le rend
// lisible, et les deux sauts de la scène doivent avoir le même.
const DUREE_SAUT = 620;

// Le dernier sommet d'un chemin, donc l'endroit où l'objet se retrouve une fois
// le mouvement joué : c'est là qu'on le pose en revenant dans la pièce.
function arrivee(chemin: Contour) {
  const [x, y] = chemin[chemin.length - 1] ?? [0, 0];
  return { x, y };
}

export class EntreeScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'entree_arrivee', flag: 'entree_vue' };

  private chat!: Phaser.GameObjects.Image;
  private diplo!: Phaser.GameObjects.Image;
  private feuilleChien!: Phaser.GameObjects.Graphics;
  private chouaf!: OrigamiDecor;
  private os!: FeuilleMobile;

  constructor() {
    // Même raison qu'au chapitre 1 : c'est main.ts qui décide de la scène à
    // ouvrir, avec les services qu'elle attend.
    super({ key: 'entree', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadCiel(this);
    preloadSprite(this, CHAT, 'assets/decor/chat.png');
    preloadSprite(this, DIPLO, 'assets/decor/diplodocus.png');
  }

  // À ÉCRIRE : les libellés des deux papiers sont un premier jet, comme ceux du
  // village.
  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      heros: {
        label: 'Moi',
        knots: { analyser: 'heros' },
      },
      chat: {
        label: 'Petit Chat',
        knots: { analyser: 'entree_chat' },
      },
      diplo: {
        label: 'Gros Diplo',
        knots: { analyser: 'entree_diplo' },
      },
      papier_chien: {
        label: 'Un papier tacheté',
        knots: { analyser: 'entree_papier_chien' },
        visibleIf: () => !gameState.flag('chien_plie'),
      },
      // Chouaf n'existe qu'une fois plié : avant, il n'y a qu'un papier.
      chouaf: {
        label: 'Chouaf',
        knots: { analyser: 'entree_chouaf' },
        visibleIf: () => gameState.flag('chien_plie'),
      },
      // Examinable dès l'arrivée, alors qu'il pend hors d'atteinte : c'est en le
      // regardant qu'on apprend qu'il faudra de l'aide pour l'attraper.
      papier_os: {
        label: 'Un papier suspendu',
        knots: { analyser: 'entree_papier_os' },
        visibleIf: () => !gameState.flag('os_plie'),
      },
    });
  }

  protected exits(): ExitDef[] {
    return exitsFrom(PLAN, {
      village: {
        label: 'Vers le village',
        room: 'village',
      },
      chateau: {
        label: 'Entrer dans le château',
        // Passe par la narration : franchir la porte termine le chapitre, et
        // c'est au récit de le dire avant que la scène ne change.
        knot: 'entree_fin_chapitre',
        // Le passage existe depuis le début, mais Gros Diplo est assis dessus.
        visibleIf: () => gameState.flag('diplo_pousse'),
      },
    });
  }

  protected onStateChange() {
    const plie = gameState.flag('chien_plie');
    this.feuilleChien?.setVisible(!plie);
    this.chouaf?.montrer(plie);

    const pris = gameState.flag('os_plie');
    this.os?.conteneur.setVisible(!pris);
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    dessinerCiel(this, SOL.y, boxOf(PLAN, 'dec_soleil'));
    semerNuages(this, boxOf(PLAN, 'dec_nuages'), GRAINE_DU_CIEL, 5);
    // Le passage est un trou dans le rempart, pas un battant : la porte du
    // château est plus loin, et ce chapitre ne la montre pas.
    dessinerDecorProvisoire(this, {
      sol: SOL,
      masses: [boxOf(PLAN, 'dec_rempart')],
      creux: [boxOf(PLAN, 'exit_chateau')],
    });

    this.feuilleChien = this.add.graphics();
    this.caler(
      'papier_chien',
      dessinerFeuille(this.feuilleChien, boxOf(PLAN, 'hs_papier_chien'), 'chien'),
    );
    this.chouaf = poserOrigami(this, 'chien', boxOf(PLAN, 'hs_chouaf'), (emprise) => {
      this.caler('chouaf', emprise);
      this.refresh();
    });

    // Le seul papier du jeu qui se déplace, d'où le conteneur : il pend d'abord
    // hors d'atteinte, et le Petit Chat le fait tomber.
    this.os = poserFeuille(this, boxOf(PLAN, 'hs_papier_os'), 'os');
    this.caler('papier_os', this.os.emprise());

    this.chat = placeSprite(this, CHAT, boxOf(PLAN, 'hs_chat'));
    this.caler('chat', empriseDe(this.chat));
    // Pas de `marqueur` dans la carte pour lui, contrairement au renard du
    // chapitre 1 : un marqueur est un point FIXE, et la cocotte serait restée
    // sur la place vide qu'il vient de quitter. Elle suit donc le centre de son
    // emprise, que `caler()` déplace avec lui.
    this.diplo = placeSprite(this, DIPLO, boxOf(PLAN, 'hs_diplo'));
    this.caler('diplo', empriseDe(this.diplo));
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.brancherLesMouvements();

    this.add
      .text(DESIGN_WIDTH / 2, 40, "L'entrée du château", {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  // La narration lève les drapeaux, la scène joue les mouvements. Les deux sont
  // bloquants : ils changent ce qu'on peut faire ensuite, et le joueur doit les
  // avoir vus avant de retoucher au décor.
  private brancherLesMouvements() {
    const chute = cheminOf(PLAN, 'chute_os');
    this.auLeverDe('os_tombe', {
      pose: () => {
        this.os.conteneur.setPosition(arrivee(chute).x, arrivee(chute).y);
        this.caler('papier_os', this.os.emprise());
      },
      jouer: () => {
        void (async () => {
          await this.deplacer(this.chat, cheminOf(PLAN, 'saut_chat'), {
            duree: DUREE_SAUT,
            ease: 'Sine.easeInOut',
            bloquant: true,
          });
          await this.deplacer(this.os.conteneur, chute, {
            vitesse: VITESSE_CHUTE,
            // Un papier qui tombe accélère ; à vitesse constante il a l'air
            // descendu à la ficelle.
            ease: 'Quad.easeIn',
            bloquant: true,
          });
          this.caler('papier_os', this.os.emprise());
        })();
      },
    });

    const fuite = cheminOf(PLAN, 'fuite_diplo');
    this.auLeverDe('diplo_pousse', {
      pose: () => {
        this.diplo.setPosition(arrivee(fuite).x, arrivee(fuite).y);
        this.caler('diplo', empriseDe(this.diplo));
      },
      jouer: () => {
        void (async () => {
          await this.deplacer(this.chouaf.image, cheminOf(PLAN, 'saut_chouaf'), {
            duree: DUREE_SAUT,
            ease: 'Sine.easeInOut',
            bloquant: true,
          });
          await this.deplacer(this.diplo, fuite, {
            vitesse: VITESSE_DIPLO,
            bloquant: true,
          });
          this.caler('diplo', empriseDe(this.diplo));
        })();
      },
    });
  }
}
