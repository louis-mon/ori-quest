// Narration d'Ori-Quest. Compilée en JSON par `npm run ink`.
//
// Pas de flux principal : chaque knot est un point d'entrée appelé par son nom
// depuis un hotspot (`knots:` dans src/game/scenes/). Un knot renommé casse la
// scène sans erreur de compilation — `grep` dans src/ avant de renommer. Tout
// knot appelé depuis une scène se termine par `-> DONE`.
//
// Effets de jeu, tous définis dans `handlers` (src/game/systems/dialogue.ts) :
//   # give: / # drop: <objet>    inventaire
//   # flag: / # unflag: <nom>    drapeau
//   # origami: <nom>             joue <nom>.origami et attend la fin
//   # goto: <scène>              change de scène
//   # puzzle: <nom>              ouvre une énigme et attend son verdict
//   # then: <knot>               repart au knot, une fois les tags appliqués
//
// Les `VAR` ci-dessous sont un miroir en lecture seule de l'état de jeu, poussé
// par le TS (préfixes `flag_` et `has_`). Les affecter avec `~` n'atteint pas
// le jeu et ne survit pas à la sauvegarde : un drapeau se lève avec `# flag:`.
// Les compteurs de visite et les choix `*` déjà pris ne sont pas sauvegardés
// non plus — toute progression réelle passe par un drapeau.
//
// ⚠ Le même piège vaut pour `# flag:` quand un CHOIX en dépend : ink construit
// la liste des choix pendant le `Continue()` qui émet le tag, donc avant que le
// drapeau ne soit levé. Un menu de dialogue qui se rouvre après avoir levé un
// drapeau doit donc y revenir par `# then:`, pas par un divert `->`.
//
// ⚠ `TODO` est un mot-clé d'ink : une ligne qui commence par TODO est avalée
// par le compilateur, avec les tags qu'elle porte. D'où « À ÉCRIRE », que
// `grep -n "À ÉCRIRE" content/story.ink` liste.


// Chapitre 1 — le pont
VAR flag_pont_vu = false
VAR flag_pont_resolu = false
VAR flag_pont_plie = false

// Chapitre 1 — l'arbre. `flag_arbre_parle` est un savoir acquis pour de bon,
// `has_idee_arbre` une idée qu'on porte et qui se dépense au pliage. Sans le
// drapeau, la scène de première rencontre rejouerait dès l'idée dépensée.
VAR flag_arbre_parle = false
VAR has_idee_arbre = false
VAR flag_arbre_resolu = false
VAR flag_arbre_plie = false
// L'accord du fils. C'est un savoir acquis, pas un objet : il est demandé une
// fois et vaut pour toujours, y compris après que la hache a changé de main.
VAR flag_arbre_demande = false
VAR flag_vieil_arbre_decoupe = false

// Chapitre 1 — la porte. Même partage : ce que le renard a dit reste su
// (`flag_renard_bois_su`), l'idée qu'on en tire se dépense.
VAR flag_porte_vue = false
VAR flag_porte_disparue = false
VAR flag_renard_bois_su = false
VAR has_idee_hache = false
VAR flag_hache_pliee = false
VAR flag_hache_resolu = false
VAR flag_porte_resolu = false
VAR flag_porte_plie = false

// Les objets. Une idée en est un — même inventaire, même `has_` — et tout se
// consomme à l'usage (src/game/systems/objets.ts).
VAR has_hache = false
VAR has_bois = false

// ink exige un knot avant tout contenu libre, et ce fichier n'en a pas.
=== function _unused ===
~ return

// ================================================================
// Chapitre 1 — Le pont
// Voir game-design/scenes/chapter-1/le-pont.md
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (PontScene.create).
=== pont_arrivee ===
# qui: heros
Pfiou... ce voyage de retour dans mon pays natal a été épuisant. Crôa crôa
J'ai hâte de retrouver tous mes amis !
Tiens, je ne me rappelais pas que la route était bloquée ici, qu'est-ce qu'il s'est passé ?
# flag: pont_vu
-> DONE

=== pont_precipice ===
# qui: heros
J'aurais juré qu'on pouvait traverser ici avant... Crôa crôa
Il devait y avoir un pont, mais plus aucune trace.
-> DONE

=== pont_pont ===
# qui: heros
Ok, heureusement que je ne suis pas trop lourd et que j'ai pas trop le vertige... On va y aller doucement, c'est pas rassurant.
-> DONE

