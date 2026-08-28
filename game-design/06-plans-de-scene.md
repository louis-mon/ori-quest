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

Les scènes apparaissent alors dans le panneau *Project*, et les classes du jeu
sont proposées dans une liste au lieu d'être à retaper.

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

Cinq classes, c'est tout :

| Classe | Rôle | Ce que ça devient |
| --- | --- | --- |
| `hotspot` | à examiner | une zone tactile, avec sa cocotte |
| `exit` | passage vers une autre scène | une zone tactile de navigation |
| `decor` | repère de décor | un bord, une surface, une emprise |
| `marqueur` | où se pose la cocotte | un point rattaché à la zone du même nom |
| `chemin` | trajet d'un objet qui se déplace | une suite ordonnée de sommets |

Cinq classes d'**objet**, s'entend : un *calque* porte lui aussi une classe, et
`fond` y désigne le terrain peint (plus bas).

`decor` n'est pas cliquable : il sert à caler le dessin — où s'arrête le sol, où
passe le vide, quelle place occupe le pont une fois posé. L'unicité des noms est
**par classe** : `porte` peut être à la fois un `hotspot` et un `decor`, ce sont
deux choses différentes au même endroit.

`marqueur` est la seule classe qui ne s'invente pas de nom : il **porte celui de
la zone qu'il désigne**, et c'est ce nom qui les relie (plus bas).

Les noms s'écrivent en minuscules, chiffres et `_`. C'est du code une fois
généré, un accent ou une espace casserait le fichier.

## Les formes

| Forme | Quand | Ce que le jeu en fait |
| --- | --- | --- |
| **rectangle** | le cas normal | une boîte, élargie à 88 px si elle est plus petite |
| **polygone** (`P`) | quand la forme *est* le propos — une berge en biais | le contour sert au test tactile, tel quel |
| **point** (`I`) | une ancre, une position d'apparition | une boîte de taille nulle ; le code en prend le centre |
| **polyligne** (`L`) | un trajet, et lui seul — classe `chemin` | la suite de ses sommets, dans l'ordre du tracé |

Un polygone n'est **pas** élargi à la taille du pouce : l'élargir déplacerait
son coin haut-gauche, donc le repère de son contour, et la forme touchée ne
serait plus celle dessinée. Un polygone trop petit est signalé à l'import, c'est
là qu'on le corrige.

Les ellipses et les objets tournés sont ramenés à leur boîte englobante, avec un
avertissement : le jeu ne sait pas gérer une zone oblique.

## Les calques image : le fond, et le croquis

Deux calques image peuvent vivre sous le plan. Ce sont deux choses opposées, et
c'est la **classe** du calque qui les départage — comme pour les objets.

### Le fond — classe `fond`

Le terrain peint par l'artiste. Il **entre dans le jeu** : `npm run scenes` le
reporte dans le plan généré, et la scène le pose sous le décor (voir
`src/game/scenes/fond.ts`).

*Layer > New > Image Layer*, propriété *Image*, puis *Class* → `fond`. Le mettre
en **verrouillé** évite de le déplacer en ajustant les zones par-dessus.

Le calque pointe **directement le fichier que le jeu charge**, dans `public/` —
donc un chemin relatif du genre `../../../public/assets/decor/fond-pont.webp`.
C'est le nœud de l'affaire : on place les zones tactiles sur les pixels exacts
que le joueur aura sous les yeux. Une copie de travail rangée à côté de la carte
finirait par diverger de celle du build, et on ajusterait des zones sur une image
que plus personne ne voit. L'import refuse d'ailleurs un fond hors de `public/`.

Il ne couvre pas tout le cadre, et c'est voulu : **le ciel reste peint par le
code** (`ciel.ts`), dégradé, soleil et nuages compris. Le fond est livré
transparent au-dessus de l'horizon, et les nuages dérivent donc derrière le
rempart sans qu'il faille découper l'image.

Tiled n'étire jamais un calque image : ce qu'il affiche est la taille du
fichier, et c'est cette taille-là que le jeu reprend. L'import relit les
dimensions réelles et **refuse la carte** si elles ont divergé de ce qu'elle a
retenu — signe que le fichier a changé depuis, et qu'il faut rouvrir la carte
pour qu'elle le relise. La visibilité du calque, elle, ne regarde que
l'éditeur : masquer le fond pour voir dessous ne l'enlève pas du jeu.

### Le croquis — sans classe

Un calque image **sans classe** est ignoré, comme avant. C'est le croquis à la
main posé sous le plan : il se dessine ailleurs — papier photographié, n'importe
quelle app de dessin — et s'exporte en **PNG 1280 × 720** dans `croquis/` à côté
de la carte. Il sert à placer les zones et à briefer le graphisme, et ne part
**jamais dans le build**. Une fois le fond livré, c'est lui qui devient le
repère : le croquis peut passer en invisible.

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

### Où se pose la cocotte — la classe `marqueur`

