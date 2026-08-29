import type * as THREE_NS from 'three';
import type { FoldAnimation } from './fold-file';

// Le verso n'apparaît qu'aux endroits où le papier s'est retourné : c'est lui
// qui dessine les plis, un modèle uniformément blanc se lit comme une bosse.
//
// Les textures sont peintes à l'exécution plutôt que chargées en PNG, pour le
// budget de 30 Mo du jeu.

export type Papier =
  | 'papier'
  | 'noir'
  | 'bois'
  | 'boisFonce'
  | 'feuille'
  | 'herbe'
  | 'pierre'
  | 'tachete'
  | 'metal'
  | 'marron';

interface PapierModele {
  recto: Papier;
  verso: Papier;
  // Le pliage finit retourné, ce sont les triangles vus de dos qui se présentent
  // au joueur. Rien dans le crease pattern ne le dit : ça se constate au rendu.
  // Sans ce drapeau, la hache sortait en manche marron avec un éclat de métal.
  retourne?: boolean;
}

export const PAPIERS: Record<string, PapierModele> = {
  pont: { recto: 'papier', verso: 'bois' },
  // Le tronc est ce petit triangle de bois qu'un retournement fait apparaître.
  arbre: { recto: 'feuille', verso: 'boisFonce' },
  hache: { recto: 'metal', verso: 'marron', retourne: true },
  porte: { recto: 'noir', verso: 'boisFonce' },
  // Chapitre 2. Les teintes viennent des fiches de scène, où elles décrivent le
  // papier posé dans le décor : c'est la même matière avant et après le pliage.
  montagne: { recto: 'pierre', verso: 'papier' },
  herbe: { recto: 'herbe', verso: 'feuille' },
  pot: { recto: 'papier', verso: 'pierre' },
  chien: { recto: 'tachete', verso: 'papier' },
  os: { recto: 'papier', verso: 'pierre' },
  // Les feuilles de démonstration des tutoriels. Un verso, sinon la feuille
  // pliée n'est qu'un aplat clair où le pli ne se lit qu'à l'ombre — et le même
  // pour les trois, pour qu'on reconnaisse la feuille sur laquelle on explique.
  vallee: { recto: 'papier', verso: 'bois' },
  // `pli_montagne` et non `montagne` : celle du village est un vrai relief, ce
  // carré-ci n'est que le trait qui donne son nom au pli.
  pli_montagne: { recto: 'papier', verso: 'bois' },
  bombe: { recto: 'papier', verso: 'bois' },
};

const DEFAUT: PapierModele = { recto: 'papier', verso: 'papier' };

const TAILLE = 512;

interface Aspect {
  // Fond de la texture, et couleur du décor 2D : la feuille encore dépliée est
  // dessinée en primitives Phaser et doit avoir exactement la couleur du modèle
  // qu'elle deviendra, sinon la transition saute.
  teinte: string;
  peindre: (ctx: CanvasRenderingContext2D) => void;
  specular: number;
  shininess: number;
}

// Appliqué en dernier : c'est lui qui empêche l'aplat plastique.
function grain(ctx: CanvasRenderingContext2D, intensite: number, pas = 1) {
  const image = ctx.getImageData(0, 0, TAILLE, TAILLE);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4 * pas) {
    const n = (Math.random() - 0.5) * intensite;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
}

