# Ori-Quest — contexte projet

Jeu **point & click** en HTML5, jouable au navigateur **mobile**, destiné à être
publié sur **itch.io**. Particularité : les animations d'origami sont générées
automatiquement à partir de crease patterns, pas modélisées à la main.

Le jeu est écrit en **français**, et traduit : l'anglais d'abord
(`content/langues/`). Code, commentaires et documentation restent en français.

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
npm run langues                  # catalogues de traduction <- textes du jeu
npm run check-langues            # une langue est-elle complète ? (CI)
npm run qa                       # non-régression, jouée dans un navigateur
npm run qa-local                 # la même, sur le `npm run dev` déjà lancé
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
densités et la mise en page s'itère en CSS. `syncStage()` (`src/ui/cadre.ts`)
recale cette couche à chaque redimensionnement, sans quoi l'UI dérive sur les
bandes du letterbox — ce qui arrive sur à peu près tous les téléphones.

**`main.ts` assemble, il ne fait rien lui-même.** Chaque responsabilité a son
module — le moteur Phaser (`game/moteur.ts`), la pièce à l'écran
(`game/navigation.ts`), ce que fait chaque tag ink (`game/effets-du-recit.ts`),
la couche 3D du récit (`origami/couche-du-recit.ts`), le cadre
(`ui/cadre.ts`)… — et `main.ts` ne fait que les créer et les brancher entre eux.
Un comportement nouveau va dans le module qui en a la charge, ou dans un module
neuf, jamais dans `main.ts`.

**Les effets de jeu passent par des tags ink**, pas par du code par hotspot :

```ink
Le papier frémit, puis se plie de lui-même. # origami: crane # flag: folded_crane
```

Ajouter un effet = une entrée dans `handlers` (`src/game/systems/dialogue.ts`).
Ne pas contourner ce mécanisme en appelant la logique de jeu depuis une scène.
Le serveur de dev suit `content/story.ink` comme il suit les cartes :
enregistrer recompile et recharge, et un ink cassé laisse en place la dernière
version valide, l'erreur et son numéro de ligne allant au terminal.

**Une conversation est une transaction.** Ce qu'un knot pose en chemin —
drapeaux, inventaire, verdict d'énigme, pièce — vit en mémoire et n'atteint
`localStorage` qu'à sa dernière réplique : `ouvrirUneTransaction()`
(`src/game/systems/state.ts`), ouverte par `DialogueRunner.run()` et refermée
dans son `finally`. Sans ça, un rechargement à mi-dialogue enregistre une
conversation à moitié faite, et le Petit Chat en donne le cas exact :
`chat_lait` tombe à sa deuxième réplique, `os_tombe` à sa dernière, dix
répliques plus loin — entre les deux le lait est bu et le pot dépensé, aucun des
deux ne se refait, et le papier de l'os reste accroché hors d'atteinte pour
toujours. Interrompue, une conversation n'a donc pas eu lieu : elle se rejoue en
entier, énigme comprise. C'est le bon prix — rejouer un dialogue coûte des taps,
un état impossible coûte la partie. Ça suppose qu'aucun effet de jeu ne
contourne `gameState` : c'est déjà la règle des tags ci-dessus, et c'est ici
qu'elle se paie.

**Le français est la langue source, et son texte sert de clé** — la façon de
gettext. Une langue est un catalogue `content/langues/<code>.po` ; `npm run
langues` le tient d'accord avec le jeu, `npm run check-langues` refuse ce qui
manque et tourne en CI. Une réplique retouchée en français perd donc sa
traduction, et c'est voulu : une traduction restée accrochée à une ligne qui a
changé de sens est l'oubli qu'on ne voit pas. Elle revient à revoir (`fuzzy`),
l'ancienne traduction en brouillon. Ne pas passer à des identifiants.

