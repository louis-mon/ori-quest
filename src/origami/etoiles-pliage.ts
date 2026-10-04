import type * as THREE_NS from 'three';
import { sampleFold, type FoldAnimation } from './fold-file';
import { ETINCELLE, peindreEtoile, ROTATION, TAILLE_ETOILE, type Eclat } from './etoiles';
import { pliageDe, quaternionModele, repereVue } from './vue';

// Les étoiles d'un papier précieux pendant qu'il se plie : les mêmes que sur la
// feuille posée et sur le cœur du décor (feuilles-precieuses.ts), mais sur un
// papier qui bouge. Chacune est accrochée à un point de la feuille — un
// triangle et deux coordonnées barycentriques —, donc elle suit le pli qui
// l'emporte, et s'efface quand sa face se détourne ou qu'un rabat passe devant.
//
// Leur lumière est calculée par le papier lui-même, dans le shader du recto :
// elle s'arrête au bord de la feuille sans qu'on ait à la découper.

// Le temps de s'effacer derrière un rabat : coupée net, l'étoile clignoterait au
// passage de chaque arête.
const FONDU_MS = 80;

// Faute d'un point visible en autant d'essais, l'étoile saute cet éclat-là.
const ESSAIS = 12;

// La distance au bord de la silhouette, en fraction de la mesure des étoiles :
// la même que sur la feuille posée et le cœur du décor. Sur le bord, l'étoile
// dépassait du modèle.
const MARGE = 0.06;

interface Etoile {
  sprite: THREE_NS.Sprite;
  materiau: THREE_NS.SpriteMaterial;
  teinte: number;
  // Le triangle où elle est accrochée, -1 si elle saute cet éclat.
  triangle: number;
  u: number;
  v: number;
  position: THREE_NS.Vector3;
  // Dans son cycle, en ms : négatif tant qu'elle attend son premier éclat.
  temps: number;
  duree: number;
  pause: number;
  echelle: number;
  depart: number;
  sens: number;
  // 1 vue, 0 cachée, entre les deux pendant le fondu.
  vue: number;
}

