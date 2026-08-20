# Langage visuel

## Le problème que ça résout

Sur écran tactile, **le survol n'existe pas**. Dans un point & click classique,
c'est le curseur qui change de forme au passage sur un objet qui apprend au
joueur ce qui est actif. Ce retour disparaît complètement sur téléphone.

Il faut donc que les éléments interactifs se signalent d'eux-mêmes, en
permanence, sans transformer la scène en sapin de Noël.

## Deux signes, deux fonctions

| Signe | Signifie | Où |
| --- | --- | --- |
| **Cocotte en papier** | ici, on peut analyser | sur les objets et les feuilles |
| **Flèche pliée** | ici, on change de scène | sur les bords gauche et droit |

Ces deux signes ne se mélangent jamais. Un joueur doit pouvoir distinguer, d'un
coup d'œil et sans lire, ce qui fait avancer l'histoire de ce qui fait changer de
pièce.

## La cocotte

⚠️ **Deux modèles portent ce nom.** Celui qu'on veut est la **poule en papier**,
vue de profil — pas la salière à quatre volets qu'on manipule au bout des doigts.
La poule a une silhouette bien plus caractéristique, donc plus lisible en petit.

C'est le pliage le plus reconnaissable de l'enfance, et il porte le bon
sous-texte : *une feuille peut devenir autre chose*.

Le marqueur bat lentement — échelle, opacité et une légère bascule d'angle, sur
1,4 s. **Le battement doit rester discret.** Une scène contient jusqu'à cinq
hotspots ; si chacun clignote fort, la scène devient illisible et le joueur ne
regarde plus le décor. Le marqueur signale, il ne réclame pas.

### État : forme provisoire, en attente d'un dessin

⚠️ La silhouette actuelle est **dessinée en polygones dans le code** et ne se lit
pas franchement comme une poule. Plusieurs passes de réglage n'ont pas suffi :
à ~20 px, une cocotte convaincante demande un vrai dessin, pas des coordonnées
ajustées à la main.

**Le remplacement ne demande aucun code** : déposer un PNG dans
`src/assets/ui/cocotte.png` et il est utilisé partout. La détection se fait à la
compilation (`import.meta.glob`), donc rien n'est tenté tant que le fichier
n'existe pas.

Format attendu : fond transparent, ~80×80, la poule **tournée vers la gauche**,
en teinte claire.

## Les flèches de navigation

**✅ Implémenté** (`src/game/systems/exit-marker.ts`), en forme provisoire : deux
volets triangulaires, le bas plus sombre que le haut, comme une feuille repliée
éclairée d'un seul côté. Elle dérive lentement de 6 px vers l'extérieur du
cadre, sans jamais tourner.

Trois écarts délibérés avec la cocotte, pour qu'aucune confusion ne soit
possible : la **couleur** (papier clair contre jaune chaud), la **forme**
(anguleuse contre silhouette) et le **mouvement** (dérive contre battement).

Idée à explorer : la flèche pourrait être elle-même un petit origami baké par le
pipeline, et se plier/déplier au survol du doigt. Cohérent avec le sujet, et on a
déjà toute la chaîne technique pour le faire.

## Le héros est dans le décor

**Tranché.** La grenouille est **dessinée dans chaque scène** et **s'analyse
comme le reste** — une zone `hs_heros` dans chaque plan, un marqueur cocotte,
une description.

Deux raisons. Un point & click sans personnage à l'écran est un jeu de
catalogue : on regarde des objets, on ne traverse pas un lieu. Et le héros du
jeu a un visage — c'est l'origami de grenouille, celui de la vignette de
dialogue ; le laisser hors champ reviendrait à ne le montrer que quand il parle.

Le dialogue est **partagé par toutes les scènes** (knot `heros`) : ce que le
héros pense de lui-même ne change pas de pièce en pièce. Il se découpera par
scène le jour où ça comptera.

C'est **l'origami de l'artiste**, pas un dessin de substitution : la grenouille
verte photographiée, la même que sa vignette de dialogue. Le renard aussi. Les
personnages du jeu sont des pliages réels — les redessiner en polygones les
aurait fait mentir sur ce qu'est ce jeu.

Les PNG sont détourés sur fond transparent, rognés sur leur boîte alpha et
réduits à l'intégration (`tools/detourer-png.py`), donc **sans marge** : la
boîte du plan est exactement l'emprise du personnage. Le sprite est calé sur le
**bas** de sa boîte — une boîte de plan marque un appui au sol, et c'est ce point
qui doit rester fixe quand on la redimensionne dans l'éditeur.

## Palette

