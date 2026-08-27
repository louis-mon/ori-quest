// Format binaire `.origami`, produit par `tools/bake-origami.mjs`.
//
// Tous les frames partagent la même topologie, seules les positions bougent :
// c'est ce qui permet d'interpoler linéairement entre deux frames au runtime.
//
//   offset  0 : magic 'ORIQ'                     4 octets
//   offset  4 : version                          u32
//   offset  8 : vertexCount                      u32
//   offset 12 : frameCount                       u32
//   offset 16 : indexCount                       u32
//   offset 20 : reserved                         u32
//   offset 24 : indices                          u32  * indexCount
//   ensuite   : positions                        f32  * frameCount * vertexCount * 3

export const ORIGAMI_MAGIC = 0x4f524951; // 'ORIQ' en big-endian
export const ORIGAMI_VERSION = 1;
export const HEADER_BYTES = 24;

export interface FoldAnimation {
  vertexCount: number;
  frameCount: number;
  indices: Uint32Array;
  // À plat : frame f, sommet v, composante c => f*vertexCount*3 + v*3 + c
  positions: Float32Array;
}

export function parseFoldAnimation(buffer: ArrayBuffer): FoldAnimation {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error('Fichier .origami tronqué');
  }
  const view = new DataView(buffer);
  const magic = view.getUint32(0, false);
  if (magic !== ORIGAMI_MAGIC) {
    throw new Error("Ce n'est pas un fichier .origami (magic invalide)");
  }
  const version = view.getUint32(4, true);
  if (version !== ORIGAMI_VERSION) {
    throw new Error(`Version .origami non supportée : ${version}`);
  }

  const vertexCount = view.getUint32(8, true);
  const frameCount = view.getUint32(12, true);
  const indexCount = view.getUint32(16, true);

  const indicesOffset = HEADER_BYTES;
  const positionsOffset = indicesOffset + indexCount * 4;
  const expected = positionsOffset + frameCount * vertexCount * 3 * 4;
  if (buffer.byteLength < expected) {
    throw new Error(
      `Fichier .origami incomplet : ${buffer.byteLength} octets, ${expected} attendus`,
    );
  }

  return {
    vertexCount,
    frameCount,
    indices: new Uint32Array(buffer, indicesOffset, indexCount),
    positions: new Float32Array(buffer, positionsOffset, frameCount * vertexCount * 3),
  };
}

export async function loadFoldAnimation(url: string): Promise<FoldAnimation> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chargement de ${url} : HTTP ${res.status}`);
  return parseFoldAnimation(await res.arrayBuffer());
}

const chargees = new Map<string, Promise<FoldAnimation>>();

// Le même modèle est demandé par trois chemins — le pliage joué, l'image du
// décor, la vignette — sans qu'on sache lequel arrive en premier : c'est la
// promesse qu'on mutualise, sinon des appels simultanés téléchargent chacun le
// leur. Chemin relatif, itch.io sert le jeu depuis un sous-dossier.
export function animationOrigami(nom: string): Promise<FoldAnimation> {
  let promesse = chargees.get(nom);
  if (!promesse) {
    promesse = loadFoldAnimation(`assets/origami/${nom}.origami`);
    chargees.set(nom, promesse);
  }
  return promesse;
}

// `t` va de 0 (à plat) à 1 (plié). Aucune allocation : appelable à chaque frame.
export function sampleFold(anim: FoldAnimation, t: number, out: Float32Array): void {
  const stride = anim.vertexCount * 3;
  const clamped = Math.min(Math.max(t, 0), 1);
  const exact = clamped * (anim.frameCount - 1);
  const lo = Math.floor(exact);
  const hi = Math.min(lo + 1, anim.frameCount - 1);
  const mix = exact - lo;

  const a = lo * stride;
  const b = hi * stride;
  const src = anim.positions;

  if (mix === 0) {
    out.set(src.subarray(a, a + stride));
    return;
  }
  for (let i = 0; i < stride; i++) {
    const va = src[a + i];
    out[i] = va + (src[b + i] - va) * mix;
  }
}
