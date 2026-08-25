import type * as THREE_NS from 'three';
import { PREFERENCE_GPU } from '../gpu';
import { animationOrigami, sampleFold, type FoldAnimation } from './fold-file';
import { creerMeshOrigami, libererMateriaux } from './papier';
import {
  DIRECTION_VUE,
  HAUT_VUE,
  eclairer,
  quaternionFeuille,
  quaternionFeuilleDeFace,
  quaternionModele,
} from './vue';

/**
 * Distance de la caméra, pour un modèle recadré sur 1,1 unité (voir
 * `frameModel`). À 35° de champ, elle laisse une marge confortable sans que le
 * modèle ne se perde au milieu du cadre.
 */
const RECUL = 2.9;

/**
 * Part du pliage pendant laquelle le modèle finit de pivoter vers sa pose.
 *
 * Volontairement avant la fin : les derniers pourcents du pliage sont ceux où
 * la forme se referme, et c'est ce qu'on veut voir — pas un objet encore en
 * train de tourner.
 */
const POSE_A = 0.75;

/** Amplitude du balancement qui accompagne un pliage, en radians (~8°). */
const BALANCEMENT = 0.14;

/** Vitesse du tour sur soi-même, en radians par milliseconde (~9 s le tour). */
const VITESSE_TOUR = 0.0007;

/**
 * Couche 3D superposée au canvas Phaser : joue une animation de pliage
 * précalculée (`.origami`).
 *
 * three.js est chargé dynamiquement pour qu'il reste hors du bundle initial —
 * le joueur qui n'a pas encore atteint une scène avec origami ne le télécharge
 * pas. C'est ~150 Ko gzip qu'on n'impose pas à l'écran-titre.
 */
export class OrigamiLayer {
  private THREE!: typeof THREE_NS;
  private renderer!: THREE_NS.WebGLRenderer;
  private scene!: THREE_NS.Scene;
  private camera!: THREE_NS.PerspectiveCamera;
  private mesh?: THREE_NS.Mesh;
  private geometry?: THREE_NS.BufferGeometry;
  /**
   * Porte-modèle : c'est **lui** qui tourne, pas le mesh.
   *
   * Le recadrage décale le mesh pour amener le modèle au centre du cadre ; une
   * rotation appliquée au mesh se ferait donc autour de l'origine brute du
   * pliage, pas de son centre, et le modèle décrivait un arc de cercle au lieu
   * de tourner sur lui-même. En emboîtant l'un dans l'autre, le décalage et la
   * rotation ne se marchent plus dessus.
   */
  private pivot?: THREE_NS.Group;

  private anim?: FoldAnimation;
  private scratch?: Float32Array;

  /**
   * Les deux poses entre lesquelles le modèle pivote pendant qu'il se plie :
   * la feuille bien en face au départ, l'orientation définitive à l'arrivée.
   * Voir `quaternionFeuille` — la dernière image de l'animation est exactement
   * celle que le décor montrera ensuite.
   */
  private poseDepart?: THREE_NS.Quaternion;
  private poseFin?: THREE_NS.Quaternion;
  /** Pose visée à l'instant courant, balancement non compris. */
  private pose?: THREE_NS.Quaternion;
  /** Tampons réutilisés à chaque frame, pour ne rien allouer dans la boucle. */
  private axeBalancement?: THREE_NS.Vector3;
  private rotBalancement?: THREE_NS.Quaternion;

  private fold = 0;
  private target = 0;
  private speed = 0; // unités de pliage par milliseconde
  private onArrive?: () => void;

