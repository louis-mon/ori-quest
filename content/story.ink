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
VAR flag_renard_vu = false
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


// Chapitre 2 — le village. Même partage qu'au chapitre 1 : ce qu'on a appris
// reste (`flag_`), ce qu'on porte se dépense (`has_`).
VAR flag_village_vu = false
VAR flag_pingouin_chaud = false
VAR flag_montagne_resolu = false
VAR flag_montagne_pliee = false
VAR flag_pingouin_chien_su = false
VAR has_idee_chien = false
VAR flag_vache_faim = false
VAR flag_herbe_resolu = false
VAR flag_herbe_pliee = false
// La touffe quitte le décor quand la vache la mange, pas quand on la plie.
VAR flag_herbe_broutee = false
VAR flag_vache_pot_su = false
VAR has_idee_pot = false
VAR flag_pot_resolu = false
VAR flag_pot_plie = false
VAR has_pot = false
VAR has_lait = false

// Chapitre 2 — l'entrée du château. Deux drapeaux y déclenchent un mouvement de
// décor (`auLeverDe` dans src/game/scenes/entree-scene.ts) : `os_tombe` fait
// sauter le Petit Chat et tomber le papier, `diplo_pousse` fait sauter Chouaf et
// s'écarter le dinosaure.
VAR flag_entree_vue = false
VAR flag_chat_vu = false
VAR flag_chat_lait = false
VAR flag_os_tombe = false
VAR flag_chien_resolu = false
VAR flag_chien_plie = false
VAR flag_os_resolu = false
VAR flag_os_plie = false
VAR has_os = false
VAR flag_diplo_su = false
VAR flag_diplo_pousse = false

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
Tiens, il me semblait qu'on pouvait traverser ce ravin avant, qu'est-ce qu'il s'est passé ?
# flag: pont_vu
-> DONE

=== pont_precipice ===
# qui: heros
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
Je devrais bien pouvoir en faire quelque chose.
+ [plier une catapulte]
    Si je traverse en catapulte, je risque de finir en pâté de grenouille...
+ [plier un pont]
    Essayons de remettre ce pont en place.
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
    Je n'ai pas trop perdu la main. Bon, ce n'était que deux plis. # origami: pont # flag: pont_plie
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
  - flag_arbre_plie:
    # qui: arbre
    Merci, Maître origamiste, d'avoir restauré le pont et feu mon vieux père.
    Les voyageurs qui se retrouvaient bloqués ici cesseront de m'importuner, et l'ombre de mon père m'évitera les coups de soleil.
  - else:
    # qui: arbre
    Snif... Mon père me manque terriblement...
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
Ça doit être là que se trouvait le vieil arbre. Je peux le faire revenir.
-> pont_arbre_enigme

=== pont_arbre_enigme ===
# qui: heros
Essayons de reproduire ce modèle d'arbre.
-> pont_arbre_enigme_lancement

=== pont_arbre_enigme_lancement ===
# puzzle: arbre # then: pont_arbre_enigme_issue
-> DONE

// ⚠ Le `# origami:` porte une réplique : sur une ligne nue le pliage se joue
// boîte fermée, et l'inventaire reste tapable par-dessus l'animation.
=== pont_arbre_enigme_issue ===
{ flag_arbre_resolu:
    # qui: heros
    Le papier se souvient de lui. # origami: arbre # flag: arbre_plie # drop: idee_arbre
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
    Je pourrais couper l'arbre avec ma hache pour réparer la porte, mais je ne veux pas commettre un arbricide, c'est un peu comme si je l'avais ressuscité en le pliant à nouveau.
    Je devrais demander l'autorisation à son fils d'abord.
    -> DONE
}
# qui: heros
Je suis un peu ému à l'idée de transformer en planches ce respectable voisin que je connais depuis mon enfance...
// ⚠ Tags sur la LIGNE DU TEXTE : seuls, ink ne les émet qu'au `Continue()`
// suivant, donc au tap qui referme la boîte — l'arbre serait resté debout
// pendant qu'on lit qu'il est abattu.
+ [découper le vieil arbre]
    # qui: narrateur
    La hache travaille et notre vaillante grenouille est épuisée. Une bonne odeur de sciure embaume l'air, et une pile de belles planches est prête ! # give: bois # drop: hache # flag: vieil_arbre_decoupe
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
// Les retrouvailles ne se jouent qu'une fois : « tu n'as pas l'air malin coincé
// ici » se retournait contre le héros une fois la porte posée.
{ flag_renard_vu: -> porte_renard_suite }
# qui: renard
Mais voici notre origamiste royal de retour !
# qui: heros
Content de te revoir, Monsieur le Renard Futé !
Même si tu n'as pas l'air malin coincé ici.
Dis-moi, tu n'as pas une idée de ce qu'il se passe ici ? D'abord le pont avait disparu et j'ai dû le replier, ensuite impossible de rentrer en ville, il y a juste une muraille.
Beaucoup de choses ont changé depuis mon départ...
# flag: renard_vu
-> porte_renard_suite

