# L'énigme de reconstitution du crease pattern

**La plupart des énigmes sont la même chose** : un puzzle où il faut
reconstituer un crease pattern à partir de pièces séparées. C'est le minijeu de
la boucle décrite dans [01-boucle-de-jeu.md](01-boucle-de-jeu.md) — celui qui
s'ouvre quand le joueur a choisi le bon modèle devant une feuille.

Une seule énigme réutilisée partout, c'est délibéré : le joueur l'apprend une
fois, et chaque chapitre n'a plus qu'à fournir un motif et un découpage.

## L'écran

- **En haut, un peu à gauche** : le graphisme de l'origami **plié**. Un tap
  l'agrandit. C'est le but à atteindre — sans lui, on reconstitue un motif
  abstrait sans savoir ce qu'on fabrique.
- **À gauche** : le conteneur du puzzle, avec une **grille d'ancrage** plus fine
  que les pièces : une pièce lâchée à peu près au bon endroit se cale toute
  seule, on ne vise pas au pixel.
- **À droite** : un bac où les pièces sont jetées **en vrac**. Elles peuvent se
  chevaucher un peu — c'est ce qui en fait un tas et non une liste — mais ne
  sortent jamais du bac, et le détourage laisse voir la silhouette de chacune.
  Le désordre est tiré d'une **graine fixe** : la même énigme retrouve le même
  tas à chaque ouverture, donc un placement gênant se revoit au lieu de se
  perdre.
- **Deux boutons** : « Vérifier la solution » et « Abandonner ».

On glisse-dépose les pièces dans le conteneur. Les pièces **ne pivotent pas** :
le découpage produit des morceaux distinguables un à un, et une rotation rendrait
ambigus des motifs souvent symétriques.

## Les règles

**En cas d'échec**, le diagramme clignote en rouge. On réessaie immédiatement,
**autant de fois qu'on veut** — l'énigme ne se rate pas définitivement, et il n'y
a **aucune notion de qualité** du pliage : c'est fait ou ce n'est pas fait.

**En cas de succès**, on voit l'animation du papier qui se plie, et on quitte
l'énigme pour revenir à la scène précédente.

**On peut abandonner à tout moment** et revenir à la scène. La feuille est
toujours là, l'énigme se rouvre.

Le verdict est publié dans un drapeau `<nom>_resolu`, que la narration teste pour
écrire la réussite comme l'abandon — les deux branches existent toujours.

## Les fichiers d'une énigme

Dans le dossier d'assets source de l'énigme :

| Fichier                          | Rôle                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `idee_<item>.svg` (et `.jpg`)    | la **forme une fois pliée**, vue à plat. Sert de référence de travail ; **le jeu ne s'en sert plus** |
| `solution_<item>.(cp\|jpg\|svg)` | le **crease pattern solution**, celui qu'il faut reconstituer                                        |

Servi au jeu sous `public/assets/enigmes/<item>/solution.svg`, en chemin
**relatif** — itch.io sert le jeu depuis un sous-dossier.

Le **but montré en vignette** n'est plus `idee.svg` mais le modèle `.origami`
rendu en 3D (`modele:` dans [`puzzles.ts`](../src/game/puzzle/puzzles.ts)) : le
joueur reconnaît là ce qu'il va voir se plier, puis retrouver dans le décor et
dans son inventaire. Voir « Ce qui est plié se montre par son modèle » dans
[03-langage-visuel.md](03-langage-visuel.md).

Les **traits de bord** (`bo`) ne sont pas affichés : montrés, ils diraient quelle
pièce vient d'une rive du carré et donneraient l'énigme.

## Le découpage

Le découpage se **dessine**, il ne s'écrit pas. Il vit dans
`game-design/enigmes/<nom>.json` et c'est ce fichier qui fait foi, comme la carte
Tiled fait foi pour la géométrie d'une scène — voir
[06-plans-de-scene.md](06-plans-de-scene.md).

```
npm run dev  puis  http://localhost:5173/decoupage.html
```

**On trace des coupes, on ne dessine pas des pièces.** Le carré entier est la
première pièce ; chaque trait en fend une en deux. Deux propriétés en découlent
sans qu'on ait à les vérifier :

- le découpage **pave le carré exactement**, sans trou ni recouvrement — là où
  dessiner les pièces une à une aurait demandé de faire coïncider à la main les
  arêtes partagées ;
- tous les sommets tombent **sur la grille d'ancrage**, puisqu'une coupe ne
  s'arrête que sur ses intersections. Une pièce dont un sommet tomberait entre
  deux intersections ne pourrait pas se caler sur le plateau.

Une coupe traverse **une pièce à la fois**, d'un bord à l'autre, par une suite de
segments droits — la pièce est celle survolée au premier clic. Une pièce peut
donc prendre n'importe quelle forme polygonale, en escalier ou en biais ; il n'y
a pas de courbes, et le jeu n'en attend pas.

En contrepartie, une coupe en biais ne se reprend qu'aux points de grille
qu'elle traverse : une diagonale de (0,0) à (3,2) n'en croise aucun entre ses
extrémités, et rien ne pourra en repartir.

**Une coupe ne longe jamais un pli**, et l'éditeur la refuse. Un pli posé sur une
arête de découpe se retrouve fendu en deux dans la longueur : chaque pièce en
montre la moitié de l'épaisseur, le joueur voit deux demi-plis au lieu d'un, et
l'arête lui dit où le pli passait — ce que le découpage est justement censé lui
cacher. La croiser est en revanche normal, c'est même ce que fait presque toute
coupe.

Le découpage n'est pas régulier : sur un motif symétrique, des parts égales
laissent plusieurs dispositions correctes alors qu'une seule est validée — le
joueur croit avoir résolu et se voit refusé. Des pièces de tailles et de formes
différentes, chacune identifiable, évitent ça.

**L'unicité de la solution est vérifiée en continu.** L'éditeur l'annonce après
chaque coupe, l'import la revérifie à chaque enregistrement, et l'outil en ligne
de commande montre les dispositions fautives quand il y en a :

```bash
npm run check-puzzle            # toutes les énigmes
npm run check-puzzle -- pont
```

C'est le même calcul dans les trois cas (`tools/lib/decoupage.mjs`) : les pièces
y sont comparées par leur **contenu** — les portions du motif qu'elles couvrent,
ramenées en coordonnées locales — et tous les pavages compatibles sont énumérés.

## État de l'implémentation

**✅ Tout ce qui précède fonctionne.** Le minijeu vit dans
[`crease-puzzle.ts`](../src/game/puzzle/crease-puzzle.ts), les énigmes sont des
données dans [`puzzles.ts`](../src/game/puzzle/puzzles.ts) — clé, motif, but,
titre — et la narration en ouvre une avec `# puzzle: <nom>`. Le découpage, lui,
n'est pas dans le code : il arrive de `game-design/enigmes/` par
`src/generated/enigmes.ts`, et redécouper une énigme ne demande de toucher aucun
fichier source. Enregistrer dans l'éditeur suffit : le serveur de dev regénère le
module et recharge la page.

Le puzzle est une **surface DOM plein écran** au-dessus du canvas, pas une scène
Phaser : c'est le seul glisser du jeu, et `setPointerCapture` suit le doigt même
sorti du cadre, ce que Phaser ne peut pas faire tant que `input.windowEvents`
reste à `false` (et il doit y rester, voir `CLAUDE.md`).