Par défaut, **au centre de ce qui est dessiné** — ce qui va bien tant que le
sujet remplit son rectangle. Un pliage ne le remplit pas toujours : le centre de
l'emprise du renard, couché et plus large que haut, tombe dans le creux entre son
dos et sa queue — donc sur le rempart, où la cocotte se perd — et celui du jeune
arbre à mi-tronc plutôt que dans le feuillage.

Ça se corrige **entièrement dans la carte**. On trace un objet **au point**
(`I`), classe `marqueur`, portant le **nom de la zone** qu'il désigne, et posé
sur les pixels du dessin où la cocotte doit tomber :

```
hotspot   « renard »   rectangle, l'emprise du sujet
marqueur  « renard »   point, sur son flanc
```

C'est le nom qui les relie. Rien à écrire dans la scène — le point voyage avec
la zone jusqu'à `PointClickScene`, qui pose la cocotte dessus au lieu du centre.
La zone tactile, elle, ne bouge pas : elle reste l'emprise entière du dessin.

L'import refuse un marqueur qui ne tient pas la promesse de son nom :

- **un nom qui ne désigne rien** — il n'existe ni hotspot ni sortie ainsi nommé,
  et le message liste ceux de la carte (une faute de frappe se voit tout de
  suite) ;
- **un point hors de sa zone** — la cocotte se poserait à côté de son sujet. Sur
  un polygone, c'est le contour qui compte, pas la boîte englobante ;
- **un nom ambigu** — la même chaîne est à la fois un `hotspot` et un `exit`, et
  le marqueur ne saurait pas lequel il vise ;
- **une forme qui n'est pas un point** — un marqueur est une position, et un
  rectangle laisserait croire qu'on dimensionne la cocotte ici.

### Un objet qui se déplace — la classe `chemin`

Un trajet se dessine, comme le reste de la géométrie. C'est une **polyligne**
(`L`), de classe `chemin`, avec un nom :

```
chemin  « fuite »  polyligne, du pied de l'arbre jusque hors du cadre
```

Elle ne dit **que le trajet**. Ce qui l'emprunte, à quelle vitesse, dans quel
sens et quand, c'est la scène qui le décide — `deplacer()`, dans
`src/game/scenes/deplacement.ts`. La carte ne sait pas ce qui passe dessus, et
c'est ce qui permet au même tracé de servir deux fois.

**Le sens est l'ordre des clics.** Une polyligne est ordonnée, le premier sommet
est celui qu'on a posé en premier, et le `.tmj` le garde tel quel. Rien à
déclarer — mais rien ne le montre non plus dans l'éditeur, où les deux bouts se
ressemblent : `npm run scenes` affiche donc les extrémités de chaque chemin, dans
l'ordre. Et un trajet parcouru dans les deux sens ne se dessine pas deux fois :
`{ inverse: true }` retourne le même.

**Le premier sommet est la position de l'objet** quand le déplacement commence.
C'est une convention de dessin, pas un contrôle : le trajet part toujours de là
où l'objet se trouve réellement, donc un premier sommet posé ailleurs le fait
rejoindre plutôt qu'il ne l'y téléporte.

**Un chemin a le droit de sortir du cadre.** Tiled ne borne pas les objets au
plan : on tire le dernier sommet dans la zone grise, au-delà du bord, et c'est
par là que l'objet quitte l'écran. Le tracé donne la **direction** et l'endroit
du franchissement ; **la distance appartient au code** (`{ sortie: true }`), qui
poursuit le dernier segment jusqu'à ce que l'objet ait entièrement disparu. Elle
ne peut pas se dessiner : elle dépend de la taille de l'objet à l'écran, que la
carte ne connaît pas.

Aucune position n'est donc vérifiée sur un chemin — ni débordement, ni cible
tactile. Seule la forme l'est : une polyligne, et au moins deux sommets.

**Un déplacement ne bloque pas la scène.** Le joueur continue de toucher le
décor pendant qu'un objet traverse — un nuage qui dérive n'a pas à suspendre la
partie. `{ bloquant: true }` pour l'exception, ce qui doit être vu avant qu'on
puisse agir.

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

L'import **refuse** une carte qui n'est pas au bon format, un objet sans classe
ou sans nom, un nom en double dans la même classe, un nom qui n'est pas un
identifiant valide, une boîte plate, et un marqueur qui ne désigne aucune zone,
tombe hors de la sienne, est ambigu ou n'est pas tracé au point (voir plus haut).

Il refuse aussi les deux confusions de forme autour de la polyligne : une zone
tracée à la polyligne — un trait n'a pas d'intérieur, donc rien à toucher — et un
`chemin` qui n'en est pas une.

Il **signale**, sans refuser :

- une zone tactile **sous 88 unités** (la cible de 44 px réels) — elle sera
  élargie par `touchRect()`, ce qui peut la faire mordre sur une voisine ;
- un élément qui **déborde du cadre** ;
- une ellipse ou un objet tourné, ramenés à leur boîte.