Deux sources, un seul catalogue (`tools/lib/langues.mjs`). **Le récit se lit
dans le JSON compilé**, pas dans `story.ink` : chaque texte affichable y est un
fragment `^…`, et le récit d'une autre langue est ce même JSON à ses textes près
— knots, conditions, tags et chaînes de logique (`trone_feuille("rouge")`)
inchangés, donc tout ce que le jeu attend du récit vaut dans toutes les langues.
`compile-ink.mjs` écrit les deux ensemble, sans quoi un story.json neuf côtoierait
un récit traduit d'avant. Conséquence à connaître : une condition posée **au
milieu** d'une phrase la coupe en fragments que la traduction reçoit séparément
— écrire plutôt la phrase entière dans chaque branche. **L'interface passe par
`t('…')`** (`src/langues/traduire.ts`), toujours sur un littéral, ce qui varie
par un champ `{nom}` ; la vérification refuse un `t()` calculé, et repère un texte
affiché qui n'y passe pas — gabarit HTML, `aria-label`, `textContent`, champs
`nom`/`titre`…, chaîne d'allure française. Ce qui ne s'affiche jamais s'en
exempte par un commentaire `// hors traduction`.

**La langue est fixée au chargement** (`src/langues/langue.ts`) : le choix des
options, sinon le navigateur, sinon l'anglais. Les textes d'interface sont
traduits à l'évaluation des modules et l'instance `Story` naît sur un seul
récit, donc changer de langue **recharge la page** — la sauvegarde ne connaît
que des identifiants, et une conversation en cours se rejoue comme après tout
rechargement. La typographie suit (`typographie.ts`) : les espaces insécables
devant `! ? ; :` sont une règle du français, la coupe de vers ` / ` vaut
partout. **`npm run qa` joue en `fr-FR`** (`ouvrir()`, dans `pilote.mjs`) parce
que ses essais choisissent les options par leur texte ; l'essai `langue` joue
en anglais.

**Les scènes sont pilotées par des données.** Les hotspots sont une liste
d'objets, pas du code impératif : c'est ce qui rend le contenu ajoutable sans
toucher à la logique.

**Le build embarque tous les chapitres, et la traversée va jusqu'au bout.**
`src/game/chapitres.ts` sépare quand même les deux, pour pouvoir faire essayer
un chapitre sans le raccorder : un joueur du récit n'a rien à y faire, alors
qu'un testeur si. `LIVRES` dit ce que la version contient, `DERNIER_TRAVERSE`
jusqu'où elle laisse aller ; au-delà, la porte finit sur « À suivre… ».

`goto()` (`src/game/navigation.ts`) pose l'écran de fin (`src/ui/fin.ts`) pour
les deux raisons : destination absente du build, ou franchissement hors
traversée — **sans l'écrire dans la sauvegarde**, qui doit rester sur une pièce
que ce build sait rouvrir. Le test porte sur le franchissement et non sur la
seule destination : dans un chapitre hors traversée, revenir à sa première pièce
depuis la deuxième est un déplacement interne, et finir la partie là-dessus
enfermerait le testeur.

**Le menu des points d'étape est livré lui aussi**, tant que la page itch.io est
en Draft (`ETAPES_LIVREES`, dans `src/game/systems/etapes.ts`) : un testeur ne
retraverse pas le chapitre pour en atteindre la fin. Il ne propose que les
chapitres que le build embarque — ailleurs, il déposerait le joueur au ravin avec
les drapeaux du chapitre suivant levés.

