import type { Personnage } from '../game/systems/personnages';
import { VERB_LABELS, type Verb } from '../game/systems/hotspots';
import { gameState } from '../game/systems/state';
import { estIdee, objet } from '../game/systems/objets';
import { mouvementReduit, placerBandeau, volVersLaCase } from './obtention';
import { vignette } from './vignettes';

/**
 * Toute l'interface (dialogues, inventaire, menu de verbes) est du DOM posé
 * au-dessus du canvas, pas des objets Phaser.
 *
 * C'est un choix d'architecture délibéré : le texte reste net à toutes les
 * densités d'écran, le retour à la ligne et l'accessibilité sont gratuits, et
 * itérer sur la mise en page se fait en CSS plutôt qu'en repositionnant des
 * sprites à la main.
 */
/**
 * Le temps, en millisecondes, pendant lequel une attente de tap fraîchement
 * ouverte ignore les taps. Zéro la désactive.
 *
 * Sans ce délai, deux contacts rapprochés dépensent deux répliques : le doigt
 * qui rebondit, ou l'impatience de qui enchaîne, fait disparaître une ligne
 * jamais lue — et rien, dans le jeu, ne permet de revenir en arrière.
 *
 * 300 ms est la valeur du genre, et ce n'est pas un hasard : c'est aussi le
 * seuil de double-tap d'iOS et d'Android (`DOUBLE_TAP_TIMEOUT`), donc la durée
 * en deçà de laquelle le système lui-même tient deux contacts pour un seul
 * geste. En dessous de ~200 ms le rebond repasse ; au-delà de ~400 ms, c'est le
 * tap volontaire d'un lecteur rapide qui est avalé, la boîte a l'air cassée et
 * le joueur retape — plus fort, et deux fois.
 *
 * **Nul par défaut en développement**, où l'on traverse le récit vingt fois par
 * heure pour aller vérifier autre chose : le délai n'y protège personne et
 * ralentit tout. Pour le sentir quand c'est *lui* qu'on règle, il suffit de
 * poser la valeur voulue dans l'environnement :
 *
 *     VITE_DELAI_TAP=300 npm run dev
 *
 * ou une ligne `VITE_DELAI_TAP=300` dans un `.env.local` (ignoré par git, Vite
 * redémarre tout seul quand le fichier change). La même variable sert dans
 * l'autre sens — `VITE_DELAI_TAP=0 npm run build` livrerait sans délai. Et
 * `npm run preview` donne le comportement réel sans rien régler du tout.
 */
const delaiDemande = Number(import.meta.env.VITE_DELAI_TAP);
const DELAI_ANTI_TAP = Number.isFinite(delaiDemande) ? delaiDemande : import.meta.env.DEV ? 0 : 300;

/**
 * Temps que met une case à s'effacer quand l'objet quitte l'inventaire.
 *
 * Un objet consommé — l'idée dépensée en pliant, la hache usée sur le vieux
 * chêne — disparaissait d'une frame à l'autre. Le remplacement le plus important
 * du jeu, l'idée qui devient l'objet, passait ainsi tout entier inaperçu : même
 * vignette, même place, aucun mouvement.
 */
const DEPART_MS = 220;

/** Temps d'affichage du bandeau « Obtenu : … ». */
const BANDEAU_MS = 2000;

/** Repli quand un objet n'a pas encore de description écrite. */
function nomDe(id: string): string {
  return objet(id).nom;
}

/**
 * Ce qu'annonce le bandeau.
 *
 * Le nom brut donnait « Obtenu : Idée : l'arbre » — deux fois deux-points pour
 * une seule phrase. Une idée porte déjà son genre dans son nom, l'annonce
 * s'accorde donc avec plutôt que de l'empiler. Et la minuscule parce que le nom
 * est écrit pour tenir seul dans une case, où il commence la ligne ; ici il la
 * finit.
 */
function annonceDe(id: string): string {
  const nom = nomDe(id);
  const suite = nom.charAt(0).toLocaleLowerCase('fr') + nom.slice(1);
  return estIdee(id) ? `Nouvelle ${suite}` : `Obtenu : ${suite}`;
}

/** Ce que l'interface sait faire d'un modèle plié : le montrer, puis le ranger. */
export interface ApercuOrigami {
  montrer(modele: string): void;
  cacher(): void;
}

