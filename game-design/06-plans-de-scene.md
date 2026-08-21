# Plans de scène

## Le problème que ça résout

Une scène décrite en français ne donne jamais de coordonnées. « La feuille est à
gauche du pont » demande trois allers-retours avant d'être jouable, et le texte
ne dit pas non plus si la zone tombe sous la taille du pouce.

Un plan dessiné à l'échelle, lui, **est** la coordonnée.

## L'outil

**[Tiled](https://www.mapeditor.org/)** — gratuit, libre, macOS/Windows/Linux.
On ouvre le **projet**, pas les fichiers un par un :

*File > Open File or Project…* → `game-design/scenes/ori-quest.tiled-project`

Les scènes apparaissent alors dans le panneau *Project*, et les trois classes du
jeu sont proposées dans une liste au lieu d'être à retaper.

Tiled est un éditeur de tile map détourné : il impose une grille de 80 px qui n'a
aucun sens ici. C'est le prix à payer, et il se débraye — *View > Snapping > No
Snapping*. Le reste (undo, zoom, copier/coller, panneau des objets) est
exactement ce qu'un éditeur vectoriel généraliste faisait mal.

## Le format

Une carte de **16 × 9 tuiles de 80 px**, soit **1280 × 720** — la résolution
logique du jeu. Le document est donc à l'échelle 1:1 : ce qu'on place à 240 px du
bord gauche arrive à 240 px du bord gauche dans le jeu.

Chaque élément est un **objet**, et deux choses le décrivent :

| | Rôle |
| --- | --- |
| la **classe** | ce que c'est — `hotspot`, `exit`, `decor` |
| le **nom** | son identifiant côté code — `feuille`, `precipice` |

Trois classes, c'est tout :

| Classe | Rôle | Ce que ça devient |
| --- | --- | --- |
| `hotspot` | à examiner | une zone tactile, avec sa cocotte |
| `exit` | passage vers une autre scène | une zone tactile de navigation |
| `decor` | repère de décor | un bord, une surface, une emprise |

`decor` n'est pas cliquable : il sert à caler le dessin — où s'arrête le sol, où
passe le vide, quelle place occupe le pont une fois posé. L'unicité des noms est
**par classe** : `porte` peut être à la fois un `hotspot` et un `decor`, ce sont
deux choses différentes au même endroit.

Les noms s'écrivent en minuscules, chiffres et `_`. C'est du code une fois
généré, un accent ou une espace casserait le fichier.

## Les formes

| Forme | Quand | Ce que le jeu en fait |
| --- | --- | --- |
| **rectangle** | le cas normal | une boîte, élargie à 88 px si elle est plus petite |
| **polygone** (`P`) | quand la forme *est* le propos — une berge en biais | le contour sert au test tactile, tel quel |
| **point** (`I`) | une ancre, une position d'apparition | une boîte de taille nulle ; le code en prend le centre |

Un polygone n'est **pas** élargi à la taille du pouce : l'élargir déplacerait
son coin haut-gauche, donc le repère de son contour, et la forme touchée ne
serait plus celle dessinée. Un polygone trop petit est signalé à l'import, c'est
là qu'on le corrige.

Les ellipses et les objets tournés sont ramenés à leur boîte englobante, avec un
avertissement : le jeu ne sait pas gérer une zone oblique.

## Le croquis

Un calque image, **verrouillé**, posé sous le plan : *Layer > New > Image
Layer*, puis la propriété *Image*.

Le croquis se dessine ailleurs — papier photographié, n'importe quelle app de
dessin — et s'exporte en **PNG 1280 × 720** dans `croquis/` à côté de la carte.
Il ne part **jamais dans le build** : il sert à placer les zones, et à briefer le
graphisme.

## La commande

```bash
npm run scenes                 # tout game-design/scenes/
npm run scenes -- --check      # valide sans écrire
```

Elle tourne au démarrage de `npm run dev` et dans `npm run build`. **Et pendant
une session de travail, enregistrer dans Tiled suffit** : le serveur de dev
surveille les cartes, regénère le plan et recharge la page. Il n'y a pas d'étape
manuelle à ne pas oublier — c'est précisément par là que le plan et le jeu se
mettaient à diverger.

La sortie va dans `src/generated/scenes/<nom>.ts`, que la scène importe.

## Ce que le code en fait

Le plan dit **où**. La scène dit **ce que ça raconte** :

```ts
return hotspotsFrom(PLAN, {
  feuille: { label: 'Feuille de papier', knots: { look: 'pont_feuille' } },
});
```

La clé est le **nom** de l'objet dans Tiled. Déplacer une zone ne demande donc
pas de toucher au code, et écrire un dialogue ne demande pas d'ouvrir Tiled.

Une zone **dessinée mais pas encore câblée** n'est pas une erreur : c'est du
contenu à écrire. La console de développement la liste au démarrage de la scène —
c'est le reste à faire, visible plutôt que silencieux.

## La carte est la source de vérité

Le plan généré est figé en `as const`, et `boxOf` / `hotspotsFrom` en tirent la
**liste exacte des noms disponibles**. Un nom que la carte ne contient pas ne
compile pas :

```
error TS2345: Argument of type '"dec_nuages"' is not assignable to parameter of
type 'PlanRef<...>'
```

C'est ce qui empêche le code d'inventer une zone dans son coin, et donc les deux
de diverger. Ajouter un repère, c'est le dessiner dans Tiled — jamais l'écrire
dans la scène.

**Ce qui reste permis dans le code**, et doit le rester : les positions
**dérivées** d'une zone nommée. Cinq nuages répartis sur la bande `dec_nuages`,
le feuillage d'un arbre calculé sur `hs_arbre` — on ne va pas poser un repère de
plan par nuage. La ligne est là : *où vit un élément* est une décision du plan,
*comment il est dessiné à l'intérieur* est une décision de code.

## Les contrôles automatiques

L'import refuse une carte qui n'est pas au bon format, un objet sans classe ou
sans nom, un nom en double dans la même classe, un nom qui n'est pas un
identifiant valide, et une boîte plate. Il signale :

- une zone tactile **sous 88 unités** (la cible de 44 px réels) — elle sera
  élargie par `touchRect()`, ce qui peut la faire mordre sur une voisine ;
- un élément qui **déborde du cadre** ;
- une ellipse ou un objet tourné, ramenés à leur boîte.
