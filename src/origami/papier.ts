import type * as THREE_NS from 'three';
import type { FoldAnimation } from './fold-file';

/**
 * Le papier des origamis — recto, verso, et le mesh qui les porte.
 *
 * Une feuille d'origami a deux faces qui ne se ressemblent pas, et c'est
 * précisément ce qui rend un pliage lisible : le verso n'apparaît qu'aux
 * endroits où le papier s'est retourné, donc il *dessine les plis*. Un modèle
 * uniformément blanc, lui, se lit comme une bosse.
 *
 * Les textures sont **peintes à l'exécution** sur un canvas plutôt que chargées
 * en PNG : quelques dizaines de lignes contre des centaines de kilo-octets à
 * télécharger, pour un grain de bois vu à 200 px de large dans un coin de
 * décor. Le budget du jeu est de 30 Mo au total (voir CLAUDE.md), et l'origami
 * n'est pas ce qui doit le manger.
 *
 * Les UV viennent de la feuille **à plat** : la texture est imprimée sur le
 * papier avant qu'on ne le plie, comme dans la réalité, donc le grain suit les
 * plis au lieu de glisser dessus.
 */

export type Papier = 'papier' | 'noir' | 'bois' | 'boisFonce' | 'feuille' | 'metal' | 'marron';

/**
 * Quel papier pour quel modèle. Le **recto** est la face qu'on voit d'abord,
 * le **verso** celle que les plis retournent vers nous.
 *
 * C'est du contenu, pas de la technique : changer l'aspect d'un modèle se fait
 * ici, sur une ligne, sans toucher au moteur.
 */
interface PapierModele {
  recto: Papier;
  verso: Papier;
  /**
   * Le pliage **finit retourné** : ce sont les triangles vus de dos qui se
   * présentent au joueur.
   *
   * Ça n'a rien d'exotique — beaucoup de modèles se terminent la face arrière
   * du papier vers le haut — mais rien dans le crease pattern ne le dit à
   * l'avance : ça se constate en regardant le rendu. Sans ce drapeau, la hache
   * sortait en manche marron avec un éclat de métal au pli, exactement à
   * l'inverse de ce qu'on attend d'une lame.
   */
  retourne?: boolean;
}

export const PAPIERS: Record<string, PapierModele> = {
  // Un tablier de papier clair, et du bois dessous : ce qui porte doit avoir
  // l'air de porter.
  pont: { recto: 'papier', verso: 'bois' },
  // L'arbre est le seul modèle dont les deux faces racontent quelque chose :
  // le feuillage dessus, et le bois qui n'apparaît qu'aux endroits où le papier
  // se retourne — c'est ce petit triangle-là qui fait le tronc.
  arbre: { recto: 'feuille', verso: 'boisFonce' },
  // Le tranchant d'un côté, le manche de l'autre.
  hache: { recto: 'metal', verso: 'marron', retourne: true },
  // Un battant noir, encadré du même bois que l'arbre — c'est de lui qu'elle
  // vient. Le noir n'est pas un fond : c'est du papier, et il le dit par son
  // reflet.
  porte: { recto: 'noir', verso: 'boisFonce' },
  // Les feuilles de démonstration des tutoriels : le pli vallée, le pli
  // montagne, et la base de la bombe à eau. Un verso, et pas du papier des deux
  // côtés : sans lui, la feuille pliée n'est qu'un aplat clair où le pli ne se
  // lit qu'à l'ombre.
  //
  // **Le même papier pour les trois**, et c'est le point : ce n'est pas un
  // modèle du jeu qu'on regarde, c'est *la feuille sur laquelle on explique*.
  // Elle doit se reconnaître d'un tutoriel à l'autre. Que ce soit celui du pont
  // est un reste de la première leçon, et ça tombe bien — c'est là que le
  // joueur a vu ce bois pour la première fois.
  vallee: { recto: 'papier', verso: 'bois' },
  montagne: { recto: 'papier', verso: 'bois' },
  bombe: { recto: 'papier', verso: 'bois' },
};

