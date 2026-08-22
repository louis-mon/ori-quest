import type { Personnage } from '../game/systems/personnages';
import { VERB_LABELS, type Verb } from '../game/systems/hotspots';
import { gameState } from '../game/systems/state';
import { estIdee, objet } from '../game/systems/objets';
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
/** Repli quand un objet n'a pas encore de description écrite. */
function nomDe(id: string): string {
  return objet(id).nom;
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
  showVerbs(
    screenX: number,
    screenY: number,
    verbs: Verb[],
    onPick: (verb: Verb | null) => void,
  ) {
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
        e.stopPropagation();
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
    this.captionTimer = window.setTimeout(
      () => this.caption.classList.remove('is-visible'),
      ms,
    );
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
   */
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

  private renderInventory(items: readonly string[]) {
    this.inventory.innerHTML = '';
    for (const id of items) {
      const { nom } = objet(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'inventory__item' + (estIdee(id) ? ' inventory__item--idee' : '');

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
      this.inventory.appendChild(el);
    }
  }
}