=== porte_renard_suite ===
{ - flag_porte_plie:
    # qui: renard
    La porte est de retour ! Le Petit Chat ne sait pas ce qui l'attend, héhé...
  - else:
    -> porte_renard_choix
}
-> DONE

=== porte_renard_choix ===
+ { not flag_porte_disparue } [Pourquoi tu restes planté là ? Tu n'as pas un vilain tour à préparer pour embêter le Petit Chat ?]
    # qui: renard
    Ahah, très drôle. Moi aussi je voudrais bien rentrer. J'étais parti chercher des insectes effrayants pour faire peur au Petit Chat.
    Mais quand je suis revenu, plus de porte. À la place, il y a ce papier.
    # flag: porte_disparue # then: porte_renard_choix
+ { flag_porte_disparue && not flag_renard_bois_su } [Parle-moi de la porte]
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
    Dépêche-toi, je m'inquiète quand même un peu pour le Petit Chat, je ne pourrai plus l'embêter s'il est transformé en feuille de papier.
    # flag: renard_bois_su # then: porte_renard_choix
+ { flag_renard_bois_su && not has_idee_hache && not flag_hache_pliee } [Tu as du bois ?]
    # qui: renard
    Non, mais avec une hache tu pourrais couper des arbres pour en trouver.
    # qui: heros
    Je suis origamiste, pas bûcheron, mais merci pour l'idée.
    # give: idee_hache # then: porte_renard_choix
// « Partir » seul en piste ne servait qu'à fermer une boîte que `pump()` ferme
// déjà quand il ne reste aucun choix. Compteur plutôt que liste de drapeaux :
// une option ajoutée demain n'obligera pas à la recopier ici.
+ { CHOICE_COUNT() > 0 } [Partir]
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
    Celui-là était plus complexe. # origami: hache # flag: hache_pliee # give: hache # drop: idee_hache
    Je vais pouvoir faire de belles planches avec cette hache toute neuve !
  - else:
    Je réessayerai plus tard...
}
-> DONE

// Franchir la porte referme le chapitre et ouvre le suivant.
//
// ⚠ Le `# goto:` est SEUL sur sa ligne, et c'est l'inverse de la règle des
// pliages : posé sur la ligne du texte, il partirait avant l'affichage et la
// réplique se lirait par-dessus le village. Seul, il n'est émis qu'au
// `Continue()` suivant — donc au tap qui referme la boîte.
=== porte_fin_chapitre ===
# qui: heros
Hâte de retourner à la maison ! Je suis quand même un peu inquiet de ce qui m'attend là-bas, j'espère que je ne vais pas voir un tas de feuilles dépliées à la place.
# goto: village
-> DONE


// ================================================================
// Chapitre 2 — Le village
// Voir game-design/scenes/chapter-2/le-village.md
//
// ⚠ Tout le texte du chapitre 2 est un PREMIER JET : il tient la structure, les
// conditions et l'enchaînement, pas la voix. Chaque knot à reprendre porte un
// « À ÉCRIRE » ; `grep -n "À ÉCRIRE" content/story.ink` les liste, et la marque
// s'enlève une fois les répliques réécrites.
// ================================================================

=== village_arrivee ===
# qui: heros
Me voici arrivé au village. C'est moins chaotique que ce que je craignais, il reste des habitants.
Je vais surement pouvoir en apprendre plus sur ce qu'il se passe ici.
# flag: village_vu
-> DONE