function veines(
  ctx: CanvasRenderingContext2D,
  couleurs: string[],
  nombre: number,
  amplitude: number,
) {
  ctx.lineWidth = 2;
  for (let i = 0; i < nombre; i++) {
    const base = (TAILLE / nombre) * (i + Math.random() * 0.6);
    const onde = 1 + Math.floor(Math.random() * 3);
    const phase = Math.random() * Math.PI * 2;
    ctx.strokeStyle = couleurs[i % couleurs.length];
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    for (let x = 0; x <= TAILLE; x += 8) {
      const y = base + Math.sin((x / TAILLE) * Math.PI * 2 * onde + phase) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function fond(ctx: CanvasRenderingContext2D, couleur: string) {
  ctx.fillStyle = couleur;
  ctx.fillRect(0, 0, TAILLE, TAILLE);
}

const ASPECTS: Record<Papier, Aspect> = {
  papier: {
    teinte: '#f2ece1',
    specular: 0x1a1a1a,
    shininess: 10,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.papier.teinte);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * TAILLE;
        const y = Math.random() * TAILLE;
        const l = 4 + Math.random() * 14;
        const a = Math.random() * Math.PI;
        ctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#ddd3c0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      grain(ctx, 10);
    },
  },

  noir: {
    // Le reflet est ce qui distingue du papier noir d'un trou : mat et uniforme,
    // il se lirait comme un vide découpé dans le décor.
    teinte: '#1c1917',
    specular: 0x6a6a72,
    shininess: 40,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.noir.teinte);
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 700; i++) {
        const x = Math.random() * TAILLE;
        const y = Math.random() * TAILLE;
        const l = 5 + Math.random() * 16;
        const a = Math.random() * Math.PI;
        ctx.strokeStyle = Math.random() > 0.5 ? '#3d3833' : '#0e0d0c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      grain(ctx, 12);
    },
  },

  bois: {
    teinte: '#8a6440',
    specular: 0x2a2018,
    shininess: 8,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.bois.teinte);
      veines(ctx, ['#5f4227', '#a07c55', '#4a3220'], 34, 14);
      grain(ctx, 16);
    },
  },

  boisFonce: {
    // Éclairci : à #59402a, sur un décor déjà sombre, le tronc de l'arbre et le
    // cadre de la porte se perdaient dans le fond.
    teinte: '#7a5a3a',
    specular: 0x241a12,
    shininess: 8,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.boisFonce.teinte);
      veines(ctx, ['#553a20', '#9c7c56', '#452e19'], 40, 11);
      grain(ctx, 14);
    },
  },

  feuille: {
    teinte: '#4f8f3a',
    specular: 0x2e3a20,
    shininess: 26,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.feuille.teinte);
      // Ce squelette de nervures fait lire « feuille » plutôt que « vert ».
      ctx.strokeStyle = '#3b6d2b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(TAILLE / 2, 0);
      ctx.lineTo(TAILLE / 2, TAILLE);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      for (let y = 18; y < TAILLE; y += 26) {
        for (const sens of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(TAILLE / 2, y);
          ctx.lineTo(TAILLE / 2 + sens * TAILLE * 0.46, y + 46);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      grain(ctx, 18);
    },
  },

  // Vert plus clair que `feuille`, et strié dans le sens des brins : c'est le
  // recto de la touffe, dont `feuille` fait le verso.
  herbe: {
    teinte: '#8fbf52',
    specular: 0x2e3a20,
    shininess: 20,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.herbe.teinte);
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 260; i++) {
        const x = Math.random() * TAILLE;
        const y = Math.random() * TAILLE;
        const h = 18 + Math.random() * 40;
        ctx.strokeStyle = Math.random() > 0.5 ? '#a8d16b' : '#6a9a37';
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + h * 0.2, y - h * 0.6, x + h * 0.5, y - h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      grain(ctx, 16);
    },
  },

  // Le gris de la montagne. Mat, contrairement au métal : un caillou qui brille
  // se lit comme une lame.
  pierre: {
    teinte: '#b3aea4',
    specular: 0x201e1b,
    shininess: 6,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.pierre.teinte);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 700; i++) {
        const x = Math.random() * TAILLE;
        const y = Math.random() * TAILLE;
        ctx.fillStyle = Math.random() > 0.5 ? '#cbc6bc' : '#8d8880';
        ctx.beginPath();
        ctx.arc(x, y, 1 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      grain(ctx, 14);
    },
  },

  // Le papier du chien : des taches franches et espacées, pas un moucheté — à la
  // taille d'une vignette d'inventaire, un grain fin redevient un aplat.
  tachete: {
    teinte: '#ece0c9',
    specular: 0x1a1a1a,
    shininess: 12,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.tachete.teinte);
      ctx.fillStyle = '#8a6a45';
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * TAILLE;
        const y = Math.random() * TAILLE;
        const r = 14 + Math.random() * 34;
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          r,
          r * (0.55 + Math.random() * 0.6),
          Math.random() * Math.PI,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      grain(ctx, 12);
    },
  },

  metal: {
    teinte: '#c3cad1',
    // Le seul papier qui brille vraiment : c'est le reflet qui dit « lame ».
    specular: 0xffffff,
    shininess: 140,
    peindre: (ctx) => {
      // Ce qui fait lire « métal » est le contraste de valeurs le long d'une
      // direction, pas le gris. L'aplat brossé d'avant tirait vers le carton
      // peint.
      const base = ctx.createLinearGradient(0, 0, TAILLE * 0.35, TAILLE);
      base.addColorStop(0, '#e9eef3');
      base.addColorStop(0.32, '#a8b0b8');
      base.addColorStop(0.52, '#ced5db');
      base.addColorStop(0.74, '#8d959d');
      base.addColorStop(1, '#dde3e9');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, TAILLE, TAILLE);

      // Peu nombreux, sinon ils font rayure plutôt que poli.
      for (const [pos, largeur, force] of [
        [0.22, 0.075, 0.5],
        [0.63, 0.045, 0.34],
      ] as const) {
        const eclat = ctx.createLinearGradient(
          0,
          TAILLE * (pos - largeur),
          TAILLE * 0.3,
          TAILLE * (pos + largeur),
        );
        eclat.addColorStop(0, 'rgba(255,255,255,0)');
        eclat.addColorStop(0.5, `rgba(255,255,255,${force})`);
        eclat.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = eclat;
        ctx.fillRect(0, 0, TAILLE, TAILLE);
      }

      for (let y = 0; y < TAILLE; y += 2) {
        ctx.globalAlpha = 0.03 + Math.random() * 0.07;
        ctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#6f767d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + Math.random());
        ctx.lineTo(TAILLE, y + Math.random());
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      grain(ctx, 5);
    },
  },

  marron: {
    teinte: '#7a5230',
    specular: 0x241a12,
    shininess: 12,
    peindre: (ctx) => {
      fond(ctx, ASPECTS.marron.teinte);
      veines(ctx, ['#5d3d22', '#8f6540'], 18, 20);
      grain(ctx, 20);
    },
  },
};

