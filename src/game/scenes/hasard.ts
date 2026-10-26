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

// Des valeurs tirées au hasard à intervalles réguliers, raccordées en douceur :
// entre -1 et 1, sans rythme qui se répète. Le tirage dépend du seul rang de
// l'intervalle, donc rien n'est à garder d'une image à l'autre.
export function bruit(graine: number, t: number): number {
  const rang = Math.floor(t);
  const f = t - rang;
  const lisse = f * f * (3 - 2 * f);
  const a = alea(graine + rang)();
  const b = alea(graine + rang + 1)();
  return (a + (b - a) * lisse) * 2 - 1;
}