// Examiner la feuille ouvre le choix du modèle. Choisir le pont lance l'énigme.
=== pont_feuille ===
Une feuille de papier est posée devant le précipice.
# qui: heros
Je devrais bien pouvoir en faire quelque chose
+ [plier une catapulte]
    Si je traverse en catapulte, je risque de finir en pâté de grenouille...
+ [plier un pont]
    Je me disais bien qu'il y avait un pont ici avant.
    -> pont_enigme
+ [plier un avion]
    Ça a l'air rigolo, mais j'ai bien peur de ne pas savoir piloter un tel engin...
+ [se moucher avec]
    J'ai attrapé froid avec ce voyage, mais cette feuille a l'air utile. Je trouverai bien des mouchoirs en rentrant.
// Gather obligatoire : le `-> DONE` ci-dessous est au niveau du knot et ne
// rattrape pas les branches, qui tomberaient dans le vide.
- -> DONE

=== pont_enigme ===
# qui: heros
Je vais pouvoir mettre en pratique mes talents d'origamiste ! Revoyons les bases.
-> pont_enigme_lancement

// Tag seul, sans texte : ink évalue en avance, donc une condition écrite à la
// suite serait résolue AVANT le verdict de l'énigme. C'est `# then:` qui relance
// le récit, une fois le drapeau à jour. Ne pas écrire cette destination en
// `-> knot` dans le tag : ink y verrait un divert et l'exécuterait lui-même.
=== pont_enigme_lancement ===
# puzzle: pont # then: pont_enigme_issue
-> DONE

=== pont_enigme_issue ===
{ flag_pont_resolu:
    Je n'ai pas trop perdu de mes talents d'origamiste. Bon, ce n'était que deux plis. # origami: pont # flag: pont_plie
    Le pont se positionne pile au-dessus du vide, je vais pouvoir rentrer chez moi !
  - else:
    Hmm je crois avoir le syndrome de la page blanche...
}
-> DONE


// Le jeune arbre parle : c'est lui qui donne l'idée de l'arbre, puis le droit
// moral de découper son père.
=== pont_arbre ===
{ flag_arbre_parle: -> pont_arbre_revoir }
# qui: narrateur
Un jeune chêne qui a l'air triste.
# qui: heros
Salut l'ami, tu as bien grandi depuis la dernière fois ! Tu n'étais qu'une jeune pousse.
# qui: arbre
...
# qui: heros
Ça n'a pas l'air d'être la grande forme, tu fais une gueule d'enterrement, qu'est-ce qui t'arrive ? Crôa crôa
# qui: arbre
Snif... Mon père, le vieux chêne vénérable, n'est plus. Je ne peux même pas honorer sa dépouille comme il se doit, il a disparu.
# qui: heros
Oh quel gâchis, on aurait pu en faire de belles armoires...
# qui: arbre
Oui quelle tristesse... Snif
# qui: narrateur
La grenouille retient la forme de l'arbre : ça pourrait être utile. # flag: arbre_parle # give: idee_arbre
-> DONE

// Visites suivantes. La demande n'a de sens qu'une fois le père replié ET la
// hache en main : avant, le héros n'a rien à montrer ni rien à offrir.
//
// ⚠ L'accord se teste EN PREMIER. Le drapeau que la demande lève ne ferme
// aucune des conditions qui la déclenchent : testé en dernier, il ne serait
// jamais atteint et la scène se rejouerait à chaque visite. Chaque branche d'un
// bloc conditionnel commence par un tiret — sans lui, `flag_arbre_demande:`
// n'est pas une condition mais une ligne de dialogue, affichée telle quelle.
=== pont_arbre_revoir ===
// Trois branches : chacune commence par un tiret, condition comprise. Sans
// lui, ink refuse la deuxième condition — ou, si le tiret manque à la seule
// deuxième, la lit comme une ligne de dialogue et l'affiche telle quelle.
{
  - flag_arbre_demande:
    # qui: arbre
    J'espère qu'il fera de beaux meubles !
  - flag_arbre_plie && has_hache:
    # qui: heros
    J'ai replié ton père, le vieux chêne vénérable ! Tu vas pouvoir te recueillir. En plus le pont est à nouveau là.
    # qui: arbre
    Oh, je suis tellement content ! Peut-être qu'il pourra devenir une magnifique armoire maintenant.
    # qui: heros
    Justement... J'ai besoin de réparer une porte.
    # qui: arbre
    Bon, j'imagine que c'est déjà ça. Ça fera un bel hommage.
    # qui: heros
    Merci, s'il reste des planches on pourra peut-être faire de beaux meubles au château.
    # flag: arbre_demande
  - else:
    # qui: arbre
    Snif...
}
-> DONE

