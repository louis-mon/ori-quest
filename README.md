# Ori-Quest

Prototype de point & click jouable au navigateur (mobile compris), destiné à
itch.io, avec des animations d'origami générées à partir de crease patterns.

> **Game design** : la boucle de jeu, la structure en chapitres et le langage
> visuel sont documentés dans [`game-design/`](game-design/).
> **Contexte pour Claude Code** : [`CLAUDE.md`](CLAUDE.md).

## Démarrer

Node ≥ 18 requis (le projet est testé sur 24.19.0 ; un `.nvmrc` est fourni).

```bash
nvm use && npm install && npm run dev
```

Le serveur écoute aussi sur le réseau local (`host: true` dans `vite.config.ts`) :
l'URL « Network » affichée permet de tester depuis un vrai téléphone, ce qui est
le seul moyen fiable de valider l'ergonomie tactile et la mémoire iOS.

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de dev (compile ink et les plans de scène, puis les suit) |
| `npm run build` | typecheck + build de production dans `dist/` |
| `npm run ink` | compile `content/story.ink` -> `src/generated/story.json`, et le récit de chaque langue |
| `npm run langues` | met les catalogues `content/langues/*.po` d'accord avec les textes du jeu |
| `npm run check-langues` | échoue si une langue n'est pas complète (tourne en CI) |
| `npm run scenes` | cartes Tiled `game-design/scenes/` -> `src/generated/scenes/` |
| `npm run enigmes` | découpages `game-design/enigmes/` -> `src/generated/enigmes.ts` |
| `npm run check-puzzle [-- <nom>]` | un découpage a-t-il bien une solution unique ? |
| `npm run bake -- <cp.svg>` | crease pattern -> animation `.origami` |
| `npm run zip` | prépare `ori-quest-itch.zip` pour itch.io |
| `npm run itch` | téléverse `dist/` sur itch.io avec butler |

Pages de réglage, en développement uniquement (hors build) — le menu du jeu les
ouvre aussi, chacune dans son onglet, par « Outils de réglage ». Toute page HTML
de la racine autre qu'`index.html` y figure d'elle-même, sous son `<title>` :

- `http://localhost:5173/orientation.html` — la pose de chaque modèle plié
  (orientation à la souris, pliage final). Pas sa taille : elle se dessine dans
  Tiled, avec le reste de la géométrie de la scène.
- `http://localhost:5173/decoupage.html` — le découpage des énigmes : on trace
  des coupes sur le crease pattern, d'un bord à l'autre d'une pièce, et l'outil
  dit après chaque coupe si la solution reste unique.
- `http://localhost:5173/eau.html` — l'eau du ravin : teinte du papier, courant,
  vagues, inclinaison du plan d'eau. Sa place, elle, se dessine dans Tiled
  (zone `eau` du plan du ravin).
- `http://localhost:5173/torches.html` — la lumière des torches de la salle du
  trône, et du même coup de la cuisine : teinte, portée, vacillement. Les
  flammes, elles, se dessinent dans Tiled (`flamme_gauche` et `flamme_droite`
  du plan de chaque pièce).
- `http://localhost:5173/vapeur.html` — la vapeur de la daurade servie dans la
  cuisine : nombre et épaisseur des filets, volutes, intermittence. Le plat,
  lui, se dessine dans Tiled (zone `repas` du plan de la cuisine).
- `http://localhost:5173/choix.html` — les menus de choix : les vrais menus
  d'ink dans la vraie boîte de dialogue, marque de réplique et en-tête réglés en
  direct.

Leur bouton « Enregistrer » écrit dans le dépôt (`src/origami/poses.ts`,
`game-design/enigmes/<nom>.json`, `src/game/scenes/eau-reglages.ts`,
`src/game/scenes/torches-reglages.ts`, `src/game/scenes/vapeur-reglages.ts`,
`src/ui/choix-reglages.ts`) par un point
d'entrée du serveur de dev défini dans `vite.config.ts` — qui n'existe qu'en
développement et ne garde que des nombres bornés.

