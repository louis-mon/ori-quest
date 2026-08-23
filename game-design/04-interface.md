# Interface — verbes, inventaire, carnet

Ce document tranche deux questions ouvertes : faut-il un menu de verbes ? faut-il
un inventaire ?

## Le menu de verbes : non

Le prototype propose un menu contextuel (« Regarder / Prendre / Utiliser ») quand
on touche un hotspot. **La boucle de jeu décrite n'en a pas besoin.**

Le joueur ne fait qu'une chose sur un élément de décor : il l'**analyse**. Les
idées viennent de l'observation, le pliage vient du minijeu. Il n'y a ni objet à
combiner, ni serrure où insérer une clé — donc pas de second verbe à proposer.

Un menu à une seule entrée est un tap de trop.

### Ce que ça coûte de l'enlever

**Rien.** Le comportement est déjà piloté par les données :

> [`point-click-scene.ts`](../src/game/scenes/point-click-scene.ts) — si un
> hotspot n'expose qu'un seul verbe, l'action se déclenche directement et
> **aucun menu ne s'ouvre**.

Il suffit donc de ne déclarer qu'un verbe par hotspot. Le menu ne réapparaîtra
que le jour où un élément en proposera réellement deux — ce qui reste possible
sans rien réécrire.

**✅ Fait** : le verbe unique s'appelle `analyser`, et le triplet
`look / take / use` hérité du point & click classique a disparu. Le type reste
une union à un membre — le menu contextuel sait toujours s'ouvrir le jour où un
élément en proposera deux.

## L'inventaire : oui, et une idée en est un objet

**Tranché.** La première version de ce document disait « pas d'inventaire » : le
héros transporte des idées, pas des objets. Le chapitre 1 a montré la limite —
la hache et le bois traversent les scènes et conditionnent des dialogues. Ce
sont des objets, quel que soit le nom qu'on leur donne.

### Une seule liste, pas deux

**Dans le code, rien ne distingue une idée d'un objet.** Même inventaire, même
tag `# give:`, même condition `has_` dans la narration. Deux mécanismes
parallèles pour « savoir plier une hache » et « avoir une hache » coûteraient
deux fois le code pour une distinction que le joueur ne rencontre jamais : on
n'a jamais l'idée *et* l'objet en même temps, l'un devient l'autre.

La distinction est **visuelle, et elle seule** : un identifiant qui commence par
`idee_` s'affiche dans une **bulle** — coins entièrement arrondis, contour
dessiné, texte en italique — là où un objet garde une case rectangulaire. Une
idée se pense, elle ne se pose pas.

Le registre vit dans [`objets.ts`](../src/game/systems/objets.ts), comme les
personnages : nom court et description, en données.

### Les objets s'emploient seuls

**Pas de glisser-déposer, pas de « utiliser X sur Y ».** Quand la scène s'y
prête, l'objet sert de lui-même : la hache apparaît dans le dialogue du vieil
arbre parce qu'on l'a en poche, pas parce qu'on l'a fait glisser dessus. La case
d'inventaire n'est donc pas une poignée — c'est un rappel.

Le seul glisser du jeu est ailleurs : celui des pièces du minijeu, sur une
surface qui lui appartient (voir
[05-puzzle-crease-pattern.md](05-puzzle-crease-pattern.md)). Un geste appris pour
l'énigme, et pour elle seule.

C'est la même raison qui a fait supprimer le menu de verbes : sur téléphone,
chaque geste composé est un geste de trop.

### Tout se consomme, les idées comprises

**Tranché : une idée se dépense en pliant, exactement comme un objet s'use en
servant.** L'idée de la hache disparaît quand la hache est pliée, celle de
l'arbre quand l'arbre l'est ; la hache quitte l'inventaire en découpant le vieil
arbre, le bois en devenant la porte.