export class EtoilesPliage {
  private readonly groupe: THREE_NS.Group;
  private readonly texture: THREE_NS.CanvasTexture;
  private readonly etoiles: Etoile[] = [];
  // Les valeurs des uniforms du recto, réécrites à chaque image.
  private readonly foyers: THREE_NS.Vector3[] = [];
  private readonly couleurs: THREE_NS.Color[] = [];
  // Aires cumulées des triangles sur la feuille à plat : un point tiré au
  // hasard sur le papier, pas dans la liste des triangles.
  private readonly cumul: Float32Array;
  private readonly marge: number;
  private readonly inverse: THREE_NS.Matrix4;
  private readonly oeil: THREE_NS.Vector3;
  // Les axes de l'écran, ramenés dans le repère du pliage et mis à la marge.
  private readonly droite: THREE_NS.Vector3;
  private readonly haut: THREE_NS.Vector3;
  private readonly voisin: THREE_NS.Vector3;

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly mesh: THREE_NS.Mesh,
    private readonly anim: FoldAnimation,
    // Les positions du pliage en cours, que la couche réécrit à chaque image.
    private readonly positions: Float32Array,
    nom: string,
    private readonly eclat: Eclat,
  ) {
    const { etoiles, lumiere } = eclat;
    const cote = coteDuModele(THREE, anim, nom);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TAILLE_ETOILE;
    peindreEtoile(canvas.getContext('2d')!, ETINCELLE);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    // Enfants du mesh : positions et tailles dans les unités du pliage, que le
    // recadrage de la couche met à l'échelle avec lui.
    this.groupe = new THREE.Group();
    mesh.add(this.groupe);

    const [tmin, tmax] = etoiles.taille;
    const [pmin, pmax] = etoiles.pause;
    for (let i = 0; i < etoiles.nombre; i++) {
      // Toujours devant, et c'est `visible()` qui les cache : face à la caméra,
      // une étoile posée sur une face inclinée y serait à moitié enfoncée, et le
      // tampon de profondeur la rognerait.
      const materiau = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(materiau);
      sprite.visible = false;
      sprite.renderOrder = 1;
      this.groupe.add(sprite);
      const duree = 2 * etoiles.duree * (0.8 + Math.random() * 0.4);
      const pause = pmin + Math.random() * (pmax - pmin);
      this.etoiles.push({
        sprite,
        materiau,
        teinte: 0,
        triangle: -1,
        u: 0,
        v: 0,
        position: new THREE.Vector3(),
        // Déphasées sur un cycle entier : parties ensemble, elles brilleraient
        // par vagues.
        temps: -Math.random() * (duree + pause),
        duree,
        pause,
        echelle: cote * (tmin + Math.random() * (tmax - tmin)),
        depart: 0,
        sens: 1,
        vue: 0,
      });
      this.foyers.push(new THREE.Vector3());
      this.couleurs.push(new THREE.Color(0, 0, 0));
    }

    this.cumul = airesCumulees(anim);
    this.marge = cote * MARGE;
    this.inverse = new THREE.Matrix4();
    this.oeil = new THREE.Vector3();
    this.droite = new THREE.Vector3();
    this.haut = new THREE.Vector3();
    this.voisin = new THREE.Vector3();

    eclairerLeRecto(mesh, {
      etoilesFoyer: { value: this.foyers },
      etoilesCouleur: { value: this.couleurs },
      etoilesRayon: { value: lumiere.rayon * cote },
    });
  }

  update(dt: number, camera: THREE_NS.Camera) {
    // La pose vient d'être écrite sur le pivot : la matrice n'est recalculée
    // qu'au rendu, après nous.
    this.mesh.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    this.inverse.copy(this.mesh.matrixWorld).invert();
    this.oeil.copy(camera.position).applyMatrix4(this.inverse);
    for (const [axe, x, y] of [
      [this.droite, 1, 0],
      [this.haut, 0, 1],
    ] as const) {
      axe
        .set(x, y, 0)
        .transformDirection(camera.matrixWorld)
        .transformDirection(this.inverse)
        .multiplyScalar(this.marge);
    }

    this.etoiles.forEach((e, i) => {
      const avant = e.temps;
      e.temps += dt;
      if (e.temps >= e.duree + e.pause) e.temps -= e.duree + e.pause;
      if (e.temps >= 0 && (avant < 0 || e.temps < avant)) this.allumer(e);

      const p = e.temps / e.duree;
      if (e.temps < 0 || p >= 1 || e.triangle < 0) {
        e.sprite.visible = false;
        this.couleurs[i].setRGB(0, 0, 0);
        return;
      }

      this.point(e);
      const cible = this.visible(e.triangle, e.position) ? 1 : 0;
      e.vue += (cible - e.vue) * Math.min(1, dt / FONDU_MS);
      const eclat = Math.sin(p * Math.PI) * e.vue;

      e.sprite.visible = eclat > 0.01;
      e.sprite.position.copy(e.position);
      e.sprite.scale.setScalar(e.echelle * eclat);
      e.materiau.rotation = this.THREE.MathUtils.degToRad(e.depart + e.sens * ROTATION * p);
      this.foyers[i].copy(e.position);
      // Les composantes telles quelles, sans passer en linéaire : la lumière
      // s'ajoute à l'image, comme sur la feuille posée.
      const force = this.eclat.lumiere.force * eclat;
      this.couleurs[i].setRGB(
        ((e.teinte >> 16) & 0xff) / 255,
        ((e.teinte >> 8) & 0xff) / 255,
        (e.teinte & 0xff) / 255,
      );
      this.couleurs[i].multiplyScalar(force);
    });
  }

  dispose() {
    this.mesh.remove(this.groupe);
    for (const e of this.etoiles) e.materiau.dispose();
    this.texture.dispose();
  }

  // Un nouvel éclat : ailleurs, d'une autre teinte, dans l'autre sens peut-être.
  private allumer(e: Etoile) {
    const { teintes } = this.eclat.etoiles;
    e.teinte = teintes[Math.floor(Math.random() * teintes.length)];
    e.materiau.color.setHex(e.teinte);
    e.depart = Math.random() * 90;
    e.sens = Math.random() > 0.5 ? 1 : -1;
    e.vue = 1;
    for (let essai = 0; essai < ESSAIS; essai++) {
      e.triangle = this.tirerTriangle();
      e.u = Math.random();
      e.v = Math.random();
      if (e.u + e.v > 1) {
        e.u = 1 - e.u;
        e.v = 1 - e.v;
      }
      this.point(e);
      if (this.visible(e.triangle, e.position) && this.loinDuBord(e.position)) return;
    }
    e.triangle = -1;
  }

  // Le papier tout autour, à la marge près, tel que le joueur le voit.
  private loinDuBord(cible: THREE_NS.Vector3): boolean {
    for (const [axe, sens] of [
      [this.droite, 1],
      [this.droite, -1],
      [this.haut, 1],
      [this.haut, -1],
    ] as const) {
      this.voisin.copy(cible).addScaledVector(axe, sens);
      if (!this.touche(this.voisin)) return false;
    }
    return true;
  }

  // Le regard qui passe par ce point rencontre-t-il du papier, devant ou
  // derrière lui ?
  private touche(point: THREE_NS.Vector3): boolean {
    const o = this.oeil;
    const idx = this.anim.indices;
    for (let t = 0; t < idx.length / 3; t++) {
      const d = intersection(
        o,
        point.x - o.x,
        point.y - o.y,
        point.z - o.z,
        this.positions,
        idx,
        t,
      );
      if (d > 0) return true;
    }
    return false;
  }

  private tirerTriangle(): number {
    const r = Math.random() * this.cumul[this.cumul.length - 1];
    const i = this.cumul.findIndex((c) => c >= r);
    return i < 0 ? this.cumul.length - 1 : i;
  }

  private point(e: Etoile) {
    const idx = this.anim.indices;
    const p = this.positions;
    const a = idx[e.triangle * 3] * 3;
    const b = idx[e.triangle * 3 + 1] * 3;
    const c = idx[e.triangle * 3 + 2] * 3;
    e.position.set(
      p[a] + e.u * (p[b] - p[a]) + e.v * (p[c] - p[a]),
      p[a + 1] + e.u * (p[b + 1] - p[a + 1]) + e.v * (p[c + 1] - p[a + 1]),
      p[a + 2] + e.u * (p[b + 2] - p[a + 2]) + e.v * (p[c + 2] - p[a + 2]),
    );
  }

  // Le recto tourné vers l'œil — c'est la face de devant du mesh —, et rien
  // entre les deux.
  private visible(triangle: number, cible: THREE_NS.Vector3): boolean {
    const idx = this.anim.indices;
    const p = this.positions;
    const o = this.oeil;
    const a = idx[triangle * 3] * 3;
    const b = idx[triangle * 3 + 1] * 3;
    const c = idx[triangle * 3 + 2] * 3;
    const e1x = p[b] - p[a];
    const e1y = p[b + 1] - p[a + 1];
    const e1z = p[b + 2] - p[a + 2];
    const e2x = p[c] - p[a];
    const e2y = p[c + 1] - p[a + 1];
    const e2z = p[c + 2] - p[a + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    if (nx * (o.x - cible.x) + ny * (o.y - cible.y) + nz * (o.z - cible.z) <= 0) return false;

    const dx = cible.x - o.x;
    const dy = cible.y - o.y;
    const dz = cible.z - o.z;
    for (let t = 0; t < idx.length / 3; t++) {
      if (t === triangle) continue;
      // Juste avant la cible : la face voisine qui la touche par une arête ne
      // compte pas comme un rabat.
      const d = intersection(o, dx, dy, dz, p, idx, t);
      if (d > 0 && d < 1 - 1e-4) return false;
    }
    return true;
  }
}

