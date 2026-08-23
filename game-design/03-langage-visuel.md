# Langage visuel

## Le problème que ça résout

Sur écran tactile, **le survol n'existe pas**. Dans un point & click classique,
c'est le curseur qui change de forme au passage sur un objet qui apprend au
joueur ce qui est actif. Ce retour disparaît complètement sur téléphone.

Il faut donc que les éléments interactifs se signalent d'eux-mêmes, en
permanence, sans transformer la scène en sapin de Noël.

## Deux signes, deux fonctions

| Signe                 | Signifie                | Où                             |
| --------------------- | ----------------------- | ------------------------------ |
| **Cocotte en papier** | ici, on peut analyser   | sur les objets et les feuilles |
| **Flèche pliée**      | ici, on change de scène | sur les bords gauche et droit  |

Ces deux signes ne se mélangent jamais. Un joueur doit pouvoir distinguer, d'un
coup d'œil et sans lire, ce qui fait avancer l'histoire de ce qui fait changer de
pièce.

## La cocotte

⚠️ **Deux modèles portent ce nom.** Celui qu'on veut est la **pajarita**,
l'oiseau traditionnel vu de profil — pas la salière à quatre volets qu'on
manipule au bout des doigts. La pajarita a une silhouette bien plus
caractéristique, donc plus lisible en petit.

C'est le pliage le plus reconnaissable de l'enfance, et il porte le bon
sous-texte : _une feuille peut devenir autre chose_.

**✅ C'est le pliage de l'artiste** (`public/assets/ui/parajita.png`, posé par
`src/game/systems/hotspot-marker.ts`), photographié comme les personnages et les
nuages. Il a remplacé une silhouette tracée en polygones dans le code, que
plusieurs passes de réglage n'ont jamais réussi à faire lire comme un oiseau : à
cette taille, une cocotte convaincante demande un vrai pliage, pas des
coordonnées ajustées à la main.

Le marqueur bat lentement — échelle, opacité et une légère bascule d'angle, sur
1,4 s. **Le battement doit rester discret.** Une scène contient jusqu'à cinq
hotspots ; si chacun clignote fort, la scène devient illisible et le joueur ne
regarde plus le décor. Le marqueur signale, il ne réclame pas.

## Les flèches de navigation

**✅ Implémenté** (`src/game/systems/exit-marker.ts`), et c'est là aussi un
pliage de l'artiste (`public/assets/ui/fleche.png`) : un carré de papier dont le
pli central retourne le verso sombre en pointe. Elle dérive lentement de 6 px
vers l'extérieur du cadre, sans jamais tourner.

Le pliage est photographié **pointant vers la gauche** ; c'est donc la sortie de
droite que le code retourne.

Trois écarts délibérés avec la cocotte, pour qu'aucune confusion ne soit
possible : la **forme** (un carré net contre une silhouette d'oiseau), la
**valeur** (une pointe sombre contre du papier clair) et le **mouvement**
(dérive contre battement).

Idée à explorer : la flèche pourrait être **animée** par le pipeline plutôt que
photographiée, et se plier/déplier au tap. Cohérent avec le sujet, et on a déjà
toute la chaîne technique pour le faire.

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

## Le ciel

**On est l'après-midi**, dans toutes les scènes d'extérieur. Les premières
étaient peintes en gris bleutés très sombres — un ciel de nuit, en contradiction
avec le récit.

Le ciel est un **dégradé peint au canvas**
([`src/game/scenes/ciel.ts`](../src/game/scenes/ciel.ts)), pas une pile
d'aplats : trois bandes unies donnaient deux lignes horizontales franches, qui
se lisaient comme des horizons flottant au-dessus du vrai. Un fond vertical du
zénith à une brume chaude d'horizon, et par-dessus un **halo elliptique qui part
du soleil** — écrasé, parce qu'un halo circulaire se lit comme une bulle posée
dans le ciel, quand une nappe étalée se lit comme de la lumière. La lumière a
donc une source, et c'est le repère `dec_soleil` du plan qui la place.

Le soleil et les nuages sont les **pliages de l'artiste** (`soleil`, et le même
nuage sous plusieurs angles), pas des silhouettes tracées
en polygones : même règle que partout ailleurs dans le jeu. Le soleil est le seul
sprite **centré** dans sa boîte de plan et non calé sur le bas : il ne repose sur
rien.

