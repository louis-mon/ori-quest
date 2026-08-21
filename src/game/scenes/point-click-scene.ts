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

export interface SceneServices {
  overlay: Overlay;
  dialogue: DialogueRunner;
  /** Changement de scène, fourni par main.ts (le même que le tag `# goto:`). */
  goto: (room: string) => void;
}

/** Durée du fondu d'entrée et de sortie, en millisecondes. */
const FONDU = 260;

/**
 * Le socle commun des scènes de point & click.
 *
 * Une scène concrète ne décrit plus que trois choses : son **plan** (la
 * géométrie, importée du SVG), le **sens** de chaque zone (quel knot, à quelle
 * condition), et son **décor**. Tout le reste — instanciation des zones
 * tactiles, marqueurs, profondeurs, réactions à l'état, transitions — vit ici.
 *
 * C'est ce qui rend une scène supplémentaire bon marché : sans ce socle, chaque
 * pièce du jeu recopierait la même centaine de lignes, et la première correction
 * de bug tactile ne serait appliquée qu'à moitié.
 */
export abstract class PointClickScene extends Phaser.Scene {
  protected services!: SceneServices;

  /** Le plan de la scène, importé de `src/generated/scenes/`. */
  protected abstract readonly plan: SceneLayout;

  /**
   * Knot joué à la première arrivée, et drapeau qui l'empêche de rejouer. Le
   * drapeau est levé par la narration elle-même (`# flag:`), pas ici : c'est
   * elle qui sait à quel moment de la tirade la scène est « vue ».
   */
  protected arrivee?: { knot: string; flag: string };

  private markers = new Map<string, Phaser.GameObjects.Container>();
  private montees: { def: HotspotDef | ExitDef; zone: Phaser.GameObjects.Zone }[] = [];

  /**
   * Emprises réellement dessinées, quand elles diffèrent de la boîte du plan.
   * Voir `caler()`.
   */
  private emprises = new Map<string, Box>();
  /** Centre du marqueur déjà posé, pour ne le refaire que s'il a bougé. */
  private centres = new Map<string, string>();

  protected abstract hotspots(): HotspotDef[];
  protected abstract exits(): ExitDef[];
  /** Décor de la scène, dessiné une fois. Les repères viennent du plan. */
  protected abstract drawScenery(): void;

  init(data: SceneServices) {
    this.services = data;
  }

  preload() {
    preloadCocotte(this);
    preloadFleche(this);
    this.preloadAssets();
  }

  /** Textures propres à la scène. Appelé par `preload()`, à surcharger. */
  protected preloadAssets() {}

  create() {
    this.cameras.main.fadeIn(FONDU, 0, 0, 0);
    this.drawScenery();
    this.monterZones();

    this.input.setTopOnly(true);

    // `subscribe` rend sa fonction de désabonnement : sans l'appeler, chaque
    // passage dans la scène laisserait un abonné de plus, accroché à des objets
    // détruits.
    const unsubscribe = gameState.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      // On lâche les objets détruits tout de suite plutôt que d'attendre le
      // prochain passage : une scène quittée ne doit rien retenir.
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

    // Dialogue d'arrivée, une seule fois. Le court délai laisse la scène peindre
    // sa première image avant que la boîte ne s'ouvre.
    //
    // Volontairement sur l'horloge de Phaser : le délai se met alors en pause
    // avec le jeu. Un joueur qui range son téléphone pendant ces 400 ms retrouve
    // le dialogue à son retour, au lieu de l'avoir manqué.
    const arrivee = this.arrivee;
    if (arrivee && !gameState.flag(arrivee.flag)) {
      this.time.delayedCall(400, () => void this.services.dialogue.run(arrivee.knot));
    }
  }

  /**
   * Recale une zone tactile sur ce qui est **réellement dessiné**.
   *
   * Une boîte du plan est une emprise généreuse : un sprite y est ajusté sans
   * déformation et n'en occupe donc qu'une partie, et un élément qui change
   * d'état change aussi de taille — la grande feuille du vieil arbre est à plat
   * au sol avant d'être pliée, debout après. Sans ce recalage, la zone tactile
   * du renard débordait de 70 px au-dessus de sa tête : on « analysait » un
   * bout de ciel.
   *
   * À appeler depuis `drawScenery()` ou `onStateChange()`, avec l'emprise du
   * dessin. La taille tactile minimale reste garantie par `touchRect()` : une
   * zone plus petite que le doigt est élargie autour de son centre.
   */
  protected caler(id: string, box: Box) {
    this.emprises.set(id, box);
    if (this.montees.length > 0) {
      this.appliquerGeometrie();
      this.appliquerVisibilite();
    }
  }

  /** L'emprise réelle si on la connaît, la boîte du plan sinon. */
  private boite(def: HotspotDef | ExitDef): Box {
    return this.emprises.get(def.id) ?? { x: def.x, y: def.y, w: def.w, h: def.h };
  }

