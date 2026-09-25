# Chapitres et scènes

## Le découpage

Le jeu est découpé en **chapitres**. Un chapitre contient **deux scènes** : c'est
le format retenu. Trois restent possibles ; au-delà, il faudrait une carte, et
une carte change la nature du jeu. Un chapitre doit rester explorable au pouce,
dans les transports, sans notes.

**Tranché : rien ne persiste d'un chapitre à l'autre.** Chaque chapitre est en
théorie **indépendant**, même si les chapitres se jouent dans l'ordre. Ni les
idées, ni les objets, ni les drapeaux ne traversent la frontière : un chapitre
repart propre, et tout ce dont il a besoin se trouve à l'intérieur. On ne revient
pas au chapitre 2 pour résoudre le chapitre 5.

C'est une décision de format : le jeu est court et se finit vite. Un inventaire
qui grossit chapitre après chapitre demanderait un tri, une mémoire, une
interface — trois choses qu'un jeu d'une heure n'a pas les moyens de porter. Un
chapitre indépendant se teste, se réécrit et se coupe sans toucher aux autres.

**À l'intérieur d'un chapitre**, en revanche, la distinction entre ce qui se
dépense et ce qui reste compte : les idées et les objets se dépensent en servant (voir [04-interface.md](04-interface.md)),
tandis que les **faits** restent acquis — que l'arbre ait parlé, que le renard ait
dit d'où venait le bois. Ce sont des drapeaux, pas des objets ; ils ne prennent
aucune place à l'écran, et ils s'arrêtent eux aussi à la fin du chapitre.

## La navigation entre scènes

On passe d'une scène à l'autre en touchant des **flèches animées, stylisées en
origami** — un pli de papier qui pointe, pas une flèche d'interface.

Ces flèches sont des hotspots comme les autres, avec deux différences :

- elles ne déclenchent pas de dialogue, elles changent de scène ;
- elles doivent être **immédiatement lisibles comme navigation**, jamais
  confondues avec un élément à analyser.

D'où une règle de langage visuel : **la cocotte signale ce qu'on analyse, la
flèche signale où l'on va**. Deux signes, deux fonctions, jamais mélangés. Voir
[03-langage-visuel.md](03-langage-visuel.md).

### Placement

Les flèches se placent sur les bords gauche et droit du cadre, à hauteur
confortable pour le pouce — donc **plutôt bas que centré verticalement**, et
jamais dans les coins supérieurs, hors d'atteinte sur un grand téléphone.

**La topologie n'est pas une question tant qu'un chapitre a deux scènes** :
A ↔ B, une flèche de chaque côté, rien à comprendre.

**Tranché au chapitre 3, le premier à en avoir trois** : une ligne, cuisine ↔
salle du trône ↔ jardin, la salle du trône au milieu. À trois scènes, c'est aussi
une étoile dont elle serait le centre, et c'est le contenu qui la désigne : elle
est le point d'entrée du chapitre, les deux quêtes y commencent — la couronne de
la reine, la faim des chats — et le dénouement s'y joue. Chaque pièce garde la
règle des bords : deux flèches dans la salle du trône, une de chaque côté, et une
seule dans les deux autres, du côté par où l'on revient.

## Ce que ça implique techniquement

Le chapitre 1 a ses deux scènes, le ravin et la porte ; le chapitre 2, le village
et l'entrée du château ; le chapitre 3, la salle du trône, la cuisine et le
jardin. La navigation fonctionne dans les deux sens à l'intérieur d'un chapitre,
franchir la porte mène du premier au second, et l'entrée du château du second au
troisième. La fin du troisième est celle de l'histoire : son dernier knot pose
l'écran de fin (`# fin:`).

**Les liaisons sont dans les plans**, pas dans un registre : une boîte `exit_<id>`
dans le SVG, et la scène dit vers quelle pièce elle mène. Le registre de
chapitres, lui, existe (`src/game/chapitres.ts`), mais il ne dit encore que deux
choses : quelles scènes chaque chapitre contient, et **jusqu'où va la
traversée**. Les trois chapitres sont embarqués — le menu des points d'étape mène
aux deux derniers —, mais la traversée s'arrête au bout du premier, sur « À
suivre… » : le texte du chapitre 2 est écrit et ses énigmes tiennent, ses objets
ne sont pas encore calés sur ses fonds ; le chapitre 3 n'a que des décors
provisoires et un texte de premier jet. ⚠ Il reste à ce registre un point d'entrée par
chapitre, et avec lui la remise à zéro de l'inventaire et des drapeaux au passage
d'un chapitre au suivant : rien ne l'effectue aujourd'hui.

**L'état de scène** passe par les drapeaux de `gameState`, sérialisés avec la
sauvegarde : le joueur qui revient au ravin retrouve le pont posé.

**La transition** est un fondu de 260 ms. Le pli qui balaie l'écran serait plus
juste et reste à faire — le fondu n'est là que pour que la scène suivante
n'apparaisse pas d'un coup, marqueurs déjà en plein battement.

⚠ Deux pièges rencontrés, à ne pas réintroduire : `game.scene.start()`
**n'arrête pas** la scène qu'on quitte (les deux restent actives, avec deux jeux
de zones tactiles), et Phaser **réutilise l'instance** de scène d'un passage à
l'autre — tout ce qu'une scène accumule dans ses champs doit être remis à zéro
au `create()`, sinon le retour dans une pièce déjà visitée touche des objets
détruits.

## Rythme visé

Un chapitre = **2 à 4 pliages**, répartis sur ses deux scènes. En dessous, le chapitre ne raconte rien ;
au-dessus, la mécanique s'épuise avant la fin.

Chaque pliage devrait sembler *mérité* : le joueur a cherché l'idée, choisi le
modèle, réussi le minijeu. Trois petites victoires par origami.