### Traduire

Le jeu s'écrit en français ; chaque autre langue est un catalogue gettext,
`content/langues/<code>.po`, qui s'ouvre dans un éditeur de texte comme dans
Poedit. La clé d'une entrée est le texte français lui-même, et son contexte
(knot, personnage qui parle, fichier) est noté au-dessus.

- **Après avoir écrit ou retouché du texte** — dans `story.ink` ou dans un
  `t('…')` du code —, `npm run langues` : les textes nouveaux arrivent vides, un
  texte retouché revient marqué `#, fuzzy` avec son ancienne traduction, ce qui a
  disparu est retiré. Remplir les `msgstr`, retirer les `#, fuzzy` relus. En
  attendant, un texte vide s'affiche en français, un texte à revoir dans son
  ancienne traduction.
- **`npm run check-langues`** échoue tant qu'une langue a un trou, et signale
  tout texte d'interface affiché sans passer par `t()`. La CI le joue à chaque
  poussée.
- **Ajouter une langue** : créer `content/langues/<code>.po` vide, puis
  `npm run langues`. Elle apparaît dans le menu, sous « Options », dès le
  `npm run ink` suivant.

La langue du jeu est celle choisie dans les options, sinon celle du navigateur,
sinon l'anglais. Les partis pris de la traduction anglaise — noms, cris,
registres — sont dans [`content/langues/en-lexique.md`](content/langues/en-lexique.md),
qu'une réplique ajoutée doit suivre.

### Intégrer un origami de l'artiste

Les PNG livrés sont détourés sur fond transparent mais gardent une large marge
vide, et leur définition (1440×1440) est dix fois celle dont le jeu a besoin.

```bash
python3 tools/detourer-png.py assets-src/graphisme_origami/renard.png \
  public/assets/decor/renard.png 360
```

Le script rogne sur la boîte alpha puis réduit, en pondérant la moyenne des
couleurs par l'alpha — sans quoi les pixels transparents (noirs) tirent les
bords du sujet vers le sombre et le détourage se voit comme un liseré. Il
n'utilise que la bibliothèque standard : ni Pillow ni ImageMagick sur la
machine, et `sips` ne sait pas rogner à un offset arbitraire.

Le fichier obtenu n'a **plus de marge** : la boîte du plan de scène est donc
exactement l'emprise du personnage.

Les vignettes de dialogue, elles, restent carrées et passent par `sips` :

```bash
sips -Z 160 assets-src/graphisme_origami/renard.png --out public/assets/personnages/renard.png
```

Même chemin pour les pliages qui ne sont pas des personnages — les deux
marqueurs de l'interface et les nuages du ciel. Ils sont juste rangés ailleurs,
et livrés en **double densité** : ce qui est petit à l'écran doit rester net sur
un téléphone.

```bash
python3 tools/detourer-png.py assets-src/graphisme_origami/parajita.png \
  public/assets/ui/parajita.png 112              # marqueur « on analyse »
python3 tools/detourer-png.py assets-src/graphisme_origami/fleche.png \
  public/assets/ui/fleche.png 112                # marqueur « on change de scène »
python3 tools/detourer-png.py assets-src/graphisme_origami/soleil.png \
  public/assets/decor/soleil.png 128

for f in assets-src/graphisme_origami/nuage/*.png; do
  python3 tools/detourer-png.py "$f" "public/assets/decor/$(basename "$f")" 360
done
```

La boucle suit le dossier plutôt qu'une liste de numéros : l'artiste en retire
et en ajoute, et un modèle qui disparaît en amont doit disparaître de
`public/assets/decor/` **et** de la liste `MODELES` dans `ciel.ts`, sinon le jeu
demande une texture qui n'existe plus. Le retrait n'arrive en local qu'avec
`npm run assets:pull -- --mirror` ; en mode normal, le tirage est purement
additif.

Le jeune arbre est **renommé à l'intégration** : `arbre` est déjà le nom du
modèle plié rendu en 3D (le vieil arbre du fond), et deux clés de texture
identiques se marcheraient dessus.

