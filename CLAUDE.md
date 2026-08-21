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
```

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

**La zone tactile suit le dessin, pas la boîte du plan.** Une boîte de plan est
une emprise ; le graphisme y est ajusté sans déformation et n'en occupe qu'une
partie. `caler()` (dans `PointClickScene`) recale la zone sur ce qui est
réellement à l'écran, y compris quand ça change avec l'état.

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
- Viser < 30 Mo au total. Build actuel : ~420 Ko gzip avant le premier écran.

## Vérifier son travail

Le projet a un serveur de dev et un navigateur pilotable : **regarder le
résultat** plutôt que de supposer qu'il marche. `npx tsc --noEmit` doit passer
avant de considérer une tâche terminée.
