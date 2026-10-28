// Le son coupé par le joueur, depuis le haut-parleur du menu.
//
// Un réglage de l'appareil, comme la langue et les cocottes, et pas de la
// partie : recommencer l'aventure n'a pas à rallumer un son qu'on a coupé.

const CLE = 'ori-quest.son-coupe';

function lire(): boolean {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    // Navigation privée sous Safari, stockage bloqué : le défaut.
    return false;
  }
}

let coupe = lire();
const suiveurs = new Set<() => void>();

export function sonCoupe(): boolean {
  return coupe;
}

export function couperLeSon(oui: boolean): void {
  if (oui === coupe) return;
  coupe = oui;
  try {
    localStorage.setItem(CLE, oui ? '1' : '0');
  } catch {
    // Le choix vaudra pour la session.
  }
  for (const suivre of suiveurs) suivre();
}

export function suivreLeSonCoupe(suivre: () => void): void {
  suiveurs.add(suivre);
}
