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
- **À droite** : les pièces, en colonne.
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

| Fichier | Rôle |
| --- | --- |
| `idee_<item>.svg` (et `.jpg`) | la **forme une fois pliée**, vue à plat. Sert de référence de travail ; **le jeu ne s'en sert plus** |
| `solution_<item>.(cp\|jpg\|svg)` | le **crease pattern solution**, celui qu'il faut reconstituer |

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

La fiche de l'énigme indique comment découper le motif : **taille de la grille
d'ancrage**, puis les coordonnées de chaque pièce en `(x, y, width, height)`
cellules, origine `(0, 0)` en **haut à gauche**.

Le découpage n'est pas régulier : sur un motif symétrique, des parts égales
laissent plusieurs dispositions correctes alors qu'une seule est validée — le
joueur croit avoir résolu et se voit refusé. Des pièces de tailles différentes,
chacune identifiable, évitent ça.

**L'outil `check-puzzle` vérifie qu'un découpage donne une solution unique** :

```bash
npm run check-puzzle -- public/assets/enigmes/pont/solution.svg \
  --grid 4 --pieces "0,0,4,1 0,1,4,2 0,3,4,1"
```

## État de l'implémentation

**✅ Tout ce qui précède fonctionne.** Le minijeu vit dans
[`crease-puzzle.ts`](../src/game/puzzle/crease-puzzle.ts), les énigmes sont des
données dans [`puzzles.ts`](../src/game/puzzle/puzzles.ts) — clé, motif, but,
grille, pièces — et la narration en ouvre une avec `# puzzle: <nom>`.

Le puzzle est une **surface DOM plein écran** au-dessus du canvas, pas une scène
Phaser : c'est le seul glisser du jeu, et `setPointerCapture` suit le doigt même
sorti du cadre, ce que Phaser ne peut pas faire tant que `input.windowEvents`
reste à `false` (et il doit y rester, voir `CLAUDE.md`).