  private rafId = 0;
  private spin = 0;
  /**
   * Ce que la couche est en train de faire.
   *
   * `pliage` accompagne l'animation d'un simple balancement, pour ne pas défaire
   * la pose qu'on vient d'atteindre. `presentation` fait tourner le modèle sur
   * lui-même, sans fin : c'est le mode où le joueur regarde un objet parce qu'il
   * l'a demandé, et où on lui doit d'en faire le tour.
   */
  private mode: 'pliage' | 'presentation' = 'pliage';
  /** Le modèle se balance-t-il pendant qu'il est à l'écran ? Voir `load`. */
  private balancement = true;
  private lastTime = 0;
  private visible = false;
  /** Le contexte a été perdu : cette couche ne rendra plus rien. */
  private perdu = false;

  private constructor(private readonly canvas: HTMLCanvasElement) {}

  static async create(canvas: HTMLCanvasElement): Promise<OrigamiLayer> {
    const layer = new OrigamiLayer(canvas);
    await layer.init();
    return layer;
  }

  private async init() {
    const THREE = await import('three');
    this.THREE = THREE;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      // L'antialias est cher sur GPU mobile. Au-delà de 2x en densité de
      // pixels il n'apporte quasiment rien de visible : on l'économise.
      antialias: window.devicePixelRatio < 2,
      powerPreference: PREFERENCE_GPU,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearAlpha(0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    // Même angle que les images fixes du décor et de l'inventaire : le modèle
    // qu'on vient de voir se plier doit se reconnaître une fois posé. Voir
    // `DIRECTION_VUE` pour le pourquoi de ces 55° au-dessus de l'horizon.
    this.camera.position.set(
      DIRECTION_VUE.x * RECUL,
      DIRECTION_VUE.y * RECUL,
      DIRECTION_VUE.z * RECUL,
    );
    this.camera.up.set(HAUT_VUE.x, HAUT_VUE.y, HAUT_VUE.z);
    this.camera.lookAt(0, 0, 0);

    eclairer(THREE, this.scene);

    // Un contexte perdu ne lève aucune erreur : la boucle continuerait de
    // tourner en ne dessinant plus rien. On l'arrête et on le dit — c'est à
    // l'appelant de refabriquer une couche (voir `coucheDemo`, dans
    // `tutoriel.ts`), une couche perdue ne se répare pas.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.perdu = true;
      this.stop();
      console.warn('[origami] contexte WebGL perdu');
    });

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /**
   * Charge un modèle par son nom (`pont`, `arbre`…).
   *
   * `textures` remplace celles des faces, dans l'ordre des matériaux du mesh.
   * Le tutoriel s'en sert pour tracer un pli sur la feuille pendant qu'on la
   * regarde (voir `papierTrace`) : elles changent à chaque image, ce qu'un
   * papier partagé ne peut pas faire.
   *
   * `posee` : la feuille est **posée bien à plat devant le joueur**, et pas
   * présentée. Deux conséquences qui vont ensemble — elle part dans
   * l'orientation de `quaternionFeuilleDeFace`, donc un carré se voit comme un
   * carré, d'aplomb et sans perspective ; et elle ne se balance pas. C'est ce
   * qu'il faut d'un schéma qu'on regarde longuement avant de le plier : on le
   * décrit, on trace un pli dessus. Le balancement dit « c'est un volume » d'un
   * objet qu'on présente ; sur une feuille qu'on examine, il dit « elle
   * tangue ». Et une feuille laissée dans le plan du solveur, vue par la caméra
   * du jeu à 70° au-dessus d'elle, se projette en trapèze : à plat pour de vrai,
   * mais pas à l'écran.
   */
  async load(
    nom: string,
    { textures, posee }: { textures?: THREE_NS.Texture[]; posee?: boolean } = {},
  ) {
    const anim = await animationOrigami(nom);

    this.disposeMesh();

    this.anim = anim;

    const { mesh, geometry, positions } = creerMeshOrigami(this.THREE, anim, nom);
    if (textures) {
      // Les matériaux sont créés pour ce mesh-ci — seules les textures sont
      // partagées — donc en écraser une n'atteint aucun autre modèle.
      const faces = (
        Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      ) as THREE_NS.MeshPhongMaterial[];
      faces.forEach((face, i) => {
        if (!textures[i]) return;
        face.map = textures[i];
        face.needsUpdate = true;
      });
    }
    this.scratch = positions;
    this.mesh = mesh;
    this.geometry = geometry;
    this.pivot = new this.THREE.Group();
    this.pivot.add(mesh);
    this.scene.add(this.pivot);

    this.balancement = !posee;
    this.poseDepart = posee ? quaternionFeuilleDeFace(this.THREE) : quaternionFeuille(this.THREE);
    this.poseFin = quaternionModele(this.THREE, nom);
    this.pose = this.poseDepart.clone();
    this.axeBalancement ??= new this.THREE.Vector3(HAUT_VUE.x, HAUT_VUE.y, HAUT_VUE.z).normalize();
    this.rotBalancement ??= new this.THREE.Quaternion();

    // Recadrage : on mesure l'encombrement sur *tous* les frames, sinon le
    // modèle sort du champ au milieu du pliage.
    this.frameModel();
    this.applyFold(this.fold);
  }

