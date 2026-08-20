# Plans de scène

## Le problème que ça résout

Une scène décrite en français ne donne jamais de coordonnées. « La feuille est à
gauche du pont » demande trois allers-retours avant d'être jouable, et le texte
ne dit pas non plus si la zone tombe sous la taille du pouce.

Un plan dessiné à l'échelle, lui, **est** la coordonnée.

## Le format

Un SVG de **1280×720** — la résolution logique du jeu. Le document est donc à
l'échelle 1:1 : ce qu'on dessine à 240 px du bord gauche arrive à 240 px du bord
gauche dans le jeu, sans conversion.

Dans le plan, chaque élément est un **groupe** qui contient deux choses :

| | Rôle | Lu à l'import ? |
| --- | --- | --- |
| le **nom du groupe** | l'identité (`hs_feuille`) | **oui** |
| le **rectangle** | la position et la taille | **oui** |
| le **texte** dans la boîte | rappel visuel, pour lire le plan | non |

Le texte est décoratif : l'effacer ou le remplacer par n'importe quoi ne change
rien au jeu. Il est quand même relu à l'import pour vérifier qu'il ne **ment**
pas — renommer un groupe sans retoucher son étiquette produirait un plan qui
affiche une chose et en fabrique une autre :

```
⚠ « hs_buisson » porte l'étiquette « hs_arbre » — c'est le nom du groupe qui
  compte, l'étiquette est à corriger
```

Le *nom du groupe* porte le rôle :

| Nom | Rôle | Ce que ça devient |
| --- | --- | --- |
| `hs_<id>` | à examiner | un hotspot, avec sa cocotte |
| `exit_<id>` | passage vers une autre scène | un hotspot de navigation |
| `dec_<id>` | repère de décor | un bord, une surface, une emprise |

Trois préfixes, c'est tout. `dec_` n'est pas cliquable : il sert à caler le
dessin (où s'arrête le sol, où passe le vide, quelle place occupe le pont une
fois posé). Si un simple point suffit — une position d'apparition, une ancre —
un petit `dec_` fait l'affaire, le code en prendra le centre.

Le reste du fichier est **ignoré** : la grille, le cadre, les étiquettes, les
croquis d'ambiance. On peut donc dessiner par-dessus pour réfléchir sans polluer
le jeu.

## Les trois calques d'un plan

| Calque | Contenu | Sort dans le jeu ? |
| --- | --- | --- |
| `repères` | grille, cadre, zone sûre, étiquettes | non — **verrouillé**, on ne peut pas le sélectionner par erreur |
| `croquis` | l'allure de la scène : lignes, silhouettes, hachures | non — c'est la référence visuelle |
| `plan` | les boîtes nommées, chacune groupée avec son étiquette | **oui** |

Le calque `croquis` est là pour répondre à « à quoi ça ressemble ». On y dessine
librement — une ligne d'horizon, le profil du sol, la silhouette d'un arbre — et
rien de tout ça n'entre dans le jeu. Ça sert à cadrer les boîtes, à discuter la
composition, et à briefer le dessin définitif.

Seul le calque `plan` produit des données, et seulement par les **noms**.

## Où mettre le nom, selon l'éditeur

| Éditeur | Comment |
| --- | --- |
| **Figma** (gratuit, web) | renommer le calque, puis à l'export SVG cocher *Include "id" attribute* |
| **Inkscape** (libre) | panneau *Objet > Objets…*, colonne étiquette |
| **Penpot** (libre, web) | renommer la couche |

N'importe lequel convient : l'import lit `inkscape:label`, `data-name` ou `id`,
dans cet ordre.

## Le minimum vital dans Inkscape

Six raccourcis suffisent, l'interface peut rester ignorée :

| Geste | Raccourci |
| --- | --- |
| Outil de sélection | `s` (ou `F1`) |
| Outil rectangle | `r`, puis glisser |
| **Dupliquer** une boîte existante | `Ctrl+D`, puis glisser |
| Renommer (le champ *Étiquette*) | `Ctrl+Shift+O` |
| Entrer dans un groupe pour redimensionner | double-clic |
| Tracer une ligne droite | `b`, clic, clic, `Entrée` |
| Enregistrer | `Ctrl+S` |

Le plus simple n'est pas de dessiner mais de **dupliquer** : `Ctrl+D` sur une
boîte existante donne le bon style et le bon calque, il ne reste qu'à la déplacer
et à la renommer.

Avec l'outil de sélection, la barre du haut affiche **X, Y, L, H en pixels** :
on tape les valeurs plutôt que de viser à la souris. Vérifier que l'unité de
cette barre est bien `px`. Un chiffre tapé là est exactement celui que le jeu
recevra.

Le calque `repères` est verrouillé : la grille et les étiquettes ne peuvent pas
être attrapées par accident. Pour les déverrouiller, le cadenas dans le panneau
*Calques* (`Ctrl+Shift+L`).

## La commande

```bash
npm run scenes                 # tout game-design/scenes/
npm run scenes -- --check      # valide sans écrire
```

Elle tourne automatiquement dans `npm run dev` et `npm run build`. La sortie va
dans `src/generated/scenes/<nom>.json`, que la scène importe.

## Ce que le code en fait

Le plan dit **où**. La scène dit **ce que ça raconte** :

```ts
return hotspotsFrom(PLAN, {
  feuille: { label: 'Feuille de papier', knots: { look: 'pont_feuille' } },
});
```

La clé est l'`<id>` du plan. Déplacer une zone ne demande donc plus de toucher au
code, et écrire un dialogue ne demande pas d'ouvrir un éditeur vectoriel.

Une zone **dessinée mais pas encore câblée** n'est pas une erreur : c'est du
contenu à écrire. La console de développement la liste au démarrage de la scène —
c'est le reste à faire, visible plutôt que silencieux.

## Les contrôles automatiques

L'import refuse un nom en double ou une boîte plate, et signale :

- une zone tactile **sous 88 unités** (la cible de 44 px réels) — elle sera
  élargie par `touchRect()`, ce qui peut la faire mordre sur une voisine ;
- un élément qui **déborde du cadre** ;
- un document qui n'est pas au format 16:9.

## Limites connues

**Les rectangles tournés** sont ramenés à leur boîte englobante : le jeu ne sait
pas gérer une zone tactile oblique.

**Les tracés** (`<path>`) donnent une boîte approximative — les points de
contrôle des courbes sont comptés dedans. Un avertissement le rappelle. Pour un
plan, dessiner des rectangles.

**Redimensionner une boîte demande d'entrer dans son groupe** (double-clic).
Chaque boîte est groupée avec son étiquette pour que les deux se déplacent
ensemble ; c'est le nom du **groupe** qui est lu à l'import. Le texte, lui, est
ignoré : il ne rentre pas dans le calcul de la boîte.