**La narration, elle, ignore quels chapitres ont été compilés** : le knot de fin
de chapitre se joue en entier, sa dernière réplique comprise, et l'écran prend la
suite. Avec les crédits et ce qui se dit pendant une énigme, c'est le seul texte
du jeu hors d'ink, et pour une raison voisine : il clôt, il ne raconte pas. La
fin de l'histoire passe aux crédits (`src/ui/credits.ts`) : c'est le tag `# fin:`
du dernier knot qui les pose — la narration sait que l'histoire est finie,
l'écran ne fait que le constater. Ils restent **sous le menu** : rien ne doit
partager l'écran avec « Merci d'avoir joué ! », c'est donc par lui qu'on
recommence, et il les fige comme il fige la scène.

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
**Un objet qu'on vient de plier y est déjà**, et c'est lui qui part : la
vignette attend qu'on quitte sa réplique, se pose sur la silhouette du modèle
pendant que la couche 3D s'efface, puis vole (`quandOnRange()`, dans
`couche-du-recit.ts`). Partie plus tôt, elle s'envolait en double sous le pliage
resté à l'écran.

Deux pièges (`src/ui/obtention.ts`). **Le vol se déclenche sur le tag `# give:`**
(`donner()` dans `src/game/effets-du-recit.ts`), jamais sur un changement
d'inventaire — `gameState.give()` sert aussi à charger une sauvegarde. Et **`renderInventory()`
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

Le terrain non plus n'est pas dessiné : sol, ravin et château sont l'image de
l'artiste, désignée par un **calque image de classe `fond`** qui pointe le
fichier de `public/` — les zones tactiles s'ajustent donc sur les pixels que le
joueur aura sous les yeux. **Seul le ciel reste peint** (`ciel.ts`), le fond
étant livré transparent au-dessus de l'horizon pour laisser passer soleil et
nuages derrière le château.

**L'eau du ravin est l'exception, et elle a été demandée** (`eau.ts`) : TexEau,
un papier bleu froissé **calculé** au lancement, pas photographié. L'artiste
livre le fond **transparent dans la brèche** comme au-dessus de l'horizon : on y
voit le ciel, et l'eau passe derrière le fond, dans la zone `eau`, dont le bord
haut est la surface. Tout se règle dans `eau.html`, qui écrit `eau-reglages.ts`.
Trois contraintes : TexEau reste une **puissance de deux** (WebGL 1 ne répète que
celles-là, et le défilement boucle par cette répétition) ; les vagues vont
**moins vite que le papier** par construction, leur vitesse étant une fraction de
la sienne bornée sous 1 ; et ses **mipmaps** se demandent à la texture elle-même
(`update()` de son `glTexture`), `refresh()` ne les accordant qu'à la
configuration globale — sans eux, le papier vu en perspective scintille.
Le calcul coûte un temps notable au premier passage sur téléphone : s'il gêne, le
passer dans un Worker.

**La lumière des torches a été demandée aussi** (`torches.ts`) : les torches
restent celles du fond, seule leur lueur est ajoutée, aux zones `flamme_*` du
plan — salle du trône et cuisine, qui ont les mêmes torches et partagent le
réglage. Le mur étant presque blanc, une lumière
**additive** n'y trouve plus de place et ne fait que le jaunir : c'est la couche
**multipliée** qui le fait virer à l'ambre, et c'est ça qui se lit comme une
torche. Le halo reste faible, sans quoi il délave la flamme de papier. Tout se
règle dans `torches.html`, sur la salle du trône, qui écrit `torches-reglages.ts`.

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

**Les cocottes sont masquées par défaut** : posées sur leur sujet, elles
couvraient le dessin. Une case de l'écran de pause les rappelle
(`src/game/systems/cocottes-montrees.ts`), réglage de l'appareil comme la
langue, **pas de la sauvegarde** — recommencer ne retire pas une aide demandée.
Les flèches de sortie, elles, restent toujours.

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
de l'objet à l'écran, que la carte ne connaît pas. L'entrée de la grenouille,
elle, ne se dessine pas du tout : de juste hors du bord gauche jusqu'à sa place,
à la même hauteur, le trajet est tout entier dérivé de `hs_heros`
(`poserHorsCadre()`). Et **un déplacement ne bloque pas la scène** — le décor
reste touchable pendant qu'un objet traverse, sauf `bloquant: true` pour ce qui
doit être vu avant qu'on puisse agir.