// La grande feuille de la rive d'en face — le vieil arbre en puissance.
=== pont_feuille_vieil_arbre ===
# qui: heros
{ flag_arbre_plie: -> pont_vieil_arbre_plie }
{ not has_idee_arbre:
    Une grande feuille aux teintes de... feuille. Je ne sais pas quoi en faire pour le moment.
    -> DONE
}
Ca doit être là que se trouvait le vieil arbre. Je peux le faire revenir.
-> pont_arbre_enigme

=== pont_arbre_enigme ===
# qui: heros
Essayons de reproduire ce modèle d'arbre.
-> pont_arbre_enigme_lancement

=== pont_arbre_enigme_lancement ===
# puzzle: arbre # then: pont_arbre_enigme_issue
-> DONE

=== pont_arbre_enigme_issue ===
{ flag_arbre_resolu:
    # origami: arbre # flag: arbre_plie # drop: idee_arbre
    -> pont_vieil_arbre_plie
  - else:
    # qui: heros
    Je n'arrive pas à en tirer quoi que ce soit.
}
-> DONE

// L'arbre plié. C'est ici qu'on obtient le bois, et seulement avec la hache —
// qui s'y consomme.
=== pont_vieil_arbre_plie ===
// Deux verrous, et pas un seul : la lame, et l'accord du fils. C'est lui qui
// donne le droit moral de découper son père — sans quoi le geste n'est qu'un
// abattage (game-design/scenes/chapter-1/le-pont.md).
{ not has_hache:
    # qui: narrateur
    Le majestueux vieux chêne se dresse au bord du vide.
    -> DONE
}
{ not flag_arbre_demande:
    # qui: heros
    Je pourrais couper l'arbre avec ma hache pour réparer la porte, mais je ne veux pas commettre un arbricide, même s'il paraît qu'il est déjà mort.
    Je devrais demander l'autorisation à son fils d'abord.
    -> DONE
}
# qui: heros
Je suis un peu ému à l'idée de transformer en planches ce respectable voisin que je connais depuis mon enfance...
+ [découper le vieil arbre]
    # qui: narrateur
    La hache travaille et notre vaillante grenouille est épuisée. Une bonne odeur de sciure embaume l'air, et une pile de belles planches est prête !
    # give: bois # drop: hache # flag: vieil_arbre_decoupe
+ [le laisser debout]
    Je n'ai pas le coeur à faire ça pour l'instant...
- -> DONE


// ================================================================
// Chapitre 1 — La porte
// Voir game-design/scenes/chapter-1/la-porte.md
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (PorteScene.create).
=== porte_arrivee ===
# qui: heros
Me voici arrivé devant le village fortifié du château. Mais je ne vois plus de porte... Encore un mystère à élucider.
# flag: porte_vue
-> DONE

// Le renard est la seule source d'information du chapitre. Chaque révélation
// lève un drapeau, et le drapeau ouvre l'option suivante — plutôt que des choix
// `*` consommés, qui repartiraient à zéro au rechargement.
//
// ⚠ Le retour au menu passe par `# then:`, jamais par `-> porte_renard_choix` :
// ink construit la liste des choix pendant le `Continue()` qui émet le tag, donc
// avant que le drapeau ne soit levé.
=== porte_renard ===
# qui: renard
Mais voici notre origamiste royal de retour !
# qui: heros
Content de te revoir, Monsieur le Renard Futé !
Même si tu n'as pas l'air malin coincé ici.
Dis-moi, tu n'as pas une idée de ce qu'il se passe ici ? D'abord le pont avait disparu et j'ai dû le replier, ensuite impossible de rentrer en ville, il y a juste une muraille.
Beaucoup de choses ont changé depuis mon départ...
-> porte_renard_choix