// Où le rayon `o + d·(dx, dy, dz)` traverse ce triangle, en multiples de
// (dx, dy, dz) ; -1 s'il le manque. Möller–Trumbore, en nombres nus : huit
// étoiles par image sur tous les triangles, sans rien allouer.
function intersection(
  o: THREE_NS.Vector3,
  dx: number,
  dy: number,
  dz: number,
  p: Float32Array,
  idx: Uint32Array,
  t: number,
): number {
  const a = idx[t * 3] * 3;
  const b = idx[t * 3 + 1] * 3;
  const c = idx[t * 3 + 2] * 3;
  const e1x = p[b] - p[a];
  const e1y = p[b + 1] - p[a + 1];
  const e1z = p[b + 2] - p[a + 2];
  const e2x = p[c] - p[a];
  const e2y = p[c + 1] - p[a + 1];
  const e2z = p[c + 2] - p[a + 2];
  const hx = dy * e2z - dz * e2y;
  const hy = dz * e2x - dx * e2z;
  const hz = dx * e2y - dy * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-12) return -1;
  const f = 1 / det;
  const sx = o.x - p[a];
  const sy = o.y - p[a + 1];
  const sz = o.z - p[a + 2];
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return -1;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = f * (dx * qx + dy * qy + dz * qz);
  if (v < 0 || u + v > 1) return -1;
  return f * (e2x * qx + e2y * qy + e2z * qz);
}