**Bloquant veut dire vraiment bloquant**, et l'état est **transitoire** : décor
et inventaire cessent de répondre, et les marqueurs se retirent (ci-dessous).
Seul le menu reste atteignable, et il **fige la scène** (`figerLeJeu`, dans
`src/game/gel.ts`) : sans ça, ce qu'on regardait finit sa course derrière le
panneau. Tout se relève à la fin du trajet **et au shutdown** — des attentes restées
ouvertes rendraient la pièce sourde pour de bon.

**Ce qui couvre tout le décor arrête Phaser, rendu compris** (`couvrirLeJeu()`,
même fichier) : l'énigme, et le menu de pause. Dessous, il redessinait à chaque
image une scène que personne ne voit, et c'est ce qui faisait ramer les pièces.
Le canvas garde sa dernière image. Rien de ce qui se joue pendant une énigme ne
doit donc compter sur l'horloge de Phaser : tutoriel, réplique d'erreur et
pliage de démonstration vivent en DOM ou dans leur propre couche 3D.

**Pendant un dialogue ou une cinématique, les marqueurs se retirent** d'un zoom,
et l'inventaire reste à l'écran sans répondre — `Overlay.marquerLeRecit()`,
tenu par `DialogueRunner.run()`, couvre aussi les moments où le récit travaille
boîte fermée : pliage, énigme, changement de pièce. Le retrait est **recalculé à
chaque image** depuis l'état du récit (`update()` de `PointClickScene`), jamais
déclenché par un événement : aucun chemin ne peut laisser les marqueurs partis
une fois la scène rendue. Ils attendent `RETOUR_MS` avant de revenir, sinon ils
reparaissent pour repartir entre deux maillons — la tirade puis le départ
qu'elle déclenche, le rapprochement puis les aveux. Le battement et le zoom
animent deux conteneurs imbriqués (`marqueur-papier.ts`) : sur un seul, ils se
disputaient l'échelle.

**C'est la narration qui déclenche, la scène qui joue** : `# flag:` lève le
drapeau, `auLeverDe()` (`PointClickScene`) joue le mouvement. Un drapeau **déjà
levé en arrivant** pose l'objet à son arrivée sans rien rejouer, sinon le
dinosaure s'écarte à chaque retour dans la pièce. Et le mouvement attend que la
boîte de dialogue se referme : l'état, lui, n'attend pas.

**L'écran d'accueil est un rideau** (`src/game/rideau.ts`). Il ne paraît au
chargement que si la partie n'a laissé aucune trace (`gameState.commencee`), et
la première pièce se monte derrière, vivante mais fermée : `PointClickScene`
attend le lever pour jouer `entrerEnScene()` — la grenouille, par bonds —, puis
son dialogue d'arrivée. C'est le même écran que la pause (`src/ui/menu.ts`), et
on n'y revient qu'en recommençant. Un rechargement pendant l'arrivée rouvre
l'accueil, et c'est juste : la transaction n'a rien écrit, la partie n'a pas
commencé.

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

**Ce texte-là n'est pas dans ink**, pas plus que la réplique d'une vérification
fausse (`src/game/puzzle/erreur.ts`) : tout ce qui se dit pendant une énigme se
dit pendant que le récit *attend* son verdict (`# puzzle:`), et `DialogueRunner`
n'a qu'une instance de `Story` qui refuse d'être relancée pendant qu'elle tourne.
Déplacé dans `story.ink`, il ne s'afficherait jamais.

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
attend **sans changer la réplique**, celle en place servant de légende.
`jouer()` (`puzzle/tutoriel.ts`) l'appelle après tout effet ; `pump()`
(`systems/dialogue.ts`) seulement quand le tap a été dépensé avant la fin d'un
`# origami:` — une réplique se lit plus longtemps qu'un pliage ne dure.

