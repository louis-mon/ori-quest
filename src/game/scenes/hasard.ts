// mulberry32 : `Math.random()` donnerait un décor différent à chaque visite de
// la même scène, et un joueur qui revient de la pièce d'à côté lirait le
// changement comme un bug. Chaque semis part donc d'une graine écrite en clair.
export function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
