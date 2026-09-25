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
//   # fin: histoire              clôt l'histoire, l'écran de fin prend la suite
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
// par le compilateur, avec les tags qu'elle porte. D'où « A ECRIRE », que
// `grep -n "A ECRIRE" content/story.ink` liste.


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
// La vache traite n'a plus rien à donner : sans ce drapeau elle réclamerait le
// pot qu'elle vient de remplir.
VAR flag_vache_traite = false

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

// Chapitre 3 — la salle du trône, la cuisine et le jardin. Trois drapeaux y
// déclenchent un mouvement de décor (`auLeverDe`) : `chats_invites` fait partir
// les chats vers la cuisine, `chats_rassasies` les en fait revenir,
// `reconciliation` les approche du cœur.
VAR flag_trone_vu = false
VAR flag_libou_parle = false
VAR has_idee_couronne = false
VAR flag_couronne_resolu = false
VAR flag_couronne_pliee = false
VAR has_couronne = false
VAR flag_couronne_rendue = false
VAR flag_chat_faim = false
VAR flag_lune_chat_parle = false
VAR flag_cuisine_vue = false
VAR flag_cheffe_poisson = false
VAR has_carpe = false
VAR flag_cheffe_daurade = false
VAR has_idee_poisson = false
VAR flag_poisson_resolu = false
VAR flag_poisson_plie = false
VAR has_daurade = false
VAR flag_repas_pret = false
VAR flag_chats_invites = false
VAR flag_chats_rassasies = false
VAR flag_jardin_vu = false
VAR flag_wyvern_indices = false
VAR has_idee_coeur = false
VAR flag_coeur_resolu = false
VAR flag_coeur_plie = false
VAR flag_reconciliation = false
VAR flag_histoire_finie = false

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
Mémorisons la forme de l'arbre : ça pourrait être utile. # flag: arbre_parle # give: idee_arbre
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
    Merci, Maître Origamiste, d'avoir restauré le pont et feu mon vieux père.
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
    La hache travaille vaillamment et je me retrouve épuisé. Une bonne odeur de sciure embaume l'air, et une pile de belles planches est prête ! # give: bois # drop: hache # flag: vieil_arbre_decoupe
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
//
// ⚠ Le repli sans texte en dessous n'est pas décoratif, et ne pas le retirer :
// ink refuse de s'arrêter sur un menu dont AUCUNE option n'est ouverte — il
// lève « ran out of content », `pump()` ne voit jamais sa liste vide, et
// l'exception laisse l'instance `Story` muette pour le reste de la partie. Le
// cas arrive une fois par partie, quand le renard vient de tout dire.
+ { CHOICE_COUNT() > 0 } [Partir]
+ -> DONE
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
// ================================================================

=== village_arrivee ===
# qui: heros
Me voici arrivé au village. C'est moins chaotique que ce que je craignais, il reste des habitants.
Je vais sûrement pouvoir en apprendre plus sur ce qu'il se passe ici.
# flag: village_vu
-> DONE


// Le pingouin. Il a trop chaud tant que la montagne n'est pas là ; à l'ombre, il
// se remet à parler, et c'est de lui que vient l'idée du chien.
=== village_pingouin ===
{ flag_pingouin_chaud: -> village_pingouin_revoir }
# qui: heros
Salut Pingouin Glagla ! Tu n'as pas l'air dans ton assiette, qu'est-ce qui t'arrive ?
On dirait que tu vas nous faire un malaise.
# qui: pingouin
J'ai chaud... trop chaud...
# qui: heros
Oh, je vois ça, tu sues à grosses gouttes, ma pauvre. Désolé, le réchauffement climatique et tout ça...
# qui: pingouin
Ma neige... disparue... Mon délicat plumage... tout sec... Mon maquillage... tout coulé de partout...
# qui: heros
Elle délire, je vais trouver de quoi régler ça avant qu'elle nous fasse une syncope.
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
    Oh, que lui est-il arrivé ? Aide-moi, je t'en conjure !
  - flag_montagne_pliee:
    # qui: pingouin
    Ahh, ça fait plaisir cette neige et ce froid. Merci du fond du coeur.
    # qui: heros
    Tu m'as fait peur dans cet état, content que tu sois revenue parmi nous !
    # qui: pingouin
    J'ai toujours pas compris comment ma montagne a pu disparaître. D'ailleurs, mon petit Chouaf n'est plus là non plus.
    # qui: heros
    C'est qui ça, Chouaf ?
    # qui: pingouin
    Mon petit chien adoré. Il aboie un peu trop et ça effraie les autres villageois, mais c'est pas une raison pour le kidnapper, non ?
    # qui: heros
    Euh, je sais pas, à vrai dire j'ai un peu peur des chiens, je peux comprendre...
    # qui: pingouin
    Ah, je vois, c'est toi qui l'as séquestré ! Moi qui pensais que tu étais un bon crapaud.
    # qui: heros
    Non mais on se calme, déjà je suis une grenouille, pas un crapaud. Crôa crôa.
    Je vais te le retrouver, ton sac à puces, sinon tu vas nous refaire une scène.
    # qui: narrateur
    Mémorisons la forme du chien : ça pourrait être utile. # flag: pingouin_chien_su # give: idee_chien
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
    Une grande feuille grise et blanche au fond du village. Je ne vois pas à quoi elle pourrait servir.
    -> DONE
}
# qui: heros
Une grande feuille grise et blanche au fond du village. Je pourrais l'utiliser pour aider Pingouin Glagla ?
+ [plier un frigo]
    Un frigo aurait pu être une bonne idée, mais elle ne m'a pas demandé un cercueil, et en plus y'a pas de prise.