La raison est une raison de format : **c'est un petit jeu, qui se finit vite.**
Un inventaire qui accumule est un inventaire qu'il faut relire, trier, et dont
chaque entrée morte suggère un usage qui n'existe pas. Sur une colonne de
téléphone, trois cases valent mieux que dix.

**Conséquence tranchée** (voir la section suivante) : le carnet d'idées ne garde
pas de trace des idées dépensées. Une idée servie disparaît, point. La colonne
montre ce qu'on a en main, pas ce qu'on a fait — le journal des exploits
appartiendrait à un autre jeu, plus long, et se paierait en pixels sur un écran
qui n'en a pas.

### Le savoir n'est pas une idée

Un piège rencontré en implémentant : si l'arbre ne raconte son père qu'à la
condition qu'on n'ait pas encore l'idée de l'arbre, alors **dépenser cette idée
fait rejouer la scène de première rencontre**. Idem pour le renard.

D'où une distinction à tenir : ce qui est **su pour de bon** est un drapeau
(`arbre_parle`, `renard_bois_su`), ce qui se **porte et se dépense** est un objet
d'inventaire. Ce n'est pas un doublon — l'un dit ce qui s'est passé, l'autre ce
qu'on a en main.

### Forme

Une **colonne de cases dans le coin haut-gauche**. En paysage sur téléphone la
hauteur est la ressource rare : une barre horizontale mangerait la ligne
d'horizon du décor, une colonne ne coûte qu'une marge.

**Ancrée en haut, pas centrée.** Centrée, elle grandissait vers le milieu du bord
gauche — c'est-à-dire pile sur la flèche de sortie, qu'elle finissait par
recouvrir dès trois objets. En haut elle ne descend que si l'inventaire
s'allonge, et le coin haut-gauche est le seul des quatre qui ne serve à rien
d'autre. Si elle redevient trop longue, c'est un menu dédié qu'il faudra, pas
une autre place.

Un tap sur une case **ouvre la boîte de dialogue** et y écrit la description, en
narration. C'est la boîte que le joueur lit déjà partout ailleurs : elle laisse
le temps de lire, se ferme d'un tap comme le reste, et le texte n'a pas à tenir
dans une étiquette qui passe. La légende fugace ne sert plus qu'à nommer l'objet
dont on ouvre le menu de verbes (voir ci-dessous).

**Et le modèle tourne au centre de l'écran** pendant ce temps, quand l'objet en a
un. Une vignette de 42 px dit ce qu'on possède ; elle ne dit pas ce que c'est. Un
origami a une épaisseur, un dos, des plis qui prennent la lumière — rien de tout
ça ne survit à une case d'inventaire, et c'est pourtant la matière même du jeu.
C'est la couche de pliage qui s'en charge (`presenter()` dans `origami-layer.ts`),
la même qui joue les animations.

La barre disparaît d'elle-même quand elle est vide
([`style.css`](../src/ui/style.css)).

## Le carnet d'idées : c'est l'inventaire

**Tranché : il n'y a pas de carnet séparé.** Les idées connues du héros sont
dans la colonne de gauche, en bulles, avec les objets — même liste, même case,
même tap pour la description.

C'est la conséquence directe des deux décisions ci-dessus. Une idée se dépense,
donc la liste reste courte : deux ou trois entrées, jamais la planche de
vignettes qu'un carnet supposerait. Et les choix du dialogue de pliage sortent
déjà de cette liste — le joueur n'a pas à la consulter avant de choisir, le
dialogue lui présente les options.

Restent les deux fonctions qui comptent, et la colonne les remplit toutes les
deux :

1. **Mémoire** — le joueur qui reprend après trois jours voit ce qu'il a en main.
2. **Vocabulaire** — les modèles affichés sont exactement ceux qu'il pourra
   proposer devant une feuille.

