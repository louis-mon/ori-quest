// Accès depuis la console, en développement : `etat.setFlag('pont_plie')`
// vérifie une branche de dialogue sans sauvegarde bricolée, `plier('arbre')`
// rejoue un pliage sans refaire l'énigme, `donner('bois')` rejoue une
// obtention sans retraverser le dialogue.
export function exposerALaConsole(outils: Record<string, unknown>) {
  Object.assign(window, outils);
}
