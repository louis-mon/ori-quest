import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { ExitDef, HotspotDef } from '../systems/hotspots';
import { gameState } from '../systems/state';
import plan from '../../generated/scenes/jardin';
import { boxOf, exitsFrom, hotspotsFrom, type Box } from './layout';
import { PointClickScene } from './point-click-scene';
import { placeHeros, preloadHeros } from './heros';
import { empriseDe, placeSprite, preloadSprite } from './decor-sprite';
import { dessinerCiel, preloadCiel, semerNuages } from './ciel';
import { dessinerDecorProvisoire } from './decor-provisoire';
import { dessinerFeuille } from './feuille';
import { IMAGES_RETOURNEMENT, poserRetournable } from './retournement';

// Le jardin du château — à droite de la salle du trône, chapitre 3.
// Voir game-design/scenes/chapter-3/jardin.md.
//
// Deux papiers à plier, la fontaine où l'on pêche la carpe, et la wyvern qui
// parle du cœur par énigmes.
//
// ⚠ Le fond n'est pas encore peint : `decor-provisoire.ts` tient la place.

const PLAN = plan;

const WYVERN = 'hydre';
const CARPE = 'carpe';

// Une valeur par scène — voir `semerNuages()`.
const GRAINE_DU_CIEL = 7219;

const SOL = boxOf(PLAN, 'dec_sol');

// Sous le seuil où l'œil suit un mouvement, comme la dérive des nuages : le
// battement des marqueurs doit rester le seul à réclamer l'attention.
const VITESSE_NAGE = 22;
const HAUTEUR_CARPE = 32;
// Le temps de passer la tête par-dessus la queue.
const DUREE_RETOURNEMENT = 1400;

export class JardinScene extends PointClickScene {
  protected readonly plan = PLAN;
  protected arrivee = { knot: 'jardin_arrivee', flag: 'jardin_vu' };

  private papierCouronne!: Phaser.GameObjects.Graphics;
  private papierPoisson!: Phaser.GameObjects.Graphics;
  private carpes: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super({ key: 'jardin', active: false });
  }

  protected preloadAssets() {
    preloadHeros(this);
    preloadCiel(this);
    preloadSprite(this, WYVERN, 'assets/decor/hydre.png');
    preloadSprite(this, CARPE, 'assets/decor/carpe.png');
  }

  protected hotspots(): HotspotDef[] {
    return hotspotsFrom(PLAN, {
      heros: {
        knot: 'heros',
      },
      fontaine: {
        knot: 'jardin_fontaine',
      },
      // Sur le PLIAGE et non sur la possession : la couronne se donne à la
      // reine, et la feuille reviendrait sur le banc à ce moment-là.
      papier_couronne: {
        knot: 'jardin_papier_couronne',
        visibleIf: () => !gameState.flag('couronne_pliee'),
      },
      papier_poisson: {
        knot: 'jardin_papier_poisson',
        visibleIf: () => !gameState.flag('poisson_plie'),
      },
      wyvern: {
        knot: 'jardin_wyvern',
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
    this.papierCouronne?.setVisible(!gameState.flag('couronne_pliee'));
    this.papierPoisson?.setVisible(!gameState.flag('poisson_plie'));
    // Celle qu'on a pêchée manque au bassin tant qu'on la porte.
    this.carpes[1]?.setVisible(!gameState.has('carpe'));
  }

  // ------------------------------------------------------------------
  // Décor
  // ------------------------------------------------------------------

  protected drawScenery() {
    dessinerCiel(this, SOL.y, boxOf(PLAN, 'dec_soleil'));
    semerNuages(this, boxOf(PLAN, 'dec_nuages'), GRAINE_DU_CIEL, 5);

    dessinerDecorProvisoire(this, {
      sol: SOL,
      masses: [boxOf(PLAN, 'dec_rempart')],
      creux: [boxOf(PLAN, 'dec_porte_trone')],
      meubles: [boxOf(PLAN, 'dec_banc')],
      eaux: [boxOf(PLAN, 'dec_bassin')],
    });

    this.carpes = [];
    const bassin = boxOf(PLAN, 'dec_carpes');
    // L'une en haut à gauche, l'autre en bas à droite, et en sens contraires :
    // deux carpes parallèles se liraient comme un seul motif qui glisse.
    this.carpes.push(this.nager(bassin, 0, true));
    this.carpes.push(this.nager(bassin, 1, false));

    this.papierCouronne = this.add.graphics();
    this.caler(
      'papier_couronne',
      dessinerFeuille(this.papierCouronne, boxOf(PLAN, 'hs_papier_couronne'), 'couronne'),
    );
    this.papierPoisson = this.add.graphics();
    this.caler(
      'papier_poisson',
      dessinerFeuille(this.papierPoisson, boxOf(PLAN, 'hs_papier_poisson'), 'poisson'),
    );

    this.caler('wyvern', empriseDe(placeSprite(this, WYVERN, boxOf(PLAN, 'hs_wyvern'))));
    this.caler('heros', empriseDe(placeHeros(this, boxOf(PLAN, 'hs_heros'))));

    this.add
      .text(DESIGN_WIDTH / 2, 40, 'Le jardin', {
        fontFamily: 'Georgia, serif',
        fontSize: '26px',
        color: '#3a3128',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  // D'un bout à l'autre de la bande, et à chaque bout la carpe se retourne comme
  // une feuille qu'on prend par la tête et qu'on rabat par-dessus la queue
  // (`retournement.ts`). La queue sert de charnière : c'est elle que suit la
  // position du sprite, et la tête retombe de l'autre côté — d'où une bande
  // d'au moins deux longueurs de carpe.
  //
  // Des tweens enchaînés et non un écouteur d'`update`, pour la raison des
  // nuages : ils meurent avec la scène.
  private nager(bande: Box, rang: number, versLaDroite: boolean): Phaser.GameObjects.Sprite {
    const photo = this.textures.get(CARPE).getSourceImage();
    const longueur = (photo.width / photo.height) * HAUTEUR_CARPE;
    const queueGauche = bande.x + longueur;
    const queueDroite = bande.x + bande.w - longueur;
    const y = rang === 0 ? bande.y + HAUTEUR_CARPE / 2 : bande.y + bande.h - HAUTEUR_CARPE / 2;
    // À la même allure, les deux se retourneraient ensemble, comme un seul motif.
    const vitesse = VITESSE_NAGE * (rang === 0 ? 1 : 0.8);

    const carpe = poserRetournable(
      this,
      CARPE,
      longueur,
      HAUTEUR_CARPE,
      versLaDroite ? queueGauche : queueDroite,
      y,
    )
      // La carpe photographiée regarde à gauche.
      .setFlipX(versLaDroite);

    const nage = (droite: boolean) => {
      this.tweens.add({
        targets: carpe,
        x: droite ? queueDroite : queueGauche,
        duration: ((queueDroite - queueGauche) / vitesse) * 1000,
        ease: 'Sine.easeInOut',
        onComplete: () => retourne(droite),
      });
    };
    const retourne = (droite: boolean) => {
      const avance = { image: 0 };
      this.tweens.add({
        targets: avance,
        image: IMAGES_RETOURNEMENT - 1,
        duration: DUREE_RETOURNEMENT,
        onUpdate: () => carpe.setFrame(Math.round(avance.image)),
        onComplete: () => {
          // La dernière image est la première de l'autre sens, en miroir : la
          // bascule ne se voit pas.
          carpe.setFlipX(!carpe.flipX).setFrame(0);
          nage(!droite);
        },
      });
    };
    nage(versLaDroite);
    return carpe;
  }
}