export class Overlay {
  private root: HTMLElement;
  private verbMenu: HTMLElement;
  private dialogue: HTMLElement;
  private dialoguePortrait: HTMLImageElement;
  private dialogueNom: HTMLElement;
  private dialogueText: HTMLElement;
  private dialogueChoices: HTMLElement;
  private dialogueNext: HTMLButtonElement;
  private inventory: HTMLElement;
  private caption: HTMLElement;
  private captionTimer = 0;
  private obtenu: HTMLElement;
  private obtenuTimer = 0;

  /**
   * Objets dont l'arrivée dans la colonne reste à montrer.
   *
   * Rempli par `annoncerObtention()`, vidé par `jouerAnnonces()`. C'est ce qui
   * distingue un objet **obtenu** d'un objet simplement **présent** : l'état de
   * jeu, lui, ne connaît pas la différence.
   */
  private aAnnoncer = new Set<string>();
  private annonceEnCours = false;
  /**
   * Nombre de lignes ou de choix en attente d'un tap.
   *
   * La boîte de dialogue est une ressource unique : la narration l'occupe pour
   * la durée d'une réplique, et rien d'autre ne doit pouvoir écrire dedans
   * pendant ce temps. Sans ce compteur, un tap sur l'inventaire en pleine
   * réplique écrasait le texte et laissait deux écouteurs sur le même tap
   * suivant.
   */
  private lignesEnCours = 0;

  /** De quoi résoudre la réplique en attente sans tap. Voir `interrompre()`. */
  private terminerLigne: (() => void) | null = null;

  /**
   * De quoi montrer un modèle plié en grand, tournant sur lui-même.
   *
   * Branché depuis `main.ts` plutôt que construit ici : c'est lui qui possède la
   * couche 3D, et l'interface n'a aucune raison de savoir que three.js existe.
   * Absent, l'examen d'un objet se contente de sa description.
   */
  private apercu?: ApercuOrigami;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="inventory"></div>
      <div class="obtenu"></div>
      <div class="caption"></div>
      <div class="verb-menu" hidden></div>
      <div class="dialogue" hidden>
        <img class="dialogue__portrait" alt="" hidden>
        <div class="dialogue__bulle">
          <p class="dialogue__nom" hidden></p>
          <p class="dialogue__text"></p>
          <div class="dialogue__choices"></div>
        </div>
        <button class="dialogue__next" aria-label="Continuer" hidden>▶</button>
      </div>
    `;
    this.verbMenu = root.querySelector('.verb-menu')!;
    this.dialogue = root.querySelector('.dialogue')!;
    this.dialoguePortrait = root.querySelector('.dialogue__portrait')!;
    this.dialogueNom = root.querySelector('.dialogue__nom')!;
    this.dialogueText = root.querySelector('.dialogue__text')!;
    this.dialogueChoices = root.querySelector('.dialogue__choices')!;
    this.dialogueNext = root.querySelector('.dialogue__next')!;
    this.inventory = root.querySelector('.inventory')!;
    this.caption = root.querySelector('.caption')!;
    this.obtenu = root.querySelector('.obtenu')!;

    // Une vignette absente ne doit pas laisser d'icône cassée dans la boîte :
    // le nom porte alors seul l'identité du personnage.
    this.dialoguePortrait.addEventListener('error', () => {
      this.dialoguePortrait.hidden = true;
    });

    gameState.subscribe((state) => this.renderInventory(state.inventory));
  }

  /** Branche la couche 3D. Voir `apercu`. */
  brancherApercu(apercu: ApercuOrigami) {
    this.apercu = apercu;
  }

  // ---------- Menu de verbes ----------

  /**
   * Affiche les actions disponibles au point tapé. Remplace le survol du
   * point & click classique, qui n'existe pas sur écran tactile.
   */
  showVerbs(screenX: number, screenY: number, verbs: Verb[], onPick: (verb: Verb | null) => void) {
    this.verbMenu.innerHTML = '';
    for (const verb of verbs) {
      const btn = document.createElement('button');
      btn.textContent = VERB_LABELS[verb];
      btn.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        this.hideVerbs();
        onPick(verb);
      });
      this.verbMenu.appendChild(btn);
    }
    this.verbMenu.hidden = false;

    // Positionne au-dessus du doigt, en restant dans le cadre du jeu.
    // Les coordonnées reçues sont en pixels page ; l'overlay est positionné
    // relativement à #stage, d'où la soustraction de son origine.
    const stage = this.root.getBoundingClientRect();
    const menu = this.verbMenu.getBoundingClientRect();
    const margin = 12;
    const x = Math.min(
      Math.max(screenX - stage.left, menu.width / 2 + margin),
      stage.width - menu.width / 2 - margin,
    );
    const y = Math.max(screenY - stage.top - 12, menu.height + margin);
    this.verbMenu.style.left = `${x}px`;
    this.verbMenu.style.top = `${y}px`;

    const dismiss = () => {
      this.hideVerbs();
      onPick(null);
    };
    // Un tap n'importe où ailleurs ferme le menu.
    setTimeout(() => window.addEventListener('pointerup', dismiss, { once: true }), 0);
  }

  hideVerbs() {
    this.verbMenu.hidden = true;
  }

  get verbsVisible() {
    return !this.verbMenu.hidden;
  }

  // ---------- Dialogue ----------

  /**
   * Affiche une ligne et attend un tap.
   *
   * `qui` désigne le personnage qui parle, `null` la narration. Le locuteur
   * vient du tag ink `# qui:` — voir `DialogueRunner`.
   */
  say(text: string, qui: Personnage | null = null): Promise<void> {
    // Écrit dans le DOM **avant** de rendre la promesse, et non dans son
    // exécuteur : `DialogueRunner` compte là-dessus pour que le locuteur soit
    // posé au moment de l'appel, pas un tick plus tard.
    this.dialogue.hidden = false;
    this.showSpeaker(qui);
    this.dialogueText.textContent = text;
    this.dialogueChoices.innerHTML = '';
    this.dialogueNext.hidden = false;
    return this.attendreUnTap();
  }