/** Papier d'un modèle inconnu : du papier ordinaire, des deux côtés. */
const DEFAUT: PapierModele = { recto: 'papier', verso: 'papier' };

// ------------------------------------------------------------------
// Les textures, peintes une fois puis partagées.
// ------------------------------------------------------------------

const TAILLE = 512;

/** Aspect d'une face : sa texture et la façon dont elle prend la lumière. */
interface Aspect {
  /**
   * Couleur dominante du papier.
   *
   * Sert de fond à la texture **et** de couleur au décor 2D : une feuille encore
   * dépliée est dessinée en primitives Phaser (three.js n'a aucune raison d'être
   * chargé pour un carré de papier), mais elle doit être exactement de la
   * couleur qu'aura le modèle une fois plié. Sans ça, une feuille verte devenait
   * un arbre en bois sans transition.
   */
  teinte: string;
  peindre: (ctx: CanvasRenderingContext2D) => void;
  specular: number;
  shininess: number;
}

/** Bruit fin, appliqué en dernier : c'est lui qui empêche l'aplat plastique. */
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

/** Veines de bois : des lignes qui ondulent doucement, jamais parallèles. */
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
      // Des fibres, pas des rayures : très claires, très courtes, en tous sens.
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
    // Du papier noir, pas un trou : ce qui l'en distingue est le **reflet**.
    // Un noir mat et uniforme se lit comme un vide découpé dans le décor, et
    // c'est exactement ce qu'on cherche à éviter pour la porte.
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
    // Éclairci : à `#59402a` il tirait vers le brun-noir, et sur un décor déjà
    // sombre le tronc de l'arbre comme le cadre de la porte se perdaient dans
    // le fond au lieu de se lire comme du bois.
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
      // Une nervure centrale et des obliques qui en partent : c'est ce
      // squelette-là qui fait lire « feuille » plutôt que « vert ».
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

  metal: {
    teinte: '#c3cad1',
    // Le seul papier qui brille vraiment : c'est le reflet qui dit « lame ».
    specular: 0xffffff,
    shininess: 140,
    peindre: (ctx) => {
      // Ce qui fait lire « métal » n'est pas le gris, c'est le **contraste de
      // valeurs qui court le long d'une direction** : le clair et le sombre
      // s'y étalent en bandes, là où un papier gris reste uniforme. D'où un
      // dégradé de base plutôt qu'un aplat — l'aplat brossé d'avant tirait vers
      // le carton peint.
      const base = ctx.createLinearGradient(0, 0, TAILLE * 0.35, TAILLE);
      base.addColorStop(0, '#e9eef3');
      base.addColorStop(0.32, '#a8b0b8');
      base.addColorStop(0.52, '#ced5db');
      base.addColorStop(0.74, '#8d959d');
      base.addColorStop(1, '#dde3e9');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, TAILLE, TAILLE);

      // Deux coups de lumière francs, en travers : ce sont eux qui donnent le
      // « poli », et ils doivent rester peu nombreux pour ne pas faire rayure.
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

      // Le brossé, par-dessus : très fin et très discret. Il ne porte pas la
      // lecture, il enlève seulement le lisse parfait du dégradé.
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

/**
 * Les textures sont **partagées entre tous les meshes** et jamais libérées :
 * il y en a six au maximum, quelques centaines de kilo-octets en mémoire GPU,
 * et les repeindre à chaque ouverture de scène coûterait bien plus cher.
 */
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
  // Les UV couvrent la feuille exactement une fois : rien à répéter, et le
  // bord ne doit surtout pas reboucler sur l'autre côté du motif.
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
    // Pas de `flatShading` : il rendait chaque triangle de la triangulation
    // visible, y compris ceux qui découpent une face plane du modèle. Les
    // normales lissées ne gomment pas les plis — ceux-là sont de vraies arêtes
    // géométriques — mais font disparaître la trame parasite.
    flatShading: false,
  });
}