+ [plier un bonhomme de neige]
    Un bonhomme de neige ? Mouais. Si c'est pour qu'il fonde et se plaigne encore plus que le pingouin, non merci.
+ [plier une montagne]
    Ça va prendre de la place, une montagne, mais au moins elle aura autant de neige qu'elle veut.
    -> village_montagne_enigme
+ [plier un éventail]
    Pingouin Glagla tient à peine debout, elle ne va pas faire grand-chose avec cet éventail.
    Et j'ai autre chose à faire que de rester là à l'éventer.
// Gather obligatoire : le `-> DONE` du knot ne rattrape pas les branches.
- -> DONE

=== village_montagne_enigme ===
# qui: heros
Ça ne va pas être facile de plier un si grand papier, mais on va essayer.
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
Une montagne enneigée. Je ne sais pas trop comment j'ai pu la faire tenir dans le village...
Glace et ombre à volonté pour Madame Glagla !
-> DONE


// La vache. Quatre états : elle a faim, elle a brouté et donne l'idée du pot,
// elle remplit le pot qu'on lui apporte, puis elle n'a plus rien à donner.
//
// ⚠ Ordre des branches : la plus avancée d'abord, sinon le pot resterait vide
// pour toujours — `flag_vache_pot_su` couvrirait le cas où on le lui tend, et
// il reste levé une fois la vache traite.
=== village_vache ===
{ flag_vache_faim: -> village_vache_revoir }
# qui: heros
Quel plaisir de te revoir, Vache à Lait ! Tiens, c'est la première fois que je te vois et que tu n'es pas en train de brouter.
# qui: vache
Meuh. T'en vois de l'herbe dans l'coin, toi ?
# qui: heros
Ah, je me disais bien que c'était pas normal. Tu peux pas sortir du village ? Ça te changerait, elle est peut-être meilleure dehors.
# qui: vache
Meeeeuuuh... La flemme, c'est trop loin, j'suis fatiguée. J'ai faim.
# qui: heros
Oh là là, quelle feignasse, cette Vache à Lait ! Je vais peut-être pouvoir faire quelque chose.
# flag: vache_faim
-> DONE

=== village_vache_revoir ===
{
  - has_pot:
    # qui: heros
    Et voilà un pot à lait tout neuf ! Crôa crôa
    # qui: vache
    T'as bien mérité un peu de mon lait frais. Pose-le là-d'ssous et tire !
    # qui: heros
    Pouah ! Y'a une sacrée odeur, mais j'en connais un qui va être heureux. Merci !
    # qui: narrateur
    Le pot est plein à ras bord de bon lait frais. # drop: pot # give: lait # flag: vache_traite
  - flag_herbe_pliee && not flag_vache_pot_su:
    # qui: vache
    Meuh ! D'la bonne herbe toute verte ! Si appétissante !
    # qui: heros
    Régale-toi, ma bonne vache !
    # qui: narrateur
    La Vache à Lait déguste l'herbe d'un air ravi. # flag: herbe_broutee
    # qui: vache
    Miam, c'est d'la bonne herbe, ça ! J'te dois bien une faveur.
    J'peux te donner un peu de mon bon lait frais, mais il te faudrait de quoi le transporter.
    Y'avait des pots à lait par ici, avant.
    # qui: heros
    C'est gentil, ça ! Je vais voir ce que je peux trouver dans le coin.
    # qui: narrateur
    Mémorisons la forme du pot à lait : ça pourrait être utile. # flag: vache_pot_su # give: idee_pot
  - flag_vache_traite:
    # qui: vache
    Meuh... J'espère qu'tu vas t'régaler avec mon bon lait frais.
    Moi j'chuis contente avec tout'cette herbe.
  - flag_vache_pot_su:
    # qui: vache
    Meuh. Reviens quand tu auras trouvé un pot à lait.
  - else:
    # qui: vache
    Où est ma bonne herbe verte ? Meuuuh
}
-> DONE


// Le papier vert, près de la vache.
=== village_herbe ===
{ flag_herbe_pliee: -> village_herbe_pliee }
{ not flag_vache_faim:
    # qui: heros
    Un papier d'un vert végétal, abandonné dans la terre sèche.
    -> DONE
}
# qui: heros
Un papier d'un vert végétal, abandonné dans la terre sèche. Ça me serait sûrement utile.
+ [plier un lézard vert]
    Ils seraient mignons, ces petits lézards, mais ça ne résoudrait pas vraiment les problèmes des habitants.