// Partagées entre tous les meshes et jamais libérées : six au maximum, et les
// repeindre à chaque ouverture de scène coûterait bien plus cher.
const textures = new Map<Papier, THREE_NS.Texture>();

function texture(THREE: typeof THREE_NS, papier: Papier): THREE_NS.Texture {
  const dejaLa = textures.get(papier);
  if (dejaLa) return dejaLa;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TAILLE;
  const ctx = canvas.getContext('2d')!;
  ASPECTS[papier].peindre(ctx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Les UV couvrent la feuille exactement une fois : le bord ne doit surtout pas
  // reboucler sur l'autre côté du motif.
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  textures.set(papier, tex);
  return tex;
}

function materiau(THREE: typeof THREE_NS, papier: Papier, side: THREE_NS.Side) {
  const aspect = ASPECTS[papier];
  return new THREE.MeshPhongMaterial({
    map: texture(THREE, papier),
    specular: aspect.specular,
    shininess: aspect.shininess,
    side,
    // flatShading rendait visible chaque triangle de la triangulation, y compris
    // ceux qui découpent une face plane. Les normales lissées ne gomment pas les
    // plis, qui sont de vraies arêtes géométriques.
    flatShading: false,
  });
}

// UV lus sur la première pose, feuille à plat : la texture est imprimée avant le
// pliage, donc un pli l'emporte avec lui. Calculés sur la pose finale, ils
// feraient glisser le bois sur les faces pendant l'animation.
function uvDuPlat(anim: FoldAnimation): Float32Array {
  const p = anim.positions;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let v = 0; v < anim.vertexCount; v++) {
    const x = p[v * 3];
    const z = p[v * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const sx = maxX - minX || 1;
  const sz = maxZ - minZ || 1;

  const uv = new Float32Array(anim.vertexCount * 2);
  for (let v = 0; v < anim.vertexCount; v++) {
    uv[v * 2] = (p[v * 3] - minX) / sx;
    uv[v * 2 + 1] = (p[v * 3 + 2] - minZ) / sz;
  }
  return uv;
}

export interface MeshOrigami {
  mesh: THREE_NS.Mesh;
  geometry: THREE_NS.BufferGeometry;
  // Réécrit à chaque pose : aucune allocation au runtime.
  positions: Float32Array;
}

// Recto et verso sont deux matériaux sur la même géométrie, chacun limité à un
// côté des triangles. Les deux groupes couvrent tous les indices, donc chaque
// triangle est dessiné deux fois : c'est la seule façon d'avoir deux aspects
// sans dupliquer la géométrie, et ça ne coûte qu'un draw call.
export function creerMeshOrigami(
  THREE: typeof THREE_NS,
  anim: FoldAnimation,
  nom: string,
): MeshOrigami {
  const positions = new Float32Array(anim.vertexCount * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvDuPlat(anim), 2));
  geometry.setIndex(new THREE.BufferAttribute(anim.indices, 1));
  geometry.addGroup(0, anim.indices.length, 0);
  geometry.addGroup(0, anim.indices.length, 1);

  const { recto, verso, retourne } = PAPIERS[nom] ?? DEFAUT;
  const devant = retourne ? verso : recto;
  const derriere = retourne ? recto : verso;

  const mesh = new THREE.Mesh(geometry, [
    materiau(THREE, devant, THREE.FrontSide),
    materiau(THREE, derriere, THREE.BackSide),
  ]);

  return { mesh, geometry, positions };
}

// En entiers Phaser : le décor 2D est de la même matière que le modèle qu'il
// deviendra, sans charger three.js.
export function teintesDe(nom: string): { recto: number; verso: number } {
  const papier = PAPIERS[nom] ?? DEFAUT;
  const teinte = (p: Papier) => Number.parseInt(ASPECTS[p].teinte.slice(1), 16);
  return { recto: teinte(papier.recto), verso: teinte(papier.verso) };
}

// Les textures, elles, restent partagées.
export function libererMateriaux(mesh: THREE_NS.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of materials) m.dispose();
}

