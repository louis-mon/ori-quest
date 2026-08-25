# Ori-Quest — contexte projet

Jeu **point & click** en HTML5, jouable au navigateur **mobile**, destiné à être
publié sur **itch.io**. Particularité : les animations d'origami sont générées
automatiquement à partir de crease patterns, pas modélisées à la main.

Le jeu est en **français**. Code, commentaires et documentation aussi.

## À lire avant de coder

- `game-design/` — la boucle de jeu, la structure en chapitres, le langage
  visuel. **Toute décision de game design va là**, pas dans les commentaires.
- `README.md` — installation, pipeline origami, publication itch.io.

## Environnement

Vite exige Node ≥ 18. Le défaut de la machine est désormais la **LTS courante**
(alias nvm `default -> lts/*`, aujourd'hui 24.19.0) et `.nvmrc` épingle la même
version : `nvm use` avant `npm run dev` reste le réflexe, mais ce n'est plus un
piège. Un `Cannot find module 'node:path'` au démarrage signifie qu'un shell
tourne encore sur un node antérieur — `nvm use` suffit.

## Commandes

```bash
nvm use && npm install
npm run dev                      # serveur de dev (suit ink + plans de scène)
npm run build                    # typecheck + build de production
npm run scenes                   # cartes Tiled des scènes -> src/generated/scenes/
npm run enigmes                  # découpages des énigmes -> src/generated/enigmes.ts
npm run check-puzzle             # un découpage a-t-il une solution unique ?
npm run bake -- <cp.svg> --name <nom>   # crease pattern -> animation .origami
npm run zip                      # dist/ -> zip vérifié pour itch.io
npm run format                   # Prettier sur le code
```

Le style de Prettier est celui du code déjà écrit — guillemets simples, largeur
100 —, relevé sur lui plutôt que choisi : `.prettierrc` ne dit que ces deux
lignes, tout le reste vient de Prettier tel quel.

Trois exclusions, et la même raison pour les trois — **on ne reformate pas ce
qu'un outil écrit**, le diff serait défait au passage suivant. Les `.json` de
`public/assets/` sortent de `npm run bake`, ceux de `game-design/enigmes/` de
`decoupage.html`. Et la documentation reste écrite à la main : Prettier impose
`_italique_` là où le projet écrit `*italique*`, et ce choix-là n'est pas
réglable.

`npm run bake` nécessite `npx playwright install chromium` une fois.

## Stack et contraintes de licence

Phaser 4 · TypeScript · Vite · inkjs (narration) · three.js (origami) —
**tout en MIT**.

**Ne pas introduire `rabbit-ear`** : la bibliothèque est excellente mais en
**GPLv3**, et la lier dans le bundle obligerait à publier le jeu entier sous
GPLv3. Si un besoin de maths origami apparaît, l'utiliser en outil de build
(Node, hors bundle) ou chercher une alternative permissive.

## Architecture — les décisions à ne pas défaire

**L'UI est en DOM, pas dans le canvas.** Dialogues, inventaire et menus vivent
dans `src/ui/`, au-dessus du canvas Phaser. Le texte reste net à toutes les
densités, le retour à la ligne est gratuit, et la mise en page s'itère en CSS.
`syncStage()` (dans `main.ts`) recale cette couche sur le canvas à chaque
redimensionnement — sans ça l'UI dérive sur les bandes du letterbox, ce qui
arrive sur à peu près tous les téléphones.

**Les effets de jeu passent par des tags ink**, pas par du code par hotspot :

```ink
Le papier frémit, puis se plie de lui-même. # origami: crane # flag: folded_crane
```

Ajouter un effet = une entrée dans `handlers` (`src/game/systems/dialogue.ts`).
Ne pas contourner ce mécanisme en appelant la logique de jeu depuis une scène.
Le serveur de dev suit `content/story.ink` comme il suit les cartes :
enregistrer recompile et recharge la page, et un ink cassé laisse en place la
dernière version valide, l'erreur et son numéro de ligne allant au terminal.

**Les scènes sont pilotées par des données.** Les hotspots sont une liste d'objets
dans la scène, pas du code impératif. Garder ce style : c'est ce qui rend le
contenu ajoutable sans toucher à la logique.

**Une idée est un objet d'inventaire comme un autre.** Même `# give:`, même
condition `has_` dans ink, même liste. Seul l'affichage les distingue, à partir
du préfixe `idee_` (bulle arrondie). Ne pas créer de mécanisme parallèle pour
les idées : le joueur n'a jamais l'idée *et* l'objet en même temps. **Tout se consomme**, idées comprises : ce qui a servi est retiré (`# drop:`),
sinon la colonne s'allonge sur un jeu qui se finit vite. Ce qui doit rester
acquis — un dialogue déjà tenu, un fait appris — est un **drapeau**, pas un
objet : conditionner une scène de première rencontre sur la possession d'une
idée la fait rejouer dès l'idée dépensée. Voir `src/game/systems/objets.ts`.

**Obtenir un objet se montre, et ça part du centre.** Le playtest a montré que
les joueurs ignoraient et l'objet reçu et l'existence de l'inventaire : la
colonne est en haut à gauche, ils lisent en bas, et rien ne bougeait. La vignette
vole donc du centre du cadre jusqu'à sa case, un bandeau la nomme contre la
colonne, et la colonne ne s'efface plus quand elle est vide. **Le départ est le
centre pour tous les objets** — c'est déjà l'endroit où ce jeu montre (pliage,
objet examiné, but de l'énigme, feuille du tutoriel), alors qu'un départ depuis
la source dans le décor serait faux dès la deuxième idée : elle se forme dans la
tête du héros, pas dans le corps de son interlocuteur. Voir `src/ui/obtention.ts`
et `game-design/04-interface.md`.

Deux pièges à ne pas défaire. **Le vol se déclenche sur le tag `# give:`**
(`donner()` dans `main.ts`), jamais sur un changement d'inventaire :
`gameState.give()` sert aussi à charger une sauvegarde et à sauter à un point
d'étape, où faire voler trois objets à la file n'a aucun sens. Et
**`renderInventory()` rend par identifiant, sans jamais repartir d'un `innerHTML`
vide** : la colonne se redessine à chaque changement d'état, drapeau compris — en
la reconstruisant, un vol en cours perd la case où il doit se poser et toutes les
cases rejouent leur arrivée à chaque objet ramassé ailleurs.

**Le décor ne dessine pas les origamis.** Le pont posé, le vieil arbre, la porte
en place sont les fichiers `.origami` eux-mêmes, rendus en 3D et posés dans la
scène (`src/game/scenes/origami-decor.ts`). Idem pour le but affiché pendant
l'énigme et les vignettes d'inventaire. Ce qui n'a pas besoin d'être animé — les
deux marqueurs de l'interface, le soleil, les nuages, le jeune arbre — est
**photographié chez l'artiste** et intégré en PNG (`tools/detourer-png.py`),
jamais tracé en polygones. Les dessins d'appoint qui tenaient la place
finissaient toujours par diverger du pliage — le joueur regardait une animation
et la scène montrait autre chose. **Ne pas réintroduire de graphisme « qui
ressemble »** : si un modèle rend mal, c'est le crease pattern, l'angle
(`src/origami/vue.ts`) ou le papier (`src/origami/papier.ts`) qu'on corrige.

**Le terrain non plus n'est pas dessiné.** Le sol, le ravin, le rempart sont
l'image de l'artiste, désignée par un **calque image de classe `fond`** dans la
carte Tiled et posée par `src/game/scenes/fond.ts`. Le calque pointe directement
le fichier de `public/` : on ajuste donc les zones tactiles, dans l'éditeur, sur
les pixels que le joueur aura sous les yeux. Les aplats de couleur qui tenaient
la place ont été retirés, et ne doivent pas revenir — même raison que pour les
pliages. **Seul le ciel reste peint** (`ciel.ts`), parce qu'il l'est vraiment :
un dégradé calé sur l'horizon du plan, avec son soleil et ses nuages, et le fond
est livré transparent au-dessus de l'horizon pour les laisser passer derrière le
rempart.

**La zone tactile suit le dessin, pas la boîte du plan.** Une boîte de plan est
une emprise ; le graphisme y est ajusté sans déformation et n'en occupe qu'une
partie. `caler()` (dans `PointClickScene`) recale la zone sur ce qui est
réellement à l'écran, y compris quand ça change avec l'état.

**Et la cocotte suit le sujet, pas le centre.** Une emprise est un rectangle, un
pliage n'en est pas un : au centre de la sienne, le marqueur du renard tombait
dans le creux entre son dos et sa queue — sur le rempart, où il se perdait — et
celui du jeune arbre à mi-tronc plutôt que dans le feuillage. Où il se pose est
alors un objet de classe **`marqueur`** dans la carte, **tracé au point** et
portant le **nom de la zone** qu'il désigne. C'est ce nom qui les relie : la
scène n'écrit rien, le point voyage avec la zone. Pas non plus de décalage en
pixels dans le code — c'est de la géométrie, elle vit dans le plan, sur les
pixels du dessin. L'import refuse un marqueur qui ne désigne aucune zone, qui
tombe hors de la sienne, dont le nom est ambigu ou qui n'est pas un point : un
lien tenu par une convention de nommage doit être vérifié, sinon il se défait en
silence le jour où l'on renomme une zone.

**La carte Tiled est la source de vérité de la géométrie.** Chaque scène a un
plan dans `game-design/scenes/`, dessiné à l'échelle 1280×720 dans
[Tiled](https://www.mapeditor.org/) ; `npm run scenes` en tire les zones. La
scène ne déclare plus que le *sens* de chacune — libellé, verbes, condition
d'apparition — et croise les deux avec `hotspotsFrom()`. Le serveur de dev
surveille les cartes : enregistrer dans Tiled suffit, il n'y a pas de commande à
relancer. Voir `game-design/06-plans-de-scene.md`.

**Déplacer ou redimensionner quoi que ce soit de visible se corrige dans la
carte, jamais dans la scène.** Le plan généré est figé en `as const` et le
compilateur en tire la liste exacte des noms : `boxOf(PLAN, 'dec_nuages')` ne
compile pas tant que `nuages` n'existe pas dans la carte. C'est délibéré — le
code ne doit pas pouvoir inventer une zone que le plan ne connaît pas, sinon les
deux divergent et il faut les resynchroniser à la main.

**Le découpage des énigmes se dessine aussi, et ailleurs que dans le code.** Il
vit dans `game-design/enigmes/<nom>.json`, se trace dans
`http://localhost:5173/decoupage.html` (page de développement, hors build) et
arrive au jeu par `src/generated/enigmes.ts`. `puzzles.ts` ne dit plus que le
motif, le modèle et le titre.

L'éditeur ne dessine pas des pièces, il trace des **coupes** : le carré entier
est la première pièce, chaque trait en fend une en deux. Le pavage est donc exact
par construction et tous les sommets tombent sur la grille d'ancrage — les deux
choses dont le minijeu a besoin, et qu'un éditeur de polygones aurait laissées à
la main. Une pièce est un polygone quelconque, détouré au rendu (`clipPath` +
`drop-shadow`) ; **ne pas revenir à des rectangles**, ni tester les
recouvrements sur les boîtes : deux pièces voisines partagent une arête entière,
d'où les masques de `src/game/puzzle/decoupage.ts`.

**Le tutoriel se joue par-dessus l'énigme, pas à côté.** Ce que la grenouille
explique — le pli vallée, à la première énigme — se montre sur le plateau que le
joueur a sous les yeux : une flèche désigne une pièce, la pièce va se poser, et
la feuille de démonstration apparaît au centre. Le moteur est
`src/game/puzzle/tutoriel.ts`, le texte et l'enchaînement sont des données dans
`tutoriels.ts`, qui se relit comme un storyboard.

**La démonstration ne pose une pièce que sur un plateau vide**, et jamais dans
une énigme dont ce tutoriel n'est pas celui d'origine. Les deux conditions
disent la même chose : un tutoriel explique, il ne résout pas. Plateau vide, le
vrac étant tiré d'une graine fixe, c'est toujours **la même** pièce qui part —
rejouer ne donne donc rien de plus que la première fois. Sans cette règle,
quatre lectures du tutoriel suffisaient à résoudre le pont.

**Ce texte-là n'est pas dans ink, et c'est le seul du jeu.** Un tutoriel se joue
pendant que le récit *attend* le verdict de l'énigme (`# puzzle:`) :
`DialogueRunner` n'a qu'une instance de `Story` et refuse d'être relancé pendant
qu'il tourne. Le tutoriel écrit donc directement dans la boîte de dialogue, qui,
elle, est libre. Ne pas « corriger » ça en déplaçant les répliques dans
`story.ink` : elles ne s'afficheraient jamais.

**Le pli de démonstration est un vrai pliage**, `content/origami/vallee.svg`
baké comme les autres, et le trait bleu est **peint dans la texture du papier**
(`papierTrace`, dans `papier.ts`). Les UV étant lues sur la feuille à plat, le
trait est imprimé sur le papier et se plie avec lui : le joueur voit la ligne
qu'il a regardé se tracer devenir l'arête du pli. Un trait posé en surimpression
resterait droit pendant que le papier se plie. Il n'est peint que **sur la face
de devant** : on trace un pli *sur* une feuille, on n'imprime pas un schéma à
travers. Peint des deux côtés, il ressortait sur les rabats que le pliage
retourne, et le joueur voyait des lignes de couleur là où il n'avait jamais rien
vu dessiner.

**Les feuilles de démonstration ont un verso** (`PAPIERS.vallee`, `montagne`,
`bombe`), comme n'importe quel modèle du jeu, et pour la même raison : sans lui,
le papier replié n'est qu'un aplat clair où le pli ne se lit qu'à l'ombre. C'est
le bois du pont qui se retourne, et c'est lui qui rend le pliage lisible — et
elles le partagent toutes les trois, pour qu'on reconnaisse *la feuille sur
laquelle on explique* d'un tutoriel à l'autre.

**Elle est posée, pas présentée** (`posee`, dans `OrigamiLayer.load`) : bien à
plat devant le joueur, **d'aplomb** et **sans balancement**. Un carré s'y voit
donc comme un carré. Deux façons de rater ça, toutes deux essayées :

- la laisser dans le plan du solveur — elle y est plate *pour de vrai*, mais la
  caméra du jeu la regarde de 70° au-dessus et la projette en **trapèze** ;
- la tourner avec `quaternionFeuille`, qui pointe sa normale vers l'œil mais
  laisse le **roulis au hasard** : elle arrive de travers de quelques degrés.
  D'où `quaternionFeuilleDeFace`, qui construit la rotation sur le repère de
  l'image.

Le balancement, lui, dit « c'est un volume » d'un objet qu'on présente ; sur une
feuille qu'on regarde longuement, qu'on décrit et sur laquelle on trace un pli,
il dit « elle tangue ».

**Un dialogue n'avance jamais tout seul.** Une réplique ne remplace la
précédente que sur un **tap du joueur** — jamais parce qu'une animation vient de
se terminer. Le piège se pose de lui-même dès qu'un effet se joue entre deux
répliques : le joueur tape pour lancer ce qu'il va regarder, ce tap-là est
dépensé, et sans rien de plus la ligne suivante prend la place à la seconde où
l'effet finit. Un tap, deux avancées, et le texte change sous les yeux de
quelqu'un qui regardait ailleurs.

`Overlay.attendreUnTap()` attend **sans rien changer à l'écran** : la réplique
en place sert de légende à ce qu'on montre, et le chevron dit quoi faire pour la
suite. `jouer()` (`puzzle/tutoriel.ts`) l'appelle après tout effet ; `pump()`
(`systems/dialogue.ts`) l'appelle quand le tap a été dépensé avant la fin d'un
`# origami:`, et seulement dans ce cas — une réplique se lit plus longtemps
qu'un pliage ne dure, donc le cas courant n'a pas de tap en plus.

**Et il n'avance qu'une fois par tap.** Deux contacts rapprochés — le doigt qui
rebondit, l'impatience de qui enchaîne — dépensaient deux répliques : la seconde
s'affichait et disparaissait sans avoir été lue, et rien dans le jeu ne revient
en arrière. Une attente de tap fraîchement ouverte ignore donc les taps pendant
`DELAI_ANTI_TAP` (`src/ui/overlay.ts`), **choix compris** — c'est même là que ça
compte le plus : un tap de trop sur une réplique arrive pile quand les choix la
remplacent, et prend alors une branche que personne n'a lue.

Ce délai est **nul en développement**, où l'on traverse le récit dix fois par
heure pour aller vérifier autre chose. `VITE_DELAI_TAP=300 npm run dev` le
rallume le temps de le régler — c'est ce que fait la configuration « ori-quest
(délai de tap) » de `.claude/launch.json` — et `npm run preview` donne le
comportement livré sans rien régler du tout.

**Trois couches à ne pas intervertir** : l'énigme est à `z-index: 4`, le voile du
tutoriel à 5, la boîte de dialogue à 6 (`Overlay.mettreDevant()`), la fenêtre de
confirmation à 7, le vol d'obtention et son bandeau à 8 — ces deux-là sont
fugaces et ne peuvent pas être à l'écran en même temps que la confirmation, mais
ils doivent passer devant la réplique qu'on est en train de lire. D'où le fait
que `.tuto` ne soit **pas positionné** : positionné, il ferait contexte
d'empilement et ses enfants ne pourraient plus encadrer la boîte de dialogue. Et le voile est là dès la première réplique, transparent :
c'est lui qui absorbe les taps destinés à l'énigme, il ne s'assombrit que pour la
démonstration.

**La flèche du tutoriel est un SVG, pas le pliage de l'artiste.** Le marqueur de
sortie (`assets/ui/fleche.png`) fait partie du décor et attend qu'on le
remarque ; celle du tutoriel interrompt une explication pour dire « regarde ça,
maintenant ». Deux fonctions, deux signes — et c'est aussi pour ça qu'elle est
grande et qu'elle désigne pendant trois secondes.

**Une réplique coupée doit être résolue, pas abandonnée.** Le bouton « Passer »
interrompt le tutoriel au milieu d'un `overlay.say()` qui attend un tap : sans
`Overlay.interrompre()`, le compteur de lignes reste levé, `occupeLeJoueur` reste
vrai pour toujours, et le décor cesse de répondre aux taps sans qu'on comprenne
pourquoi.

**Une coupe ne longe jamais un pli** (`longeUnPli`, dans `src/dev/couper.ts`) :
un pli posé sur une arête de découpe est fendu en deux dans la longueur, chaque
pièce en montrant la moitié — et l'arête révèle alors où passe le pli. La règle
est tenue par l'éditeur, là où l'on trace.

L'unicité de la solution est calculée par `tools/lib/decoupage.mjs`, et par lui
seul : l'éditeur l'affiche après chaque coupe en passant par un point d'entrée du
serveur de dev, l'import la revérifie, `npm run check-puzzle` la détaille. Une
seconde implémentation côté navigateur finirait par répondre autre chose que le
jeu.

Ce qui reste permis, et doit le rester : les positions **dérivées** d'une zone
nommée. Cinq nuages répartis sur `dec_nuages`, le feuillage calculé sur
`hs_arbre` — on ne pose pas un repère de plan par nuage. La ligne : *où vit un
élément* appartient au plan, *comment il est dessiné à l'intérieur* appartient au
code. Un pixel absolu qui ne dérive d'aucune boîte est le signe qu'il manque un
repère dans la carte.

## Pièges déjà rencontrés (ne pas les redécouvrir)

**Bake origami** — changer `globals.creasePercent` ne suffit pas : il faut lever
`globals.shouldChangeCreasePercent = true`, sinon le solveur tourne indéfiniment
sur la valeur figée à l'initialisation des shaders et toutes les poses sortent
identiques.

**Un crease pattern ne supporte pas de commentaire XML.** Le même carré à une
diagonale sortait à **440 sommets et 798 faces** avec un `<!-- … -->` glissé
avant `<svg>`, et le solveur le froissait au lieu de le plier ; sans le
commentaire, 4 sommets, 2 faces, un pli net et un fichier 100 fois plus léger.
Les CP du projet sont des exports ORIPA : garder cette forme exacte, et
documenter le fichier ailleurs — dans `tutoriels.ts` ou ici.

**Le solveur plie symétriquement.** Rien n'ancre une moitié du papier : sur un
pli unique, les **deux** faces tournent autour de l'arête, et le résultat à 100 %
est un plan perpendiculaire à la feuille de départ, pas la feuille repliée sur
elle-même. Conséquence pratique : la pose d'un tel modèle ne se devine pas plus
que les autres, et vue dans l'axe du pli elle donne un fuseau illisible. Se
régler dans `orientation.html`, comme le reste.

**Chaque modèle a son orientation, et elle se règle à l'œil.** Rien dans un
crease pattern ne dit comment le pliage se présentera — où tombe le manche, de
quel côté est le tronc. C'est `POSES` (`src/origami/poses.ts`) — orientation,
taux de pliage et taille dans le décor, par modèle — et ça se règle avec
`http://localhost:5173/orientation.html` (page de développement, hors build)
plutôt qu'en devinant des angles.

**`src/origami/poses.ts` est écrit par cet outil**, pas à la main : son bouton
« Enregistrer » passe par un point d'entrée du serveur de dev
(`vite.config.ts`), qui ne garde que des nombres bornés et ne connaît que ce
fichier. Ce qu'on ajouterait à la main dans le bloc `POSES` serait effacé au
réglage suivant. La caméra, elle, ne bouge pas : elle
n'a **aucune composante en X**, faute de quoi l'image se cisaille et les modèles
rectangulaires sortent de travers.

**Un modèle peut finir retourné.** Beaucoup de pliages se terminent la face
arrière du papier vers le haut, et rien dans le crease pattern ne le dit à
l'avance — ça se constate en regardant le rendu. Sans le drapeau `retourne` de
`PAPIERS` (`src/origami/papier.ts`), la hache sortait en manche marron avec un
éclat de métal au pli, exactement à l'inverse de ce qu'on attend d'une lame.

**Ne jamais montrer un pliage à 100 %.** La pose finale du solveur est souvent
parfaitement plate — le pont y perd toute épaisseur, et l'image d'un objet plat
n'a plus rien d'un origami. On s'arrête au `pliage` de `POSES`
(`src/origami/poses.ts`),
pour l'animation comme pour les images fixes.

**Et à 100 % ça ne rend même plus correctement** : un trait en travers du pliage
et des hachures qui bougent avec la caméra. C'est du **z-fighting**, pas un bug
du solveur. Sur un pli unique, les deux moitiés tournent chacune de 90° (voir
« Le solveur plie symétriquement » plus haut) : à 100 % elles sont **exactement
coplanaires** — l'écart des sommets d'une moitié au plan de l'autre vaut 0,0000
sur `vallee` comme sur `montagne` — et le tampon de profondeur n'a plus de quoi
décider laquelle est devant, donc il tranche pixel par pixel. Les hachures sont
cette indécision, le trait est le bord de la zone où les deux moitiés se
recouvrent.

Ça ne se corrige pas par le rendu — les deux moitiés sont le même mesh et le
même matériau, `polygonOffset` ne les séparerait pas. La correction est
géométrique : s'arrêter un cheveu avant. Quelques pourcents suffisent — 3 %
donnent déjà 6 % du côté de la feuille d'écart entre les moitiés, largement de
quoi trancher, et invisible à l'œil.

**`renderer.dispose()` ne rend pas le contexte WebGL.** Le tutoriel créait puis
jetait une couche 3D à chaque lecture ; les contextes s'accumulaient, et
au-delà d'une quinzaine le navigateur tue le **plus ancien** — celui de Phaser.
L'écran clignotait, puis plus rien ne se rendait. Deux réponses, les deux en
place : `forceContextLoss()` avant `dispose()`, et surtout **une seule couche
gardée** pour toute la partie (`demonstration`, dans `tutoriel.ts`), comme
`main.ts` le fait déjà pour celle du récit. Une couche qui doit resservir se
recharge avec `load()` ; `dispose()` est une fin de vie.

**Un contexte WebGL perdu ne lève aucune erreur.** Le rendu continue de
« marcher » et ne produit plus que des images vides : le but de l'énigme, les
vignettes et la feuille du tutoriel disparaissaient sans un mot dans la console.
Les trois couches écoutent donc `webglcontextlost` — l'atelier de `apercu.ts`
se jette lui-même **avec son cache d'images**, `OrigamiLayer` arrête sa boucle,
et `tutoriel.ts` oublie sa couche pour en refabriquer une. Un contexte ne se
répare pas ; ce qui compte est de s'en apercevoir.

**Un singleton asynchrone se mémorise en promesse, pas en objet.** `if (!x) x =
await créer()` laisse passer deux appels rapprochés — l'`await` rend la main
avant l'affectation — et chacun fabrique son contexte WebGL, dont l'un reste
orphelin pour toujours. C'est comme ça que le tutoriel finissait par faire tuer
celui de Phaser. Mémoriser la **promesse**, posée avant le premier `await`,
règle le cas ; `fold-file.ts` fait déjà ça pour les `.origami`.

**`hidden` est une propriété de `HTMLElement`, pas de `SVGElement`.**
`svg.hidden = false` pose une propriété JavaScript sur l'objet sans rien retirer
du DOM : la règle `[hidden]` continue de s'appliquer et l'élément reste
invisible, sans erreur nulle part. La flèche du tutoriel ne s'est jamais montrée
le jour où elle est passée d'un `<img>` à un `<svg>`. `toggleAttribute('hidden',
…)` marche sur n'importe quel élément.

**Le solveur ne gère pas les collisions entre couches.** Les pliages à peu de
couches (bases, tessellations, Miura-ori) convergent bien ; la grue
traditionnelle ne se referme pas complètement. Augmenter les itérations
n'arrange rien — vérifié, ça donne un résultat *moins* replié. C'est une limite
du modèle physique.

**Hotspots qui se chevauchent** : la profondeur est assignée par surface
croissante (`PontScene`), sinon la grande zone avale les taps destinés au
détail posé dessus.

**`input.windowEvents: false` est indispensable, ne pas le retirer.** Par défaut
Phaser double ses écouteurs de pointeur sur `window` en phase de *capture*. Un
tap sur un bouton de l'interface DOM était donc traité par le jeu **avant**
d'atteindre le bouton, et déclenchait le hotspot situé dessous : appuyer sur
« Recommencer » ouvrait la confirmation *et* lançait le dialogue de l'étagère
derrière. Arrêter la propagation côté DOM ne suffit pas — la capture passe
avant. Le canvas ne reçoit que des taps — le seul glisser du jeu, celui des
pièces d'énigme, vit dans la couche DOM et s'appuie sur `setPointerCapture`,
qui suit le doigt même hors cadre. Se limiter au canvas ne
coûte rien.

**Le plein écran s'applique à `#app`**, jamais au canvas seul : l'interface vit
dans des éléments frères et disparaîtrait. À noter, Safari sur iPhone
n'implémente toujours pas l'API plein écran pour un élément quelconque —
l'entrée de menu est masquée quand `document.fullscreenEnabled` est faux.

**La CSS des pages de développement passe par un `import` du module**, pas par
un `<link>` dans le HTML. Sur `<link href="/src/dev/*.css">`, le navigateur
garde sa copie et une règle ajoutée n'arrive jamais à la page : l'éditeur de
découpage s'est retrouvé tout noir, ses nouveaux tracés n'ayant plus de règle et
retombant sur le `fill` noir par défaut de SVG. Importée depuis le TypeScript,
la feuille entre dans le graphe de modules et suit le HMR comme le reste.

**itch.io** : `index.html` à la racine du zip, chemins relatifs (`base: './'`),
et laisser **SharedArrayBuffer décoché** — son implémentation itch.io casse le
chargement hors Chrome.

## Mobile — non négociable

- Pas de survol : tout doit être atteignable au tap.
- Cibles tactiles à 44 px **réels** minimum, même quand le décor rétrécit.
- Le jeu est **verrouillé en paysage** (1280×720) ; une invite CSS couvre le
  portrait.
- Audio débloqué au premier `pointerdown` (obligatoire sur iOS).
- Viser < 30 Mo au total. `npm run build` donne le détail par chunk, en gzip.

## Vérifier son travail

Le projet a un serveur de dev et un navigateur pilotable : **regarder le
résultat** plutôt que de supposer qu'il marche. `npx tsc --noEmit` doit passer
avant de considérer une tâche terminée.
