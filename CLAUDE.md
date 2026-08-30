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

Vite exige Node ≥ 18 ; `.nvmrc` épingle la LTS courante. Un
`Cannot find module 'node:path'` au démarrage signifie qu'un shell tourne encore
sur un node antérieur — `nvm use` suffit.

## Commandes

```bash
nvm use && npm install
npm run dev                      # serveur de dev (suit ink + plans de scène)
npm run build                    # typecheck + build de production
npm run prod                     # build, puis le sert : le jeu tel que livré
npm run scenes                   # cartes Tiled des scènes -> src/generated/scenes/
npm run enigmes                  # découpages des énigmes -> src/generated/enigmes.ts
npm run check-puzzle             # un découpage a-t-il une solution unique ?
npm run check-story              # un menu de dialogue peut-il se vider ?
npm run bake -- <cp.svg> --name <nom>   # crease pattern -> animation .origami
npm run zip                      # dist/ -> zip vérifié pour itch.io
npm run itch                     # dist/ -> itch.io par butler (page laissée en Draft)
npm run format                   # Prettier sur le code
```

`npm run bake` nécessite `npx playwright install chromium` une fois.

Prettier a trois exclusions, et la même raison pour les trois — **on ne reformate
pas ce qu'un outil écrit**, le diff serait défait au passage suivant : les
`.json` de `public/assets/` (sortie de `npm run bake`), ceux de
`game-design/enigmes/` (sortie de `decoupage.html`), et la documentation, où
Prettier impose `_italique_` là où le projet écrit `*italique*`.

## Stack et contraintes de licence

Phaser 4 · TypeScript · Vite · inkjs (narration) · three.js (origami) —
**tout en MIT**.

**Ne pas introduire `rabbit-ear`** : la bibliothèque est excellente mais en
**GPLv3**, et la lier dans le bundle obligerait à publier le jeu entier sous
GPLv3. Si un besoin de maths origami apparaît, l'utiliser en outil de build
(Node, hors bundle) ou chercher une alternative permissive.

## Architecture — les décisions à ne pas défaire

**L'UI est en DOM, pas dans le canvas.** Dialogues, inventaire et menus vivent
dans `src/ui/`, au-dessus du canvas Phaser : le texte reste net à toutes les
densités et la mise en page s'itère en CSS. `syncStage()` (`main.ts`) recale
cette couche à chaque redimensionnement, sans quoi l'UI dérive sur les bandes du
letterbox — ce qui arrive sur à peu près tous les téléphones.

**Les effets de jeu passent par des tags ink**, pas par du code par hotspot :

```ink
Le papier frémit, puis se plie de lui-même. # origami: crane # flag: folded_crane
```

Ajouter un effet = une entrée dans `handlers` (`src/game/systems/dialogue.ts`).
Ne pas contourner ce mécanisme en appelant la logique de jeu depuis une scène.
Le serveur de dev suit `content/story.ink` comme il suit les cartes :
enregistrer recompile et recharge, et un ink cassé laisse en place la dernière
version valide, l'erreur et son numéro de ligne allant au terminal.

**Les scènes sont pilotées par des données.** Les hotspots sont une liste
d'objets, pas du code impératif : c'est ce qui rend le contenu ajoutable sans
toucher à la logique.

**Le jeu livré s'arrête à la fin du chapitre 1**, sur « À suivre… » : le chapitre
2 se joue en développement, mais son texte est un premier jet et ses deux scènes
sont encore sur décor provisoire. Ce que cette version embarque tient dans
`src/game/chapitres.ts`, une ligne à changer le jour où le chapitre suivant est
prêt. `goto()` (`main.ts`) y lit qu'une destination n'est pas livrée et pose
l'écran de fin (`src/ui/fin.ts`) au lieu de changer de scène — **sans l'écrire
dans la sauvegarde**, qui doit rester sur une pièce que ce build sait rouvrir.

**Le menu des points d'étape est livré lui aussi**, tant que la page itch.io est
en Draft (`ETAPES_LIVREES`, dans `src/game/systems/etapes.ts`) : un testeur ne
retraverse pas le chapitre pour en atteindre la fin. Il ne propose que les
chapitres que le build embarque — ailleurs, il déposerait le joueur au ravin avec
les drapeaux du chapitre suivant levés.

**La narration, elle, ignore quels chapitres ont été compilés** : le knot de fin
de chapitre se joue en entier, sa dernière réplique comprise, et l'écran prend la
suite. C'est le seul texte du jeu hors d'ink avec celui des tutoriels, et pour
une raison voisine : il parle de la version, pas de l'histoire.