```bash
python3 tools/detourer-png.py assets-src/graphisme_origami/arbre.png \
  public/assets/decor/jeune-arbre.png 360
```

### Intégrer un fond de scène

Les fonds sont livrés dans `background/`, en **WebP 1280 × 720** — la résolution
logique du jeu, donc aucun rognage ni réduction à faire : c'est une simple copie.
Le canvas fait 1280 × 720 quelle que soit la densité de l'écran (`Scale.FIT`), une
livraison en double densité n'apporterait donc rien et pèserait quatre fois plus.

```bash
cp assets-src/graphisme_origami/background/bg_ravin.webp \
  public/assets/decor/fond-pont.webp
cp assets-src/graphisme_origami/background/bg_la_porte.webp \
  public/assets/decor/fond-porte.webp
cp assets-src/graphisme_origami/background/bg_village.webp \
  public/assets/decor/fond-village.webp
cp assets-src/graphisme_origami/background/bg_entree_chateau.webp \
  public/assets/decor/fond-entree.webp
cp assets-src/graphisme_origami/background/salle_trone.webp \
  public/assets/decor/fond-trone.webp
cp assets-src/graphisme_origami/background/jardin.webp \
  public/assets/decor/fond-jardin.webp
cp assets-src/graphisme_origami/background/cuisine.webp \
  public/assets/decor/fond-cuisine.webp
```

Ils sont **renommés à l'intégration**, sur l'identifiant de la scène et non sur
le nom de la zone : c'est lui que disent les knots d'ink, les sauvegardes et les
plans. Le joueur, lui, lit « Le ravin ».

Le WebP est gardé tel quel — 33 Ko contre 550 Ko pour le même dessin en PNG, et
il porte sa couche alpha : le fond est **transparent au-dessus de l'horizon**,
c'est ce qui laisse passer le ciel, son soleil et ses nuages, peints par le code
(`src/game/scenes/ciel.ts`).

Reste à le **brancher dans la carte Tiled** de la scène : un calque image de
classe `fond`, qui pointe le fichier de `public/`. C'est la carte qui dit au jeu
quel fond charger et où le poser — voir
[game-design/06-plans-de-scene.md](game-design/06-plans-de-scene.md).

### Intégrer les sons

Les sons sont livrés dans `son/` : les ambiances dans `son_ambiance/`, les cris
et bruits dans `bruitage /` — une espace à la fin de son nom, d'où les
guillemets.

**Les ambiances sont réencodées.** Telles que livrées, elles dépassaient à elles
seules le budget du jeu : elles durent plusieurs minutes.
[`tools/alleger-ambiance.mjs`](tools/alleger-ambiance.mjs) les ramène au débit du
jeu ; il décode par `afconvert`, donc sur macOS.

```bash
for nom in chapitre_1 chapitre_1_riviere chapitre_2 chapitre_3_chateau; do
  node tools/alleger-ambiance.mjs "assets-src/son/son_ambiance/son_ambiance_$nom.mp3" \
    "public/assets/sons/ambiance/$nom.mp3"
done
```

Celle du jardin n'y est pas : `son_ambiance_chapitre_3_jardin.mp3` est le même
fichier, octet pour octet, que `son_ambiance_chapitre_1.mp3`, et le jardin joue
celui-ci. La rivière, elle, coule au ravin par-dessus `chapitre_1` : une pièce
peut superposer plusieurs ambiances. Quelle pièce joue quelle ambiance se dit dans la scène (`ambiance`) ; le
catalogue des fichiers est [`src/sons/catalogue.ts`](src/sons/catalogue.ts).

**Les bruitages sont copiés tels quels**, renommés sur l'identifiant du
personnage qui les pousse (`personnages.ts`) — c'est lui que la zone de l'animal
reprend dans son `cri`. Le coup de hache, lui, est un tag du récit :
`# son: arbre_coupe`.