  /**
   * Cadre de la zone d'écoute.
   *
   * Une zone rectangulaire est élargie à la taille du pouce ; une zone tracée au
   * polygone ne l'est pas. L'élargir déplacerait son coin haut-gauche, donc le
   * repère dans lequel son contour est exprimé — et la forme dessinée dans Tiled
   * ne serait plus celle qu'on touche. Un polygone trop petit est signalé à
   * l'import, c'est là qu'on le corrige.
   */
  private rectDe(def: HotspotDef | ExitDef): Box {
    const box = this.boite(def);
    return def.points ? box : touchRect(box);
  }

  private monterZones() {
    // Phaser **réutilise l'instance de scène** d'un passage à l'autre : sans ce
    // nettoyage, on empilerait les zones du passage précédent, déjà détruites
    // par le shutdown. `refresh()` appelait alors `setInteractive()` sur un
    // objet sans scène, et la scène restait bloquée en création — écran figé au
    // retour dans une pièce déjà visitée.
    this.markers.clear();
    this.centres.clear();
    this.montees = [];

    for (const def of [...this.hotspots(), ...this.exits()] as (HotspotDef | ExitDef)[]) {
      const rect = this.rectDe(def);
      const zone = this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0);

      if (def.points) {
        // Le contour est en coordonnées du jeu, la zone d'écoute en coordonnées
        // locales : d'où le décalage. Il reste juste tant que la zone ne bouge
        // pas, ce que `rectDe()` garantit pour un polygone.
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

  /**
   * Recale zones, profondeurs et marqueurs sur les emprises courantes.
   *
   * Les zones se chevauchent (la feuille est posée *sur* le sol) : Phaser
   * départage par profondeur, on donne la priorité à la plus petite, sinon la
   * grande zone avale les taps destinés au détail. Le classement se refait ici
   * plutôt qu'au montage : une emprise qui change change aussi son rang.
   */
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

  /**
   * Pose (ou repose) le marqueur au centre de l'emprise.
   *
   * Il est **refait** plutôt que déplacé : son battement est un tween qui pilote
   * sa position, et qui ramènerait le marqueur à son ancien point au cycle
   * suivant. Le garde-fou sur le centre évite de le reconstruire à chaque
   * changement d'état pour rien.
   */
  private poserMarqueur(def: HotspotDef | ExitDef, box: Box) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
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

  /**
   * Réapplique tout : décor dépendant de l'état, géométrie, visibilité. À
   * appeler quand quelque chose change en dehors de `gameState` — l'arrivée
   * d'une image rendue en différé, par exemple.
   */
  protected refresh() {
    // Le décor d'abord : il peut recaler des emprises (`caler`), et la
    // visibilité doit se poser sur la géométrie à jour.
    this.onStateChange();
    this.appliquerVisibilite();
  }

  private appliquerVisibilite() {
    for (const { def, zone } of this.montees) {
      const visible = def.visibleIf ? def.visibleIf() : true;
      this.markers.get(def.id)?.setVisible(visible);
      // On bascule `enabled` plutôt que de repasser par `setInteractive()` :
      // appelé sans argument, celui-ci **refabrique** une zone d'écoute
      // rectangulaire, et effaçait donc le contour des zones polygonales à
      // chaque changement d'état. C'était sans conséquence tant que tout était
      // rectangulaire, mais ça reconstruisait la zone pour rien.
      if (zone.input) zone.input.enabled = visible;
    }
  }

  /** Point d'accroche pour le décor qui dépend de l'état (un pont posé…). */
  protected onStateChange() {}

  private onZone(def: HotspotDef | ExitDef, pointer: Phaser.Input.Pointer) {
    const { overlay, dialogue } = this.services;
    // Tant que l'interface parle, le décor se tait — voir `occupeLeJoueur`.
    // Les deux conditions ne font pas doublon : `isRunning` couvre aussi les
    // instants où le moteur de narration travaille boîte fermée (une animation
    // de pliage, un changement de scène), où aucune réplique n'attend de tap.
    if (dialogue.isRunning || overlay.occupeLeJoueur) return;
    if (def.visibleIf && !def.visibleIf()) return;

    if (estSortie(def)) {
      // Pas d'annonce de la destination. La légende tenait 1,6 s quand le fondu
      // en dure 0,26 : elle finissait de passer par-dessus la scène d'arrivée,
      // à nommer la pièce qu'on venait de quitter. Et sur un téléphone en
      // paysage elle tombait tout en bas du cadre, là où la boîte de dialogue
      // et le pouce se disputent déjà la place. La flèche pointe hors du cadre
      // et le fondu dit le changement : le joueur sait qu'il part.
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

    // Un seul verbe : pas de menu, l'action part directement. Un menu à une
    // entrée est un tap de trop (game-design/04-interface.md).
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

  /**
   * Change de scène derrière un fondu.
   *
   * Le fondu n'est pas décoratif : sans lui, la scène suivante apparaît avec ses
   * marqueurs déjà en plein battement, et le joueur ne sait pas s'il a changé de
   * pièce ou si la sienne a changé. Un pli qui balaie l'écran serait plus juste
   * (game-design/02-chapitres-et-scenes.md) — le fondu tient la place en
   * attendant.
   */
  protected quitter(room: string) {
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.services.goto(room));
    cam.fadeOut(FONDU, 0, 0, 0);
  }

  /** Coordonnées logiques du jeu -> pixels CSS de la page (pour l'overlay DOM). */
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
