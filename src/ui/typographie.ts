// La typographie française met une espace devant `! ? ; :`, et elle doit être
// insécable : sur une boîte de dialogue étroite, une espace ordinaire laisse la
// ponctuation partir seule en tête de la ligne suivante.
//
// Ces caractères ne se tapent pas — pas plus que le `Ç` — donc `story.ink`
// s'écrit à l'espace ordinaire, la seule qu'un clavier produise, et la
// conversion se fait ici, au moment d'afficher. La source reste lisible en diff
// et cherchable au grep ; c'est le rendu qui porte la règle.
const FINE = ' '; // fine insécable : devant ! ? ;
const INSECABLE = ' '; // insécable pleine : devant :

// Une rime ne se lit que si elle tombe en fin de ligne, et ink n'a aucune façon
// de couper une réplique : `{"\n"}` affiche un « n », la glue recolle avec une
// espace, et deux lignes de source font deux répliques — donc deux taps, la rime
// arrivant après que la première moitié a disparu. La coupe s'écrit donc ` / `,
// comme on cite un vers, et se pose ici. Le rendu suit dans `.dialogue__text`,
// en `white-space: pre-line`.
const COUPE_DE_VERS = / +\/ +/g;

export function typographier(texte: string): string {
  return texte
    .replace(COUPE_DE_VERS, '\n')
    .replace(/ +([!?;])/g, `${FINE}$1`)
    .replace(/ +:/g, `${INSECABLE}:`);
}