// Le pingouin. Il a trop chaud tant que la montagne n'est pas là ; à l'ombre, il
// se remet à parler, et c'est de lui que vient l'idée du chien.
=== village_pingouin ===
{ flag_pingouin_chaud: -> village_pingouin_revoir }
# qui: heros
Salut Pingouin Glagla ! Tu n'as pas l'air dans ton assiette, qu'est ce qu'il t'arrive ?
On dirait que tu vas nous faire un malaise.
# qui: pingouin
J'ai chaud... trop chaud...
# qui: heros
Oh je voie ça, tu sues à grosses gouttes mon pauvre. Désolé le réchauffement climatique tout ça...
# qui: pingouin
Ma neige... disparue... Mon délicat plumage... tout sec... Mon maquillage... tout coulé de partout...
# qui: heros
Il délire, je vais trouver de quoi régler ça avant qu'il nous fasse une syncope.
# flag: pingouin_chaud
-> DONE

// ⚠ La branche la plus avancée en premier : le drapeau que la rencontre lève ne
// ferme aucune des conditions qui la déclenchent, et testé en dernier il ne
// serait jamais atteint.
=== village_pingouin_revoir ===
{
  - flag_pingouin_chien_su:
    # qui: pingouin
    Je respire mieux avec mes neiges éternelles. Mais mon petit Chouaf me manque, il devait être devant le château.
    Oh que lui est il arrivé ? Aide moi je t'en conjure !
  - flag_montagne_pliee:
    # qui: pingouin
    Ahh ça fait plaisir cette neige et ce froid. Merci du fond du coeur.
    # qui: heros
    Tu m'as fait peur dans cet état, content que tu sois revenu parmi nous!
    # qui: pingouin
    J'ai pas compris encore comment ma montagne a pu disparaître. D'ailleurs, mon petit Chouaf n'est plus là aussi.
    # qui: heros
    C'est qui ça Chouaf ?
    # qui: pingouin
    Mon petit chien adoré. Il aboie un peu trop et ça effraie les autres villageois, mais c'est pas une raison pour le kidnapper non ?
    # qui: heros
    Heu je sais pas, à vrai dire j'ai un peu peur des chiens, je peux comprendre...
    # qui: pingouin
    Ah je vois, c'est toi qui l'as séquestré! Moi qui pensais que tu était un bon crapeau.
    # qui: heros
    Non mais on se calme, déjà je suis une grenouille pas un crapeau. Crôa crôa.
    Je vais te le retrouver ton sac à puces, sinon tu vas nous refaire une scène.
    # qui: narrateur
    La grenouille retient la forme du chien : ça pourrait être utile. # flag: pingouin_chien_su # give: idee_chien
  - else:
    # qui: pingouin
    Chaud... De la neige, de la glace, de l'ombre...
}
-> DONE


// Le grand papier gris du fond, qui deviendra la montagne. Les options ne
// s'ouvrent qu'une fois qu'on sait que le pingouin a chaud : avant, le papier
// n'est qu'un papier.
=== village_montagne ===
{ flag_montagne_pliee: -> village_montagne_pliee }
{ not flag_pingouin_chaud:
    # qui: heros
    Une grand feulle grise et blanche au fond du village. Je ne vois pas à quoi elle pourrait servir.
    -> DONE
}
# qui: heros
Une grand feulle grise et blanche au fond du village. Je pourrais l'utiliser pour aider le pingouin ?
+ [plier un frigo]
    Un frigo aurait pu être une bonne idée, mais il ne m'a pas demandé un cerceuil, en plus y'a pas de prise.
+ [plier un bonhomme de neige]
    Un bonhomme de neige ? Mouais. Si c'est pour qu'il fonde et se plaigne encore plus que le pingouin, non merci.
+ [plier une montagne]
    Ca va prendre de la place une montagne, mais au moins il aura autant de neige qu'il veut.
    -> village_montagne_enigme
+ [plier un éventail]
    Pingouin Glagla tiens à peine debout, il ne va pas faire grand chose avec cet éventail.
    Et j'ai autre chose à faire que de rester là à l'eventer.
// Gather obligatoire : le `-> DONE` du knot ne rattrape pas les branches.
- -> DONE

=== village_montagne_enigme ===
# qui: heros
Ca ne va pas être facile de plier un si grand papier, mais on va essayer.
-> village_montagne_lancement

// Tag seul, sans texte : ink évalue en avance, donc une condition écrite à la
// suite serait résolue AVANT le verdict. C'est `# then:` qui relance le récit.
=== village_montagne_lancement ===
# puzzle: montagne # then: village_montagne_issue
-> DONE