  /**
   * Attend un tap **sans rien afficher de neuf** : la réplique déjà à l'écran y
   * reste, et c'est le joueur qui dit quand on passe à la suite.
   *
   * Pour ce qui se joue *pendant* qu'une réplique est affichée — une animation
   * de tutoriel, un pli qui se trace. Sans ça, la ligne suivante remplace celle
   * qu'on est en train de lire à la seconde exacte où l'animation se termine :
   * le joueur a tapé une fois et le dialogue a avancé deux fois. Un dialogue
   * n'avance jamais tout seul.
   *
   * Boîte fermée, il n'y a rien à taper : attendre bloquerait la partie faute
   * de cible où poser le doigt, donc on rend la main tout de suite.
   */
  attendreUnTap(): Promise<void> {
    if (this.dialogue.hidden) return Promise.resolve();
    const debut = performance.now();
    return new Promise((resolve) => {
      this.lignesEnCours++;
      let fait = false;
      const finir = () => {
        if (fait) return;
        fait = true;
        this.dialogue.removeEventListener('pointerup', advance);
        if (this.terminerLigne === finir) this.terminerLigne = null;
        this.lignesEnCours--;
        resolve();
      };
      const advance = (e: Event) => {
        // Arrêter la propagation même quand le tap est ignoré : avalé ici, il
        // ne doit pas non plus aller fermer un menu de verbes derrière.
        e.stopPropagation();
        if (performance.now() - debut < DELAI_ANTI_TAP) return;
        finir();
      };
      this.dialogue.addEventListener('pointerup', advance);
      this.terminerLigne = finir;
    });
  }

  /**
   * Met fin à la réplique en attente **sans tap**, et referme la boîte.
   *
   * Pour ce qui coupe court à une séquence de répliques : le bouton « Passer »
   * du tutoriel. Sans ça, la ligne interrompue garde son écouteur et son
   * compteur levé — `occupeLeJoueur` reste vrai pour toujours, et le décor
   * cesse de répondre aux taps sans qu'on comprenne pourquoi.
   *
   * N'interrompt **pas** un choix en cours : ceux-là résolvent un index, et
   * en inventer un ferait prendre au récit une branche que personne n'a
   * choisie. Un appelant qui peut couper court ne doit donc pas laisser de
   * choix ouvert au même moment.
   */
  interrompre() {
    this.terminerLigne?.();
    this.hideDialogue();
  }

  /**
   * Fait passer la boîte de dialogue **au-dessus** des couches plein écran.
   *
   * L'énigme est à `z-index: 4` et la boîte n'en a pas : une séquence de
   * répliques jouée par-dessus une énigme — c'est-à-dire un tutoriel — se
   * déroulerait invisible, derrière le panneau.
   */
  mettreDevant(devant: boolean) {
    this.dialogue.classList.toggle('dialogue--devant', devant);
  }