**On rouvrira la question si la place manque** — le jour où une scène tiendrait
six ou sept entrées à l'écran, une planche repliable derrière une icône
redeviendrait le bon compromis. Rien dans le code n'y ferait obstacle :
l'inventaire est déjà une liste de données rendue par
[`overlay.ts`](../src/ui/overlay.ts).

### Représentation

Une case **montre avant de nommer** : la vignette du modèle plié au-dessus, le nom
en petit dessous. On repère une forme bien plus vite qu'on ne lit une étiquette,
et à la taille où l'inventaire tient sur un téléphone une colonne d'étiquettes se
lit mal.

**C'est le modèle lui-même**, rendu depuis le `.origami` — donc littéralement la
même image que le but affiché pendant l'énigme, puis que l'objet posé dans le
décor. Le joueur suit un seul dessin de « je sais faire ça » jusqu'à « j'ai ça ».

Ce qui n'est pas un pliage — le bois tiré du vieil arbre — a une vignette
dessinée, dans [`vignettes.ts`](../src/ui/vignettes.ts).

La vignette reste contenue (42 px à l'échelle 1) : la colonne s'allonge d'une
case par objet, et le bord gauche est aussi celui de la flèche de sortie.

## Qui parle : nom + vignette

Les dialogues avec les PNJ demandent de savoir qui parle sans avoir à le
déduire du texte. La boîte de dialogue affiche donc un **en-tête de locuteur** :
une vignette carrée à gauche, le nom au-dessus de la réplique.

**La vignette plutôt que le nom seul.** Les PNJ du jeu sont des origamis, et
l'artiste les livre déjà détourés sur fond transparent — la matière existe. Une
vignette identifie un personnage d'un coup d'œil là où un nom demande une
lecture, ce qui compte sur un écran de téléphone où la boîte occupe déjà le bas
du cadre. Le nom reste affiché à côté : un origami de renard vu à 56 px ne dit
pas encore comment ce renard s'appelle.

**Le nom seul suffit quand la vignette manque.** Un personnage sans graphisme
s'affiche avec son nom seul, et un fichier de vignette absent ne laisse pas
d'icône cassée. Écrire les dialogues n'attend pas les images.

**La narration n'a pas d'en-tête.** Ni nom ni vignette, et le texte passe en
italique. C'est ce qui distingue « quelqu'un parle » de « le jeu décrit » avant
même la lecture.

### Le héros est la grenouille

**Tranché.** Le héros a un visage : c'est l'origami de grenouille, et il a sa
vignette comme n'importe quel PNJ. Une réplique qu'il prononce à voix haute
s'écrit donc `# qui: heros` — ou `# qui: grenouille`, c'est le même personnage.

Ce qui reste sans locuteur est la narration : les descriptions, et ce que le
héros pense sans le dire. La distinction est utile à l'écriture. « Le pont est
rompu » n'est pas une réplique, et un jeu contemplatif passe le plus clair de son
temps dans cette voix-là — lui coller une vignette de grenouille à chaque ligne
remplirait la boîte d'un visage qui ne parle pas.

Les deux identifiants existent pour une raison : `heros` dit le rôle dans le
récit, `grenouille` dit la forme. Le jour où le héros change de forme — dans un
jeu où tout se plie et se replie, l'hypothèse n'a rien de gratuit — c'est le
registre qui bouge, pas les dialogues déjà écrits.

**Côté écriture**, le locuteur est un tag ink rémanent — `# qui: renard` vaut
jusqu'au prochain `# qui:`. Le registre des personnages (nom, vignette, couleur
du nom) vit dans `src/game/systems/personnages.ts` ; voir l'en-tête de
`content/story.ink` pour la syntaxe.

## Ce qui reste dans l'interface

