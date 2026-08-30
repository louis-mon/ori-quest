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

// Pour un modèle recadré sur 1,1 unité par frameModel, à 35° de champ.
const RECUL = 2.9;

// Le modèle finit de pivoter avant la fin du pliage : les derniers pourcents
// sont ceux où la forme se referme, et c'est ça qu'on veut voir.
const POSE_A = 0.75;

const BALANCEMENT = 0.14; // radians, ~8°
const VITESSE_TOUR = 0.0007; // radians par milliseconde, ~9 s le tour

// three.js est chargé dynamiquement pour rester hors du bundle initial : ~150 Ko
// gzip qu'on n'impose pas à l'écran-titre.
export class OrigamiLayer {
  private THREE!: typeof THREE_NS;
  private renderer!: THREE_NS.WebGLRenderer;
  private scene!: THREE_NS.Scene;
  private camera!: THREE_NS.PerspectiveCamera;
  private mesh?: THREE_NS.Mesh;
  private geometry?: THREE_NS.BufferGeometry;
  // C'est le pivot qui tourne, pas le mesh : le recadrage décale le mesh, donc
  // une rotation appliquée à lui se ferait autour de l'origine brute du pliage
  // et le modèle décrirait un arc de cercle au lieu de tourner sur lui-même.
  private pivot?: THREE_NS.Group;

  private anim?: FoldAnimation;
  private scratch?: Float32Array;

  private poseDepart?: THREE_NS.Quaternion;
  private poseFin?: THREE_NS.Quaternion;
  private pose?: THREE_NS.Quaternion;
  // Tampons réutilisés à chaque frame, pour ne rien allouer dans la boucle.
  private axeBalancement?: THREE_NS.Vector3;
  private rotBalancement?: THREE_NS.Quaternion;

  private fold = 0;
  private target = 0;
  private speed = 0; // unités de pliage par milliseconde
  private onArrive?: () => void;