Définie dans `src/game/config.ts`.

| Rôle | Usage |
| --- | --- |
| `paper` / `paperDark` | le papier, les origamis, le texte |
| `ink` | les fonds sombres, les contours |
| `wood` / `woodDark` | le mobilier, les décors |
| `accent` (terracotta) | les plis, les actions, ce qui répond au doigt |
| `glow` (jaune chaud) | la cocotte, les sources de lumière |

L'accent terracotta sert aux **traits de pli** dans les crease patterns comme aux
**boutons pressés** : c'est la couleur de ce qui se plie et de ce qui réagit.

## Le papier des origamis

Une feuille d'origami a **deux faces qui ne se ressemblent pas**, et c'est ce qui
rend un pliage lisible : le verso n'apparaît qu'aux endroits où le papier s'est
retourné, donc il *dessine les plis*. Un modèle uniformément blanc se lit comme
une bosse.

Chaque modèle a donc son papier, déclaré dans
[`src/origami/papier.ts`](../src/origami/papier.ts) :

| Modèle | Recto (ce qu'on voit) | Verso (ce que les plis retournent) |
| --- | --- | --- |
| pont | papier | bois |
| arbre | feuille verte | bois — c'est lui qui fait le tronc |
| hache | métal poli | marron |
| porte | **papier noir** | bois, comme l'arbre |

Le noir de la porte est du **papier**, pas un fond : ce qui l'en distingue est
son reflet. Un noir mat et uniforme se lit comme un vide découpé dans le décor —
c'est exactement le piège que l'embrasure vide tendait avant, quand elle n'était
qu'un rectangle plein.

La **feuille encore dépliée**, elle, est dessinée en primitives — charger
three.js pour un carré de papier condamnerait le premier écran — mais elle prend
la teinte du recto de son modèle (`teintesDe`). La grande feuille du vieil arbre
est donc verte avant même d'être pliée, et le papier de la hache métallisé : le
pliage ne change pas de matière en cours de route. Et elle est **carrée**, comme
toute feuille d'origami.

Les textures sont **peintes au canvas à l'exécution**, pas chargées en PNG :
quelques dizaines de lignes contre des centaines de kilo-octets, pour un grain de
bois vu à 200 px dans un coin de décor. Les UV sont lues sur la feuille **à
plat** — la texture est imprimée avant le pliage, comme dans la réalité, donc le
grain suit les plis au lieu de glisser dessus.

## Ce qui est plié se montre par son modèle

**Le décor ne dessine jamais un origami.** Le pont posé, le vieil arbre, la porte
en place : ce sont les fichiers `.origami` eux-mêmes, rendus en 3D et posés dans
la scène ([`origami-decor.ts`](../src/game/scenes/origami-decor.ts)). Même chose
pour le but affiché pendant l'énigme et pour les vignettes d'inventaire.

C'est une règle, pas une commodité. Les dessins d'appoint qui tenaient la place —
une gouttière pour le pont, un arbre mort au trait — finissaient par n'avoir plus
rien de commun avec le pliage : on regardait une animation, et la scène montrait
autre chose.

**L'angle est le même partout** ([`vue.ts`](../src/origami/vue.ts)). Ces crease
patterns sont *plats* : le solveur les replie dans leur propre plan, il n'en sort
presque rien. Le modèle plié n'est pas un volume, c'est une **silhouette** — et
une silhouette ne se lit que de face. D'où une caméra presque à la verticale du
papier, à ~70° au-dessus de l'horizon, exactement la vue de pliage d'ORIPA. Les
20° qui restent donnent le relief : les rabats accrochent la lumière et on voit
que c'est du papier posé, pas un dessin.

**Chaque modèle a sa pose**, dans [`poses.ts`](../src/origami/poses.ts) — une
orientation, un taux de pliage, et une taille dans le décor. Le pont basculé
vers l'arrière pour qu'il enjambe au lieu d'être vu de dessus, l'arbre roulé
jusqu'à ce que son tronc soit en bas, la porte droite. C'est l'objet qu'on
tourne, pas la caméra : l'angle de vue est commun à tout le jeu, alors que la
bonne façon de présenter un objet dépend de l'objet.

L'**échelle** est là parce que la taille sur scène ne se déduit pas de la boîte
du plan seule : le modèle y est ajusté sans déformation, donc une silhouette
longue et fine n'occupe qu'une fraction de son emprise là où une silhouette
carrée la remplit. Deux modèles logés dans des boîtes identiques n'ont donc pas
la même présence. Elle n'agit que sur le **décor** — l'inventaire et le but de
l'énigme ont leurs propres cases, l'animation son propre cadre.

Ces valeurs ne se devinent pas — rien dans un crease pattern ne dit où tombera
le manche. Elles se règlent à l'œil :

```bash
npm run dev
```

puis `http://localhost:5173/orientation.html` : un modèle à la fois, **qu'on
tourne à la souris**, plus les curseurs pour finir au degré près, le pliage
final, la taille dans le décor et un zoom de confort. « Enregistrer » **écrit
directement** `poses.ts` — c'est le serveur de développement qui s'en charge
(voir `vite.config.ts`), et rien de tout ça n'existe dans le build.

Trois détails d'ergonomie qui comptent, appris à l'usage : l'échelle du rendu
**ne bouge jamais** quand on tourne (le cadrage du jeu serre sur la silhouette,
donc l'image grandissait à chaque degré et on perdait le fil) ; le bouton de
retour ramène à la pose **enregistrée**, pas à zéro — après vingt essais, ce
qu'on veut retrouver est la dernière pose validée ; et il n'y a plus de
copier-coller, qui était le vrai coût du réglage.

**La caméra n'a aucune dérive latérale**, et c'est ce qui garde les verticales
verticales. La moindre composante en X cisaille l'image, et un modèle
rectangulaire — la porte — en sortait de travers sans qu'on comprenne pourquoi.

**L'animation part de la feuille en face et arrive dans la pose.** Le pliage
commence sur la feuille présentée bien à plat devant soi, et pivote vers
l'orientation du modèle au fur et à mesure : la dernière image de l'animation
est exactement celle que le décor montrera ensuite. Le modèle se balance ensuite
de quelques degrés — assez pour dire « c'est un volume », pas assez pour défaire
la pose.

**Un voile accompagne la 3D.** Dès que la couche de pliage se montre — animation
comme examen d'un objet — un fond sombre à 50 % apparaît avec elle et disparaît
avec elle. Sans lui, le modèle passe devant les personnages et le décor et tout
se mélange. Volontairement pas plus opaque : ce n'est pas un écran de
chargement, le joueur doit garder le fil de l'endroit où il est. C'est la couleur
de fond du canvas 3D lui-même, donc rien à synchroniser.

**Jamais 100 % de pliage.** La pose finale du solveur est souvent parfaitement
plate — le pont y perd toute épaisseur. On s'arrête un cheveu avant (le `pliage`
de `POSES`, réglable par modèle),
pour l'animation comme pour les images fixes : les rabats gardent leur angle, et
c'est la même pose partout.

## Lisibilité tactile

Contraintes non négociables, appliquées dans le code :

- **Cibles à 44 px réels minimum.** `touchRect()` élargit toute zone trop petite
  autour de son centre — le visuel reste fin, la zone de collision grossit.
- **Priorité au plus petit.** Quand deux hotspots se chevauchent (une feuille
  posée sur une table), le plus petit gagne le tap. Sans ça, la grande zone avale
  systématiquement le détail.
- **La zone tactile suit le dessin, pas la boîte du plan.** Une boîte de plan est
  une emprise généreuse dans laquelle le graphisme est ajusté sans déformation :
  il n'en occupe donc qu'une partie, et il change de taille avec l'état (une
  feuille à plat, puis un arbre debout). `caler()` recale la zone sur ce qui est
  réellement à l'écran — sans quoi on « analysait » le renard en tapant 70 px
  au-dessus de sa tête.
- **Les marqueurs sont détourés.** La cocotte et la flèche de sortie sont
  redessinées en sombre juste en dessous d'elles-mêmes, un peu dilatées. Un
  marqueur clair posé sur une feuille de papier ou sur une rive au soleil
  disparaissait, alors qu'il est le seul signe qui dise « ici, on peut agir ».
  La dilatation se fait autour d'un centre **commun** à toutes les parties de la
  forme : chacune autour du sien, elles s'écartent les unes des autres et la
  silhouette se casse.
- **Rien dans les coins hauts.** Sur un grand téléphone tenu à deux mains en
  paysage, le haut de l'écran est hors d'atteinte du pouce.
- **L'UI ne rétrécit pas indéfiniment.** Le décor est mis à l'échelle, pas les
  boutons : `--ui-scale` ne descend pas sous 0.62.

## Orientation

Le jeu est **verrouillé en paysage**. En portrait, une invite « Tourne ton
téléphone » couvre l'écran (CSS pur, `@media (orientation: portrait)`).

Nécessaire : l'option d'orientation d'itch.io n'est qu'une suggestion au
navigateur, elle ne force rien.
