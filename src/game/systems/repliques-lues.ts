// Les répliques déjà lues, qui se passent vite : posées d'un coup, sans délai
// anti-tap, et ⏩ pour les enchaîner (game-design/04-interface.md).
//
// ink ne saurait pas le dire : ses compteurs de visite ne sont pas sauvegardés,
// et `remettreDebout()` les remet à zéro.
//
// Un réglage de l'appareil, comme les cocottes, et pas de la partie :
// recommencer l'aventure repasse vite sur ce qu'on connaît déjà. Écrit tout de
// suite, hors de la transaction de `gameState` — rien ici n'est un état de jeu,
// et c'est ce qui rend rapide la conversation rejouée après un rechargement.
//
// En développement, tout ce qu'on retraverse devient lu :
// `localStorage.removeItem('ori-quest.lues')` rend au texte son écriture.

const CLE = 'ori-quest.lues';

function lire(): Set<string> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return new Set(Array.isArray(brut) ? brut : []);
  } catch {
    // Navigation privée sous Safari, stockage bloqué : tout est inédit.
    return new Set();
  }
}

const lues = lire();

// Le knot d'entrée et le texte tel qu'affiché : une réplique réécrite redevient
// inédite, et l'erreur possible va toujours dans le bon sens — relire, jamais
// passer ce qu'on n'a pas lu. Haché, sans quoi la liste serait une copie du
// récit (cyrb53, 53 bits : une collision n'arrivera pas sur quelques milliers
// de répliques).
function empreinte(knot: string, texte: string): string {
  const source = `${knot}\n${texte}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < source.length; i++) {
    const c = source.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function estLue(knot: string, texte: string): boolean {
  return lues.has(empreinte(knot, texte));
}

export function marquerLue(knot: string, texte: string): void {
  const cle = empreinte(knot, texte);
  if (lues.has(cle)) return;
  lues.add(cle);
  try {
    localStorage.setItem(CLE, JSON.stringify([...lues]));
  } catch {
    // La mémoire vaudra pour la session.
  }
}
