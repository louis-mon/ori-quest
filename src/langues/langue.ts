import { CATALOGUES, SOURCE } from './catalogues';

// La langue de la partie : celle que le joueur a choisie dans les options, sinon
// la première de son navigateur que le jeu parle, sinon l'anglais.
//
// L'anglais et pas le français quand rien ne correspond : un joueur dont le
// navigateur ne parle ni l'une ni l'autre a bien plus de chances de lire
// l'anglais, et c'est la langue qu'itch.io lui montre déjà autour du jeu.
//
// Fixée au chargement, pour toute la partie : les textes de l'interface sont
// traduits à l'évaluation des modules, et l'instance `Story` d'ink est créée sur
// le récit d'une seule langue. En changer recharge la page — voir
// `choisirLaLangue()`.

const CLE = 'ori-quest.langue';
const REPLI = 'en';

export const LANGUES: readonly string[] = [SOURCE, ...Object.keys(CATALOGUES).sort()];

function lireLeChoix(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    // Navigation privée sous Safari, stockage bloqué : le navigateur décide.
    return null;
  }
}

function deviner(): string {
  const choisie = lireLeChoix();
  if (choisie && LANGUES.includes(choisie)) return choisie;
  const demandees = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const demandee of demandees) {
    const code = demandee?.toLowerCase().split('-')[0];
    if (code && LANGUES.includes(code)) return code;
  }
  return LANGUES.includes(REPLI) ? REPLI : SOURCE;
}

export const langue: string = deviner();

// Le nom d'une langue dans cette langue même — « English », « Français » : c'est
// sous ce nom que la cherche celui qui ne lit pas la langue en cours.
export function nomDeLaLangue(code: string): string {
  let nom = code;
  try {
    nom = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    // Intl.DisplayNames manque aux Safari d'avant 14.1 : le code fera l'affaire.
  }
  return nom.charAt(0).toLocaleUpperCase(code) + nom.slice(1);
}

// Rechargement complet, comme la remise à zéro du menu : les textes déjà posés
// et le récit d'ink appartiennent à l'ancienne langue. La sauvegarde ne connaît
// que des identifiants, elle passe d'une langue à l'autre sans rien perdre ; une
// conversation en cours, elle, se rejoue, comme après tout rechargement.
export function choisirLaLangue(code: string): void {
  if (!LANGUES.includes(code) || code === langue) return;
  try {
    localStorage.setItem(CLE, code);
  } catch {
    // Sans stockage le choix ne survivrait pas au rechargement qui l'applique :
    // mieux vaut ne rien faire que recharger pour rien.
    console.warn('[langues] choix de langue impossible à enregistrer');
    return;
  }
  window.location.reload();
}
