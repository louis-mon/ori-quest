import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import {
  touchRect,
  verbsOf,
  type Box,
  type ExitDef,
  type HotspotDef,
  type Verb,
} from '../systems/hotspots';
import { createHotspotMarker, preloadCocotte } from '../systems/hotspot-marker';
import { createExitMarker, preloadFleche } from '../systems/exit-marker';
import { gameState } from '../systems/state';
import type { Overlay } from '../../ui/overlay';
import type { DialogueRunner } from '../systems/dialogue';
import { signalerNonCables, type SceneLayout } from './layout';
import {
  deplacer as animerDeplacement,
  type Destination,
  type Mobile,
  type OptionsDeplacement,
} from './deplacement';

export interface SceneServices {
  overlay: Overlay;
  dialogue: DialogueRunner;
  // Le même que le tag `# goto:`.
  goto: (room: string) => void;
}

// Fondu d'entrée et de sortie, en millisecondes.
const FONDU = 260;

// Une scène concrète ne décrit que son plan, le sens de chaque zone et son
// décor. Zones tactiles, marqueurs, profondeurs, réactions à l'état et
// transitions vivent ici.
export abstract class PointClickScene extends Phaser.Scene {
  protected services!: SceneServices;

  // Importé de `src/generated/scenes/`.
  protected abstract readonly plan: SceneLayout;

  // Le drapeau est levé par la narration elle-même (`# flag:`), pas ici : c'est
  // elle qui sait à quel moment de la tirade la scène est « vue ».
  protected arrivee?: { knot: string; flag: string };

  private markers = new Map<string, Phaser.GameObjects.Container>();
  private montees: { def: HotspotDef | ExitDef; zone: Phaser.GameObjects.Zone }[] = [];

  // Quand elles diffèrent de la boîte du plan. Voir `caler()`.
  private emprises = new Map<string, Box>();
  // Centre du marqueur déjà posé, pour ne le refaire que s'il a bougé.
  private centres = new Map<string, string>();

  // Déplacements en cours qui demandent l'attention du joueur. Un compteur et
  // non un drapeau : deux objets peuvent partir ensemble, et le premier arrivé
  // ne doit pas rendre la main pour l'autre.
  private bloquants = 0;

  protected abstract hotspots(): HotspotDef[];
  protected abstract exits(): ExitDef[];
  // Décor de la scène, dessiné une fois. Les repères viennent du plan.
  protected abstract drawScenery(): void;

  init(data: SceneServices) {
    this.services = data;
  }

  preload() {
    preloadCocotte(this);
    preloadFleche(this);
    this.preloadAssets();
  }

  // Textures propres à la scène. Appelé par `preload()`, à surcharger.
  protected preloadAssets() {}