=== porte_renard_choix ===
+ { not flag_porte_disparue } [Pourquoi tu restes planté là ? Tu n'as pas un vilain tour à préparer pour embêter le Petit Chat ?]
    # qui: renard
    Ahah, très drôle. Moi aussi je voudrais bien rentrer. J'étais parti chercher des insectes effrayants pour faire peur au Petit Chat.
    Mais quand je suis revenu, plus de porte. À la place, il y a ce papier.
    # flag: porte_disparue # then: porte_renard_choix
+ { flag_porte_disparue && not flag_renard_bois_su } [Parle moi de la porte]
    # qui: renard
    Bah, qu'est-ce que tu veux que je te dise...
    # qui: heros
    Je suis parti pendant longtemps, je me rappelle plus bien comment elle était, cette porte.
    La réparer serait utile, mais aide moi à me souvenir.
    # qui: renard
    C'était une porte en bois rectangulaire, je sais pas quoi te dire de plus...
    # qui: heros
    Bon, ça ira, je vais voir ce que je peux faire.
    # qui: renard
    Dépêche-toi, les insectes effrayants me courent partout dessus, ça me chatouille.
    # flag: renard_bois_su # then: porte_renard_choix
+ { flag_renard_bois_su && not has_idee_hache && not flag_hache_pliee } [Tu as du bois ?]
    # qui: renard
    Non, mais avec une hache tu pourrais couper des arbres pour en trouver.
    # qui: heros
    Je suis origamiste, pas bûcheron, mais merci pour l'idée.
    # give: idee_hache # then: porte_renard_choix
+ [Partir]
- -> DONE

// La grande feuille tendue dans l'embrasure, à la place du battant.
=== porte_porte ===
# qui: heros
{
  - has_bois:
    Je vais pouvoir reconstruire la porte avec ces magnifiques planches de bois.
    -> porte_enigme
  - flag_renard_bois_su:
    J'ai besoin de bois pour fabriquer la porte.
  - else:
    Je crois qu'il y avait une porte ici avant, mais je ne me rappelle plus trop comment elle était.
}
-> DONE

=== porte_enigme ===
-> porte_enigme_lancement

=== porte_enigme_lancement ===
# puzzle: porte # then: porte_enigme_issue
-> DONE

=== porte_enigme_issue ===
{ flag_porte_resolu:
    # qui: narrateur
    La feuille de papier se transforme en une imposante porte. # origami: porte # flag: porte_plie # drop: bois
    # qui: heros
    Je vais pouvoir retourner au village !
  - else:
    # qui: heros
    J'ai un trou de mémoire...
}
-> DONE

// Le papier métallisé, qui deviendra la hache. C'est le PLIAGE qui le fait
// disparaître de la scène (`flag_hache_pliee`), pas la possession de la hache :
// celle-ci se dépense plus tard, et la feuille reviendrait.
=== porte_feuille_hache ===
{ not has_idee_hache:
    Une feuille de papier légèrement métallisée. Quoi faire avec ?
    -> DONE
}
# qui: heros
Voilà un papier parfait pour plier une hache. Le côté métallisé fera une belle lame bien tranchante.
-> porte_hache_enigme

=== porte_hache_enigme ===
-> porte_hache_enigme_lancement

=== porte_hache_enigme_lancement ===
# puzzle: hache # then: porte_hache_enigme_issue
-> DONE

=== porte_hache_enigme_issue ===
# qui: heros
{ flag_hache_resolu:
    Celui là était plus complexe. # origami: hache # flag: hache_pliee # give: hache # drop: idee_hache
    Je vais pouvoir faire de belles planches avec cette hache toute neuve !
  - else:
    Ça ne doit pas être ça...
}
-> DONE

// Franchir la porte referme le chapitre.
//
// ⚠ Pas de `# goto:` : le chapitre 2 n'existe pas. Le jour où il existera, ce
// knot est le seul endroit à modifier.
=== porte_fin_chapitre ===
# qui: heros
Hâte de retourner à la maison ! Je suis quand même un peu inquiet de ce qui m'attend là-bas, j'espère que je ne vais pas voir un tas de feuilles dépliées à la place.
-> DONE


// ================================================================
// Le héros
// ================================================================

// Partagé par toutes les scènes : ce que le héros pense de lui-même ne change
// pas d'une pièce à l'autre. Il se découpera par scène le jour où ça comptera.
=== heros ===
# qui: heros
Je reviens d'un long voyage à l'étranger et je suis épuisé. Hâte de retrouver le confort du château !
Je suis l'origamiste royal de Sa Majesté Le Libou des Bois Jolis.
-> DONE