**Une idée est un objet d'inventaire comme un autre.** Même `# give:`, même
condition `has_`, même liste ; seul l'affichage les distingue, à partir du
préfixe `idee_`. Pas de mécanisme parallèle : le joueur n'a jamais l'idée *et*
l'objet en même temps. **Tout se consomme** (`# drop:`), sinon la colonne
s'allonge sur un jeu qui se finit vite — et ce qui doit rester acquis est un
**drapeau**, pas un objet : conditionner une première rencontre sur la possession
d'une idée la fait rejouer dès l'idée dépensée. Voir `src/game/systems/objets.ts`.

**Obtenir un objet se montre, et ça part du centre.** Au playtest, les joueurs
ignoraient et l'objet reçu et l'existence de l'inventaire : la colonne est en
haut à gauche, ils lisent en bas, rien ne bougeait. La vignette vole donc du
centre jusqu'à sa case, un bandeau la nomme, et la colonne ne s'efface plus quand
elle est vide. **Le centre pour tous les objets** : partir de la source dans le
décor serait faux dès la deuxième idée, qui se forme dans la tête du héros.

Deux pièges (`src/ui/obtention.ts`). **Le vol se déclenche sur le tag `# give:`**
(`donner()` dans `main.ts`), jamais sur un changement d'inventaire —
`gameState.give()` sert aussi à charger une sauvegarde. Et **`renderInventory()`
rend par identifiant, sans jamais repartir d'un `innerHTML` vide** : la colonne
se redessine à chaque changement d'état, et la reconstruire fait perdre au vol en
cours la case où il doit se poser.

**Rien de ce qui se plie n'est dessiné.** Le pont posé, le vieil arbre, la porte
sont les `.origami` rendus en 3D (`src/game/scenes/origami-decor.ts`), comme le
but de l'énigme et les vignettes ; le reste — marqueurs, soleil, nuages, jeune
arbre — est **photographié chez l'artiste** (`tools/detourer-png.py`). **Ne pas
réintroduire de graphisme « qui ressemble »** : les dessins d'appoint finissaient
toujours par diverger du pliage, et le joueur regardait une animation pendant que
la scène montrait autre chose. Si un modèle rend mal, c'est le crease pattern,
l'angle (`src/origami/vue.ts`) ou le papier (`src/origami/papier.ts`) qu'on
corrige.

**Une scène dont le fond n'est pas encore peint** prend
`dessinerDecorProvisoire()` (`decor-provisoire.ts`) : des aplats francs et une
mention « décor provisoire » en clair à l'écran. Il tient la place sans prétendre
au fond, et s'enlève en une ligne le jour où l'image arrive — les boîtes du plan,
elles, ne bougent pas.

Le terrain non plus n'est pas dessiné : sol, ravin et rempart sont l'image de
l'artiste, désignée par un **calque image de classe `fond`** qui pointe le
fichier de `public/` — les zones tactiles s'ajustent donc sur les pixels que le
joueur aura sous les yeux. **Seul le ciel reste peint** (`ciel.ts`), le fond
étant livré transparent au-dessus de l'horizon pour laisser passer soleil et
nuages derrière le rempart.

**La zone tactile suit le dessin, pas la boîte du plan.** Une boîte est une
emprise ; le graphisme y est ajusté sans déformation et n'en occupe qu'une
partie. `caler()` (`PointClickScene`) recale la zone sur ce qui est réellement à
l'écran, y compris quand ça change avec l'état.

**Et la cocotte suit le sujet, pas le centre.** Au centre de son emprise, le
marqueur du renard tombait dans le creux entre son dos et sa queue. Où il se pose
est donc un objet de classe **`marqueur`** dans la carte, **tracé au point** et
portant le **nom de la zone** qu'il désigne — pas de décalage en pixels dans le
code. L'import refuse un marqueur qui ne désigne aucune zone, qui tombe hors de
la sienne, dont le nom est ambigu ou qui n'est pas un point : un lien tenu par une
convention de nommage doit être vérifié, sinon il se défait en silence le jour où
l'on renomme une zone.