| Élément | Statut |
| --- | --- |
| Boîte de dialogue + choix | ✅ garder tel quel |
| En-tête de locuteur (nom + vignette) | ✅ implémenté |
| Marqueur cocotte sur les hotspots | ✅ garder |
| Légende fugace (nom de l'élément) | ✅ gardée avec le menu de verbes, retirée des sorties |
| Menu (plein écran, recommencer) | ✅ implémenté |
| Menu de verbes | ✅ retiré (verbe unique `analyser`) |
| Inventaire (objets + idées) | ✅ colonne à gauche, tap = description |
| Carnet d'idées | ✅ c'est l'inventaire — pas d'écran séparé |
| Flèches de navigation | ✅ implémenté |

**Une sortie ne s'annonce plus.** Taper une flèche affichait le nom de la
destination dans la légende fugace. Deux raisons de l'avoir retiré. La légende
tient 1,6 s quand le fondu de transition en dure 0,26 : elle finissait donc de
passer **par-dessus la scène d'arrivée**, à nommer la pièce qu'on venait de
quitter — l'information arrivait toujours après le voyage. Et sur un téléphone
en paysage, elle tombe tout en bas du cadre, là où la boîte de dialogue et le
pouce se disputent déjà la place.

Ce qu'elle apportait est déjà dit ailleurs : la flèche pointe **hors du cadre**,
donc vers le dehors, et le fondu marque le changement de pièce. Un jeu qui tient
en quelques pièces voisines n'a pas besoin qu'on lui nomme la porte d'à côté.
Le jour où un carrefour offrira trois directions, la question se reposera — mais
il faudra alors une forme qui se lise **avant** de partir, pas pendant.

**Ce qui est au premier plan est exclusif.** Tant qu'une réplique attend un tap
ou qu'un menu est ouvert, le décor ne répond plus : ni hotspot, ni sortie. Seuls
la boîte de dialogue et le menu du jeu restent atteignables.

Le piège était la **description d'un objet d'inventaire** : elle écrit dans la
boîte sans passer par le moteur de narration, si bien que le décor ne la voyait
pas. On pouvait donc analyser un hotspot en lisant une description, ou pire
changer de scène — la boîte suivait alors le joueur dans la pièce d'à côté, à
décrire un objet au milieu d'un décor qui n'avait plus rien à voir. La question
« l'interface tient-elle la parole ? » se posait en trois morceaux répartis dans
deux fichiers, et il en manquait forcément un. C'est l'interface elle-même qui y
répond maintenant, en un seul endroit (`occupeLeJoueur` dans
[`overlay.ts`](../src/ui/overlay.ts)).

## Le menu

Bouton en haut à droite — à l'opposé de l'inventaire, pour qu'aucun des deux ne
recouvre l'autre ni le titre de scène. Il ouvre deux entrées :

**Plein écran.** Masqué automatiquement là où le navigateur ne le permet pas,
plutôt que d'offrir un bouton inerte — c'est le cas de Safari sur iPhone, qui
réserve encore l'API plein écran aux vidéos. Sur itch.io, le lecteur fournit de
toute façon son propre bouton.

**Recommencer.** Passe par une confirmation explicite (« Cette action est
définitive »), puis écrase la sauvegarde et recharge la page.

Le rechargement complet est délibéré : l'état de jeu n'est pas le seul à devoir
repartir de zéro. Le récit ink conserve ses variables dans son instance `Story`,
et la couche origami garde un contexte WebGL et un modèle chargé. Redémarrer la
seule scène Phaser laisserait tout cela en place — une partie « neuve » qui se
souviendrait des dialogues déjà lus.

C'est aussi une nuance de la sauvegarde : elle est **réécrite** avec un état
neuf, pas supprimée. Effacer la clé laisserait le gestionnaire `pagehide`
réenregistrer l'état courant pendant le rechargement, et ressusciter la partie
qu'on vient d'effacer.

## Principe directeur

**L'interface doit disparaître derrière le décor.** Un point & click contemplatif
sur l'origami ne supporte pas une barre d'outils. Chaque élément d'UI permanent
doit justifier la place qu'il prend sur un écran de téléphone — et en paysage,
cette place est rare.
