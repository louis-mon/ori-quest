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
À ÉCRIRE — constatation à l'arrivée : le précipice, le pont qui n'est plus là, l'impasse. # flag: pont_vu
-> DONE

=== pont_precipice ===
À ÉCRIRE — ce que le héros voit en se penchant sur le vide.
À ÉCRIRE — et ce qui le trouble : rien n'est tombé, rien n'est rompu. Le pont a simplement disparu, comme le père du jeune arbre.
-> DONE

// Seul le pont POSÉ s'examine : avant, il n'y a rien à cet endroit — pas des
// moignons, pas une travée rompue, rien. C'est le précipice qu'on regarde.
=== pont_pont ===
À ÉCRIRE — le pont de papier une fois posé : est-ce que ça tiendra vraiment ?
-> DONE

// Examiner la feuille ouvre le choix du modèle. Choisir le pont lance l'énigme.
=== pont_feuille ===
À ÉCRIRE — description de la feuille de papier trouvée au sol.
À ÉCRIRE — la question que se pose le héros : qu'est-ce que je pourrais en faire ?

// `+` et non `*` : la feuille doit rester ré-analysable tant qu'elle n'est pas
// pliée, pour qu'écarter une mauvaise piste ne ferme pas l'accès au bon modèle.
+ [À ÉCRIRE — choix : un pont]
    -> pont_enigme
+ [À ÉCRIRE — choix : un autre modèle (mauvaise piste)]
    À ÉCRIRE — pourquoi ce modèle ne résout rien ici.
+ [À ÉCRIRE — choix : reposer la feuille]
    À ÉCRIRE — le héros repose la feuille.
// Gather obligatoire : le `-> DONE` ci-dessous est au niveau du knot et ne
// rattrape pas les branches, qui tomberaient dans le vide.
- -> DONE

=== pont_enigme ===
À ÉCRIRE — le héros s'accroupit et étale la feuille devant lui.
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
    À ÉCRIRE — réussite : le tracé est juste, le papier sait quoi faire. # origami: pont # flag: pont_plie
    À ÉCRIRE — le pont est en place au-dessus du vide.
  - else:
    À ÉCRIRE — échec ou abandon : la feuille reste lisse, rien n'est décidé.
}
-> DONE


// Le jeune arbre parle : c'est lui qui donne l'idée de l'arbre, puis le droit
// moral de découper son père.
=== pont_arbre ===
{ flag_arbre_parle: -> pont_arbre_revoir }
# qui: narrateur
À ÉCRIRE — le jeune arbre, ses plis encore nets.
# qui: arbre
À ÉCRIRE — il est triste : son vieux père, mort il y a peu, a disparu d'un coup.
# qui: narrateur
À ÉCRIRE — le héros retient sa forme : il saurait la refaire. # flag: arbre_parle # give: idee_arbre
-> DONE

// Visites suivantes. La proposition n'apparaît qu'une fois la hache en main :
// avant, le héros n'a rien à offrir.
=== pont_arbre_revoir ===
{ has_hache && not flag_vieil_arbre_decoupe:
    # qui: heros
    À ÉCRIRE — proposer d'aller trouver le père, et d'user de la lame pour l'honorer.
    # qui: arbre
    À ÉCRIRE — le fils accepte : que la lame serve à l'honorer. # flag: arbre_demande
  - else:
    # qui: arbre
    À ÉCRIRE — quelques mots de plus, sans nouvelle piste.
}
-> DONE

// La grande feuille de la rive d'en face — le vieil arbre en puissance.
=== pont_feuille_vieil_arbre ===
{ flag_arbre_plie: -> pont_vieil_arbre_plie }
{ not has_idee_arbre:
    À ÉCRIRE — une grande feuille, épaisse. Rien ne vient : il ne sait pas quoi en faire.
    -> DONE
}
À ÉCRIRE — cette fois il reconnaît la forme. C'est un arbre qui dort là-dedans.
-> pont_arbre_enigme

=== pont_arbre_enigme ===
À ÉCRIRE — le héros étale la grande feuille sur la rive.
-> pont_arbre_enigme_lancement

=== pont_arbre_enigme_lancement ===
# puzzle: arbre # then: pont_arbre_enigme_issue
-> DONE

=== pont_arbre_enigme_issue ===
{ flag_arbre_resolu:
    À ÉCRIRE — réussite : le pliage tient. # origami: arbre # flag: arbre_plie # drop: idee_arbre
    À ÉCRIRE — le vieil arbre se dresse sur la rive, mort et debout.
  - else:
    À ÉCRIRE — échec ou abandon : la feuille reste lisse.
}
-> DONE