=== village_montagne_issue ===
{ flag_montagne_resolu:
    # qui: heros
    Et voilà le travail. # origami: montagne # flag: montagne_pliee
    Glace et ombre à volonté pour Madame Glagla !
  - else:
    # qui: heros
    Pourquoi un simple pli montagne ne suffit pas...
}
-> DONE

=== village_montagne_pliee ===
# qui: heros
Une montage enneigée. Je ne sais pas trop comment j'ai pu le faire finir dans le village...
Glace et ombre à volonté pour Madame Glagla !
-> DONE


// La vache. Trois états : elle a faim, elle a brouté et donne l'idée du pot,
// puis elle remplit le pot qu'on lui apporte.
//
// ⚠ Ordre des branches : la plus avancée d'abord, sinon le pot resterait vide
// pour toujours — `flag_vache_pot_su` couvrirait le cas où on le lui tend.
// À ÉCRIRE
=== village_vache ===
{ flag_vache_faim: -> village_vache_revoir }
# qui: heros
Bonjour Vache à Lait ! Tu me reconnais ?
# qui: vache
Meuh. L'origamiste. Tu tombes mal, je n'ai rien à brouter.
# qui: heros
Rien du tout ?
# qui: vache
Regarde autour de toi. Plus un brin d'herbe dans ce village. Et une vache qui ne broute pas est une vache qui ne donne rien.
# flag: vache_faim
-> DONE

// À ÉCRIRE
=== village_vache_revoir ===
{
  - has_pot:
    # qui: heros
    Regarde ce que j'ai plié.
    # qui: vache
    Meuh ! Un vrai pot à lait. Approche, je te le remplis.
    # qui: narrateur
    La vache s'exécute avec application. Le pot est plein à ras bord. # drop: pot # give: lait
  - flag_herbe_pliee && not flag_vache_pot_su:
    # qui: vache
    Meuh ! De l'herbe ! De la vraie !
    # qui: narrateur
    La touffe disparaît en trois bouchées. # flag: herbe_broutee
    # qui: vache
    Voilà qui change tout. Je te dois bien quelque chose : du lait, tant que tu veux.
    # qui: heros
    Avec plaisir, mais je n'ai rien pour le porter.
    # qui: vache
    Tu es origamiste, non ? Un pot, ça se plie aussi.
    # qui: narrateur
    La grenouille retient la forme du pot. # flag: vache_pot_su # give: idee_pot
  - flag_vache_pot_su:
    # qui: vache
    Meuh. Reviens quand tu auras de quoi le porter.
  - else:
    # qui: vache
    Trouve-moi de l'herbe, et on reparlera de lait.
}
-> DONE


// Le papier vert, près de la vache.
// À ÉCRIRE
=== village_herbe ===
{ flag_herbe_pliee: -> village_herbe_pliee }
{ not flag_vache_faim:
    # qui: heros
    Un papier vert clair et vert foncé, abandonné dans la poussière.
    -> DONE
}
# qui: heros
Vert clair, vert foncé... et une vache qui n'a plus rien à brouter.
+ [plier une salade]
    Une salade pour une vache. Elle me regarderait de travers, et elle aurait raison.
