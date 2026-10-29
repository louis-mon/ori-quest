// Ce qui compte pour « déjà lu » : une réplique lue se pose d'un coup, sans
// délai anti-tap, et ⏩ enchaîne les suivantes (game-design/04-interface.md).
//
// ink ne saurait pas le dire : ses compteurs de visite ne sont pas sauvegardés,
// et `remettreDebout()` les remet à zéro. Le registre vit donc dans la
// sauvegarde, transaction comprise : une conversation interrompue n'a pas eu
// lieu, ses répliques n'ont pas été lues non plus.
import { gameState } from './state';

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
  return gameState.aLu(empreinte(knot, texte));
}

export function marquerLue(knot: string, texte: string): void {
  gameState.marquerLu(empreinte(knot, texte));
}