  create() {
    this.cameras.main.fadeIn(FONDU, 0, 0, 0);
    this.drawScenery();
    this.monterZones();

    this.input.setTopOnly(true);

    // `subscribe` rend sa fonction de désabonnement : sans l'appeler, chaque
    // passage laisserait un abonné de plus, accroché à des objets détruits.
    const unsubscribe = gameState.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      // Une scène quittée ne doit rien retenir.
      this.markers.clear();
      this.centres.clear();
      this.emprises.clear();
      this.montees = [];
    });

    if (import.meta.env.DEV) {
      signalerNonCables(this.plan, [
        ...this.hotspots().map((h) => h.id),
        ...this.exits().map((e) => e.id),
      ]);
    }

    // Le délai laisse la scène peindre sa première image avant que la boîte ne
    // s'ouvre. Sur l'horloge de Phaser volontairement : il se met en pause avec
    // le jeu, donc un joueur qui range son téléphone ne manque pas le dialogue.
    const arrivee = this.arrivee;
    if (arrivee && !gameState.flag(arrivee.flag)) {
      this.time.delayedCall(400, () => void this.services.dialogue.run(arrivee.knot));
    }
  }

  // Emmène un objet du décor vers un chemin, un repère du plan ou une position.
  // La promesse se dénoue à l'arrivée, mais **la scène n'est pas bloquée pour
  // autant** : le joueur continue de toucher le décor pendant qu'un objet
  // traverse, ce qui est le cas normal — un nuage qui dérive n'a pas à
  // suspendre la partie. `bloquant: true` pour l'exception, ce qui doit être vu
  // avant qu'on puisse agir.
  //
  // Le trajet part de la position courante de l'objet ; voir `deplacement.ts`.
  protected deplacer(
    objet: Mobile,
    destination: Destination,
    options: OptionsDeplacement = {},
  ): Promise<void> {
    const trajet = animerDeplacement(this, objet, destination, options);
    if (!options.bloquant) return trajet;

    this.bloquants++;
    // Toujours décrémenté : la promesse se dénoue aussi quand la scène est
    // quittée en cours de route, sans quoi le décor resterait sourd au retour.
    return trajet.finally(() => {
      this.bloquants--;
    });
  }

  // Une boîte du plan est une emprise généreuse, et un élément qui change d'état
  // change de taille. Sans ce recalage, la zone tactile du renard débordait de
  // 70 px au-dessus de sa tête : on « analysait » un bout de ciel.
  //
  // À appeler depuis `drawScenery()` ou `onStateChange()`.
  protected caler(id: string, box: Box) {
    this.emprises.set(id, box);
    if (this.montees.length > 0) {
      this.appliquerGeometrie();
      this.appliquerVisibilite();
    }
  }

  // L'emprise réelle si on la connaît, la boîte du plan sinon.
  private boite(def: HotspotDef | ExitDef): Box {
    return this.emprises.get(def.id) ?? { x: def.x, y: def.y, w: def.w, h: def.h };
  }

  // Une zone rectangulaire est élargie à la taille du pouce ; un polygone ne
  // l'est pas — l'élargir déplacerait son coin haut-gauche, donc le repère de
  // son contour, et la forme dessinée dans Tiled ne serait plus celle qu'on
  // touche. Un polygone trop petit est signalé à l'import.
  private rectDe(def: HotspotDef | ExitDef): Box {
    const box = this.boite(def);
    return def.points ? box : touchRect(box);
  }

  private monterZones() {
    // Phaser réutilise l'instance de scène d'un passage à l'autre : sans ce
    // nettoyage on empile les zones du passage précédent, déjà détruites par le
    // shutdown, et `refresh()` appelle `setInteractive()` sur un objet sans
    // scène — écran figé au retour dans une pièce déjà visitée.
    this.markers.clear();
    this.centres.clear();
    this.montees = [];

    for (const def of [...this.hotspots(), ...this.exits()] as (HotspotDef | ExitDef)[]) {
      const rect = this.rectDe(def);
      const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0);

      if (def.points) {
        // Le contour est en coordonnées du jeu, la zone d'écoute en coordonnées
        // locales. Le décalage reste juste tant que la zone ne bouge pas, ce que
        // `rectDe()` garantit pour un polygone.
        const contour = new Phaser.Geom.Polygon(
          def.points.flatMap(([x, y]) => [x - rect.x, y - rect.y]),
        );
        zone.setInteractive(contour, Phaser.Geom.Polygon.Contains);
        if (zone.input) zone.input.cursor = 'pointer';
      } else {
        zone.setInteractive({ useHandCursor: true });
      }

      zone.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onZone(def, pointer));
      this.montees.push({ def, zone });
    }

    this.appliquerGeometrie();
    this.refresh();
  }

  // Les zones se chevauchent, et Phaser départage par profondeur : priorité à la
  // plus petite, sinon la grande avale les taps destinés au détail. Le classement
  // se refait ici plutôt qu'au montage — une emprise qui change change son rang.
  private appliquerGeometrie() {
    const aire = (b: Box) => b.w * b.h;
    const parPriorite = [...this.montees].sort(
      (a, b) => aire(this.boite(b.def)) - aire(this.boite(a.def)),
    );

    parPriorite.forEach(({ def, zone }, index) => {
      const box = this.boite(def);
      const rect = this.rectDe(def);
      zone.setPosition(rect.x, rect.y);
      // `setSize` refait la zone d'écoute rectangulaire : sur un polygone, ça
      // effacerait le contour posé au montage.
      if (!def.points) zone.setSize(rect.w, rect.h);
      zone.setDepth(index);
      this.poserMarqueur(def, box);
    });
  }

  // Au centre de l'emprise, ou sur le point que la carte donne. Le centre va
  // bien tant que le sujet remplit son rectangle, ce qu'un pliage ne fait pas :
  // celui du renard tombe dans le creux entre son dos et sa queue. Un objet de
  // classe `marqueur` tranche alors, et arrive avec la zone.
  //
  // Refait plutôt que déplacé : son battement est un tween qui pilote sa
  // position et le ramènerait à son ancien point au cycle suivant.
  private poserMarqueur(def: HotspotDef | ExitDef, box: Box) {
    const [cx, cy] = def.marqueur ?? [box.x + box.w / 2, box.y + box.h / 2];
    const centre = `${Math.round(cx)}:${Math.round(cy)}`;
    if (this.centres.get(def.id) === centre) return;
    this.centres.set(def.id, centre);

    const ancien = this.markers.get(def.id);
    if (ancien) {
      this.tweens.killTweensOf(ancien);
      ancien.destroy();
    }

    this.markers.set(
      def.id,
      estSortie(def)
        ? // La flèche pointe vers l'extérieur du cadre : c'est ce qui dit
          // « on sort par là » plutôt que « regarde ici ».
          createExitMarker(this, cx, cy, cx < DESIGN_WIDTH / 2 ? -1 : 1)
        : createHotspotMarker(this, cx, cy),
    );
  }

  // À appeler quand quelque chose change en dehors de `gameState` — l'arrivée
  // d'une image rendue en différé, par exemple.
  protected refresh() {
    // Le décor d'abord : il peut recaler des emprises, et la visibilité doit se
    // poser sur la géométrie à jour.
    this.onStateChange();
    this.appliquerVisibilite();
  }

  private appliquerVisibilite() {
    for (const { def, zone } of this.montees) {
      const visible = def.visibleIf ? def.visibleIf() : true;
      this.markers.get(def.id)?.setVisible(visible);
      // `enabled` plutôt que `setInteractive()` : appelé sans argument, celui-ci
      // refabrique une zone d'écoute rectangulaire et efface donc le contour des
      // zones polygonales.
      if (zone.input) zone.input.enabled = visible;
    }
  }

  // Point d'accroche pour le décor qui dépend de l'état (un pont posé…).
  protected onStateChange() {}

  private onZone(def: HotspotDef | ExitDef, pointer: Phaser.Input.Pointer) {
    const { overlay, dialogue } = this.services;
    // Les deux conditions ne font pas doublon : `isRunning` couvre les instants
    // où le moteur de narration travaille boîte fermée — une animation de
    // pliage, un changement de scène — sans qu'aucune réplique n'attende de tap.
    if (dialogue.isRunning || overlay.occupeLeJoueur) return;
    // Un déplacement ordinaire laisse la scène jouable ; seul celui qui a
    // demandé le silence compte ici.
    if (this.bloquants > 0) return;
    if (def.visibleIf && !def.visibleIf()) return;

    if (estSortie(def)) {
      // Pas d'annonce de la destination : la légende tenait 1,6 s quand le fondu
      // en dure 0,26, donc elle finissait par-dessus la scène d'arrivée à nommer
      // la pièce qu'on venait de quitter. La flèche et le fondu suffisent.
      if (def.knot) void dialogue.run(def.knot);
      else if (def.room) this.quitter(def.room);
      return;
    }

    const verbs = verbsOf(def);
    if (verbs.length === 0) return;

    const run = (verb: Verb) => {
      const knot = def.knots[verb];
      if (knot) void dialogue.run(knot);
    };

    // Un menu à une entrée est un tap de trop (game-design/04-interface.md).
    if (verbs.length === 1) {
      run(verbs[0]);
      return;
    }

    overlay.showCaption(def.label);
    const screen = this.toScreen(pointer.worldX, pointer.worldY);
    overlay.showVerbs(screen.x, screen.y, verbs, (verb) => {
      if (verb) run(verb);
    });
  }

  // Le fondu n'est pas décoratif : sans lui, la scène suivante apparaît avec ses
  // marqueurs déjà en plein battement, et le joueur ne sait pas s'il a changé de
  // pièce ou si la sienne a changé.
  protected quitter(room: string) {
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.services.goto(room));
    cam.fadeOut(FONDU, 0, 0, 0);
  }

  // Coordonnées du jeu -> pixels CSS de la page, pour l'overlay DOM.
  private toScreen(x: number, y: number) {
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: rect.left + (x / DESIGN_WIDTH) * rect.width,
      y: rect.top + (y / DESIGN_HEIGHT) * rect.height,
    };
  }
}

function estSortie(def: HotspotDef | ExitDef): def is ExitDef {
  return !('knots' in def);
}