// ------------------------------------------------------------------
// Le mesh
// ------------------------------------------------------------------

/**
 * UV lus sur la feuille **à plat** (première pose), dans le plan XZ.
 *
 * C'est ce qui rend la texture solidaire du papier : elle est imprimée avant le
 * pliage, donc un pli l'emporte avec lui. Des UV calculés sur la pose finale
 * feraient au contraire glisser le bois sur les faces pendant l'animation.
 */
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
  /** Tampon de positions, réécrit à chaque pose. Aucune allocation au runtime. */
  positions: Float32Array;
}

/**
 * Monte le mesh d'un modèle : une géométrie, deux matériaux.
 *
 * Le recto et le verso sont **deux matériaux sur la même géométrie**, chacun
 * limité à un côté des triangles (`FrontSide` / `BackSide`). Les deux groupes
 * couvrent tous les indices : chaque triangle est donc dessiné deux fois, une
 * fois par face. C'est la seule façon d'avoir deux aspects distincts sans
 * dupliquer la géométrie — et elle ne coûte qu'un draw call de plus.
 */
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

/**
 * Couleurs des deux faces d'un modèle, en entiers Phaser (`0xRRGGBB`).
 *
 * C'est ce qui permet au décor 2D — la feuille encore dépliée — d'être de la
 * même matière que le modèle qu'elle deviendra, sans charger three.js.
 */
export function teintesDe(nom: string): { recto: number; verso: number } {
  const papier = PAPIERS[nom] ?? DEFAUT;
  const teinte = (p: Papier) => Number.parseInt(ASPECTS[p].teinte.slice(1), 16);
  return { recto: teinte(papier.recto), verso: teinte(papier.verso) };
}

/** Libère les matériaux d'un mesh. Les textures, elles, restent partagées. */
export function libererMateriaux(mesh: THREE_NS.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of materials) m.dispose();
}

// ------------------------------------------------------------------
// Le papier du tutoriel : une feuille sur laquelle un pli se trace
// ------------------------------------------------------------------

/**
 * Couleur des plis, à l'identique de `--fold-valley` et `--accent` dans
 * style.css.
 *
 * Le trait tracé sur la feuille du tutoriel doit être **exactement** celui des
 * pièces de l'énigme : c'est ce qui fait comprendre au joueur que le bleu qu'il
 * voit sur le motif est le pli qu'on vient de lui montrer en action. Deux bleus
 * voisins mais différents cassent le lien plus sûrement qu'une couleur franche.
 */
export const COULEUR_PLI: Record<'va' | 'mo', string> = {
  va: '#4a6fa5',
  mo: '#c4553d',
};

/**
 * Épaisseur du trait dans la texture, en pixels de `TAILLE`.
 *
 * Franche, et plus que sur un crease pattern : le trait est posé **sur le pli**,
 * donc une fois le papier replié il ne se voit plus que par la tranche. Trop
 * fin, il disparaît exactement au moment où il devient intéressant.
 */
const TRAIT_PLI = 14;

/**
 * Un pli peint sur la feuille de démonstration : sa nature, et ses deux bouts
 * en fraction de texture, **origine en haut à gauche**.
 *
 * Les repères ne se lisent pas dans le crease pattern — le solveur pose le
 * modèle dans son propre repère — mais ils se **calculent** depuis la première
 * pose du `.origami` ; la méthode est écrite dans `tutoriels.ts`, à côté des
 * valeurs.
 */
export interface TracePli {
  pli: 'va' | 'mo';
  de: readonly [number, number];
  a: readonly [number, number];
}