+ [plier de l'herbe]
    Des brins d'herbe vont mettre un peu de vie sur cette place désolée, et ravir Vache à Lait.
    -> village_herbe_enigme
+ [plier une fleur]
    Ça serait joli, mais pas sûr que ça soit au goût de Vache à Lait.
- -> DONE

=== village_herbe_enigme ===
# qui: heros
Ça devrait être simple à plier.
-> village_herbe_lancement

=== village_herbe_lancement ===
# puzzle: herbe # then: village_herbe_issue
-> DONE

=== village_herbe_issue ===
{ flag_herbe_resolu:
    # qui: heros
    Faisons quelques plis... # origami: herbe # flag: herbe_pliee
    Un peu de verdure sur cette terre aride. Vache à Lait va se régaler.
  - else:
    # qui: heros
    L'herbe va devoir attendre un peu.
}
-> DONE

=== village_herbe_pliee ===
# qui: heros
De la bonne herbe bien grasse.
-> DONE


// Le papier crème, qui deviendra le pot à lait. Pas de menu d'options ici :
// l'idée vient de la vache, et elle est déjà précise.
=== village_pot ===
{ not has_idee_pot:
    # qui: heros
    Un papier crème et épais. Je ne sais pas quoi en faire pour le moment.
    -> DONE
}
# qui: heros
Ce solide papier couleur crème serait parfait pour plier le pot à lait.
-> village_pot_lancement

=== village_pot_lancement ===
# puzzle: pot # then: village_pot_issue
-> DONE

=== village_pot_issue ===
{ flag_pot_resolu:
    # qui: heros
    C'est plié ! # origami: pot # flag: pot_plie # give: pot # drop: idee_pot
    Il ne reste plus qu'à le remplir.
  - else:
    # qui: heros
    Je n'arrive pas à lui donner la bonne forme. On verra plus tard.
}
-> DONE


// ================================================================
// Chapitre 2 — L'entrée du château
// Voir game-design/scenes/chapter-2/entree-chateau.md
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (EntreeScene.create).
=== entree_arrivee ===
# qui: heros
Je peux voir d'ici l'entrée du château. Crôa crôa
Mais Gros Diplo a décidé d'assiéger le château, on dirait. Je devrais aller voir ce qui lui arrive.
Et Petit Chat a l'air dans tous ses états. Il faut que j'aille voir ça de plus près.
# flag: entree_vue
-> DONE


// Le Petit Chat. Il veut du lait ; le lait obtenu, il raconte ce qui se passe au
// château et fait tomber le papier suspendu.
=== entree_chat ===
{ flag_chat_lait: -> entree_chat_apres }
{ has_lait: -> entree_chat_lait }
{ flag_chat_vu:
    # qui: chat
    Miaou. Si tu n'as pas de lait à me faire laper, / Alors je te prie de décamper.
    -> DONE
}
# qui: heros
Mais c'est notre Petit Chat adoré ! Viens là que je te fasse un câlin.
# qui: chat
Miaou ! Où sont mes laquais ? / Personne ici ne daigne me donner du lait.
Il n'y a ici que de l'eau, / Et je ne puis regagner ma demeure au Château.
Ce Gros Diplo m'empêche de rentrer, / Il dit que c'est pour ma sécurité.
Le Chat Mal Luné a perdu l'esprit, / Qu'est-ce qui lui a pris ?
# qui: heros
Petit Chat ! Toujours aussi mignon, et toujours aussi insolent.
Peux-tu me dire ce qu'il se passe ? Pourquoi Gros Diplo ne veut pas te laisser entrer ?
# qui: chat
Miaou ! Du lait d'abord, je t'en conjure ! / Ou je commets un parjure.
# qui: heros
Il divague. Je ferais mieux de trouver du lait avant de me transformer en pâté pour chat.
# flag: chat_vu
-> DONE

// ⚠ Les tags qui déclenchent le mouvement sont sur la LIGNE du texte : posés
// seuls, ink ne les émet qu'au `Continue()` suivant, donc au tap qui referme la
// boîte. Le saut, lui, attend que la boîte se referme — c'est la scène qui s'en
// charge (`quandLaBoiteEstFermee`), sinon il se jouerait derrière elle.
=== entree_chat_lait ===
# qui: heros
Tiens, mon Petit Chat. Du bon lait frais. Tu pourras remercier la Vache à Lait.
# qui: narrateur
Le Petit Chat lape goulûment le lait ; le pot se retrouve vide en quelques secondes. # drop: lait # flag: chat_lait
Il étend ses pattes et miaule de satisfaction.
# qui: chat
Maaw ! Merci, mon cher Maître Origamiste ! / Sans toi je serais bien triste.
Ici hélas rien ne va plus. / Pourra-t-on trouver le salut ?
# qui: heros
Calme-toi, Petit Chat. Je comprends à moitié ce que tu dis. Enfin, ça ne change pas vraiment d'avant.
Raconte-moi ce qui s'est passé au château.
# qui: chat
Quels terribles actes nous a infligés / Le Chat Mal Luné pour se venger !
Les petits oiseaux, les jolies fleurs / Dépliés, disparus, oh quelle douleur !
# qui: heros
C'est terrible ! Pourquoi ferait-il une chose pareille ?
# qui: chat
Le Chat Mal Luné est mesquin / Aussi méchant et vil qu'un requin.
Il va continuer à déplier / Tout ce que tu as jadis plié.
Je dois de ce pas et de manière ferme / Au Château y mettre un terme.
# qui: heros
Crôa crôa. Je crois que tu ne me racontes pas tout.
Encore une de vos disputes qui a mal tourné.
Pour l'instant, aide-moi à revenir au château, on va essayer de régler ça.
# qui: chat
Au Château j'aimerais tant / Y revenir à temps.
Ce papier accroché là-haut / Peut-être est-ce ce qu'il nous faut.
Voici ma modeste contribution / À ce que ce problème trouve une solution. # flag: os_tombe
-> DONE

=== entree_chat_apres ===
# qui: chat
{ not flag_diplo_pousse:
    Hélas, Gros Diplo n'a pas daigné se mouvoir. / J'aimerais tellement ne plus le voir.
  - else:
    Allons de ce pas régler ça. / Au Château rentrons fissa.
}
-> DONE


// Le papier tacheté : Chouaf en puissance.
=== entree_papier_chien ===
{ not has_idee_chien:
    # qui: heros
    Ce papier est tout doux et parsemé de taches brunes. Je ne sais pas quoi en faire pour le moment.
    -> DONE
}
# qui: heros
Ce papier est tout doux et parsemé de taches brunes. Ça doit être Chouaf !
-> entree_chien_lancement

=== entree_chien_lancement ===
# puzzle: chien # then: entree_chien_issue
-> DONE

=== entree_chien_issue ===
{ flag_chien_resolu:
    # qui: heros
    Un dernier pli pour le museau... # origami: chien # flag: chien_plie # drop: idee_chien
    # qui: chien
    Chouaf Chouaf !
  - else:
    # qui: heros
    Euh, il est un peu mutant, ce chien... Je devrais repartir de zéro.
}
-> DONE


// Le papier de l'os. Suspendu à l'arrivée, il ne tombe qu'après le lait ; et il
// ne se plie qu'une fois Chouaf debout, sinon l'os n'aurait personne à occuper.
=== entree_papier_os ===
{ not flag_os_tombe:
    # qui: heros
    Un papier blanc est accroché là-haut. Même moi, je ne saute pas assez haut pour le décrocher.
    -> DONE
}
{ flag_os_plie: -> DONE }
{ not flag_chien_plie:
    # qui: heros
    C'est un papier blanc un peu abîmé. Et il y a... de la bave ? Pouah !
    -> DONE
}
# qui: heros
C'est un papier blanc un peu abîmé. Et il y a... de la bave ? Pouah !
Il a l'air de beaucoup intéresser Chouaf.
+ [plier une laisse]
    Le pauvre, je ne vais pas l'attacher. Et pour être honnête, je ne saurais même pas comment m'y prendre sans y perdre une patte.
+ [plier un os]
    Un jouet pour Chouaf ? Pourquoi pas.
    -> entree_os_lancement
+ [plier une gamelle]
    Je n'ai pas de quoi la remplir. Et je ne suis pas aussi tordu que le Renard Futé pour lui faire cette mauvaise blague.
- -> DONE

=== entree_os_lancement ===
# puzzle: os # then: entree_os_issue
-> DONE

=== entree_os_issue ===
{ flag_os_resolu:
    # qui: heros
    Un nouveau joujou pour le toutou. # origami: os # flag: os_plie # give: os
  - else:
    # qui: heros
    Avec un peu d'imagination, peut-être un os réduit en bouillie... Non, ça ne doit pas être ça.
}
-> DONE


// Chouaf. Sans os il s'ennuie ; avec, il fait le travail que la grenouille ne
// pourrait pas faire.
=== entree_chouaf ===
{
  - flag_diplo_pousse:
    # qui: chien
    Chouaf ! Ouaf Ouaf !
    # qui: heros
    Bon chien. Non, ne t'approche pas trop.
    Pingouin Glagla te cherche partout, va donc étaler ta bave là-bas.
  - has_os:
    # qui: narrateur
    Je vais essayer de ne pas me faire mordre...
    # qui: heros
    Bon chien ? Chouaf ? Regarde ce que j'ai apporté pour toi !
    # qui: chien
    WOUAF ! OUAF OUAF OUAF !
    # qui: narrateur
    Je lance l'os vers Gros Diplo en m'excusant intérieurement.
    Chouaf est tout excité et saute partout. # drop: os # flag: diplo_pousse
  - else:
    # qui: chien
    Chouaf ?
    # qui: narrateur
    Il n'a pas l'air si terrible, je pourrais même me servir de lui pour arriver à mes fins...
    Faisons attention quand même.
    # qui: heros
    Tu veux jouer, c'est ça ? Attends, je vais trouver quelque chose qui va beaucoup te plaire !
    # qui: chien
    Ouaf Ouaf !
}
-> DONE


// Ce que le héros pense une fois le dinosaure parti pour de bon.
//
// ⚠ Ce knot est hors de la tirade de Chouaf, et c'est tout son intérêt : le
// mouvement ne se joue qu'une fois la boîte de dialogue refermée (`auLeverDe`),
// donc une réplique laissée à la suite du `# flag:` annonçait un dinosaure
// encore assis sur le passage. C'est `EntreeScene` qui lance celle-ci, à la fin
// du trajet. Elle ne pose aucun état : interrompue, elle ne coûte qu'elle-même.
=== entree_diplo_ecarte ===
Mon plan machiavélique fonctionne, et Gros Diplo s'éloigne de cette boule de dents surexcitée.
-> DONE


// Gros Diplo. Il n'est pas méchant, il est de garde — et il a le sommeil léger.
=== entree_diplo ===
{ flag_diplo_pousse: -> entree_diplo_pousse }
{ flag_diplo_su:
    # qui: diplodocus
    QU'EST-CE QUE TU FAIS LÀ ? TU N'AS PAS COMPRIS ? C'EST DANGEREUX ICI !
    # qui: heros
    Ok, ça va, pas la peine de me crier dessus...
    -> DONE
}
# qui: heros
Gros Diplo ? Je crois que tu m'empêches de rentrer chez moi.
Ça t'ennuierait de te pousser un peu ?
# qui: diplodocus
OH, L'ORIGAMISTE. JE CROIS PAS QUE ÇA SOIT POSSIBLE, NON.
# qui: narrateur
J'avais oublié qu'il parlait un peu fort, celui-là. Je vais devenir sourd.
# qui: heros
Mais je veux rentrer ! Et tu me fais mal aux tympans !
# qui: diplodocus
C'EST POUR TA SÉCURITÉ. DÉSOLÉ, JE NE PEUX PAS PARLER MOINS FORT.
# qui: heros
Ma sécurité ? Tout le village est devenu fou, je vais être plus en sécurité chez moi, je crois.
Allez, pousse-toi un peu, mon Gros Diplo.
# qui: diplodocus
LE CHAT MAL LUNÉ EST À L'INTÉRIEUR, JE NE PEUX PAS LE FAIRE SORTIR.
ET JE DOIS EMPÊCHER QUICONQUE DE L'APPROCHER.
# qui: heros
Qu'est-ce qu'il a fait encore, le Chat Mal Luné ? C'est en lien avec tous les objets dépliés ?
# qui: diplodocus
J'EN SAIS RIEN, MOI. SA MAJESTÉ LE LIBOU DES BOIS JOLIS M'A DIT DE LE TENIR À L'ÉCART DU VILLAGE.
J'OBÉIS. ALLEZ, DU BALAI.
# qui: narrateur
Faut que je trouve un moyen de l'éloigner, il est têtu comme une mule géante. Et je suis en train de devenir sourd.
# flag: diplo_su
-> DONE

=== entree_diplo_pousse ===
# qui: diplodocus
PARDON, MA REINE ! MAUDIT CHIEN, J'AI FAILLI À MON DEVOIR.
# qui: heros
C'est vrai qu'il peut être terrifiant, ce Chouaf.
Sur ce, j'ai des choses à régler au château.
# qui: diplodocus
NON ! NE T'APPROCHE PAS DU CHAT MAL LUNÉ !
-> DONE


// Franchir l'entrée referme le chapitre et ouvre le suivant.
//
// ⚠ Le `# goto:` est SEUL sur sa ligne, pour la raison donnée à la porte du
// chapitre 1 : la réplique doit se lire avant que la salle du trône n'apparaisse.
=== entree_fin_chapitre ===
# qui: heros
Il est temps de retrouver Sa Majesté Le Libou Des Bois Jolis et de confronter le Chat Mal Luné.
J'appréhende un peu...
# goto: trone
-> DONE


// ================================================================
// Chapitre 3 — La salle du trône
// Voir game-design/scenes/chapter-3/salle-du-trone.md
//
// ⚠ Tout le texte du chapitre 3 est un PREMIER JET : il tient la structure, les
// conditions et l'enchaînement, pas la voix. Chaque knot à reprendre porte un
// « [A ECRIRE] » ; `grep -n "A ECRIRE" content/story.ink` les liste, et la
// marque s'enlève une fois les répliques réécrites.
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (TroneScene.create).
// [A ECRIRE]
=== trone_arrivee ===
# qui: heros
Me voici enfin dans la salle du trône. Crôa crôa
# qui: narrateur
Le Petit Chat et le Chat Mal Luné se toisent, chacun à un bout de la salle, en feulant à qui mieux mieux.
# qui: heros
Sa Majesté a l'air à bout de nerfs. Je devrais aller la saluer.
# flag: trone_vu
-> DONE


// Le Libou Des Bois Jolis. Elle a perdu sa couronne et ne supporte plus les
// disputes des chats ; la couronne rendue, elle pose la feuille rouge au centre
// de la salle.
//
// ⚠ La branche la plus avancée d'abord, comme pour la vache du village.
// [A ECRIRE]
=== trone_libou ===
{
  - flag_reconciliation:
    # qui: hibou
    Hou hou ! Enfin la paix dans mon château. Merci, mon cher Maître Origamiste.
  - has_couronne:
    # qui: heros
    Votre Majesté, voici une couronne toute neuve, pliée de mes mains.
    # qui: hibou
    Hou hou ! Qu'elle est belle ! Elle brille encore plus que l'ancienne. # drop: couronne
    Pour te remercier, je te confie ma plus belle feuille. Elle scintille comme un rubis.
    # qui: narrateur
    Sa Majesté dépose une feuille rouge scintillante au centre de la salle. # flag: couronne_rendue
    # qui: hibou
    Si seulement elle pouvait ramener un peu de paix entre ces deux-là...
  - flag_couronne_rendue:
    # qui: hibou
    Ma feuille rouge est le plus beau papier du royaume. Sauras-tu en tirer de quoi apaiser ces deux chats ?
  - flag_libou_parle:
    # qui: hibou
    Hou hou... Ma couronne... Comment régner sans couronne ?
  - else:
    -> trone_libou_rencontre
}
-> DONE

// [A ECRIRE]
=== trone_libou_rencontre ===
# qui: heros
Votre Majesté ! Me voici rentré de voyage. Votre origamiste royal est à votre service.
# qui: hibou
Hou hou ! Il était temps ! Tout va de travers dans ce château.
J'ai perdu ma couronne, et ces deux chats n'arrêtent pas de se chamailler du matin au soir.
# qui: heros
Perdu votre couronne ? Encore ?
# qui: hibou
Je ne peux pas recevoir mes sujets tête nue ! Fais quelque chose, toi qui plies si bien.
# qui: heros
Une couronne de papier, digne de Sa Majesté... Il me faudrait un papier précieux.
# qui: narrateur
Mémorisons la forme de la couronne : ça pourrait être utile. # flag: libou_parle # give: idee_couronne
-> DONE


// Le Petit Chat. Il a faim, encore ; le repas prêt, il suit l'autre à la
// cuisine.
// [A ECRIRE]
=== trone_chat ===
{
  - flag_reconciliation:
    # qui: chat
    Miaou ! Plus jamais de querelle, / Désormais la vie est belle.
  - flag_chats_rassasies:
    # qui: chat
    Le ventre plein, je suis comblé, / Mais ce Chat Mal Luné me fait toujours bouder.
  - flag_repas_pret:
    -> trone_invitation
  - flag_chat_faim:
    # qui: chat
    Miaou... Mon ventre crie famine, / Que fait donc la cuisine ?
  - else:
    # qui: chat
    Miaou ! Te voilà enfin au Château, / Mais ici rien ne va, c'est le chaos.
    Ce Chat Mal Luné a tout déplié, / Et moi, je n'ai rien à manger.
    # qui: heros
    Tu as encore faim ? Tu viens pourtant de laper tout un pot de lait.
    # qui: chat
    Le lait n'était qu'une mise en bouche, / C'est un festin qu'il me faut sous la moustache.
    # qui: heros
    Il faudra voir ça avec les cuisines, Petit Chat. # flag: chat_faim
}
-> DONE


// Le Chat Mal Luné. Il a déplié les origamis que la reine aimait, parce qu'elle
// lui préfère le Petit Chat ; il a faim, et il n'a pas envie de parler.
// [A ECRIRE]
=== trone_lune_chat ===
{
  - flag_reconciliation:
    # qui: lune_chat
    Je tiendrai parole. Plus rien ne sera déplié dans ce château.
  - flag_chats_rassasies:
    # qui: lune_chat
    Pas mauvais, ce poisson. Mais je n'ai toujours rien à dire au Petit Chat.
  - flag_repas_pret:
    -> trone_invitation
  - flag_lune_chat_parle:
    # qui: lune_chat
    Laisse-moi tranquille. J'ai faim.
  - else:
    # qui: heros
    Chat Mal Luné ! C'est donc toi qui as déplié tous les origamis du château ?
    # qui: lune_chat
    Pfff. Et alors ?
    La reine les adorait, ces origamis. Presque autant que son précieux Petit Chat.
    Elle ne jure que par lui. Moi, on m'accuse de tout, alors autant le mériter.
    # qui: heros
    Ce n'est pas une raison pour transformer le royaume en tas de feuilles !
    # qui: lune_chat
    J'ai faim. Je n'ai pas envie de parler. # flag: lune_chat_parle
}
-> DONE


// Le repas est prêt : on invite l'un ou l'autre chat, les deux partent. Le
// départ se joue une fois la boîte refermée (`auLeverDe` dans trone-scene.ts),
// donc rien ici ne le commente.
// [A ECRIRE]
=== trone_invitation ===
# qui: heros
À table, les chats ! La Cheffe Éléphant vous a préparé une daurade royale.
# qui: chat
Miaou ! Une daurade, quel délice, / Courons-y sans artifice !
# qui: lune_chat
Enfin quelque chose d'intéressant. # flag: chats_invites
-> DONE


// La feuille rouge de la reine, au centre de la salle, puis le cœur qu'elle
// devient. Elle se plie en bien des choses ; le cœur n'est proposé qu'à qui a
// écouté la wyvern.
// [A ECRIRE]
=== trone_coeur ===
{ flag_coeur_plie: -> trone_coeur_plie }
# qui: heros
Une feuille rouge qui scintille comme un rubis. Il faut en faire quelque chose qui rapproche ces deux chats.
+ [plier une souris]
    Une souris pour deux chats ? Ils se la disputeraient, et ce serait pire qu'avant.
+ [plier une couronne]
    Sa Majesté a déjà la sienne. Et un chat couronné, ça ferait des jaloux.
+ { has_idee_coeur } [plier un cœur]
    Un cœur, comme l'a soufflé la wyvern. Voyons s'il peut réconcilier ces deux-là.
    -> trone_coeur_lancement
+ [plier une pelote de laine]
    Ils joueraient ensemble... ou pas. Je ne veux pas risquer une bagarre de plus.
- -> DONE

// Tag seul, sans texte : voir `pont_enigme_lancement`.
=== trone_coeur_lancement ===
# puzzle: coeur # then: trone_coeur_issue
-> DONE

// Plié en dernier, le cœur enchaîne sur les retrouvailles ; plié avant le
// repas, il attend que les chats reviennent de la cuisine (TroneScene).
// [A ECRIRE]
=== trone_coeur_issue ===
{ flag_coeur_resolu:
    # qui: heros
    Un pli après l'autre, avec tout mon cœur... # origami: coeur # flag: coeur_plie # drop: idee_coeur
    { flag_chats_rassasies: -> trone_retrouvailles }
    Reste à ce que les chats s'en approchent. Mais le ventre vide, ils n'ont d'yeux que pour la cuisine.
  - else:
    # qui: heros
    J'ai le cœur qui n'y est pas... Je réessaierai.
}
-> DONE

// [A ECRIRE]
=== trone_coeur_plie ===
# qui: heros
Un cœur rouge et scintillant, au milieu de la salle du trône.
{ not flag_chats_rassasies: Les chats ne le regarderont qu'une fois le ventre plein. }
-> DONE


// Les chats repus devant le cœur plié. C'est le seul knot qui lève
// `reconciliation`, et le rapprochement se joue une fois la boîte refermée :
// rien ici ne le décrit. La scène enchaîne sur `trone_reconciliation` à la fin
// du trajet.
//
// On y arrive par le cœur plié en dernier (`trone_coeur_issue`), ou par les
// chats rentrés en dernier de la cuisine (TroneScene, à l'entrée dans la pièce).
// [A ECRIRE]
=== trone_retrouvailles ===
# qui: narrateur
Le ventre plein, les deux chats remarquent enfin le cœur rouge au milieu de la salle. # flag: reconciliation
-> DONE

// La fin de l'histoire, lancée par la scène au bout du rapprochement. Relancée
// aussi à l'entrée dans la pièce tant que `histoire_finie` n'est pas levé : un
// rechargement pendant les aveux ne doit pas coûter la fin.
//
// ⚠ Le `# fin:` est SEUL sur sa ligne, comme le `# goto:` des fins de chapitre :
// l'écran de fin ne vient qu'après la dernière réplique.
// [A ECRIRE]
=== trone_reconciliation ===
# qui: narrateur
Côte à côte devant le cœur, les deux chats restent un long moment silencieux.
# qui: chat
Miaou... Il est temps que je l'avoue, / J'ai fait une grosse bêtise, entre nous.
La couronne de Sa Majesté, c'est moi qui l'ai cachée, / Plus d'une fois, pour que tu sois accusé.
Je voulais que la reine n'aime que moi. / Pardon, Chat Mal Luné, pardon à toi.
# qui: hibou
Hou hou ! Petit Chat ! C'était donc toi !
# qui: lune_chat
...
Bon. J'arrêterai de déplier les origamis du château. À condition que tu te tiennes à carreau, Petit Chat.
# qui: chat
Promis, juré, sur mes moustaches, / Plus jamais de couronne que je cache !
# qui: hibou
Enfin la paix dans mon château. Merci, mon cher Maître Origamiste.
# qui: heros
Crôa crôa ! Il n'y a pas de quoi, Votre Majesté. Un origamiste a toujours un pli d'avance. # flag: histoire_finie
# fin: histoire
-> DONE


// ================================================================
// Chapitre 3 — La cuisine
// Voir game-design/scenes/chapter-3/cuisine.md
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (CuisineScene.create).
// [A ECRIRE]
=== cuisine_arrivee ===
# qui: narrateur
Ça sent bon le bouillon. La Cheffe Éléphant s'affaire devant ses fourneaux.
# flag: cuisine_vue
-> DONE


// La Cheffe Éléphant. Elle veut du poisson pour les chats ; la carpe n'est pas
// comestible, la daurade si. La daurade apportée, le repas est prêt.
//
// ⚠ La branche la plus avancée d'abord : `cheffe_daurade` reste levé une fois
// l'idée donnée, et couvrirait le cas où on lui tend la daurade.
// [A ECRIRE]
=== cuisine_cheffe ===
{
  - flag_chats_rassasies:
    # qui: elephant
    Deux assiettes vides et deux chats repus. Voilà qui fait plaisir à une cuisinière !
  - flag_chats_invites:
    # qui: elephant
    Chut, laisse-les manger tranquilles.
  - flag_repas_pret:
    # qui: elephant
    Le repas est prêt ! Va donc chercher ces deux chats, qu'ils mangent tant que c'est chaud.
  - has_daurade:
    # qui: heros
    Voici une daurade royale, toute fraîche pliée !
    # qui: elephant
    Magnifique ! Voilà un poisson digne des chats de Sa Majesté. # drop: daurade
    # qui: narrateur
    La Cheffe Éléphant découpe, assaisonne et fait mijoter en un tour de trompe.
    # qui: elephant
    Le repas est prêt ! Va chercher les chats, et qu'ils ne se battent pas à table. # flag: repas_pret
  - has_carpe:
    # qui: heros
    Voici une belle carpe, pêchée dans la fontaine du jardin !
    # qui: elephant
    Une carpe ? Malheureux ! Les carpes du jardin sont décoratives, elles ne se mangent pas.
    Je la remettrai dans sa fontaine. # drop: carpe
    Il me faudrait un vrai poisson de roi... Une daurade royale, voilà ce qu'il faut.
    # qui: narrateur
    Mémorisons la forme de la daurade : ça pourrait être utile. # flag: cheffe_daurade # give: idee_poisson
  - flag_cheffe_daurade:
    # qui: elephant
    Une daurade royale, pas moins ! Les chats de Sa Majesté ont le palais délicat.
  - flag_cheffe_poisson:
    # qui: elephant
    Alors, ce poisson ? Mes casseroles s'impatientent.
  - else:
    # qui: heros
    Bonjour, Cheffe ! Ça sent drôlement bon, ici.
    # qui: elephant
    Ça sentirait meilleur si j'avais de quoi cuisiner ! Les chats de Sa Majesté réclament leur repas, et je n'ai plus un seul poisson.
    Sans poisson, pas de repas. Et sans repas, ces deux-là vont finir par se dévorer entre eux.
    # qui: heros
    Je vais voir ce que je peux trouver. # flag: cheffe_poisson
}
-> DONE


// Les deux chats à table. Leur parler, c'est les renvoyer repus vers la salle du
// trône ; le départ se joue boîte refermée (`auLeverDe` dans cuisine-scene.ts).
// [A ECRIRE]
=== cuisine_chats ===
# qui: narrateur
Les deux chats dévorent la daurade, chacun à un bout de la table, sans se regarder.
# qui: chat
Miaou ! Quel festin, quelle merveille, / Rien au monde n'est pareil !
# qui: lune_chat
Mmmh. Pas mal.
# qui: heros
Alors, rassasiés ? Sa Majesté vous attend dans la salle du trône.
# qui: chat
Le ventre plein, la mine ravie, / Retournons au trône, mes amis. # flag: chats_rassasies
-> DONE


// ================================================================
// Chapitre 3 — Le jardin
// Voir game-design/scenes/chapter-3/jardin.md
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (JardinScene.create).
// [A ECRIRE]
=== jardin_arrivee ===
# qui: heros
Le jardin du château ! La fontaine, le banc... Rien n'a changé. Crôa crôa
# qui: narrateur
Dans un coin, une silhouette rouge m'observe sans un bruit.
# flag: jardin_vu
-> DONE


// La fontaine et ses carpes. On n'en pêche une qu'après la requête de la
// Cheffe, et plus du tout une fois qu'elle a dit ce qu'elle en pensait.
// [A ECRIRE]
=== jardin_fontaine ===
{
  - has_carpe:
    # qui: heros
    Une carpe me suffit. La Cheffe attend.
  - flag_cheffe_daurade:
    # qui: heros
    Des carpes décoratives, pas comestibles. C'est vrai qu'elles sont plus jolies dans l'eau.
  - flag_cheffe_poisson:
    # qui: heros
    Du poisson ! Voilà qui devrait faire l'affaire.
    # qui: narrateur
    D'un coup de langue, j'attrape une carpe qui passait par là. # give: carpe
  - else:
    # qui: narrateur
    Deux carpes de papier tournent lentement dans le bassin de la fontaine.
}
-> DONE


// Le papier chatoyant, près de la fontaine : la daurade en puissance. Pas de
// menu, l'idée vient de la Cheffe et elle est déjà précise — comme le pot à
// lait du village.
// [A ECRIRE]
=== jardin_papier_poisson ===
{ not has_idee_poisson:
    # qui: heros
    Un papier chatoyant, aux reflets d'argent et d'or. On dirait des écailles.
    -> DONE
}
# qui: heros
Des reflets d'argent et d'or... Les couleurs d'une daurade royale ! Parfait pour la Cheffe.
-> jardin_poisson_lancement

=== jardin_poisson_lancement ===
# puzzle: poisson # then: jardin_poisson_issue
-> DONE

// [A ECRIRE]
=== jardin_poisson_issue ===
{ flag_poisson_resolu:
    # qui: heros
    Une nageoire, une queue... # origami: poisson # flag: poisson_plie # give: daurade # drop: idee_poisson
    Une daurade royale, prête pour la cuisine !
  - else:
    # qui: heros
    Ce poisson a plutôt l'air d'une limande. Je recommencerai.
}
-> DONE


// Le papier doré serti de gemmes, sur le banc. Il ne se plie qu'une fois la
// requête de la reine entendue.
// [A ECRIRE]
=== jardin_papier_couronne ===
{ not has_idee_couronne:
    # qui: heros
    Un papier doré, incrusté de petites gemmes. Bien trop précieux pour en faire n'importe quoi.
    -> DONE
}
# qui: heros
Un papier doré, serti de gemmes : de quoi plier une couronne digne de Sa Majesté.
-> jardin_couronne_lancement

=== jardin_couronne_lancement ===
# puzzle: couronne # then: jardin_couronne_issue
-> DONE

// [A ECRIRE]
=== jardin_couronne_issue ===
{ flag_couronne_resolu:
    # qui: heros
    Et un dernier pli pour les pointes... # origami: couronne # flag: couronne_pliee # give: couronne # drop: idee_couronne
    Une couronne toute neuve ! Sa Majesté va être ravie.
  - else:
    # qui: heros
    Pas facile de plier une couronne sans l'avoir sur la tête. Je réessaierai.
}
-> DONE


// La wyvern, dans un coin du jardin. Elle parle du cœur par énigmes, et c'est
// d'elle que vient l'idée de le plier.
// [A ECRIRE]
=== jardin_wyvern ===
{ flag_wyvern_indices:
    # qui: wyvern
    Ce que deux cœurs fâchés ne savent plus se dire, un seul, bien plié, le dira pour eux.
    -> DONE
}
# qui: heros
Euh... Bonjour ? Je ne crois pas vous connaître.
# qui: wyvern
Moi, je te connais, petit plieur. Je veille sur ce jardin depuis bien avant ta naissance.
Deux félins se déchirent sous ce toit. Ni griffes ni couronne ne les réuniront.
Il faut plier ce qui bat : deux lobes et une pointe, rouge comme ma peau.
# qui: heros
Deux lobes et une pointe... Rouge... Un cœur ?
# qui: wyvern
Le papier viendra de la reine. Le reste viendra de toi.
# qui: narrateur
Mémorisons la forme du cœur : ça pourrait être utile. # flag: wyvern_indices # give: idee_coeur
-> DONE


// ================================================================
// Le héros
// ================================================================

// Partagé par toutes les scènes : ce que le héros pense de lui-même ne change
// pas d'une pièce à l'autre. Il se découpera par scène le jour où ça comptera.
=== heros ===
# qui: heros
Je reviens d'un long voyage à l'étranger et je suis épuisé. Hâte de retrouver le confort du château !
Je suis l'origamiste royal de Sa Majesté Le Libou Des Bois Jolis.
-> DONE
