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
| `npm run ink` | compile `content/story.ink` -> `src/generated/story.json` |
| `npm run scenes` | cartes Tiled `game-design/scenes/` -> `src/generated/scenes/` |
| `npm run bake -- <cp.svg>` | crease pattern -> animation `.origami` |

Page de réglage, en développement uniquement (hors build) :
`http://localhost:5173/orientation.html` — la pose de chaque modèle plié
(orientation à la souris, pliage final, taille dans le décor). « Enregistrer »
écrit `src/origami/poses.ts` directement, par un point d'entrée du serveur de
dev défini dans `vite.config.ts`.
| `npm run zip` | prépare `ori-quest-itch.zip` pour itch.io |

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

### Reprendre à un point précis du chapitre

Le menu du jeu porte, **en développement seulement**, une liste « Reprendre à… »
qui reconstitue un moment de la partie — pont posé, hache en main, bois en
poche… Rejouer tout le chapitre pour vérifier une correction de fin coûte
plusieurs minutes et une énigme ; ces entrées suppriment ce coût.

Le menu ne porte **qu'une entrée par chapitre** ; elle ouvre une fenêtre avec
les étapes de ce chapitre. Tout mettre à plat noyait les deux entrées qui
comptent vraiment, plein écran et recommencer.

Les étapes sont des données, dans
[`src/game/systems/etapes.ts`](src/game/systems/etapes.ts) : chacune décrit
l'état **complet** attendu (scène, drapeaux, inventaire), pas un écart par
rapport à la précédente. Elles rechargent la page, comme « Recommencer » — le
récit ink garde ses propres variables dans son instance `Story`, que l'état de
jeu ne touche pas.

`import.meta.env.DEV` étant remplacé par une constante à la compilation, ce menu
et son module disparaissent entièrement du build publié.

## Stack

| Rôle | Choix | Licence |
| --- | --- | --- |
| Moteur 2D | Phaser 4 | MIT |
| Narration | inkjs (langage ink d'inkle) | MIT |
| Origami 3D | three.js | MIT |
| Bake origami | Origami Simulator (A. Ghassaei) + Playwright | MIT |
| Build | Vite + TypeScript | MIT |

Tout est permissif. **Rabbit Ear a été volontairement écarté : il est en GPLv3**,
et le lier dans le bundle obligerait à publier le jeu entier sous GPLv3.

### Poids réel (build actuel, gzip)

| Chunk | Taille | Quand |
| --- | --- | --- |
| Phaser | 381 Ko | au démarrage |
| app + CSS | 41 Ko | au démarrage |
| three.js | 190 Ko | **à la demande**, au premier pliage |
| `pont.origami` | 2 Ko | à la demande |

Soit ~435 Ko avant le premier écran. `three` est derrière un `await import()`
dans `OrigamiLayer` et dans `apercu.ts` : un joueur qui n'atteint jamais une
scène avec origami ne le télécharge pas.

⚠ Le décor affiche les modèles pliés (voir plus bas), et ces images passent par
three.js elles aussi. Le rendu n'est donc demandé **qu'à la première apparition**
du modèle (`montrer()` dans `origami-decor.ts`) : ouvrir la première scène, où
rien n'est encore plié, ne charge toujours rien. Vérifiable en console :

```js
performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /three/.test(n))
```

Les textures de papier, elles, sont **peintes au canvas** et ne pèsent rien au
téléchargement.

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
content/origami/*.svg        crease patterns sources
public/assets/origami/*.origami  animations bakées
src/
  main.ts                    bootstrap, syncStage, déblocage audio, sauvegarde
  game/
    config.ts                résolution logique, seuil tactile, palette
    scenes/pont-scene.ts     décor + hotspots
    puzzle/crease-puzzle.ts  minijeu de reconstitution (DOM)
    puzzle/puzzles.ts        registre des énigmes, en données
    systems/state.ts         état sérialisable (drapeaux, inventaire)
    systems/hotspots.ts      définition des zones et des verbes
    systems/dialogue.ts      pont ink <-> UI, gestion des tags
    scenes/origami-decor.ts  les modèles pliés, posés dans le décor
  origami/
    fold-file.ts             parseur du format .origami + interpolation
    origami-layer.ts         animation de pliage, three.js (import dynamique)
    apercu.ts                image fixe d'un modèle plié (décor, inventaire, énigme)
    papier.ts                recto/verso de chaque modèle, textures peintes
    vue.ts                   angle et lumière, partagés par tous les rendus
  ui/
    overlay.ts               dialogues, inventaire, menu de verbes (DOM)
    vignettes.ts             image d'un objet d'inventaire
    style.css
tools/
  bake-origami.mjs           CP -> .origami
  compile-ink.mjs            .ink -> .json
  pack-itch.mjs              dist/ -> zip vérifié pour itch.io
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
`then`, `qui`. En ajouter
un = une entrée dans `handlers` (`src/game/systems/dialogue.ts`).

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

```bash
npm run build && npm run zip
```

`pack-itch.mjs` vérifie qu'`index.html` est bien à la racine et qu'aucun chemin
absolu ne traîne (itch.io sert depuis un sous-dossier arbitraire), puis affiche
les cases à cocher côté itch.io. Laisser **SharedArrayBuffer décoché** : inutile
ici, et son implémentation itch.io casse le chargement hors Chrome.

## Orientation

**Le jeu est verrouillé en paysage** (1280×720). Sur téléphone en portrait, une
invite « Tourne ton téléphone » masque le jeu — en CSS pur
(`@media (orientation: portrait) and (max-width: 900px)`), sans JS.

C'est nécessaire : la case « orientation » d'itch.io n'est qu'une suggestion au
navigateur, elle ne force rien. Penser à la régler sur **landscape** malgré tout,
pour que le plein écran parte dans le bon sens.

## Points ouverts

- Le décor est dessiné en primitives Phaser (placeholder) — pas encore d'assets.
- Une seule scène, pas de transition entre pièces (le tag `goto:` est prêt).