**La carte Tiled est la source de vérité de la géométrie**, et déplacer ou
redimensionner quoi que ce soit de visible s'y corrige, jamais dans la scène.
Chaque scène a un plan dans `game-design/scenes/`, dessiné à l'échelle 1280×720 ;
`npm run scenes` en tire les zones, la scène ne déclare que le *sens* de chacune,
et le serveur de dev surveille les cartes. Le plan généré étant figé en
`as const`, `boxOf(PLAN, 'dec_nuages')` ne compile pas tant que `nuages` n'existe
pas dans la carte — le code ne doit pas pouvoir inventer une zone que le plan ne
connaît pas. Voir `game-design/06-plans-de-scene.md`.

Restent permises les positions **dérivées** d'une zone nommée : cinq nuages
répartis sur `dec_nuages`, le feuillage calculé sur `hs_arbre`. *Où vit un
élément* appartient au plan, *comment il est dessiné à l'intérieur* appartient au
code ; un pixel absolu qui ne dérive d'aucune boîte est le signe qu'il manque un
repère dans la carte.

**Un déplacement se dessine aussi**, classe `chemin` : une polyligne dont l'ordre
des sommets est le sens de parcours, et dont le premier est la position de
l'objet au départ. Elle ne dit que le trajet — `deplacer()`
(`src/game/scenes/deplacement.ts`) accepte aussi bien un chemin qu'un repère du
plan ou une position, et c'est la scène qui décide de la vitesse. **Sortir de
l'écran ne se dessine qu'à moitié** : le dernier sommet tiré hors cadre donne la
direction, la distance est calculée (`sortie`) parce qu'elle dépend de la taille
de l'objet à l'écran, que la carte ne connaît pas. Et **un déplacement ne bloque
pas la scène** — le décor reste touchable pendant qu'un objet traverse, sauf
`bloquant: true` pour ce qui doit être vu avant qu'on puisse agir.

**Bloquant veut dire vraiment bloquant**, et l'état est **transitoire** : décor
et inventaire cessent de répondre, et les marqueurs s'endorment — grisés,
arrêtés sur une pose stable et non au milieu de leur battement, qu'on lirait
comme un défaut d'affichage. Seul le menu reste atteignable, et il **fige la
scène** (`figerLeJeu`, dans `main.ts`) : sans ça, ce qu'on regardait finit sa
course derrière le panneau. Tout se relève à la fin du trajet **et au
shutdown** — des attentes restées ouvertes rendraient la pièce sourde pour de
bon.

**C'est la narration qui déclenche, la scène qui joue** : `# flag:` lève le
drapeau, `auLeverDe()` (`PointClickScene`) joue le mouvement. Un drapeau **déjà
levé en arrivant** pose l'objet à son arrivée sans rien rejouer, sinon le
dinosaure s'écarte à chaque retour dans la pièce. Et le mouvement attend que la
boîte de dialogue se referme : l'état, lui, n'attend pas.

**Le découpage des énigmes se dessine aussi, et ailleurs que dans le code.** Il
vit dans `game-design/enigmes/<nom>.json`, se trace dans
`http://localhost:5173/decoupage.html` (page de développement, hors build) et
arrive par `src/generated/enigmes.ts` ; `puzzles.ts` ne dit plus que le motif, le
modèle et le titre.

L'éditeur ne dessine pas des pièces, il trace des **coupes** : le carré entier
est la première pièce, chaque trait en fend une en deux, donc le pavage est exact
par construction et tous les sommets tombent sur la grille d'ancrage. Une pièce
est un polygone quelconque, détouré au rendu (`clipPath` + `drop-shadow`) ;
**ne pas revenir à des rectangles**, ni tester les recouvrements sur les boîtes —
deux pièces voisines partagent une arête entière, d'où les masques de
`src/game/puzzle/decoupage.ts`.

**Une coupe ne longe jamais un pli** (`longeUnPli`, dans `src/dev/couper.ts`) :
un pli posé sur une arête de découpe est fendu en deux dans la longueur, et
l'arête révèle alors où il passe.

**L'unicité de la solution est calculée par `tools/lib/decoupage.mjs`, et par lui
seul** — l'éditeur l'affiche après chaque coupe, l'import la revérifie,
`npm run check-puzzle` la détaille. Une seconde implémentation côté navigateur
finirait par répondre autre chose que le jeu.

**Le tutoriel se joue par-dessus l'énigme, pas à côté** : ce que la grenouille
explique se montre sur le plateau que le joueur a sous les yeux. Le moteur est
`src/game/puzzle/tutoriel.ts`, le texte est dans `tutoriels.ts`, qui se relit
comme un storyboard.