export interface PapierTrace {
  /**
   * La texture de la **face de devant**, seule — un tableau d'un élément, dans
   * l'ordre des matériaux du mesh (voir `creerMeshOrigami`, et le drapeau
   * `retourne`).
   *
   * Un seul élément parce que `OrigamiLayer.load` ne remplace que les faces
   * qu'on lui donne : le derrière garde donc le papier ordinaire du modèle,
   * partagé avec le reste du jeu, sans qu'on ait à en repeindre une copie.
   */
  textures: THREE_NS.Texture[];
  /**
   * Trace les plis sur `part` du chemin total (0 = feuille nue, 1 = tous les
   * traits entiers).
   *
   * Les plis se tracent **l'un après l'autre**, pas tous à la fois : sur la base
   * de la bombe à eau, quatre traits qui s'allongent ensemble ne se lisent plus
   * comme quatre plis mais comme une étoile qui apparaît. Un à la fois, le
   * joueur voit de quelle couleur est chacun.
   */
  tracer(part: number): void;
  dispose(): void;
}

/**
 * Le papier d'un modèle, sur lequel **on dessine ses plis**, progressivement.
 *
 * Pourquoi peindre le trait dans la texture plutôt que le poser en surimpression
 * à l'écran : les UV sont lues sur la feuille à plat (voir `uvDuPlat`), donc le
 * trait est imprimé sur le papier et **se plie avec lui**. Quand l'animation
 * démarre, le joueur voit la ligne bleue qu'il vient de regarder se tracer
 * devenir l'arête du pli — c'est tout ce que le tutoriel a à démontrer. Un trait
 * dessiné par-dessus l'image resterait droit pendant que le papier se plie, ou
 * devrait disparaître au moment précis où il devient intéressant.
 *
 * Le pli n'est tracé **que sur la face de devant** — celle qu'on a sous les yeux
 * quand la feuille est encore à plat. Le derrière garde son papier nu.
 *
 * C'est le sens du geste : on trace un pli *sur* une feuille, on n'imprime pas
 * un schéma à travers. Tracé des deux côtés, le trait ressortait sur les rabats
 * que le pliage retourne, et le joueur voyait des lignes de couleur à des
 * endroits où il n'avait jamais rien vu dessiner — du bruit, là où justement il
 * fallait regarder la forme.
 *
 * `traces` est le crease pattern du modèle, dans l'ordre où on veut le voir
 * apparaître (voir `TracePli`). Un seul trait pour une leçon sur un pli, les
 * quatre du carré pour la base de la bombe à eau.
 *
 * Ces textures ne sont **pas partagées**, contrairement à celles des papiers du
 * jeu : on les repeint à chaque image du tracé, et elles ne servent qu'à la
 * démonstration en cours. D'où le `dispose()`, à appeler quand elle disparaît.
 */
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

/** La face de devant : son papier habituel, et les plis qu'on trace dessus. */
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
    // On repart de la feuille nue à chaque appel : dessiner par-dessus le tracé
    // précédent empilerait les extrémités arrondies et épaissirait le départ du
    // trait à chaque image.
    ctx.clearRect(0, 0, TAILLE, TAILLE);
    ctx.drawImage(nu, 0, 0);

    // L'avancement couvre les traits l'un après l'autre : le trait `i` se
    // dessine pendant que `avance` traverse son intervalle, et reste entier
    // ensuite.
    const avance = Math.min(Math.max(part, 0), 1) * traces.length;
    ctx.lineWidth = TRAIT_PLI;
    ctx.lineCap = 'round';
    traces.forEach(({ pli, de, a }, i) => {
      const t = Math.min(Math.max(avance - i, 0), 1);
      if (t <= 0) return;
      ctx.strokeStyle = COULEUR_PLI[pli];
      ctx.beginPath();
      ctx.moveTo(de[0] * TAILLE, de[1] * TAILLE);
      ctx.lineTo(
        (de[0] + (a[0] - de[0]) * t) * TAILLE,
        (de[1] + (a[1] - de[1]) * t) * TAILLE,
      );
      ctx.stroke();
    });
    texture.needsUpdate = true;
  };

  tracer(0);
  return { texture, tracer };
}