```bash
B="assets-src/son/bruitage "
cp "$B/bruitage_grenouille.mp3" public/assets/sons/bruitage/grenouille.mp3
cp "$B/hibou_des_bois_joli.mp3" public/assets/sons/bruitage/hibou.mp3
cp "$B/Bruitage_le_petit_chat.mp3" public/assets/sons/bruitage/chat.mp3
cp "$B/bruitage_chat_mal_lune.mp3" public/assets/sons/bruitage/lune_chat.mp3
cp "$B/bruitage_arbre_coupe.mp3" public/assets/sons/bruitage/arbre_coupe.mp3
```

Le mélange — le volume de chaque son, la durée d'un cri trop long — se règle à
l'oreille dans `http://localhost:5173/sons.html`, qui écrit
`src/sons/sons-reglages.ts`. Un son neuf entre par le catalogue, et `tsc`
réclame alors son réglage.

### Reprendre à un point précis du chapitre

Le menu du jeu porte une liste « Reprendre à… » qui reconstitue un moment de la
partie — pont posé, hache en main, bois en poche… Rejouer tout le chapitre pour
vérifier une correction de fin coûte plusieurs minutes et une énigme ; ces
entrées suppriment ce coût.

Elle est toujours là sous `npm run dev`. Le build publié l'embarque aussi, car
un testeur ne retraversera pas le chapitre entier pour en atteindre la fin, mais
la **cache au joueur** : elle ne paraît qu'en mode dev. Pour l'ouvrir, enfoncer
le bouton du menu, glisser sans lâcher jusqu'au coin opposé de l'écran, et lever
le doigt là ; la pause s'ouvre, « Points d'étape » compris. Le même geste la
retire. Le mode tient d'un rechargement à l'autre et survit à « Recommencer » :
c'est la clé `ori-quest.devMode` du `localStorage`, à `true`
([`src/game/systems/mode-dev.ts`](src/game/systems/mode-dev.ts)). Les outils de
réglage n'en font pas partie : leurs pages n'existent que sur le serveur de dev.

Le menu ne porte **qu'une entrée par chapitre** ; elle ouvre une fenêtre avec
les étapes de ce chapitre. Tout mettre à plat noyait les deux entrées qui
comptent vraiment, plein écran et recommencer.

Les étapes sont des données, dans
[`src/game/systems/etapes.ts`](src/game/systems/etapes.ts) : chacune décrit
l'état **complet** attendu (scène, drapeaux, inventaire), pas un écart par
rapport à la précédente. Elles rechargent la page, comme « Recommencer » — le
récit ink garde ses propres variables dans son instance `Story`, que l'état de
jeu ne touche pas.

Seuls les chapitres que le build embarque sont proposés
(`chapitresAtteignables()`) : un point d'étape posé dans une scène absente
renverrait le joueur au ravin, les drapeaux du chapitre suivant levés.

## Stack

