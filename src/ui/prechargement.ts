// L'écran d'index.html, servi avec la page pour couvrir le temps que le script
// arrive. Retiré dès que le jeu a de quoi montrer : l'accueil, ou l'écran de
// chargement de la pièce.
export function retirerLePrechargement(): void {
  document.getElementById('prechargement')?.remove();
}