  /** La boîte de dialogue est-elle occupée par une réplique en attente ? */
  get dialogueOccupe() {
    return this.lignesEnCours > 0;
  }

  /**
   * L'interface tient-elle la parole ?
   *
   * Vrai dès qu'une réplique attend un tap ou qu'un menu de verbes est ouvert —
   * y compris pour la description d'un objet d'inventaire, qui passe par `say()`
   * sans passer par le moteur de narration. C'est **la** question que le décor
   * doit poser avant de réagir à un tap : la poser en trois morceaux, comme
   * c'était le cas, laissait forcément un chemin en oublier un. Lire la
   * description d'un objet n'empêchait ainsi ni d'analyser un hotspot ni de
   * changer de scène — la boîte partait alors avec la pièce qu'on quittait.
   */
  get occupeLeJoueur() {
    return this.dialogueOccupe || this.verbsVisible;
  }

  /** Affiche des choix et attend une sélection. Résout l'index choisi. */
  choose(options: string[]): Promise<number> {
    // Un tap de trop sur une réplique arrive pile quand les choix la
    // remplacent, et prend alors une branche que personne n'a lue. C'est le cas
    // le plus coûteux du lot : une ligne sautée se devine à la suivante, un
    // choix pris tout seul emmène le récit ailleurs.
    const debut = performance.now();
    return new Promise((resolve) => {
      this.dialogue.hidden = false;
      this.dialogueNext.hidden = true;
      this.dialogueChoices.innerHTML = '';
      this.lignesEnCours++;
      options.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          if (performance.now() - debut < DELAI_ANTI_TAP) return;
          this.dialogueChoices.innerHTML = '';
          this.lignesEnCours--;
          resolve(i);
        });
        this.dialogueChoices.appendChild(btn);
      });
    });
  }

  hideDialogue() {
    this.dialogue.hidden = true;
    this.dialogueChoices.innerHTML = '';
    // Le texte part avec le reste : un knot qui ouvre directement des choix, sans
    // réplique avant eux, rouvrait la boîte sur la dernière ligne du dialogue
    // précédent — attribuée à personne, puisque le locuteur, lui, était rendu.
    this.dialogueText.textContent = '';
    this.showSpeaker(null);
  }

  /**
   * Pose l'en-tête du locuteur : sa vignette et son nom.
   *
   * Sans locuteur, la boîte repasse en narration — ni nom ni vignette, et le
   * texte en italique. La différence entre « quelqu'un parle » et « le jeu
   * décrit » se voit alors avant d'être lue, ce qui compte sur un écran de
   * téléphone où la boîte est la seule zone de texte.
   */
  private showSpeaker(qui: Personnage | null) {
    this.dialogue.classList.toggle('dialogue--narration', !qui);
    this.dialogueNom.hidden = !qui;
    this.dialogueNom.textContent = qui?.nom ?? '';
    this.dialogueNom.style.color = qui?.couleur ?? '';

    const portrait = qui?.portrait ?? '';
    this.dialoguePortrait.hidden = !portrait;
    // Ne pas réaffecter `src` à l'identique : le navigateur relancerait un
    // chargement, et la vignette clignoterait à chaque ligne du même
    // personnage.
    if (portrait && !this.dialoguePortrait.src.endsWith(portrait)) {
      this.dialoguePortrait.src = portrait;
    }
  }

  // ---------- Divers ----------

  /**
   * La légende fugace : une pastille qui nomme l'objet dont on ouvre le menu de
   * verbes. C'est son seul emploi — les descriptions d'inventaire passent par la
   * boîte de dialogue, et les sorties ne s'annoncent plus.
   */
  showCaption(text: string, ms = 1600) {
    this.caption.textContent = text;
    this.caption.classList.add('is-visible');
    clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => this.caption.classList.remove('is-visible'), ms);
  }

  /**
   * Examiner un objet : le modèle tourne au centre de l'écran pendant qu'on lit
   * sa description, et les deux se referment au tap.
   *
   * Une vignette de 42 px dit ce qu'on possède ; elle ne dit pas ce que c'est.
   * Un origami a une épaisseur, un dos, des plis qui prennent la lumière — rien
   * de tout ça ne survit à une case d'inventaire, et c'est pourtant la matière
   * même du jeu.
   */
  private async examiner(id: string) {
    const { description, modele } = objet(id);
    if (!description && !modele) return;

    if (modele) this.apercu?.montrer(modele);
    try {
      await this.say(description || nomDe(id));
    } finally {
      // `finally` : une description interrompue ne doit pas laisser le modèle
      // tourner indéfiniment par-dessus la scène.
      this.apercu?.cacher();
      this.hideDialogue();
    }
  }

  /**
   * L'inventaire : une colonne de cases sur le bord gauche.
   *
   * Chaque case est un bouton — un tap **ouvre la boîte de dialogue** et y écrit
   * la description, en narration. C'est la boîte que le joueur lit déjà dans
   * tout le jeu : elle laisse le temps de lire, se ferme sur un tap comme le
   * reste, et le texte n'est pas contraint à tenir dans une étiquette qui passe.
   * La légende reste pour ce qui est vraiment fugace — le libellé d'une sortie.
   *
   * Les objets ne se combinent pas et ne se glissent nulle part : ils
   * s'emploient d'eux-mêmes quand la scène s'y prête. La case n'est donc pas
   * une poignée, seulement un rappel.
   *
   * Chaque case porte l'**image** de ce qu'elle contient, au-dessus du nom : à
   * la taille où l'inventaire tient sur un téléphone, une colonne d'étiquettes
   * de texte se lit mal et se reconnaît encore moins vite. Pour un pliage,
   * l'image est le modèle lui-même — la même que le but de l'énigme.
   *
   * **La colonne reste à l'écran même vide**, avec un emplacement en
   * pointillés. Elle s'effaçait jusqu'ici quand il n'y avait rien dedans, et le
   * premier objet faisait donc apparaître le contenant et son contenu du même
   * geste : le joueur n'avait jamais eu l'occasion d'apprendre qu'il existait
   * ici un endroit où les choses se rangent. C'est le remède du genre — un
   * inventaire visible en permanence, comme la grille du bas d'écran chez
   * LucasArts — dans le format dont on dispose.
   */
  private renderInventory(items: readonly string[]) {
    // Rendu **par identifiant**, jamais reconstruit. La colonne se redessine à
    // chaque changement d'état, drapeau compris : en repartant d'un `innerHTML`
    // vide, un vol en cours perdrait la case où il doit se poser, et toutes les
    // cases rejoueraient leur arrivée à chaque objet ramassé ailleurs.
    const vivantes = new Map<string, HTMLButtonElement>();
    for (const el of this.inventory.querySelectorAll<HTMLButtonElement>('.inventory__item')) {
      const id = el.dataset.objet;
      if (id && !el.classList.contains('inventory__item--part')) vivantes.set(id, el);
    }

    for (const [id, el] of vivantes) {
      if (!items.includes(id)) this.retirerCase(el);
    }

    let precedent: HTMLElement | null = null;
    for (const id of items) {
      const el = vivantes.get(id) ?? this.creerCase(id);
      // Remet les cases dans l'ordre de l'inventaire sans déranger celles qui
      // sont en train de partir : elles finissent leur effacement où elles sont.
      this.inventory.insertBefore(
        el,
        precedent ? precedent.nextSibling : this.inventory.firstChild,
      );
      precedent = el;
    }

    this.majEmplacementVide();
    void this.jouerAnnonces();
  }

  private creerCase(id: string): HTMLButtonElement {
    const { nom } = objet(id);
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.objet = id;
    el.className = 'inventory__item' + (estIdee(id) ? ' inventory__item--idee' : '');
    // Une case attendue par une annonce naît **invisible**, et c'est le vol qui
    // la découvre en s'y posant. Invisible et non absente : il faut pouvoir la
    // mesurer pour savoir où atterrir.
    if (this.aAnnoncer.has(id)) el.classList.add('inventory__item--arrive');

    const image = document.createElement('img');
    image.className = 'inventory__image';
    image.alt = '';
    image.hidden = true;
    el.appendChild(image);

    const label = document.createElement('span');
    label.className = 'inventory__nom';
    label.textContent = nom;
    el.appendChild(label);

    // La vignette arrive en différé (rendu 3D du modèle). La case est
    // utilisable tout de suite ; l'image s'ajoute quand elle est prête, et
    // son absence ne laisse pas d'icône cassée.
    void vignette(id).then((url) => {
      if (!url || !el.isConnected) return;
      image.src = url;
      image.hidden = false;
    });

    el.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      // Pas pendant une réplique : la boîte est déjà prise, et le joueur
      // retrouverait sa description à la place de ce qu'il était en train de
      // lire.
      if (this.dialogueOccupe) return;
      void this.examiner(id);
    });
    return el;
  }

  /** Une case qui part s'efface : voir `DEPART_MS`. */
  private retirerCase(el: HTMLElement) {
    el.classList.add('inventory__item--part');
    setTimeout(() => {
      el.remove();
      this.majEmplacementVide();
    }, DEPART_MS);
  }

  /** Pose ou retire l'emplacement en pointillés qui tient la colonne visible. */
  private majEmplacementVide() {
    const occupee = this.inventory.querySelector('.inventory__item');
    const vide = this.inventory.querySelector('.inventory__vide');
    if (occupee) {
      vide?.remove();
      return;
    }
    if (vide) return;
    const el = document.createElement('div');
    el.className = 'inventory__vide';
    el.setAttribute('aria-hidden', 'true');
    this.inventory.appendChild(el);
  }

  // ---------- Obtenir un objet ----------

  /**
   * Annonce l'arrivée d'un objet : au prochain rendu, sa case sera montrée.
   *
   * Appelé par l'effet `# give:`, et par lui seul (voir `donner` dans
   * `main.ts`). Surtout pas depuis l'abonnement à l'état : `gameState.give()`
   * sert aussi à charger une sauvegarde et à sauter à un point d'étape, où
   * annoncer trois objets à la file n'aurait aucun sens.
   */
  annoncerObtention(id: string) {
    this.aAnnoncer.add(id);
  }

  /** Joue les annonces en attente, une à la fois. */
  private async jouerAnnonces() {
    if (this.annonceEnCours) return;
    this.annonceEnCours = true;
    try {
      while (this.aAnnoncer.size) {
        const [id] = this.aAnnoncer;
        this.aAnnoncer.delete(id);
        const el = this.inventory.querySelector<HTMLElement>(
          `.inventory__item[data-objet="${id}"]`,
        );
        if (el) await this.montrerObtention(id, el);
      }
    } finally {
      this.annonceEnCours = false;
    }
  }

  /**
   * Le vol, puis la case qui se pose, puis le bandeau qui la nomme.
   *
   * Dans cet ordre et pas un autre : le mouvement dit *où*, l'atterrissage dit
   * *maintenant*, le texte dit *quoi*. Le nom affiché en premier ferait lire le
   * bandeau au lieu de suivre le vol — et c'est le vol qui enseigne la colonne.
   */
  private async montrerObtention(id: string, el: HTMLElement) {
    try {
      // La vignette est un rendu 3D mis en cache : le premier objet d'un modèle
      // se fait attendre, les suivants sont immédiats.
      const url = await vignette(id);
      if (url && !mouvementReduit()) await volVersLaCase(this.root, url, el);
    } catch (err) {
      // Montrer un objet ne doit jamais empêcher de l'avoir.
      console.error(`[objet] annonce de "${id}" impossible`, err);
    } finally {
      // Quoi qu'il arrive : une case restée invisible serait un objet perdu.
      el.classList.remove('inventory__item--arrive');
    }

    el.classList.add('inventory__item--pose');
    el.addEventListener('animationend', () => el.classList.remove('inventory__item--pose'), {
      once: true,
    });
    this.montrerBandeau(annonceDe(id), el);
  }

  /**
   * Le bandeau « Obtenu : … », posé contre la case.
   *
   * Cousine de `showCaption()` — même pastille, même effacement — mais elle ne
   * dit pas la même chose et ne vit pas au même endroit : la légende nomme ce
   * qu'on touche, au centre ; celle-ci nomme ce qu'on vient de recevoir, et le
   * fait *là où c'est rangé*. Un bandeau centré nommerait l'objet en laissant le
   * joueur ignorer où il est parti, c'est-à-dire la moitié du problème.
   */
  private montrerBandeau(texte: string, cible: HTMLElement) {
    this.obtenu.textContent = texte;
    placerBandeau(this.obtenu, this.root, cible);
    this.obtenu.classList.add('is-visible');
    clearTimeout(this.obtenuTimer);
    this.obtenuTimer = window.setTimeout(
      () => this.obtenu.classList.remove('is-visible'),
      BANDEAU_MS,
    );
  }
}