  private rafId = 0;
  private spin = 0;
  // `pliage` se contente d'un balancement, pour ne pas défaire la pose qu'on
  // vient d'atteindre ; `presentation` fait tourner le modèle sans fin.
  private mode: 'pliage' | 'presentation' = 'pliage';
  private balancement = true; // voir `load`
  private lastTime = 0;
  private visible = false;
  // Le contexte a été perdu : cette couche ne rendra plus rien.
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
      // Cher sur GPU mobile, et au-delà de 2x en densité de pixels il n'apporte
      // quasiment rien de visible.
      antialias: window.devicePixelRatio < 2,
      powerPreference: PREFERENCE_GPU,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearAlpha(0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    // Même angle que les images fixes du décor et de l'inventaire : le modèle
    // qu'on vient de voir se plier doit se reconnaître une fois posé.
    this.camera.position.set(
      DIRECTION_VUE.x * RECUL,
      DIRECTION_VUE.y * RECUL,
      DIRECTION_VUE.z * RECUL,
    );
    this.camera.up.set(HAUT_VUE.x, HAUT_VUE.y, HAUT_VUE.z);
    this.camera.lookAt(0, 0, 0);

    eclairer(THREE, this.scene);

    // Un contexte perdu ne lève aucune erreur : la boucle continuerait de
    // tourner sans plus rien dessiner. Une couche perdue ne se répare pas, c'est
    // à l'appelant d'en refabriquer une.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.perdu = true;
      this.stop();
      // Qui attendait la fin du pliage doit reprendre la main. Sans ça,
      // `playFold()` (main.ts) reste suspendu, le récit avec lui, et TOUT le
      // décor cesse de répondre — sans la moindre erreur en console.
      this.settle();
      console.warn('[origami] contexte WebGL perdu');
    });

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  // `textures` remplace celles des faces, dans l'ordre des matériaux du mesh :
  // le tutoriel y trace un pli image par image, ce qu'un papier partagé ne peut
  // pas faire.
  //
  // `posee` pose la feuille à plat devant le joueur au lieu de la présenter :
  // d'aplomb, sans balancement. Une feuille laissée dans le plan du solveur se
  // projette en trapèze sous la caméra du jeu, et le balancement, qui dit « c'est
  // un volume » d'un objet présenté, dit « elle tangue » d'une feuille qu'on
  // regarde longuement.
  async load(
    nom: string,
    { textures, posee }: { textures?: THREE_NS.Texture[]; posee?: boolean } = {},
  ) {
    const anim = await animationOrigami(nom);

    this.disposeMesh();

    this.anim = anim;

    const { mesh, geometry, positions } = creerMeshOrigami(this.THREE, anim, nom);
    if (textures) {
      // Les matériaux sont créés pour ce mesh-ci, donc en écraser un n'atteint
      // aucun autre modèle.
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

    // L'encombrement se mesure sur *tous* les frames, sinon le modèle sort du
    // champ au milieu du pliage.
    this.frameModel();
    this.applyFold(this.fold);
  }

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

  // Adouci aux deux bouts : une rotation linéaire s'arrête sec juste au moment
  // où le joueur essaie de reconnaître l'objet.
  private applyPose(t: number) {
    if (!this.pose || !this.poseDepart || !this.poseFin) return;
    const avance = Math.min(Math.max(t / POSE_A, 0), 1);
    const doux = avance * avance * (3 - 2 * avance);
    this.pose.copy(this.poseDepart).slerp(this.poseFin, doux);
  }

  playTo(t: number, durationMs = 2000): Promise<void> {
    this.mode = 'pliage';
    return new Promise((resolve) => {
      this.onArrive?.();
      this.target = Math.min(Math.max(t, 0), 1);
      const delta = Math.abs(this.target - this.fold);
      this.speed = delta > 0 && durationMs > 0 ? delta / durationMs : Infinity;
      this.onArrive = resolve;
      // `perdu` compte autant que la distance nulle : sans boucle, personne ne
      // viendra dénouer cette promesse, et le récit resterait suspendu sur un
      // pliage qui ne finira jamais. Le modèle ne s'affiche plus, la partie
      // continue — c'est le bon sens de la dégradation.
      if (this.perdu || this.speed === Infinity) {
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

  // Le modèle déjà plié, tournant lentement : une image fixe ne dirait pas qu'un
  // origami a une épaisseur et un dos.
  presenter(pliage: number) {
    this.setFold(pliage);
    this.mode = 'presentation';
    this.spin = 0;
    this.show();
  }

  // À appeler quand la toile revient dans le document : `resize` ne suit que la
  // fenêtre, et une toile détachée s'y mesure à zéro. Sans ça, la couche gardée
  // du tutoriel se réveillait en 1×1 pixel après un redimensionnement.
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
    // Une couche cachée n'ira pas au bout de son pliage : on rend la main
    // plutôt que de laisser attendre. Sans effet dans le cas courant, où
    // `hide()` suit une pose déjà atteinte.
    this.settle();
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

    // Le balancement est posé par-dessus la pose et jamais accumulé : de quoi
    // montrer que c'est un volume, pas de quoi défaire l'orientation qu'on vient
    // d'atteindre. À ±34°, la pose finale était illisible.
    if (this.pivot && this.pose && this.axeBalancement && this.rotBalancement) {
      const presente = this.mode === 'presentation';
      if (!presente && !this.balancement) {
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

  // `renderer.dispose()` seul ne libère pas le contexte WebGL : les contextes
  // s'accumulent et au-delà d'une quinzaine le navigateur tue le plus ancien,
  // celui de Phaser. D'où `forceContextLoss()`.
  //
  // Fin de vie, pas mise en veille : ce qui doit resservir se recharge avec
  // `load()`. Et jamais en boucle — le navigateur compte les pertes provoquées
  // et finit par interdire à la page de créer le moindre contexte.
  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    this.disposeMesh();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
  }
}