+ [plier de l'herbe]
    De l'herbe. Ce n'est pas très ambitieux, mais c'est exactement ce qu'on me demande.
    -> village_herbe_enigme
+ [plier un arbre]
    J'en ai déjà plié un ce mois-ci. Et une vache ne broute pas les arbres.
- -> DONE

// À ÉCRIRE
=== village_herbe_enigme ===
# qui: heros
Un brin d'herbe est un pliage comme un autre.
-> village_herbe_lancement

=== village_herbe_lancement ===
# puzzle: herbe # then: village_herbe_issue
-> DONE

// À ÉCRIRE
=== village_herbe_issue ===
{ flag_herbe_resolu:
    # qui: heros
    Et que ça pousse. # origami: herbe # flag: herbe_pliee
    Une belle touffe bien grasse. Vache à Lait va être contente.
  - else:
    # qui: heros
    Même l'herbe me résiste, aujourd'hui.
}
-> DONE

// À ÉCRIRE
=== village_herbe_pliee ===
# qui: heros
Une touffe d'herbe de papier, qui n'attend qu'une vache.
-> DONE


// Le papier crème, qui deviendra le pot à lait. Pas de menu d'options ici :
// l'idée vient de la vache, et elle est déjà précise.
// À ÉCRIRE
=== village_pot ===
{ not has_idee_pot:
    # qui: heros
    Un papier crème, épais, un peu raide. Je le garde en tête.
    -> DONE
}
# qui: heros
Épais, raide, imperméable. Exactement ce qu'il faut pour tenir du lait.
-> village_pot_lancement

=== village_pot_lancement ===
# puzzle: pot # then: village_pot_issue
-> DONE

// À ÉCRIRE
=== village_pot_issue ===
{ flag_pot_resolu:
    # qui: heros
    Un fond, quatre côtés, et surtout pas de trou. # origami: pot # flag: pot_plie # give: pot # drop: idee_pot
    Reste à trouver quelqu'un pour le remplir.
  - else:
    # qui: heros
    Il fuit de partout. Je recommencerai.
}
-> DONE


// ================================================================
// Chapitre 2 — L'entrée du château
// Voir game-design/scenes/chapter-2/entree-chateau.md
//
// ⚠ Premier jet, comme le village : voir la note en tête du chapitre.
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (EntreeScene.create).
// À ÉCRIRE
=== entree_arrivee ===
# qui: heros
L'entrée du château ! Et... un dinosaure assis devant.
Ce n'était pas là quand je suis parti, ça.
# flag: entree_vue
-> DONE


// Le Petit Chat. Il veut du lait ; le lait obtenu, il raconte ce qui se passe au
// château et fait tomber le papier suspendu.
// À ÉCRIRE
=== entree_chat ===
{ flag_chat_lait: -> entree_chat_apres }
{ has_lait: -> entree_chat_lait }
{ flag_chat_vu:
    # qui: chat
    Miaou. Du lait. S'il te plaît. Miaou.
    -> DONE
}
# qui: chat
Miaou !
# qui: heros
Petit Chat ! Toi au moins tu n'as pas changé.
# qui: chat
Miaou... j'ai faim... personne ne m'a rien donné depuis des jours... du lait... n'importe quoi... miaou...
# flag: chat_vu
-> DONE

// ⚠ Les tags qui déclenchent le mouvement sont sur la LIGNE du texte : posés
// seuls, ink ne les émet qu'au `Continue()` suivant, donc au tap qui referme la
// boîte. Le saut, lui, attend que la boîte se referme — c'est la scène qui s'en
// charge (`quandLaBoiteEstFermee`), sinon il se jouerait derrière elle.
// À ÉCRIRE
=== entree_chat_lait ===
# qui: heros
Tiens, Petit Chat. C'est Vache à Lait qui régale.
# qui: narrateur
Le pot est vide en quelques secondes. # drop: lait # flag: chat_lait
# qui: chat
Miaou ! Merci ! Je te dois tout !
Écoute... il faut que tu saches. Le Chat Mal Luné est entré dans le château, et il a commencé à déplier les origamis. Un par un. Il n'en restera bientôt plus rien.
# qui: heros
Déplier ? Mais c'est monstrueux.
# qui: chat
Aide-nous. Toi seul sais les remettre en état.
Et pour commencer... ce papier, là-haut. Il te sera plus utile qu'à cette branche. Regarde ! # flag: os_tombe
-> DONE

// À ÉCRIRE
=== entree_chat_apres ===
# qui: chat
Miaou. Ce lait, quand même. Le meilleur du village.
{ not flag_diplo_pousse:
    Fais quelque chose pour ce gros tas, il me bouche la vue.
}
-> DONE


// Le papier tacheté : Chouaf en puissance.
// À ÉCRIRE
=== entree_papier_chien ===
{ not has_idee_chien:
    # qui: heros
    Un papier plein de taches brunes. Il a l'air d'attendre quelqu'un.
    -> DONE
}
# qui: heros
Des taches partout, deux coins qui tombent comme des oreilles... Chouaf, c'est toi.
-> entree_chien_lancement

=== entree_chien_lancement ===
# puzzle: chien # then: entree_chien_issue
-> DONE

// À ÉCRIRE
=== entree_chien_issue ===
{ flag_chien_resolu:
    # qui: heros
    Reviens parmi nous, Chouaf. # origami: chien # flag: chien_plie # drop: idee_chien
    # qui: chien
    Wouaf !
  - else:
    # qui: heros
    Ça ne ressemble à rien. Un chien mérite mieux que ça.
}
-> DONE


// Le papier de l'os. Suspendu à l'arrivée, il ne tombe qu'après le lait ; et il
// ne se plie qu'une fois Chouaf debout, sinon l'os n'aurait personne à occuper.
// À ÉCRIRE
=== entree_papier_os ===
{ not flag_os_tombe:
    # qui: heros
    Un papier blanc, accroché beaucoup trop haut pour moi. Une grenouille saute, mais pas jusque-là.
    -> DONE
}
{ flag_os_plie: -> DONE }
{ not flag_chien_plie:
    # qui: heros
    Un papier blanc, dur, un peu jauni. Il me fait penser à quelque chose, mais quoi ?
    -> DONE
}
# qui: heros
Blanc, dur, jauni... et un chien qui tourne autour depuis tout à l'heure.
+ [plier une gamelle]
    Une gamelle vide n'a jamais fait la joie de personne.
+ [plier un os]
    Un os. Il n'y a pas plus simple, et pas plus efficace.
    -> entree_os_lancement
+ [plier un bâton]
    Un bâton, ça se lance et ça se perd. Je n'ai pas le temps de jouer toute la journée.
- -> DONE

=== entree_os_lancement ===
# puzzle: os # then: entree_os_issue
-> DONE

// À ÉCRIRE
=== entree_os_issue ===
{ flag_os_resolu:
    # qui: heros
    Voilà de quoi se faire un ami. # origami: os # flag: os_plie # give: os
  - else:
    # qui: heros
    On dirait plutôt un caillou. Je recommencerai.
}
-> DONE


// Chouaf. Sans os il s'ennuie ; avec, il fait le travail que la grenouille ne
// pourrait pas faire.
// À ÉCRIRE
=== entree_chouaf ===
{
  - flag_diplo_pousse:
    # qui: chien
    Wouaf ! Wouaf !
    # qui: heros
    Oui, tu as été très courageux. Va donc retrouver Pingouin Glagla, il ne parle que de toi.
  - has_os:
    # qui: heros
    Chouaf ! Regarde ce que j'ai pour toi.
    # qui: chien
    WOUAF !
    # qui: narrateur
    Le chien bondit vers l'os en aboyant à réveiller tout le village. # drop: os # flag: diplo_pousse
  - else:
    # qui: chien
    Wouaf...
    # qui: heros
    Tu as l'air de t'ennuyer, mon vieux. Il te faudrait de quoi t'occuper.
}
-> DONE


// Gros Diplo. Il n'est pas méchant, il est de garde — et il a le sommeil léger.
// À ÉCRIRE
=== entree_diplo ===
{ flag_diplo_pousse: -> entree_diplo_pousse }
{ flag_diplo_su:
    # qui: diplodocus
    Personne ne passe. C'est comme ça.
    -> DONE
}
# qui: heros
Bonjour... monsieur ? Vous êtes assis devant chez moi.
# qui: diplodocus
Je sais.
# qui: heros
Vous comptez y rester longtemps ?
# qui: diplodocus
Le temps qu'il faudra. Le Chat Mal Luné est là-dedans, et tant que je bouche l'entrée, il ne sort pas.
# qui: heros
Et personne n'entre non plus.
# qui: diplodocus
C'est le principe d'un bouchon.
# flag: diplo_su
-> DONE

// À ÉCRIRE
=== entree_diplo_pousse ===
# qui: diplodocus
Ce chien. Cet aboiement. J'en ai encore les écailles qui tremblent.
# qui: heros
Toutes mes excuses. Je peux entrer, du coup ?
# qui: diplodocus
Fais donc. Mais si tu croises le Chat Mal Luné, tu ne m'as jamais vu.
-> DONE


// Franchir l'entrée referme le chapitre.
//
// ⚠ Pas de `# goto:` : le chapitre 3 n'existe pas. Le jour où il existera, ce
// knot est le seul endroit à modifier.
// À ÉCRIRE
=== entree_fin_chapitre ===
# qui: heros
Bon. Un chat mal luné, un château plein d'amis dépliés, et moi.
Crôa crôa. On a vu pire.
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
