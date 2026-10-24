// Les cocottes sont masquées sauf si le joueur les demande, depuis l'écran de
// pause (game-design/03-langage-visuel.md).
//
// Un réglage de l'appareil, comme la langue, et pas de la partie : la sauvegarde
// ne porte que la progression, et recommencer l'aventure n'a pas à retirer une
// aide que le joueur a demandée.

const CLE = 'ori-quest.cocottes';

function lire(): boolean {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    // Navigation privée sous Safari, stockage bloqué : le défaut.
    return false;
  }
}

let montrees = lire();
const suiveurs = new Set<() => void>();

export function cocottesMontrees(): boolean {
  return montrees;
}

// Sans rechargement, à la différence de la langue : la scène sait déjà faire
// paraître et retirer ses marqueurs.
export function montrerLesCocottes(oui: boolean): void {
  if (oui === montrees) return;
  montrees = oui;
  try {
    localStorage.setItem(CLE, oui ? '1' : '0');
  } catch {
    // Le choix vaudra pour la session.
  }
  for (const suivre of suiveurs) suivre();
}

// Rend sa fonction de désabonnement, comme `gameState.subscribe()`.
export function suivreLesCocottes(suivre: () => void): () => void {
  suiveurs.add(suivre);
  return () => suiveurs.delete(suivre);
}