// À tenir identiques à --fold-valley et --accent dans style.css : le trait de la
// feuille du tutoriel doit être exactement celui des pièces de l'énigme, sinon
// le joueur ne fait pas le lien. Deux bleus voisins le cassent plus sûrement
// qu'une couleur franchement différente.
export const COULEUR_PLI: Record<'va' | 'mo', string> = {
  va: '#4a6fa5',
  mo: '#c4553d',
};

// En pixels de TAILLE, et plus franc que sur un crease pattern : le trait est
// posé sur le pli, donc une fois le papier replié il ne se voit que par la
// tranche. Trop fin, il disparaît au moment où il devient intéressant.
const TRAIT_PLI = 14;

// Les deux bouts sont en fraction de texture, origine en haut à gauche. Ils ne
// se lisent pas dans le crease pattern — le solveur pose le modèle dans son
// propre repère — mais se calculent depuis la première pose du .origami ; la
// méthode est dans tutoriels.ts, à côté des valeurs.
export interface TracePli {
  pli: 'va' | 'mo';
  de: readonly [number, number];
  a: readonly [number, number];
}

export interface PapierTrace {
  // La face de devant seule, dans l'ordre des matériaux du mesh. Un seul élément
  // parce que OrigamiLayer.load ne remplace que les faces qu'on lui donne : le
  // derrière garde le papier ordinaire du modèle, partagé avec le reste du jeu.
  textures: THREE_NS.Texture[];
  // 0 = feuille nue, 1 = tous les traits entiers. Les plis se tracent l'un après
  // l'autre : sur la base de la bombe à eau, quatre traits qui s'allongent
  // ensemble se lisent comme une étoile qui apparaît, pas comme quatre plis.
  tracer(part: number): void;
  dispose(): void;
}

// Le trait est peint dans la texture, pas posé en surimpression : les UV sont
// lues sur la feuille à plat, donc il se plie avec le papier et le joueur voit
// la ligne qu'il a regardé se tracer devenir l'arête du pli. En surimpression,
// il resterait droit pendant que le papier se plie.
//
// Seulement sur la face de devant : on trace un pli sur une feuille, on
// n'imprime pas un schéma à travers. Des deux côtés, le trait ressortait sur les
// rabats que le pliage retourne, là où le joueur n'avait rien vu dessiner.
//
// Ces textures ne sont pas partagées, d'où le dispose().
export function papierTrace(
  THREE: typeof THREE_NS,
  nom: string,
  traces: readonly TracePli[],
): PapierTrace {
  const { recto, verso, retourne } = PAPIERS[nom] ?? DEFAUT;
  const devant = faceTracee(THREE, retourne ? verso : recto, traces);

  return {
    textures: [devant.texture],
    tracer: devant.tracer,
    dispose: () => devant.texture.dispose(),
  };
}

function faceTracee(THREE: typeof THREE_NS, papier: Papier, traces: readonly TracePli[]) {
  const nu = document.createElement('canvas');
  nu.width = nu.height = TAILLE;
  ASPECTS[papier].peindre(nu.getContext('2d')!);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TAILLE;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;

  const tracer = (part: number) => {
    // Repartir de la feuille nue : dessiner par-dessus le tracé précédent
    // empilerait les extrémités arrondies et épaissirait le départ du trait.
    ctx.clearRect(0, 0, TAILLE, TAILLE);
    ctx.drawImage(nu, 0, 0);

    const avance = Math.min(Math.max(part, 0), 1) * traces.length;
    ctx.lineWidth = TRAIT_PLI;
    ctx.lineCap = 'round';
    traces.forEach(({ pli, de, a }, i) => {
      const t = Math.min(Math.max(avance - i, 0), 1);
      if (t <= 0) return;
      ctx.strokeStyle = COULEUR_PLI[pli];
      ctx.beginPath();
      ctx.moveTo(de[0] * TAILLE, de[1] * TAILLE);
      ctx.lineTo((de[0] + (a[0] - de[0]) * t) * TAILLE, (de[1] + (a[1] - de[1]) * t) * TAILLE);
      ctx.stroke();
    });
    texture.needsUpdate = true;
  };

  tracer(0);
  return { texture, tracer };
}
