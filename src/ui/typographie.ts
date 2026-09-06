// La typographie française met une espace devant `! ? ; :`, et elle doit être
// insécable : sur une boîte de dialogue étroite, une espace ordinaire laisse la
// ponctuation partir seule en tête de la ligne suivante.
//
// Ces caractères ne se tapent pas — pas plus que le `Ç` — donc `story.ink`
// s'écrit à l'espace ordinaire, la seule qu'un clavier produise, et la
// conversion se fait ici, au moment d'afficher. La source reste lisible en diff
// et cherchable au grep ; c'est le rendu qui porte la règle.
const FINE = ' '; // fine insécable : devant ! ? ;
const INSECABLE = ' '; // insécable pleine : devant :

export function typographier(texte: string): string {
  return texte.replace(/ +([!?;])/g, `${FINE}$1`).replace(/ +:/g, `${INSECABLE}:`);
}
