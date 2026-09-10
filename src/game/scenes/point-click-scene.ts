import Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import {
  touchRect,
  type Box,
  type ExitDef,
  type HotspotDef,
  type Marqueur,
} from '../systems/hotspots';
import { createHotspotMarker, preloadCocotte } from '../systems/hotspot-marker';
import { endormirMarqueur, escamoterMarqueur, estEscamote } from '../systems/marqueur-papier';
import { createExitMarker, preloadFleche } from '../systems/exit-marker';
import { gameState } from '../systems/state';
import type { Overlay } from '../../ui/overlay';
import type { DialogueRunner } from '../systems/dialogue';
import { empriseDe } from './decor-sprite';
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
  // Les zones attachées à un objet du décor. Voir `calerSur()`.
  private porteurs = new Map<string, Porteur>();
  // Centre du marqueur déjà posé, pour ne le refaire que s'il a bougé.
  private centres = new Map<string, string>();

  // Déplacements en cours qui demandent l'attention du joueur. Un ensemble et
  // non un drapeau : deux objets peuvent partir ensemble, et le premier arrivé
  // ne doit pas rendre la main pour l'autre.
  //
  // ⚠ Cet état est transitoire, et rien ne doit pouvoir l'y laisser : il se vide
  // à la fin de chaque trajet — y compris quand la scène est quittée en cours de
  // route, `deplacer()` dénouant alors sa promesse — et au shutdown. Un ensemble
  // resté plein rendrait la pièce sourde pour de bon.
  private attentes = new Set<object>();

  // Ce que la narration déclenche une fois : voir `auLeverDe()`.
  private declencheurs: { flag: string; jouer: () => void; fait: boolean }[] = [];

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
    // Phaser réutilise l'instance d'un passage à l'autre : les déclencheurs du
    // passage précédent parleraient d'objets détruits.
    this.declencheurs = [];
    this.attentes.clear();
    this.drawScenery();
    this.monterZones();

    this.input.setTopOnly(true);

    // `subscribe` rend sa fonction de désabonnement : sans l'appeler, chaque
    // passage laisserait un abonné de plus, accroché à des objets détruits.
    const unsubscribe = gameState.subscribe(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      // Une scène quittée ne doit rien retenir.
      this.attentes.clear();
      this.services.overlay.suspendreLInventaire(false);
      this.declencheurs = [];
      this.markers.clear();
      this.centres.clear();
      this.emprises.clear();
      this.porteurs.clear();
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
  //
  // Les zones que l'objet porte (`calerSur()`) font le trajet avec lui : leur
  // marqueur s'escamote au départ et revient à l'arrivée, sur l'emprise recalée.
  protected deplacer(
    objet: Mobile,
    destination: Destination,
    options: OptionsDeplacement = {},
  ): Promise<void> {
    const portees = this.zonesPortees(objet);
    const trajet = (async () => {
      await this.escamoter(portees, true);
      await animerDeplacement(this, objet, destination, options);
      // Le trajet se dénoue aussi quand la scène est quittée en route, et le
      // shutdown a tout vidé : il n'y a plus rien à recaler.
      for (const id of portees) {
        const porteur = this.porteurs.get(id);
        if (porteur) this.caler(id, porteur.emprise());
      }
    })();

    // La réapparition est hors de l'attente, et non dedans : le marqueur y est
    // encore endormi, et on le verrait grandir en gris avant de reprendre ses
    // couleurs.
    return (options.bloquant ? this.enAttendant(trajet) : trajet).then(() =>
      this.escamoter(portees, false),
    );
  }

  // Le décor cesse de répondre le temps de la promesse. Toujours relevé : elle
  // se dénoue aussi quand la scène est quittée en cours de route, sans quoi le
  // décor resterait sourd au retour.
  private enAttendant(trajet: Promise<void>): Promise<void> {
    const jeton = {};
    this.attentes.add(jeton);
    this.appliquerAttente();
    return trajet.finally(() => {
      this.attentes.delete(jeton);
      this.appliquerAttente();
    });
  }

  private zonesPortees(objet: Mobile): string[] {
    return [...this.porteurs].filter(([, porteur]) => porteur.objet === objet).map(([id]) => id);
  }

  // Le zoom des marqueurs concernés, et la zone avec : escamotée, elle ne répond
  // plus — son objet est en route, et le tap tomberait sur la place qu'il vient
  // de quitter.
  private async escamoter(ids: string[], escamote: boolean) {
    if (ids.length === 0) return;
    const zooms = ids.map((id) => {
      const marqueur = this.markers.get(id);
      return marqueur ? escamoterMarqueur(marqueur, escamote) : Promise.resolve();
    });
    // L'état est posé avant le zoom : la zone se ferme au départ du marqueur,
    // pas à la fin de son escamotage.
    this.appliquerVisibilite();
    await Promise.all(zooms);
  }

  // Le joueur n'a rien à faire pendant qu'un objet traverse sous ses yeux : les
  // zones ne répondent plus (`repondAuTap`), l'inventaire non plus, et les
  // marqueurs s'éteignent pour le dire. Seul le menu reste atteignable, et il fige la
  // scène — voir `figerLeJeu()` dans main.ts.
  private appliquerAttente() {
    const attend = this.attentes.size > 0;
    for (const marqueur of this.markers.values()) endormirMarqueur(marqueur, attend);
    this.services.overlay.suspendreLInventaire(attend);
  }

  // La narration lève un drapeau, la scène joue le mouvement : c'est le même
  // chemin que les autres effets (`# flag:`), et la scène reste la seule à
  // savoir ce qui bouge chez elle.
  //
  // `pose` est le cas du drapeau DÉJÀ levé en entrant : l'objet est mis à son
  // arrivée sans rien jouer. Sans cette distinction, le dinosaure s'écarterait
  // une seconde fois à chaque retour dans la pièce.
  //
  // À appeler depuis `drawScenery()`.
  protected auLeverDe(flag: string, effet: { pose: () => void; jouer: () => void }) {
    const deja = gameState.flag(flag);
    if (deja) effet.pose();
    this.declencheurs.push({ flag, jouer: effet.jouer, fait: deja });
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

  // La même chose pour une zone portée par un objet qui peut se déplacer : elle
  // le suit, `deplacer()` la reposant sur sa nouvelle emprise à chaque trajet.
  // Sans ça, la cocotte du Petit Chat restait sur la place qu'il vient de
  // quitter, et le tap avec elle.
  //
  // `emprise` pour ce qui se mesure mieux que par ses bornes — une feuille dont
  // le tracé déborde du carré qu'elle occupe.
  protected calerSur(id: string, objet: Mobile, emprise: () => Box = () => empriseDe(objet)) {
    const ancre = emprise();
    this.porteurs.set(id, { objet, emprise, ancre });
    this.caler(id, ancre);
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

    for (const def of [...this.hotspots(), ...this.exits()]) this.monterZone(def);

    this.appliquerGeometrie();
    this.refresh();
  }

  private monterZone(def: HotspotDef | ExitDef) {
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

    zone.on('pointerup', () => ('sortie' in def ? this.onSortie(def) : this.onHotspot(def)));
    this.montees.push({ def, zone });
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
    const [cx, cy] = this.pointDuMarqueur(def, box);
    const centre = `${Math.round(cx)}:${Math.round(cy)}`;
    if (this.centres.get(def.id) === centre) return;
    this.centres.set(def.id, centre);

    const ancien = this.markers.get(def.id);
    // Une emprise qui change pendant un trajet refait le marqueur : né entier au
    // milieu du vol, il annulerait l'escamotage en cours.
    const escamote = ancien ? estEscamote(ancien) : false;
    if (ancien) {
      this.tweens.killTweensOf(ancien);
      ancien.destroy();
    }

    const marqueur =
      'sortie' in def
        ? // La flèche pointe vers l'extérieur du cadre : c'est ce qui dit
          // « on sort par là » plutôt que « regarde ici ».
          createExitMarker(this, cx, cy, cx < DESIGN_WIDTH / 2 ? -1 : 1)
        : createHotspotMarker(this, cx, cy);
    // Un marqueur refait pendant un déplacement bloquant naîtrait éveillé : une
    // emprise qui change en cours de trajet suffit à le refaire.
    endormirMarqueur(marqueur, this.attentes.size > 0);
    if (escamote) void escamoterMarqueur(marqueur, true, 0);
    this.markers.set(def.id, marqueur);
  }

  // Le point de la carte est FIXE, et l'objet qui le porte a pu bouger : on le
  // décale du même écart que son emprise. Sans porteur — le cas de presque
  // toutes les zones — il vaut exactement ce que Tiled donne.
  private pointDuMarqueur(def: HotspotDef | ExitDef, box: Box): Marqueur {
    const centre: Marqueur = [box.x + box.w / 2, box.y + box.h / 2];
    if (!def.marqueur) return centre;
    const ancre = this.porteurs.get(def.id)?.ancre;
    if (!ancre) return def.marqueur;
    return [
      def.marqueur[0] + centre[0] - (ancre.x + ancre.w / 2),
      def.marqueur[1] + centre[1] - (ancre.y + ancre.h / 2),
    ];
  }

  // À appeler quand quelque chose change en dehors de `gameState` — l'arrivée
  // d'une image rendue en différé, par exemple.
  protected refresh() {
    // Le décor d'abord : il peut recaler des emprises, et la visibilité doit se
    // poser sur la géométrie à jour.
    this.onStateChange();
    this.appliquerVisibilite();
    // Les mouvements en dernier : ils se jouent sur un décor déjà à jour, et
    // `fait` est levé avant l'appel, donc un effet qui change l'état ne se
    // rappelle pas lui-même.
    for (const declencheur of this.declencheurs) {
      if (declencheur.fait || !gameState.flag(declencheur.flag)) continue;
      declencheur.fait = true;
      this.quandLaBoiteEstFermee(declencheur.jouer);
    }
  }

  // Le drapeau est levé au milieu d'une tirade, et la boîte de dialogue occupe
  // le bas du cadre : joué tout de suite, le mouvement se déroulerait derrière
  // elle. On retarde donc le MOUVEMENT, jamais l'état — la narration a déjà pris
  // ses décisions.
  //
  // Une horloge de scène et non un `setTimeout` : elle se met en pause avec le
  // jeu, et meurt avec la scène plutôt que de réveiller la pièce qu'on a
  // quittée.
  private quandLaBoiteEstFermee(jouer: () => void) {
    if (!this.services.dialogue.isRunning) {
      jouer();
      return;
    }
    this.time.delayedCall(120, () => this.quandLaBoiteEstFermee(jouer));
  }

  private appliquerVisibilite() {
    for (const { def, zone } of this.montees) {
      const visible = def.visibleIf ? def.visibleIf() : true;
      const marqueur = this.markers.get(def.id);
      marqueur?.setVisible(visible);
      // `enabled` plutôt que `setInteractive()` : appelé sans argument, celui-ci
      // refabrique une zone d'écoute rectangulaire et efface donc le contour des
      // zones polygonales.
      if (zone.input) zone.input.enabled = visible && !(marqueur && estEscamote(marqueur));
    }
  }

  // Point d'accroche pour le décor qui dépend de l'état (un pont posé…).
  protected onStateChange() {}

  private onHotspot(def: HotspotDef) {
    if (!this.repondAuTap(def)) return;
    void this.services.dialogue.run(def.knot);
  }

  private onSortie(def: ExitDef) {
    if (!this.repondAuTap(def)) return;
    if (def.knot) void this.services.dialogue.run(def.knot);
    else if (def.room) this.quitter(def.room);
  }

  private repondAuTap(def: HotspotDef | ExitDef): boolean {
    const { overlay, dialogue } = this.services;
    // Les deux conditions ne font pas doublon : `isRunning` couvre les instants
    // où le moteur de narration travaille boîte fermée — une animation de
    // pliage, un changement de scène — sans qu'aucune réplique n'attende de tap.
    if (dialogue.isRunning || overlay.occupeLeJoueur) return false;
    // Un déplacement ordinaire laisse la scène jouable ; seul celui qui a
    // demandé le silence compte ici.
    if (this.attentes.size > 0) return false;
    if (def.visibleIf && !def.visibleIf()) return false;
    return true;
  }

  // Le fondu n'est pas décoratif : sans lui, la scène suivante apparaît avec ses
  // marqueurs déjà en plein battement, et le joueur ne sait pas s'il a changé de
  // pièce ou si la sienne a changé.
  protected quitter(room: string) {
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.services.goto(room));
    cam.fadeOut(FONDU, 0, 0, 0);
  }
}

// Une zone et l'objet qui l'emmène. `ancre` est l'emprise du jour où elle lui a
// été attachée : c'est l'écart à celle-ci qui déplace un marqueur tracé au point.
interface Porteur {
  objet: Mobile;
  emprise: () => Box;
  ancre: Box;
}