**La flèche ▶ ne s'affiche que si un tap est attendu** : elle part au tap qui
dénoue une attente et revient avec la suivante, dans `attendreUnTap()` même.
Restée à l'écran pendant un pliage, elle invitait à taper une boîte qui
n'écoutait plus. Et le modèle plié **reste à l'écran jusqu'à ce qu'on quitte sa
réplique** (`CoucheDuRecit.ranger()`, dans `src/origami/couche-du-recit.ts`),
pas pendant une durée fixe : qui a vu avance aussitôt, qui regarde garde la
pose. La durée du pliage lui-même est `PLIAGE_MS`, dans le même fichier.

**Et il n'avance qu'une fois par tap.** Deux contacts rapprochés dépensaient deux
répliques, et rien dans le jeu ne revient en arrière. Une attente fraîchement
ouverte ignore donc les taps pendant `DELAI_ANTI_TAP` (`src/ui/overlay.ts`),
**choix compris** — c'est même là que ça compte le plus, un tap de trop prenant
une branche que personne n'a lue. Le délai est **nul en développement** ;
`VITE_DELAI_TAP=300 npm run dev` le rallume, `npm run preview` donne le
comportement livré.

**La boîte se signale, parce qu'on ne la voyait pas.** Au playtest, des joueurs
restaient devant une réplique sans comprendre qu'il fallait la toucher : ils
tapaient le décor, qui est sourd tant qu'une réplique attend. Trois signes, tous
dans `overlay.ts` et sa CSS — le texte **s'écrit** (`defiler()`,
`CARACTERES_PAR_SECONDE`), la flèche **glisse** vers la droite au lieu de
clignoter, et un tap tombé **hors de la boîte** la fait virer au doré
**en entier** (`surveillerAilleurs()`) — le liseré seul ne se voyait pas. Ce tap-là n'a aucune autre réponse possible, autant
qu'il enseigne. Pourquoi pas « taper n'importe où fait avancer », qui supprimerait
le problème : parce que la surface des taps accidentels deviendrait l'écran
entier, et qu'une réplique sautée ne se rejoue pas — c'est déjà ce que
`DELAI_ANTI_TAP` protège.

Ce tap-là est guetté sur `window`, où l'interface ne laisse rien remonter
(`src/ui/isolation.ts`). Sur une énigme, le décor est couvert par un voile — celui
du tutoriel, celui d'une vérification fausse — qui porte donc **`data-ailleurs`**
pour passer quand même : sans lui, la boîte restait muette sur une énigme.

Deux pièges dans le texte qui s'écrit. **Ce qui reste à écrire est dans le DOM**,
en `visibility: hidden` : écrit dans un seul nœud qui grandit, le texte se
recouperait à chaque mot et remonterait sous le doigt, la boîte étant calée par
le bas. Et **achever l'écriture d'un tap rouvre le délai anti-tap**, sinon le
rebond de ce tap emporte la réplique qu'il vient tout juste d'afficher — la seule
que personne n'aurait lue. `npm run qa -- anti-tap` tient les deux.

**Des couches à ne pas intervertir** : l'énigme à `z-index: 4`, le voile du
tutoriel à 5, la boîte de dialogue à 6 (`Overlay.mettreDevant()`), la
confirmation à 7, le vol d'obtention et son bandeau à 8, l'écran « À suivre… »
à 9 — au-dessus du menu, seul écran du jeu dans ce cas : la partie est finie, il
n'y a plus rien à reprendre. Les crédits sont à 6, après la boîte dans le DOM et
sous le menu, par où l'on recommence. D'où le fait que `.tuto`
ne soit **pas positionné** : positionné, il ferait contexte d'empilement et ses
enfants ne pourraient plus encadrer la boîte de dialogue.