function airesCumulees(anim: FoldAnimation): Float32Array {
  // La première pose est la feuille à plat.
  const p = anim.positions;
  const idx = anim.indices;
  const cumul = new Float32Array(idx.length / 3);
  let total = 0;
  for (let t = 0; t < cumul.length; t++) {
    const a = idx[t * 3] * 3;
    const b = idx[t * 3 + 1] * 3;
    const c = idx[t * 3 + 2] * 3;
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    total +=
      Math.hypot(
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ) / 2;
    cumul[t] = total;
  }
  return cumul;
}

const cotes = new Map<string, number>();

// La mesure des étoiles, comme pour le cœur du décor : le côté d'un carré de
// même aire que la silhouette du modèle plié, vue par le joueur. Elles ont ainsi
// la taille qu'elles auront une fois le modèle posé.
//
// Tramée plutôt que calculée : les couches d'un pliage se recouvrent, et la
// somme des triangles compterait plusieurs fois le même papier.
function coteDuModele(THREE: typeof THREE_NS, anim: FoldAnimation, nom: string): number {
  const connu = cotes.get(nom);
  if (connu) return connu;

  const p = new Float32Array(anim.vertexCount * 3);
  sampleFold(anim, pliageDe(nom), p);
  const q = quaternionModele(THREE, nom);
  const { droite, haut } = repereVue(THREE);
  const xs = new Float32Array(anim.vertexCount);
  const ys = new Float32Array(anim.vertexCount);
  const v = new THREE.Vector3();
  for (let i = 0; i < anim.vertexCount; i++) {
    v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyQuaternion(q);
    xs[i] = v.dot(droite);
    ys[i] = v.dot(haut);
  }
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const etendue = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;

  const TRAME = 128;
  const k = TRAME / etendue;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TRAME;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  const idx = anim.indices;
  // Un remplissage par triangle : d'un seul tracé, deux couches d'orientations
  // opposées s'annuleraient à la règle du non-zéro.
  for (let t = 0; t < idx.length; t += 3) {
    ctx.beginPath();
    for (let s = 0; s < 3; s++) {
      const x = (xs[idx[t + s]] - minX) * k;
      const y = (ys[idx[t + s]] - minY) * k;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const pixels = ctx.getImageData(0, 0, TRAME, TRAME).data;
  let remplis = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 127) remplis++;

  const cote = Math.sqrt(remplis) / k;
  cotes.set(nom, cote);
  return cote;
}

// Ajoutée à la couleur finale, déjà passée en sRGB, et linéaire jusqu'au rayon :
// les disques de la feuille posée s'ajoutent de même à l'image. Additionnée en
// linéaire, avant la conversion, la flaque s'élargissait et virait à l'orange.
// Sur le recto seul : c'est lui que les étoiles éclairent. Le matériau est
// propre à ce mesh (`creerMeshOrigami`), aucun autre modèle n'en hérite.
function eclairerLeRecto(mesh: THREE_NS.Mesh, uniforms: Record<string, { value: unknown }>) {
  const recto = (mesh.material as THREE_NS.Material[])[0];
  const n = (uniforms.etoilesFoyer.value as unknown[]).length;
  recto.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vPositionPapier;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPositionPapier = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `#define ETOILES ${n}
uniform vec3 etoilesFoyer[ETOILES];
uniform vec3 etoilesCouleur[ETOILES];
uniform float etoilesRayon;
varying vec3 vPositionPapier;
void main() {`,
      )
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
for (int i = 0; i < ETOILES; i++) {
  float d = distance(vPositionPapier, etoilesFoyer[i]);
  gl_FragColor.rgb += etoilesCouleur[i] * max(0.0, 1.0 - d / etoilesRayon);
}`,
      );
  };
  recto.customProgramCacheKey = () => `etoiles-${n}`;
  recto.needsUpdate = true;
}
