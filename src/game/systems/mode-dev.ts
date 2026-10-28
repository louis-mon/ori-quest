// Le mode dev du build livré : ce qu'un testeur ouvre d'un geste sur le bouton
// du menu (`ui/geste-du-menu.ts`), et que le joueur ne voit jamais.
//
// Un réglage de l'appareil, comme la langue, et pas de la partie : recommencer
// l'aventure, ce qu'un testeur fait sans arrêt, n'a pas à le refermer. La clé
// porte le préfixe du jeu parce qu'itch.io sert tous ses jeux HTML depuis la
// même origine, donc le même localStorage.

const CLE = 'ori-quest.devMode';

function lire(): boolean {
  try {
    return localStorage.getItem(CLE) === 'true';
  } catch {
    // Navigation privée sous Safari, stockage bloqué : le défaut.
    return false;
  }
}

let actif = lire();

export function modeDevActif(): boolean {
  return actif;
}

export function basculerLeModeDev(): void {
  actif = !actif;
  try {
    if (actif) localStorage.setItem(CLE, 'true');
    else localStorage.removeItem(CLE);
  } catch {
    // Le choix vaudra pour la session.
  }
}