**Le menu passe au-dessus de tout ça** — bouton et écran à 7, fenêtres à 8 —
parce que plein écran et remise à zéro doivent rester atteignables énigme
ouverte ; sans `z-index`, le bouton restait **dessiné mais inerte** sous le tas
de pièces. Attention à l'ordre du DOM, qui départage à `z-index` égal : l'énigme
est montée bien après le menu, donc un écran de menu à 4 passerait dessous.

Le tutoriel a son **voile**, transparent et plein cadre : il absorbe les taps
destinés à l'énigme (il ne s'assombrit que pour la démonstration) — sans quoi le
même geste déclenche au passage le hotspot du décor.
`input.windowEvents: false` garde Phaser sur le canvas, mais le tap y est traité
**puis** remonte jusqu'à l'écouteur `window`, et `occupeLeJoueur` ne connaît que
la boîte de dialogue et le menu de verbes. L'écran du menu tient ce rôle pour
lui-même : il couvre le cadre, et un tap hors de ses boutons ne referme rien.

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
métal au pli, exactement à l'inverse d'une lame. Le pliage **part** alors
retourné lui aussi (`OrigamiLayer.load`), et la feuille du décor s'imprime
redressée : sinon le joueur voyait se plier du marron juste après avoir touché
une feuille de métal.

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
`tutoriel.ts`), comme `CoucheDuRecit` le fait pour celle du récit. Une couche qui doit
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

**Un `Graphics` de Phaser se retriangule à chaque image**, qu'il ait changé ou
non. Les feuilles précieuses du trône saturaient ainsi le processeur d'un
téléphone : ce qui ne bouge pas se fige en texture (`figer()`, dans
`feuilles-precieuses.ts`), et une lumière qui bouge se peint dans un canvas 2D
découpé à la feuille.

**Un canvas qu'on relit se crée avec `willReadFrequently`**, sinon il vit sur le
GPU et chaque `getImageData` attend la carte : c'était le plus long du montage
d'une pièce (`grain()`, dans `papier.ts`).

**`input.windowEvents: false` est indispensable, ne pas le retirer.** Par défaut
Phaser double ses écouteurs de pointeur sur `window` en phase de *capture* : un
tap sur un bouton de l'interface DOM était traité par le jeu **avant** d'atteindre
le bouton, et déclenchait le hotspot dessous. Arrêter la propagation côté DOM ne
suffit pas, la capture passe avant. Le canvas ne reçoit que des taps — le seul
glisser du jeu s'appuie sur `setPointerCapture`, dans la couche DOM.

**Au doigt, le tap se rejoue en souris**, et Phaser écoute la souris. Après un
toucher, le navigateur émet `mousedown` et `mouseup` au même point, sur ce qui
s'y trouve *à ce moment-là* : le tap qui ferme la boîte de dialogue la retire de
dessous le doigt, et la souris rejouée tombait sur le hotspot dessous. La
fontaine du jardin, qui couvre tout le bas du cadre, rouvrait ainsi son dialogue
à chaque fermeture, sans issue ; le voile du menu laissait passer le même tap.
`isolerLInterface()` (`src/ui/isolation.ts`) écarte la souris d'un toucher né
dans l'interface jusqu'au `pointerdown` suivant. Annuler `touchend` ne suffit
pas — il n'atteint plus l'interface quand sa cible en a été retirée, un bouton de
choix — et annuler `touchstart` bloquerait le défilement du menu. Un clic ne
rejoue rien : l'essai `toucher` de `npm run qa` ouvre un écran tactile.

**Le plein écran s'applique à `#app`**, jamais au canvas seul : l'interface vit
dans des éléments frères et disparaîtrait. Safari sur iPhone n'implémente
toujours pas l'API pour un élément quelconque, d'où l'entrée de menu masquée
quand `document.fullscreenEnabled` est faux.