**La démonstration ne pose une pièce que sur un plateau vide**, et jamais dans
une énigme dont ce tutoriel n'est pas celui d'origine : un tutoriel explique, il
ne résout pas. Le vrac étant tiré d'une graine fixe, c'est toujours **la même**
pièce qui part ; sans cette règle, quatre lectures résolvaient le pont.

**Ce texte-là n'est pas dans ink, et c'est le seul du jeu.** Un tutoriel se joue
pendant que le récit *attend* le verdict de l'énigme (`# puzzle:`), et
`DialogueRunner` n'a qu'une instance de `Story` qui refuse d'être relancée
pendant qu'elle tourne. Déplacé dans `story.ink`, il ne s'afficherait jamais.

**Le pli de démonstration est un vrai pliage**, baké comme les autres, et le
trait bleu est **peint dans la texture du papier** (`papierTrace`, dans
`papier.ts`) : les UV étant lues sur la feuille à plat, il se plie avec elle et
devient l'arête du pli sous les yeux du joueur, là où un trait en surimpression
resterait droit. Peint **sur la face de devant seulement** — des deux côtés, il
ressortait sur les rabats que le pliage retourne, là où le joueur n'avait rien vu
dessiner.

Ces feuilles ont un **verso** (`PAPIERS.vallee`, `pli_montagne`, `bombe`), et le même
pour les trois : sans lui le papier replié n'est qu'un aplat clair où le pli ne
se lit qu'à l'ombre, et c'est le partage qui fait reconnaître *la feuille sur
laquelle on explique* d'un tutoriel à l'autre.

**Elle est posée, pas présentée** (`posee`, dans `OrigamiLayer.load`) : à plat,
d'aplomb, sans balancement, pour qu'un carré s'y voie comme un carré. Deux façons
de rater ça, toutes deux essayées — la laisser dans le plan du solveur, où la
caméra la regarde de 70° au-dessus et la projette en **trapèze** ; ou la tourner
avec `quaternionFeuille`, qui pointe sa normale vers l'œil mais laisse le
**roulis au hasard**. D'où `quaternionFeuilleDeFace`, construit sur le repère de
l'image.

**Un dialogue n'avance jamais tout seul** : une réplique ne remplace la
précédente que sur un **tap du joueur**, jamais parce qu'une animation vient de
se terminer. Le piège se pose dès qu'un effet se joue entre deux répliques — le
tap qui lance l'effet est dépensé, et sans rien de plus la ligne suivante prend
la place à la seconde où l'effet finit. D'où `Overlay.attendreUnTap()`, qui
attend **sans rien changer à l'écran**, la réplique en place servant de légende.
`jouer()` (`puzzle/tutoriel.ts`) l'appelle après tout effet ; `pump()`
(`systems/dialogue.ts`) seulement quand le tap a été dépensé avant la fin d'un
`# origami:` — une réplique se lit plus longtemps qu'un pliage ne dure.

**Et il n'avance qu'une fois par tap.** Deux contacts rapprochés dépensaient deux
répliques, et rien dans le jeu ne revient en arrière. Une attente fraîchement
ouverte ignore donc les taps pendant `DELAI_ANTI_TAP` (`src/ui/overlay.ts`),
**choix compris** — c'est même là que ça compte le plus, un tap de trop prenant
une branche que personne n'a lue. Le délai est **nul en développement** ;
`VITE_DELAI_TAP=300 npm run dev` le rallume, `npm run preview` donne le
comportement livré.

**Des couches à ne pas intervertir** : l'énigme à `z-index: 4`, le voile du
tutoriel à 5, la boîte de dialogue à 6 (`Overlay.mettreDevant()`), la
confirmation à 7, le vol d'obtention et son bandeau à 8, l'écran de fin à 9 —
au-dessus du menu, seul écran du jeu dans ce cas : la partie est finie, il n'y a
plus rien à reprendre. D'où le fait que `.tuto`
ne soit **pas positionné** : positionné, il ferait contexte d'empilement et ses
enfants ne pourraient plus encadrer la boîte de dialogue.

**Le menu passe au-dessus de tout ça** — voile à 6, bouton et panneau à 7,
fenêtres à 8 — parce que plein écran et remise à zéro doivent rester atteignables
énigme ouverte ; sans `z-index`, le bouton restait **dessiné mais inerte** sous le
tas de pièces. Attention à l'ordre du DOM, qui départage à `z-index` égal :
l'énigme est montée bien après le menu, donc un voile de menu à 4 passerait
dessous.

