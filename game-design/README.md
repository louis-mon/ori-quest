# Game design — Ori-Quest

Les décisions de conception du jeu. Le code documente _comment_ ; ces fichiers
documentent _pourquoi_.

| Document                                                   | Sujet                                              |
| ---------------------------------------------------------- | -------------------------------------------------- |
| [01-boucle-de-jeu.md](01-boucle-de-jeu.md)                 | la boucle idée → feuille → minijeu → pliage        |
| [02-chapitres-et-scenes.md](02-chapitres-et-scenes.md)     | découpage en chapitres, navigation                 |
| [03-langage-visuel.md](03-langage-visuel.md)               | la cocotte, les flèches, la lisibilité tactile     |
| [04-interface.md](04-interface.md)                         | verbes, inventaire, carnet d'idées                 |
| [05-puzzle-crease-pattern.md](05-puzzle-crease-pattern.md) | le minijeu : reconstituer le crease pattern        |
| [06-plans-de-scene.md](06-plans-de-scene.md)               | la carte Tiled qui donne les positions d'une scène |

## Le pitch en une phrase

On explore des scènes, on y glane des **idées d'origami**, et on les réalise sur
les **feuilles de papier** rencontrées — chaque pliage réussi fait avancer
l'aventure.

## Les trois partis pris

**Le papier est le seul verbe.** Le joueur collectionne d'abord des
_savoir-faire_ : ce qu'il emporte d'une scène à l'autre, ce sont des idées de
pliage — et le peu d'objets qu'il ramasse tient dans la même liste, se dépense
pareil, et ne franchit pas la fin du chapitre.

**Le pliage est un moment, pas une icône.** Chaque origami réussi déclenche une
animation de pliage réelle, calculée depuis un vrai crease pattern. C'est la
récompense, et c'est ce qui distingue le jeu.

**Tout se joue au pouce.** Conçu pour un téléphone tenu en paysage, sans survol,
sans double-clic, sans glisser-déposer.

## Statut

Ces documents décrivent la cible. L'implémentation couvre aujourd'hui le
chapitre 1 — deux scènes, la navigation, l'inventaire, le minijeu et l'animation
de pliage — sur un récit encore largement « À ÉCRIRE ». Les écarts sont signalés
par **⚠ pas encore implémenté**.

Les questions non tranchées sont marquées **❓ à décider** — ce sont des
décisions qui attendent, pas des oublis. Il n'en reste aucune : le mauvais choix
de modèle, le minijeu, l'indépendance des chapitres et la forme du carnet sont
tranchés.