| Rôle | Choix | Licence |
| --- | --- | --- |
| Moteur 2D | Phaser 4 | MIT |
| Narration | inkjs (langage ink d'inkle) | MIT |
| Origami 3D | three.js | MIT |
| Bake origami | Origami Simulator (A. Ghassaei) + Playwright | MIT |
| Réencodage des ambiances | lamejs | LGPL-3.0 |
| Build | Vite + TypeScript | MIT |

Tout ce qui part avec le jeu est permissif ; lamejs ne sert qu'à l'intégration
des sons, hors bundle. **Rabbit Ear a été volontairement écarté : il est en
GPLv3**, et le lier dans le bundle obligerait à publier le jeu entier sous GPLv3.

Permissif ne veut pas dire sans condition : MIT demande que la notice parte
avec chaque copie. Le build l'écrit dans `dist/licences-tierces.txt`
([`tools/lib/licences-tierces.mjs`](tools/lib/licences-tierces.mjs)), d'après ce
que le bundle contient vraiment, et `npm run zip` comme `npm run itch` refusent un
`dist/` qui ne l'a pas.

### Ce qui se charge, et quand

Au démarrage : Phaser, l'application et sa CSS. **Le reste est différé.** `three`
est derrière un `await import()` dans `OrigamiLayer` et dans `apercu.ts`, et
Vite lui donne son propre chunk : un joueur qui n'atteint jamais une scène avec
origami ne le télécharge pas. Les `.origami` suivent le même chemin, un par
modèle, au moment où on le plie.

Les tailles se lisent dans la sortie de `npm run build`, qui les donne en gzip
chunk par chunk. Elles ne sont pas recopiées ici : elles seraient fausses au
prochain commit, et ce qui compte dans ce fichier est **ce qui est différé**, pas
combien il pèse aujourd'hui.

⚠ Le décor affiche les modèles pliés (voir plus bas), et ces images passent par
three.js elles aussi. Le rendu n'est donc demandé **qu'à la première apparition**
du modèle (`montrer()` dans `origami-decor.ts`) : ouvrir la première scène, où
rien n'est encore plié, ne charge toujours rien. Vérifiable en console :

```js
performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /three/.test(n))
```

Les textures de papier, elles, sont **peintes au canvas** et ne pèsent rien au
téléchargement.

Les ambiances se lisent **en flux**, à l'entrée dans une pièce qui les joue : un
joueur n'en télécharge que ce qu'il en écoute. Les cris, courts, sont tirés et
décodés au premier geste.

## Les animations d'origami

**Tu n'as rien à modéliser à la main.** Tu fournis un crease pattern, le pipeline
produit l'animation :

```bash
npx playwright install chromium     # une seule fois
npm run bake -- content/origami/pont.svg --name pont
```

### Ce qui se passe

1. Le script clone Origami Simulator dans `tools/vendor/` (une fois) et le sert
   en local.
2. Chromium headless l'ouvre, avec WebGL logiciel (SwiftShader) — pas besoin de GPU.
3. Le CP est chargé par `globals.importer.importDemoFile()`.
4. Pour chaque pose : on fixe `globals.creasePercent`, on lève
   `globals.shouldChangeCreasePercent` (**sans ce drapeau le solveur ignore la
   nouvelle valeur** et tourne indéfiniment sur celle figée à l'init des shaders),
   puis on itère le solveur GPU.
5. On lit `globals.model.getPositionsArray()` et on empile les poses.
6. Le tout est écrit dans un `.origami` (format décrit dans `src/origami/foldFile.ts`).

Au runtime, `OrigamiLayer` interpole linéairement entre deux poses. Toutes les
poses partagent la même topologie, donc c'est un simple `lerp` sur un
`Float32Array` : aucun solveur ne tourne sur le téléphone.

### Format du crease pattern

Un SVG où la couleur du trait porte le sens du pli — la convention d'Origami
Simulator :

| Couleur | Sens |
| --- | --- |
| rouge | pli montagne |
| bleu | pli vallée |
| noir | bord / découpe |
| gris clair | pli plat (facultatif) |

Inkscape ou Illustrator suffisent. Les `.fold` sont acceptés aussi.

⚠ **Pas de commentaire XML dans le fichier.** Un `<!-- … -->` avant `<svg>` fait
sortir le même carré à 440 sommets au lieu de 4, et le solveur froisse le papier
au lieu de le plier. Les CP du dépôt sont des exports ORIPA : garder cette forme.

⚠ **Arrondir les coordonnées à l'intégration.** ORIPA écrit le même sommet
`585.7864376268969` d'un côté et `585.7864376269122` de l'autre, et des zéros en
notation `5.55E-14` : l'importateur y voit deux points, et le pot sortait à 440
sommets au lieu de 18 — le même symptôme que ci-dessus. Six décimales suffisent,
et le fichier de `content/origami/` doit rester **identique** à celui servi dans
`public/assets/enigmes/<nom>/solution.svg`.

### Ce que le pipeline sait et ne sait pas faire

Origami Simulator **relaxe une feuille physique** ; ce n'est pas un solveur de
pliage rigide et **il ne gère pas les collisions entre couches**. Conséquences
mesurées sur ce projet :

- Les pliages à peu de couches convergent bien : bases (waterbomb, poisson),
  tessellations, Miura-ori, hypars. C'est là que l'effet est le plus spectaculaire.
- La grue traditionnelle ne se referme pas complètement : à 100 % on obtient un
  effondrement crédible, pas une grue nette. Les pliages à peu de couches, eux
  (bases, tessellations, le pont), convergent proprement.
  C'est une limite du modèle physique, **pas un manque d'itérations** — vérifié :
  passer de 600 à 2500 itérations par pose donne un résultat *moins* replié.
- Certains CP dégénèrent (géométrie réduite à un point). Le script le détecte et
  s'arrête plutôt que d'écrire un asset vide.

**En pratique** : choisis des CP qui simulent bien, et si un pliage « héros » doit
être parfait, modélise celui-là à la main dans Blender (shape keys -> morph
targets glTF) — le format runtime est le même.

### Réglages

| Option | Défaut | Rôle |
| --- | --- | --- |
| `--frames` | 24 | nombre de poses (coût linéaire en taille de fichier) |
| `--steps` | 400 | itérations du solveur entre deux poses |
| `--settle` | 1500 | itérations supplémentaires sur la pose finale |
| `--debug` | — | ouvre le navigateur pour voir la simulation |

## Architecture

```
content/story.ink            narration (éditable sans toucher au code)
content/langues/*.po         traductions, une langue par fichier (clé : le français)
content/origami/*.svg        crease patterns sources
game-design/scenes/*.tmj     géométrie des scènes (Tiled) — fait foi
game-design/enigmes/*.json   découpage des énigmes (decoupage.html) — fait foi
public/assets/origami/*.origami  animations bakées
src/
  main.ts                    assemble les modules ci-dessous, sans logique propre
  langues/
    langue.ts                la langue de la partie : options, navigateur, repli
    traduire.ts              `t('…')` pour l'interface, et le récit traduit
    catalogues.ts            les langues compilées par `npm run ink`
    page.ts                  `lang` et textes d'index.html
  sons/
    catalogue.ts             les fichiers son, ambiances et bruitages
    contexte.ts              l'AudioContext, né au premier geste (iOS, Chromium)
    ambiance.ts              l'ambiance de la pièce, en flux et en fondu enchaîné
    bruitages.ts             les cris et bruits, décodés une fois
    sons-reglages.ts         le mélange, écrit par sons.html
  game/
    config.ts                résolution logique, seuil tactile, palette
    chapitres.ts             quelles scènes cette version embarque, où elle s'arrête
    moteur.ts                le jeu Phaser et sa configuration
    navigation.ts            quelle pièce est à l'écran, ou l'écran de fin
    gel.ts                   figer les scènes (menu ouvert, fin de partie)
    effets-du-recit.ts       ce que chaque tag ink fait au jeu
    scenes/pont-scene.ts     décor + hotspots
    puzzle/crease-puzzle.ts  minijeu de reconstitution (DOM)
    puzzle/jouer-enigme.ts   le tag `# puzzle:` : ouvre l'énigme, publie le verdict
    puzzle/decoupage.ts      pièces polygonales : boîtes, masques, détourage
    puzzle/puzzles.ts        registre des énigmes, en données
    puzzle/tutoriel.ts       le tutoriel, posé sur l'énigme ouverte
    puzzle/tutoriels.ts      son texte et son enchaînement, en données
    systems/state.ts         état sérialisable (drapeaux, inventaire)
    systems/sauvegarde-a-la-sortie.ts  écrit l'état quand l'onglet disparaît
    systems/hotspots.ts      définition des zones et des verbes
    systems/dialogue.ts      pont ink <-> UI, gestion des tags
    scenes/origami-decor.ts  les modèles pliés, posés dans le décor
    scenes/fond.ts           le terrain peint, posé par le plan de scène
    scenes/ciel.ts           le ciel, son soleil et ses nuages (peints)
  origami/
    fold-file.ts             parseur du format .origami + interpolation
    origami-layer.ts         animation de pliage, three.js (import dynamique)
    couche-du-recit.ts       la couche 3D du récit : pliage d'un `# origami:`, aperçu
    apercu.ts                image fixe d'un modèle plié (décor, inventaire, énigme)
    papier.ts                recto/verso de chaque modèle, textures peintes
    vue.ts                   angle et lumière, partagés par tous les rendus
  ui/
    overlay.ts               dialogues, inventaire, menu de verbes (DOM)
    cadre.ts                 recale l'UI sur le canvas letterboxé (syncStage)
    isolation.ts             un tap né dans l'UI ne remonte pas jusqu'au jeu
    fin.ts                   « À suivre… » hors de la traversée livrée
    credits.ts               les crédits, après la dernière réplique de l'histoire
    credits-texte.ts         ce qu'ils disent, rangé en sections
    vignettes.ts             image d'un objet d'inventaire
    style.css
  dev/
    orientation.ts           page de réglage des poses (hors build)
    sons.ts                  page de réglage du mélange (hors build)
    console.ts               raccourcis de console en développement
    decoupage.ts             éditeur de découpage des énigmes (hors build)
    couper.ts                fendre une pièce le long d'un trait
tools/
  alleger-ambiance.mjs       ambiance de l'artiste -> MP3 au débit du jeu
  bake-origami.mjs           CP -> .origami
  compile-ink.mjs            .ink -> .json, pour chaque langue
  langues.mjs                tient et vérifie les catalogues de traduction
  lib/langues.mjs            ce qui est à traduire, et sa substitution (partagé)
  import-decoupage.mjs       découpages -> src/generated/enigmes.ts
  lib/decoupage.mjs          pavage, unicité de la solution (partagé)
  lib/dist-itch.mjs          ce que dist/ doit respecter pour itch.io (partagé)
  pack-itch.mjs              dist/ -> zip vérifié pour itch.io
  publier-itch.mjs           dist/ -> itch.io par butler, page laissée en Draft
  pull-assets.mjs            dossier partagé de l'artiste -> assets-src/
```

### Deux décisions structurantes

**L'UI est en DOM, pas dans le canvas.** Le texte reste net à toutes les densités
d'écran, le retour à la ligne et l'accessibilité sont gratuits, et itérer sur la
mise en page se fait en CSS. `syncStage()` recale la couche DOM sur le canvas
Phaser à chaque redimensionnement — sans ça, l'UI dérive sur les bandes du
letterbox dès qu'on quitte le 16:9, c'est-à-dire sur à peu près tous les
téléphones.

**Les effets de jeu passent par des tags ink**, pas par du code par hotspot :

```ink
=== desk_use ===
Le tracé est juste, le papier sait quoi faire. # origami: pont # flag: pont_plie
-> DONE
```

Tags disponibles : `give`, `drop`, `flag`, `unflag`, `origami`, `goto`, `puzzle`,
`then`, `qui`, `fin`. En ajouter
un = une entrée dans `handlers` (`src/game/systems/dialogue.ts`).

**Une exception** : ce qui se dit pendant une énigme n'est pas dans ink — le
texte des tutoriels vit dans
[`src/game/puzzle/tutoriels.ts`](src/game/puzzle/tutoriels.ts), la réplique d'une
vérification fausse dans [`src/game/puzzle/erreur.ts`](src/game/puzzle/erreur.ts).
Le récit attend alors le verdict de l'énigme, et `DialogueRunner` refuse d'être
relancé pendant qu'il tourne — les répliques ne s'afficheraient jamais. La
feuille de démonstration d'un tutoriel est un vrai pliage :

```bash
npm run bake -- content/origami/vallee.svg --name vallee --frames 16 --steps 2000
```

## Contraintes mobile prises en compte

- **Pas de survol** : un tap sur un hotspot ouvre un menu de verbes contextuel.
  Des points lumineux pulsants signalent les zones actives, sinon elles sont
  invisibles au doigt.
- **Cibles tactiles** : `touchRect()` élargit toute zone à 88 unités logiques
  minimum ; l'UI DOM garde des boutons à 44 px **réels** même quand le décor
  rétrécit (`--ui-scale` ne descend pas sous 0.62).
- **Priorité des hotspots** : les zones se chevauchent (le diagramme est posé
  *sur* l'établi) ; la profondeur est assignée par surface croissante, sinon la
  grande zone avale les taps destinés au détail.
- **Audio** : le contexte est débloqué au premier `pointerdown` (obligatoire sur iOS).
- **Sauvegarde** : écrite sur `visibilitychange`/`pagehide`, le dernier moment
  fiable avant qu'iOS ne tue l'onglet. Échec silencieux en navigation privée.
- **Zoom / pull-to-refresh** désactivés (`touch-action`, `overscroll-behavior`).

## Publier sur itch.io

Ce qui part en ligne se joue **jusqu'à la fin de l'histoire**, au bout du
chapitre 3. Pour faire essayer un chapitre sans le raccorder, la frontière tient
en une ligne de [`src/game/chapitres.ts`](src/game/chapitres.ts) : la traversée
s'arrête alors sur « À suivre… » (`src/ui/fin.ts`) — la narration, elle, ignore
quels chapitres ont été compilés.

### Une fois pour toutes

1. Installer butler, le client officiel d'itch.io, et le rendre atteignable
   depuis le PATH.
2. `butler login` — ouvre le navigateur, garde la clé pour les fois d'après.
3. Créer le projet sur itch.io — butler envoie des builds, il ne crée pas la
   page.

### À chaque version

```bash
npm run build && npm run itch
```

La cible est écrite dans `publier-itch.mjs` (`louis-mon/ori-quest`, l'adresse du
projet dans son URL) ; un argument ou `ITCH_CIBLE` la remplacent, pour un compte
de test.

Le build part sur le canal `html5` — itch.io lit `html` dans le nom du canal et
marque le fichier comme jouable en navigateur — sous la version
`<celle de package.json>+<commit>`, seul lien entre un build en ligne et l'état
du dépôt qui l'a produit.

**La page reste en Draft, et rien dans ces commandes ne peut l'en sortir** :
butler ne dépose que des fichiers. Un jeu ne devient visible qu'au bouton
« Publish » de son tableau de bord ; tant qu'il est en Draft, il ne s'ouvre que
connecté avec le compte qui le possède.

Restent les réglages qui ne sont pas dans le fichier envoyé, à faire une fois
dans le tableau de bord (`npm run itch` les rappelle après chaque envoi) :
fenêtre 1280 × 720, bouton plein écran — le seul du jeu une fois en ligne, le
menu s'effaçant devant lui —, « Mobile friendly » en paysage, et
**SharedArrayBuffer décoché** — inutile ici, et son implémentation itch.io casse
le chargement hors Chrome.

`npm run zip` reste la voie manuelle, pour téléverser depuis le navigateur. Les
deux routes envoient le même `dist/` et le vérifient de la même façon
(`tools/lib/dist-itch.mjs`) : `index.html` à la racine, aucun chemin absolu —
itch.io sert le jeu depuis un sous-dossier arbitraire.

### Voir le build avant de l'envoyer

`npm run preview` sert `dist/` tel qu'il sera livré, avec le délai anti-tap
réel, que le serveur de dev n'a pas.

## Orientation

**Le jeu est verrouillé en paysage** (1280×720). Sur téléphone en portrait, une
invite « Tourne ton téléphone » masque le jeu — en CSS pur
(`@media (orientation: portrait) and (max-width: 900px)`), sans JS.

C'est nécessaire : la case « orientation » d'itch.io n'est qu'une suggestion au
navigateur, elle ne force rien. Penser à la régler sur **landscape** malgré tout,
pour que le plein écran parte dans le bon sens.

## Points ouverts

- **Rien ne remet l'état à zéro entre deux chapitres**, alors que le game design
  le prévoit (voir [game-design/02-chapitres-et-scenes.md](game-design/02-chapitres-et-scenes.md)).
  Sans conséquence tant que les drapeaux d'un chapitre ne servent pas au suivant.