Le tutoriel comme le menu ont leur **voile**, transparent et plein cadre, et pour
la même raison : celui du tutoriel absorbe les taps destinés à l'énigme (il ne
s'assombrit que pour la démonstration), celui du menu ceux qui le referment —
sans quoi le même geste déclenche au passage le hotspot du décor.
`input.windowEvents: false` garde Phaser sur le canvas, mais le tap y est traité
**puis** remonte jusqu'à l'écouteur `window`, et `occupeLeJoueur` ne connaît que
la boîte de dialogue et le menu de verbes.

**La flèche du tutoriel est un SVG, pas le pliage de l'artiste.** Le marqueur de
sortie (`assets/ui/fleche.png`) fait partie du décor et attend qu'on le
remarque ; celle du tutoriel interrompt une explication pour dire « regarde ça,
maintenant ». Deux fonctions, deux signes.

**Une réplique coupée doit être résolue, pas abandonnée.** Le bouton « Passer »
interrompt le tutoriel au milieu d'un `overlay.say()` qui attend un tap : sans
`Overlay.interrompre()`, le compteur de lignes reste levé, `occupeLeJoueur` reste
vrai pour toujours, et le décor cesse de répondre aux taps.

## Pièges déjà rencontrés (ne pas les redécouvrir)

**Bake origami** — changer `globals.creasePercent` ne suffit pas : il faut lever
`globals.shouldChangeCreasePercent = true`, sinon le solveur tourne indéfiniment
sur la valeur figée à l'initialisation des shaders et toutes les poses sortent
identiques.

**Un crease pattern ne supporte pas non plus deux écritures du même point.**
ORIPA exporte `585.7864376268969` d'un bout de trait et `585.7864376269122` de
l'autre, et des zéros en `5.55E-14` : le pot sortait à **440 sommets et 798
faces** — exactement le symptôme du commentaire XML ci-dessous — au lieu de 18,
et le solveur le froissait. Les coordonnées sont donc **arrondies à six
décimales à l'intégration**, dans `content/origami/` comme dans
`public/assets/enigmes/<nom>/solution.svg`, qui doivent rester identiques.

**Un crease pattern ne supporte pas de commentaire XML.** Le même carré à une
diagonale sortait à **440 sommets et 798 faces** avec un `<!-- … -->` glissé avant
`<svg>`, et le solveur le froissait au lieu de le plier ; sans le commentaire,
4 sommets et 2 faces. Les CP du projet sont des exports ORIPA : garder cette
forme exacte, et documenter le fichier ailleurs.

**Le solveur plie symétriquement.** Rien n'ancre une moitié du papier : sur un
pli unique, les **deux** faces tournent autour de l'arête, et le résultat à 100 %
est un plan perpendiculaire à la feuille de départ, pas la feuille repliée sur
elle-même.

**Chaque modèle a son orientation, et elle se règle à l'œil.** Rien dans un
crease pattern ne dit où tombera le manche ni de quel côté sera le tronc : c'est
`POSES` (`src/origami/poses.ts`) — orientation et taux de pliage —, réglé dans
`http://localhost:5173/orientation.html`. Ce fichier est **écrit par l'outil** :
le bloc `POSES` est regénéré à chaque enregistrement, et ce qu'on y ajouterait à
la main disparaîtrait au réglage suivant. La caméra, elle, ne bouge pas : elle
n'a **aucune composante en X**, faute de quoi l'image se cisaille et les modèles
rectangulaires sortent de travers.

**Un modèle peut finir retourné**, sans que le crease pattern le dise — ça se
constate au rendu. Sans le drapeau `retourne` de `PAPIERS`
(`src/origami/papier.ts`), la hache sortait en manche marron avec un éclat de
métal au pli, exactement à l'inverse d'une lame.

**Ne jamais montrer un pliage à 100 %.** La pose finale du solveur est souvent
parfaitement plate — le pont y perd toute épaisseur — et l'image d'un objet plat
n'a plus rien d'un origami. On s'arrête au `pliage` de `POSES`, pour l'animation
comme pour les images fixes. À 100 %, ça ne rend d'ailleurs même plus
correctement : les deux moitiés y sont exactement coplanaires, le tampon de
profondeur tranche pixel par pixel, et le **z-fighting** met des hachures en
travers du pliage. Ça ne se corrige pas par le rendu — même mesh, même matériau —
mais géométriquement : 3 % avant la fin donnent déjà 6 % du côté de la feuille
d'écart entre les moitiés, largement de quoi trancher, et invisible à l'œil.