// L'arbre plié. C'est ici qu'on obtient le bois, et seulement avec la hache —
// qui s'y consomme.
=== pont_vieil_arbre_plie ===
// Deux verrous, et pas un seul : la lame, et l'accord du fils. C'est lui qui
// donne le droit moral de découper son père — sans quoi le geste n'est qu'un
// abattage (game-design/scenes/chapter-1/le-pont.md).
{ not has_hache:
    À ÉCRIRE — le vieil arbre, debout. Rien à en tirer sans lame.
    -> DONE
}
{ not flag_arbre_demande:
    À ÉCRIRE — la lame est là, mais ce n'est pas au héros d'en décider : il faudrait en parler au fils.
    -> DONE
}
À ÉCRIRE — la lame pèse dans la main du héros, et le fils a dit oui. C'est maintenant, ou jamais.
+ [À ÉCRIRE — choix : découper le vieil arbre]
    À ÉCRIRE — le geste, le bruit du papier, ce que ça coûte. # give: bois # drop: hache # flag: vieil_arbre_decoupe
+ [À ÉCRIRE — choix : le laisser debout]
    À ÉCRIRE — il repose la lame.
- -> DONE


// ================================================================
// Chapitre 1 — La porte
// Voir game-design/scenes/chapter-1/la-porte.md
// ================================================================

// Joué automatiquement à la première arrivée dans la scène (PorteScene.create).
=== porte_arrivee ===
À ÉCRIRE — arrivée devant le village fortifié : le rempart, et le trou à la place de la porte. # flag: porte_vue
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
À ÉCRIRE — le renard, assis devant le trou, coincé dehors.
-> porte_renard_choix

=== porte_renard_choix ===
+ { not flag_porte_disparue } [À ÉCRIRE — choix : qu'est-ce que tu fais là ?]
    # qui: renard
    À ÉCRIRE — il attend. La porte était là il y a peu, et elle n'y est plus. # flag: porte_disparue # then: porte_renard_choix
+ { flag_porte_disparue && not flag_renard_bois_su } [À ÉCRIRE — choix : elle était comment, cette porte ?]
    # qui: renard
    À ÉCRIRE — en bois. Il n'en a pas. Mais avec une lame, on en trouverait. # flag: renard_bois_su # give: idee_hache # then: porte_renard_choix
+ [À ÉCRIRE — choix : prendre congé]
    # qui: narrateur
    À ÉCRIRE — le héros le laisse à son attente.
- -> DONE

// La grande feuille tendue dans l'embrasure, à la place du battant.
=== porte_porte ===
{
  - has_bois:
    À ÉCRIRE — il a de quoi faire, maintenant.
    -> porte_enigme
  - flag_porte_disparue:
    À ÉCRIRE — il faudrait du bois, et il n'en a pas.
  - else:
    À ÉCRIRE — une embrasure vide, une grande feuille posée en travers. Pour quoi faire ?
}
-> DONE

=== porte_enigme ===
À ÉCRIRE — le héros déplie le bois contre l'embrasure.
-> porte_enigme_lancement

=== porte_enigme_lancement ===
# puzzle: porte # then: porte_enigme_issue
-> DONE

=== porte_enigme_issue ===
{ flag_porte_resolu:
    À ÉCRIRE — réussite : la porte prend forme. # origami: porte # flag: porte_plie # drop: bois
    À ÉCRIRE — elle tient dans l'embrasure, et le village s'ouvre.
  - else:
    À ÉCRIRE — échec ou abandon : le bois reste du bois.
}
-> DONE

// Le papier métallisé, qui deviendra la hache. C'est le PLIAGE qui le fait
// disparaître de la scène (`flag_hache_pliee`), pas la possession de la hache :
// celle-ci se dépense plus tard, et la feuille reviendrait.
=== porte_feuille_hache ===
{ not has_idee_hache:
    À ÉCRIRE — un papier métallisé, plus raide que les autres. Rien ne vient.
    -> DONE
}
À ÉCRIRE — une lame. C'est une lame qu'il faut, et il sait la plier.
-> porte_hache_enigme

=== porte_hache_enigme ===
À ÉCRIRE — le héros lisse le papier métallisé devant lui.
-> porte_hache_enigme_lancement

=== porte_hache_enigme_lancement ===
# puzzle: hache # then: porte_hache_enigme_issue
-> DONE

=== porte_hache_enigme_issue ===
{ flag_hache_resolu:
    À ÉCRIRE — réussite : le tranchant apparaît. # origami: hache # flag: hache_pliee # give: hache # drop: idee_hache
    À ÉCRIRE — le héros soupèse la hache de papier.
  - else:
    À ÉCRIRE — échec ou abandon : le papier refuse de tenir le pli.
}
-> DONE

// Franchir la porte referme le chapitre.
//
// ⚠ Pas de `# goto:` : le chapitre 2 n'existe pas. Le jour où il existera, ce
// knot est le seul endroit à modifier.
=== porte_fin_chapitre ===
À ÉCRIRE — le passage sous la porte de papier, et ce qu'on aperçoit du village.
À ÉCRIRE — fin du chapitre 1.
-> DONE


// ================================================================
// Le héros
// ================================================================

// Partagé par toutes les scènes : ce que le héros pense de lui-même ne change
// pas d'une pièce à l'autre. Il se découpera par scène le jour où ça comptera.
=== heros ===
# qui: narrateur
À ÉCRIRE — la grenouille de papier, vue par elle-même.
-> DONE