Les nuages sont **semés au hasard**, mais d'un hasard à graine fixe : une valeur
par scène, tirée une fois pour toutes. On obtient l'irrégularité qu'aucune table
écrite à la main ne donne vraiment, sans que le ciel se rejoue à chaque passage —
un joueur qui revient de la scène d'à côté doit retrouver la sienne, sinon le
retour se lit comme un bug. Leur emprise est la bande `dec_nuages` du plan
Tiled ; leur nombre et leur dispersion sont une décision de dessin et vivent dans
le code. Un nuage ne remplit jamais sa bande : la marge qui reste sert à les
décaler en hauteur, ce qui compte bien plus pour la lecture du ciel que leur
taille.

Ils **dérivent** vers la droite, très lentement — de 4 à 11 px par seconde, une
traversée d'écran en deux à cinq minutes. Chacun a sa vitesse, et c'est ce
décalage qui donne la profondeur : à vitesse commune, la rangée entière glisse
comme un seul décor peint. Le mouvement doit rester sous le seuil où l'œil le
suit, sinon il concurrence le battement des marqueurs, qui est le seul mouvement
du jeu à demander l'attention.

Le ciel, son soleil et ses nuages vivent **sous** le décor (profondeurs
négatives), de sorte qu'un rempart passe devant les nuages.

## Palette

Définie dans `src/game/config.ts`.

| Rôle                  | Usage                                         |
| --------------------- | --------------------------------------------- |
| `paper` / `paperDark` | le papier, les origamis, le texte             |
| `ink`                 | les fonds sombres, les contours               |
| `wood` / `woodDark`   | le mobilier, les décors                       |
| `accent` (terracotta) | les plis, les actions, ce qui répond au doigt |
| `glow` (jaune chaud)  | les sources de lumière                        |

L'accent terracotta sert aux **traits de pli** dans les crease patterns comme aux
**boutons pressés** : c'est la couleur de ce qui se plie et de ce qui réagit.

## Le papier des origamis

Une feuille d'origami a **deux faces qui ne se ressemblent pas**, et c'est ce qui
rend un pliage lisible : le verso n'apparaît qu'aux endroits où le papier s'est
retourné, donc il _dessine les plis_. Un modèle uniformément blanc se lit comme
une bosse.

Chaque modèle a donc son papier, déclaré dans
[`src/origami/papier.ts`](../src/origami/papier.ts) :

| Modèle | Recto (ce qu'on voit) | Verso (ce que les plis retournent) |
| ------ | --------------------- | ---------------------------------- |
| pont   | papier                | bois                               |
| arbre  | feuille verte         | bois — c'est lui qui fait le tronc |
| hache  | métal poli            | marron                             |
| porte  | **papier noir**       | bois, comme l'arbre                |

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
patterns sont _plats_ : le solveur les replie dans leur propre plan, il n'en sort
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
- **Les marqueurs portent leur ombre.** La cocotte et la flèche de sortie sont
  redessinées en sombre juste en dessous d'elles-mêmes, un peu dilatées et
  décalées vers le bas. Ces deux pliages sont en papier clair : posés sur une
  feuille de papier ou sur une rive au soleil ils disparaissaient, alors qu'ils
  sont le seul signe qui dise « ici, on peut agir ».
- **Rien dans les coins hauts.** Sur un grand téléphone tenu à deux mains en
  paysage, le haut de l'écran est hors d'atteinte du pouce.
- **L'UI ne rétrécit pas indéfiniment.** Le décor est mis à l'échelle, pas les
  boutons : `--ui-scale` ne descend pas sous 0.62.

## Orientation

Le jeu est **verrouillé en paysage**. En portrait, une invite « Tourne ton
téléphone » couvre l'écran (CSS pur, `@media (orientation: portrait)`).

Nécessaire : l'option d'orientation d'itch.io n'est qu'une suggestion au
navigateur, elle ne force rien.