**`renderer.dispose()` ne rend pas le contexte WebGL.** Le tutoriel créait puis
jetait une couche 3D à chaque lecture ; les contextes s'accumulaient, et au-delà
d'une quinzaine le navigateur tue le **plus ancien** — celui de Phaser. Deux
réponses, les deux en place : `forceContextLoss()` avant `dispose()`, et surtout
**une seule couche gardée** pour toute la partie (`coucheDemo`, dans
`tutoriel.ts`), comme `main.ts` le fait pour celle du récit. Une couche qui doit
resservir se recharge avec `load()` ; `dispose()` est une fin de vie.

**Un contexte WebGL perdu ne lève aucune erreur** : le rendu continue de
« marcher » et ne produit plus que des images vides. Les trois couches écoutent
donc `webglcontextlost` — et l'atelier de `apercu.ts` se jette **avec son cache
d'images**, sinon les images vides y resteraient.

**Un singleton asynchrone se mémorise en promesse, pas en objet.** `if (!x) x =
await créer()` laisse passer deux appels rapprochés — l'`await` rend la main
avant l'affectation — et chacun fabrique son contexte WebGL, dont l'un reste
orphelin. Mémoriser la **promesse**, posée avant le premier `await`, règle le
cas ; `fold-file.ts` fait déjà ça pour les `.origami`.

**`hidden` est une propriété de `HTMLElement`, pas de `SVGElement`.**
`svg.hidden = false` pose une propriété JavaScript sans rien retirer du DOM : la
règle `[hidden]` s'applique toujours, l'élément reste invisible, et rien ne lève
d'erreur. `toggleAttribute('hidden', …)` marche partout.

**Le solveur ne gère pas les collisions entre couches.** Les pliages à peu de
couches (bases, tessellations, Miura-ori) convergent bien ; la grue ne se referme
pas complètement, et augmenter les itérations donne un résultat *moins* replié.

**Une énigme ouverte doit survivre à un changement de taille du cadre.**
`eparpiller()` écrit des **pixels** qui ne valent que pour les dimensions
mesurées au montage, et le cas n'a rien de théorique : **sur itch.io le plein
écran est un bouton du site**, hors du jeu. Elle est donc rejouée sur `resize`,
groupée dans une frame pour laisser `syncStage()` recaler le cadre d'abord. Deux
précautions : effacer les deux variables avant de mesurer — sinon on mesure le
plateau du calcul précédent et l'échelle rétrécit à chaque passage — et ne
reposer que les pièces **encore dans le bac**, celles du plateau étant en
pourcentages.

**Un menu de dialogue dont toutes les options peuvent se fermer est un
cul-de-sac.** ink n'y voit pas une liste vide — que `pump()` saurait traiter —
mais « ran out of content », et l'instance `Story` reste en erreur : plus un
hotspot ne répond, alors que les sorties, qui ne passent pas par la narration,
continuent de marcher. Le renard l'a fait, une fois qu'il avait tout dit. Un
**repli sans texte** (`+ -> DONE`) en dernière ligne du menu suffit ;
`npm run check-story` les cherche, et `DialogueRunner.remettreDebout()` remet
l'instance sur pied pour que la faute suivante ne coûte plus que son knot.

**Hotspots qui se chevauchent** : la profondeur est assignée par surface
croissante, sinon la grande zone avale les taps destinés au détail posé dessus.

**`input.windowEvents: false` est indispensable, ne pas le retirer.** Par défaut
Phaser double ses écouteurs de pointeur sur `window` en phase de *capture* : un
tap sur un bouton de l'interface DOM était traité par le jeu **avant** d'atteindre
le bouton, et déclenchait le hotspot dessous. Arrêter la propagation côté DOM ne
suffit pas, la capture passe avant. Le canvas ne reçoit que des taps — le seul
glisser du jeu s'appuie sur `setPointerCapture`, dans la couche DOM.

**Le plein écran s'applique à `#app`**, jamais au canvas seul : l'interface vit
dans des éléments frères et disparaîtrait. Safari sur iPhone n'implémente
toujours pas l'API pour un élément quelconque, d'où l'entrée de menu masquée
quand `document.fullscreenEnabled` est faux.

**La CSS des pages de développement passe par un `import` du module**, pas par un
`<link>` dans le HTML : sur `<link href="/src/dev/*.css">`, le navigateur garde
sa copie et une règle ajoutée n'arrive jamais à la page. L'éditeur de découpage
s'est retrouvé tout noir, ses tracés retombant sur le `fill` par défaut de SVG.

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