  /** Centre et met à l'échelle le modèle pour qu'il tienne dans le cadre. */
  private frameModel() {
    const anim = this.anim;
    if (!anim || !this.mesh) return;

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    const p = anim.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
      if (p[i + 2] < minZ) minZ = p[i + 2];
      if (p[i + 2] > maxZ) maxZ = p[i + 2];
    }

    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const scale = 1.1 / size;
    this.mesh.scale.setScalar(scale);
    this.mesh.position.set(
      -((minX + maxX) / 2) * scale,
      -((minY + maxY) / 2) * scale,
      -((minZ + maxZ) / 2) * scale,
    );
  }

  private applyFold(t: number) {
    if (!this.anim || !this.scratch || !this.geometry) return;
    sampleFold(this.anim, t, this.scratch);
    const attr = this.geometry.getAttribute('position');
    attr.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.applyPose(t);
  }

  /**
   * Fait pivoter le modèle de la feuille à plat vers sa pose définitive, au
   * rythme du pliage.
   *
   * Le mouvement est adouci aux deux bouts : une rotation linéaire donne un
   * démarrage sec, et surtout un arrêt sec juste au moment où le joueur essaie
   * de reconnaître l'objet.
   */
  private applyPose(t: number) {
    if (!this.pose || !this.poseDepart || !this.poseFin) return;
    const avance = Math.min(Math.max(t / POSE_A, 0), 1);
    const doux = avance * avance * (3 - 2 * avance);
    this.pose.copy(this.poseDepart).slerp(this.poseFin, doux);
  }

  /** Anime le pliage jusqu'à `t`. Résout quand l'animation est terminée. */
  playTo(t: number, durationMs = 2000): Promise<void> {
    this.mode = 'pliage';
    return new Promise((resolve) => {
      this.onArrive?.();
      this.target = Math.min(Math.max(t, 0), 1);
      const delta = Math.abs(this.target - this.fold);
      this.speed = delta > 0 && durationMs > 0 ? delta / durationMs : Infinity;
      this.onArrive = resolve;
      if (this.speed === Infinity) {
        this.fold = this.target;
        this.applyFold(this.fold);
        this.settle();
      }
    });
  }

  setFold(t: number) {
    this.fold = this.target = Math.min(Math.max(t, 0), 1);
    this.applyFold(this.fold);
  }

  /**
   * Montre le modèle déjà plié, tournant lentement sur lui-même.
   *
   * C'est la vue « je regarde ce que j'ai en poche » : le joueur a tapé un objet
   * de son inventaire, il veut le voir, et une image fixe ne dit pas qu'un
   * origami a une épaisseur et un dos. Le tour est lent — assez pour qu'on suive
   * une arête du regard pendant qu'on lit la description.
   */
  presenter(pliage: number) {
    this.setFold(pliage);
    this.mode = 'presentation';
    this.spin = 0;
    this.show();
  }

  /**
   * Recale le rendu sur la taille actuelle de la toile.
   *
   * À appeler quand la toile revient dans le document : `resize` ne suit que les
   * redimensionnements de la fenêtre, et une toile détachée s'y mesure à zéro.
   * Sans ça, une couche gardée d'une fois sur l'autre — celle du tutoriel — se
   * réveillait en 1×1 pixel après un simple changement de taille de fenêtre.
   */
  ajuster() {
    this.resize();
  }

  show() {
    this.visible = true;
    this.canvas.classList.add('is-visible');
    this.start();
  }

  hide() {
    this.visible = false;
    this.canvas.classList.remove('is-visible');
    this.stop();
  }

  private start() {
    if (this.rafId || this.perdu) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(now - this.lastTime, 100); // borne les gros hoquets
      this.lastTime = now;
      this.update(dt);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private update(dt: number) {
    if (this.fold !== this.target) {
      const step = this.speed * dt;
      const remaining = this.target - this.fold;
      if (Math.abs(remaining) <= step) {
        this.fold = this.target;
        this.applyFold(this.fold);
        this.settle();
      } else {
        this.fold += Math.sign(remaining) * step;
        this.applyFold(this.fold);
      }
    }

    // Un très léger balancement autour de la verticale de l'image, **posé
    // par-dessus** la pose et jamais accumulé : de quoi montrer que c'est un
    // volume, pas de quoi défaire l'orientation qu'on vient d'atteindre.
    // L'ancienne oscillation à ±34° rendait la pose finale illisible.
    if (this.pivot && this.pose && this.axeBalancement && this.rotBalancement) {
      const presente = this.mode === 'presentation';
      if (!presente && !this.balancement) {
        // Posé : le modèle ne fait rien d'autre que se plier. Voir `load`.
        this.pivot.quaternion.copy(this.pose);
      } else {
        this.spin += dt * (presente ? VITESSE_TOUR : 0.00035);
        this.rotBalancement.setFromAxisAngle(
          this.axeBalancement,
          presente ? this.spin : Math.sin(this.spin) * BALANCEMENT,
        );
        this.pivot.quaternion.copy(this.rotBalancement).multiply(this.pose);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private settle() {
    const cb = this.onArrive;
    this.onArrive = undefined;
    cb?.();
  }

  private resize = () => {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.visible) this.renderer.render(this.scene, this.camera);
  };

  private disposeMesh() {
    if (this.pivot) this.scene.remove(this.pivot);
    if (this.mesh) libererMateriaux(this.mesh);
    this.geometry?.dispose();
    this.pivot = undefined;
    this.mesh = undefined;
    this.geometry = undefined;
  }

  /**
   * Rend le contexte WebGL, et pas seulement les ressources three.js.
   *
   * `renderer.dispose()` seul **ne libère pas le contexte** : il reste vivant
   * jusqu'à ce que le navigateur récupère la mémoire, quand il veut. Les
   * contextes s'accumulent alors, et au-delà d'une quinzaine le navigateur tue
   * le **plus ancien** — celui de Phaser. L'écran du jeu clignotait, puis plus
   * rien ne se rendait. `forceContextLoss()` est la façon documentée de le
   * rendre tout de suite.
   *
   * La couche n'est **pas réutilisable** après : `dispose()` est une fin de vie,
   * pas une mise en veille. Ce qui doit resservir se garde et se recharge avec
   * `load()`.
   *
   * ⚠ À n'appeler que pour une vraie fin de vie, jamais en boucle : le
   * navigateur compte les pertes provoquées et finit par **interdire à la page**
   * de créer le moindre contexte (« Web page caused context loss and was
   * blocked »). L'onglet est alors bon à fermer, et le jeu paraît cassé sans
   * qu'aucune ligne de code ne soit en cause.
   */
  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    this.disposeMesh();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
  }
}