**Dans une iframe, le plein écran est celui du site**, et l'entrée de menu se
masque aussi (`pleinEcranPossible()`, `src/ui/plein-ecran.ts`). itch.io met en
plein écran son propre cadre, ce que la page du jeu ne voit pas — ni
`fullscreenElement`, ni `fullscreenchange` : le menu proposait « Plein écran »
sur un écran déjà plein, et l'accepter empilait le nôtre sur le sien. Or un
rechargement fait tomber **les deux** quand ils sont empilés, alors que celui du
site, seul, y survit — et tout ce qui repart à neuf recharge la page.
Hors iframe, un rechargement fait toujours sortir du plein écran et rien n'y
ramène sans geste : `garderLePleinEcranAuRechargement()` le note au `pagehide`,
et le premier tap d'après l'y remet. `npm run qa -- plein-ecran` tient les deux.

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

**`npm run qa` joue le jeu pour de vrai**, dans un Chromium piloté par
Playwright : traversée du chapitre, quatre énigmes résolues au glisser-déposer,
tutoriel, rotation, rechargement — nu, puis en pleine conversation —, perte de
contexte WebGL. Il bâtit `dist/` et le
sert lui-même — **sur le build livré, et c'est le propos** : le délai anti-tap
réel n'existe que là, et c'est en production qu'on a trouvé les deux gels de
cette session. Le
dev répondrait « tout va bien » sur un jeu qui n'est pas celui qu'on publie.
`npm run qa-local` vise le `npm run dev` d'à côté, quand on met un essai au point
et qu'on veut des piles d'appels lisibles : ni build ni attente, et les essais
qui parlent du build s'y sautent d'eux-mêmes. Le délai anti-tap suit la cible, et
`BASE_URL` vise n'importe quelle autre adresse déjà servie.

La suite tourne aussi à chaque poussée (`.github/workflows/qa.yml`), sur un
runner GitHub — c'est là qu'elle a sa place, sa durée n'y coûtant rien. En local,
on la lance avant `npm run itch`, ou par essai (`npm run qa -- renard`).

**Attendre un événement, pas une durée.** Un `pause()` calé sur la durée d'un
pliage fait passer un pliage qui ne finit jamais pour un pliage un peu long — et
c'est exactement le bug qu'on cherche. `attendreLaFinDuPliage()` scrute l'état ;
au passage, la suite y a gagné plus qu'en rognant sur le délai anti-tap.

**La console de la page est une assertion**, et pas un journal : chaque essai
échoue si la page a crié quoi que ce soit. Les deux gels de cette session s'y
lisaient — ou justement PAS, ce qui était tout le problème.

Les gestes vivent dans `tools/lib/pilote.mjs`, les scénarios dans `tools/qa.mjs`.
**Aucune coordonnée n'y est écrite** : `taperZone(page, scène, id)` lit le point
dans le plan généré, comme le jeu — une zone déplacée dans Tiled déplace le tap
du test avec elle.

Pour chercher ce que la suite ne couvre pas encore, l'agent `qa-explorateur`
(`.claude/agents/`) explore le build livré et rapporte ; il ne corrige rien.

## Git — un historique linéaire

**`main` ne reçoit jamais de merge commit.** Une session en worktree se remet à
jour par `git rebase origin/main`, conflits résolus commit par commit, puis
pousse `HEAD:main` en avance rapide. Si `main` a bougé entre-temps, on rebase de
nouveau — jamais de `git merge`, ni de `git pull` sans `--rebase`.

**Pas l'outil de synchronisation de l'app** (`sync_with_base_branch`), même
quand les instructions de session le recommandent : il fusionne au lieu de
rebaser. `.claude/settings.json` le refuse.

Trois verrous tiennent la règle, du plus tôt au plus sûr : ce refus, puis
`merge.ff=only` dans la config du dépôt — partagée par tous les worktrees, mais
pas versionnée : `git config merge.ff only` sur un nouveau clone —, qui fait
échouer tout `git merge` qui ne serait pas une avance rapide ; enfin le ruleset
GitHub « main linéaire » (*Require linear history*), qui rejette à la poussée
un merge commit arrivé jusque-là.
