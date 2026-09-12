import type { Personnage } from '../game/systems/personnages';
import { gameState } from '../game/systems/state';
import { estIdee, objet } from '../game/systems/objets';
import { mouvementReduit, placerBandeau, volVersLaCase } from './obtention';
import { vignette } from './vignettes';
import { urlApercuOrigami } from '../origami/apercu';
import { typographier } from './typographie';

// Le portrait s'affiche à ~56 px ; les photos du registre font 160 px de côté, et
// un modèle rendu n'a pas de raison d'être plus fin.
const TAILLE_PORTRAIT = 160;

// L'interface est du DOM posé au-dessus du canvas, pas des objets Phaser : le
// texte reste net à toutes les densités et la mise en page s'itère en CSS.

// Millisecondes pendant lesquelles une attente de tap fraîchement ouverte ignore
// les taps ; sans quoi deux contacts rapprochés dépensent deux répliques et rien
// dans le jeu ne revient en arrière.
//
// 300 ms est aussi le seuil de double-tap d'iOS et d'Android. En dessous de
// ~200 ms le rebond repasse ; au-delà de ~400 ms, c'est le tap volontaire d'un
// lecteur rapide qui est avalé. Nul en développement, où l'on retraverse le
// récit sans arrêt ; VITE_DELAI_TAP le règle dans les deux sens.
const delaiDemande = Number(import.meta.env.VITE_DELAI_TAP);
const DELAI_ANTI_TAP = Number.isFinite(delaiDemande) ? delaiDemande : import.meta.env.DEV ? 0 : 300;

// Sans effacement, un objet consommé disparaissait d'une frame à l'autre : le
// remplacement le plus important du jeu, l'idée qui devient l'objet, passait
// inaperçu — même vignette, même place, aucun mouvement.
const DEPART_MS = 220;

// Le texte s'écrit caractère par caractère. Au playtest, des joueurs restaient
// devant une boîte posée d'un coup sans comprendre qu'elle attendait d'eux :
// rien n'y bougeait, elle passait pour un élément de décor. Un texte qui
// s'écrit est la seule chose en mouvement à l'écran, et le regard y va.
//
// 20 c/s est plus lent qu'une lecture ordinaire, et c'est voulu tant que la
// vitesse se règle : le premier tap termine la ligne, donc un lecteur rapide
// n'attend jamais plus que le geste qu'il ferait de toute façon.
const CARACTERES_PAR_SECONDE = 20;

const BANDEAU_MS = 2000;

function nomDe(id: string): string {
  return objet(id).nom;
}

// Le nom brut donnait « Obtenu : Idée : l'arbre », deux fois deux-points dans
// une phrase. Minuscule parce que le nom est écrit pour commencer la ligne d'une
// case ; ici il la finit.
function annonceDe(id: string): string {
  const nom = nomDe(id);
  const suite = nom.charAt(0).toLocaleLowerCase('fr') + nom.slice(1);
  return estIdee(id) ? `Nouvelle ${suite}` : `Obtenu : ${suite}`;
}

export interface ApercuOrigami {
  montrer(modele: string): void;
  cacher(): void;
}

export class Overlay {
  private root: HTMLElement;
  private dialogue: HTMLElement;
  private dialoguePortrait: HTMLImageElement;
  // Numéro de la dernière demande de portrait ; voir `poserPortrait()`.
  private portraitDemande = 0;
  private dialogueNom: HTMLElement;
  private dialogueVu: HTMLElement;
  private dialogueReste: HTMLElement;
  private dialogueChoices: HTMLElement;
  private dialogueNext: HTMLButtonElement;
  private inventory: HTMLElement;
  private obtenu: HTMLElement;
  private obtenuTimer = 0;

  // Ce qui distingue un objet obtenu d'un objet simplement présent : l'état de
  // jeu, lui, ne connaît pas la différence.
  private aAnnoncer = new Set<string>();
  private annonceEnCours = false;
  // La boîte de dialogue est une ressource unique. Sans ce compteur, un tap sur
  // l'inventaire en pleine réplique écrasait le texte et laissait deux écouteurs
  // sur le tap suivant.
  private lignesEnCours = 0;

  // La réplique entière, dont `dialogueVu` ne montre encore qu'un préfixe, et
  // l'image en attente tant qu'elle s'écrit. Voir `defiler()`.
  private texteEnCours = '';
  private imageDefilement = 0;

  // De quoi résoudre la réplique en attente sans tap. Voir `interrompre()`.
  private terminerLigne: (() => void) | null = null;

  // Le temps d'un déplacement bloquant. Voir `suspendreLInventaire()`.
  private inventaireSuspendu = false;

  // Branché depuis `main.ts`, qui possède la couche 3D : l'interface n'a pas à
  // savoir que three.js existe. Absent, l'examen se contente de la description.
  private apercu?: ApercuOrigami;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="inventory"></div>
      <div class="obtenu"></div>
      <div class="dialogue" hidden>
        <img class="dialogue__portrait" alt="" hidden>
        <div class="dialogue__bulle">
          <p class="dialogue__nom" hidden></p>
          <!-- Les deux moitiés se touchent : en pre-line, un retour à la ligne
               entre elles s'afficherait comme tel. Voir defiler(). -->
          <p class="dialogue__text"><span class="dialogue__vu"></span><span class="dialogue__reste"></span></p>
          <div class="dialogue__choices"></div>
        </div>
        <button class="dialogue__next" aria-label="Continuer" hidden>▶</button>
      </div>
    `;
    this.dialogue = root.querySelector('.dialogue')!;
    this.dialoguePortrait = root.querySelector('.dialogue__portrait')!;
    this.dialogueNom = root.querySelector('.dialogue__nom')!;
    this.dialogueVu = root.querySelector('.dialogue__vu')!;
    this.dialogueReste = root.querySelector('.dialogue__reste')!;
    this.dialogueChoices = root.querySelector('.dialogue__choices')!;
    this.dialogueNext = root.querySelector('.dialogue__next')!;
    this.inventory = root.querySelector('.inventory')!;
    this.obtenu = root.querySelector('.obtenu')!;

    // Une vignette absente ne doit pas laisser d'icône cassée : le nom porte
    // alors seul l'identité du personnage.
    this.dialoguePortrait.addEventListener('error', () => {
      this.dialoguePortrait.hidden = true;
    });

    gameState.subscribe((state) => this.renderInventory(state.inventory));
  }

  brancherApercu(apercu: ApercuOrigami) {
    this.apercu = apercu;
  }

  // ---------- Dialogue ----------

  // `qui` à null, c'est la narration.
  say(text: string, qui: Personnage | null = null): Promise<void> {
    // Écrit dans le DOM avant de rendre la promesse, et non dans son exécuteur :
    // `DialogueRunner` compte là-dessus pour que le locuteur soit posé au moment
    // de l'appel, pas un tick plus tard.
    this.dialogue.hidden = false;
    this.showSpeaker(qui);
    this.defiler(typographier(text));
    this.dialogueChoices.innerHTML = '';
    this.dialogueNext.hidden = false;
    return this.attendreUnTap();
  }

  // Attend un tap sans rien changer à l'écran, pour ce qui se joue pendant
  // qu'une réplique est affichée. Sans ça, la ligne suivante remplace celle
  // qu'on lit à la seconde où l'animation se termine : un tap, deux avancées.
  //
  // Boîte fermée, il n'y a rien à taper : attendre bloquerait la partie faute de
  // cible où poser le doigt.
  attendreUnTap(): Promise<void> {
    if (this.dialogue.hidden) return Promise.resolve();
    // Rouvert quand un tap achève le défilement : ce tap-là compte pour un
    // contact neuf, le rebond qui le suit ne doit pas emporter la réplique.
    let ouvert = performance.now();
    return new Promise((resolve) => {
      this.lignesEnCours++;
      let fait = false;
      const rendreLesTaps = this.surveillerAilleurs(() => ouvert);
      const finir = () => {
        if (fait) return;
        fait = true;
        this.dialogue.removeEventListener('pointerup', advance);
        rendreLesTaps();
        if (this.terminerLigne === finir) this.terminerLigne = null;
        this.lignesEnCours--;
        resolve();
      };
      const advance = (e: Event) => {
        // Propagation arrêtée même quand le tap est ignoré : avalé ici, il ne
        // doit pas repartir déclencher ce qui se trouve derrière la boîte.
        e.stopPropagation();
        if (performance.now() - ouvert < DELAI_ANTI_TAP) return;
        // Sur un texte qui s'écrit, le tap l'achève au lieu d'avancer : le
        // joueur pressé lit d'un coup, et personne ne saute une réplique pour
        // avoir voulu la lire plus vite.
        if (this.defile) {
          this.toutMontrer();
          ouvert = performance.now();
          return;
        }
        finir();
      };
      this.dialogue.addEventListener('pointerup', advance);
      this.terminerLigne = finir;
    });
  }

  // Pour le bouton « Passer » du tutoriel. Sans ça, la ligne interrompue garde
  // son écouteur et son compteur levé : `occupeLeJoueur` reste vrai pour
  // toujours et le décor cesse de répondre aux taps.
  //
  // N'interrompt pas un choix en cours — en inventer l'index ferait prendre au
  // récit une branche que personne n'a choisie. Un appelant qui peut couper
  // court ne doit donc pas laisser de choix ouvert au même moment.
  interrompre() {
    this.terminerLigne?.();
    this.hideDialogue();
  }

  // L'énigme est à z-index 4 et la boîte n'en a pas : un tutoriel, qui joue des
  // répliques par-dessus une énigme, se déroulerait invisible derrière elle.
  mettreDevant(devant: boolean) {
    this.dialogue.classList.toggle('dialogue--devant', devant);
  }

  // LA question que le décor doit poser avant de réagir à un tap. La poser en
  // plusieurs morceaux laissait forcément un chemin en oublier un : lire la
  // description d'un objet n'empêchait alors ni d'analyser un hotspot ni de
  // changer de scène, et la boîte partait avec la pièce qu'on quittait.
  get occupeLeJoueur() {
    return this.lignesEnCours > 0;
  }

  choose(options: string[]): Promise<number> {
    // Le délai anti-tap compte ici plus qu'ailleurs : un tap de trop arrive pile
    // quand les choix remplacent la réplique. Une ligne sautée se devine à la
    // suivante, un choix pris tout seul emmène le récit ailleurs.
    const debut = performance.now();
    return new Promise((resolve) => {
      this.dialogue.hidden = false;
      this.dialogueNext.hidden = true;
      this.dialogueChoices.innerHTML = '';
      // Le menu s'ouvre sur une réplique déjà payée d'un tap : ce qu'il en
      // reste à écrire s'écrirait sous les options, pendant qu'on les lit.
      this.toutMontrer();
      this.lignesEnCours++;
      const rendreLesTaps = this.surveillerAilleurs(() => debut);
      options.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent = typographier(label);
        btn.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          if (performance.now() - debut < DELAI_ANTI_TAP) return;
          rendreLesTaps();
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
    this.dialogue.classList.remove('dialogue--appel');
    // Le texte part avec le reste : un knot qui ouvre directement des choix
    // rouvrait la boîte sur la dernière ligne du dialogue précédent, attribuée à
    // personne puisque le locuteur, lui, était rendu.
    this.defiler('');
    this.showSpeaker(null);
  }

  // ---------- Le texte qui s'écrit ----------

  // Ce qui reste à écrire est déjà dans le DOM, seulement invisible : la boîte a
  // dès la première lettre la taille qu'elle aura à la fin. Écrit dans un seul
  // nœud qui grandit, le texte se recouperait à chaque mot et remonterait sous
  // le doigt, la boîte étant calée par le bas.
  private defiler(texte: string) {
    this.texteEnCours = texte;
    cancelAnimationFrame(this.imageDefilement);
    this.imageDefilement = 0;

    if (!texte || mouvementReduit()) {
      this.toutMontrer();
      return;
    }

    this.dialogueVu.textContent = '';
    this.dialogueReste.textContent = texte;
    this.dialogue.classList.add('dialogue--defile');

    // Le compte se refait sur l'horloge à chaque frame, et ne s'incrémente pas :
    // une frame sautée doit rattraper deux caractères, pas ralentir la réplique.
    const debut = performance.now();
    const frame = () => {
      const n = Math.floor(((performance.now() - debut) * CARACTERES_PAR_SECONDE) / 1000);
      if (n >= texte.length) {
        this.toutMontrer();
        return;
      }
      this.dialogueVu.textContent = texte.slice(0, n);
      this.dialogueReste.textContent = texte.slice(n);
      this.imageDefilement = requestAnimationFrame(frame);
    };
    this.imageDefilement = requestAnimationFrame(frame);
  }

  private get defile() {
    return this.imageDefilement !== 0;
  }

  private toutMontrer() {
    cancelAnimationFrame(this.imageDefilement);
    this.imageDefilement = 0;
    this.dialogueVu.textContent = this.texteEnCours;
    this.dialogueReste.textContent = '';
    this.dialogue.classList.remove('dialogue--defile');
  }

  // ---------- « C'est ici qu'il faut taper » ----------

  // Un tap qui tombe hors de la boîte pendant qu'elle attend : le joueur a bien
  // compris qu'il fallait taper, pas où. Rien ne peut lui répondre — le décor
  // est sourd tant qu'une réplique est en cours —, alors la boîte se signale.
  //
  // Seuls les taps du décor arrivent jusqu'ici : `uiRoot` arrête tout ce qui
  // naît dans l'interface (`main.ts`), inventaire et menu compris, qui eux ont
  // répondu au joueur.
  private surveillerAilleurs(ouvert: () => number): () => void {
    const ailleurs = (e: Event) => {
      if (this.dialogue.contains(e.target as Node)) return;
      // Le rebond du tap qui a ouvert la réplique tombe ici : c'est celui du
      // hotspot qui a lancé la conversation, il n'a rien manqué.
      if (performance.now() - ouvert() < DELAI_ANTI_TAP) return;
      this.attirerLAttention();
    };
    window.addEventListener('pointerup', ailleurs);
    return () => window.removeEventListener('pointerup', ailleurs);
  }

  private attirerLAttention() {
    // Retirée, style recalculé, remise : sans le recalcul entre les deux,
    // l'animation ne repart pas au tap suivant.
    this.dialogue.classList.remove('dialogue--appel');
    void this.dialogue.offsetWidth;
    this.dialogue.classList.add('dialogue--appel');
  }

  // Sans locuteur, la boîte repasse en narration : la différence entre
  // « quelqu'un parle » et « le jeu décrit » se voit avant d'être lue.
  private showSpeaker(qui: Personnage | null) {
    this.dialogue.classList.toggle('dialogue--narration', !qui);
    this.dialogueNom.hidden = !qui;
    this.dialogueNom.textContent = qui?.nom ?? '';
    this.dialogueNom.style.color = qui?.couleur ?? '';

    this.poserPortrait(qui);
  }

  // Une photo se pose tout de suite ; un modèle demande un rendu, donc un
  // aller-retour. D'où le jeton : deux répliques de locuteurs différents qui
  // s'enchaînent ne doivent pas voir la réponse de la première se poser sur la
  // seconde. Et la vignette reste cachée le temps du rendu plutôt que de garder
  // celle du locuteur précédent, qui serait un contresens.
  private poserPortrait(qui: Personnage | null) {
    const jeton = ++this.portraitDemande;

    if (qui?.portrait) {
      this.dialoguePortrait.hidden = false;
      // Ne pas réaffecter `src` à l'identique : le navigateur relancerait un
      // chargement et la vignette clignoterait à chaque ligne du personnage.
      if (!this.dialoguePortrait.src.endsWith(qui.portrait)) {
        this.dialoguePortrait.src = qui.portrait;
      }
      return;
    }

    this.dialoguePortrait.hidden = true;
    if (!qui?.modele) return;

    void urlApercuOrigami(qui.modele, { taille: TAILLE_PORTRAIT }).then(
      (url) => {
        if (jeton !== this.portraitDemande) return;
        this.dialoguePortrait.hidden = false;
        if (this.dialoguePortrait.src !== url) this.dialoguePortrait.src = url;
      },
      (err) => {
        // Le nom porte seul l'identité du locuteur : le dialogue reste jouable.
        console.error(`[personnage] portrait de "${qui.modele}" impossible`, err);
      },
    );
  }

  // Pendant qu'un objet traverse la scène, le décor ne répond plus aux taps et
  // l'inventaire non plus : la description d'un objet s'ouvrirait par-dessus ce
  // qu'il y avait justement à regarder. La classe éteint la colonne, le drapeau
  // ferme la porte — une case grisée qui répond quand même est pire que rien.
  //
  // Toujours relevé : `PointClickScene` le retire à la fin du trajet comme au
  // shutdown.
  suspendreLInventaire(suspendu: boolean) {
    this.inventaireSuspendu = suspendu;
    this.inventory.classList.toggle('inventory--suspendue', suspendu);
  }

  // ---------- Divers ----------

  // Une vignette de 42 px dit ce qu'on possède, pas ce que c'est : l'épaisseur,
  // le dos et les plis d'un origami ne survivent pas à une case d'inventaire.
  private async examiner(id: string) {
    const { description, modele } = objet(id);
    if (!description && !modele) return;

    if (modele) this.apercu?.montrer(modele);
    try {
      await this.say(description || nomDe(id));
    } finally {
      // Une description interrompue ne doit pas laisser le modèle tourner
      // indéfiniment par-dessus la scène.
      this.apercu?.cacher();
      this.hideDialogue();
    }
  }

  // Les objets ne se combinent ni ne se glissent nulle part : la case est un
  // rappel, pas une poignée. Elle porte une image parce qu'à la taille où
  // l'inventaire tient sur un téléphone, une colonne de texte se reconnaît mal.
  //
  // La colonne reste à l'écran même vide : quand elle s'effaçait, le premier
  // objet faisait apparaître le contenant et son contenu du même geste, et le
  // joueur n'apprenait jamais qu'il existait un endroit où les choses se rangent.
  private renderInventory(items: readonly string[]) {
    // Rendu par identifiant, jamais reconstruit : la colonne se redessine à
    // chaque changement d'état, drapeau compris. En repartant d'un `innerHTML`
    // vide, un vol en cours perdrait la case où il doit se poser et toutes les
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
      // Sans déranger les cases en train de partir : elles finissent leur
      // effacement là où elles sont.
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
    // Une case attendue par une annonce naît invisible, et c'est le vol qui la
    // découvre en s'y posant. Invisible et non absente : il faut pouvoir la
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

    // La vignette est un rendu 3D, elle arrive en différé : la case est
    // utilisable tout de suite, et son absence ne laisse pas d'icône cassée.
    void vignette(id).then((url) => {
      if (!url || !el.isConnected) return;
      image.src = url;
      image.hidden = false;
    });

    el.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      // Pas pendant une réplique : la boîte est prise, et le joueur retrouverait
      // cette description à la place de ce qu'il lisait.
      if (this.occupeLeJoueur || this.inventaireSuspendu) return;
      void this.examiner(id);
    });
    return el;
  }

  private retirerCase(el: HTMLElement) {
    el.classList.add('inventory__item--part');
    setTimeout(() => {
      el.remove();
      this.majEmplacementVide();
    }, DEPART_MS);
  }

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

  // Appelé par l'effet `# give:` et par lui seul, jamais depuis l'abonnement à
  // l'état : `gameState.give()` sert aussi à charger une sauvegarde et à sauter
  // à un point d'étape, où annoncer trois objets à la file n'a aucun sens.
  annoncerObtention(id: string) {
    this.aAnnoncer.add(id);
  }

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

  // Le vol, la case qui se pose, puis le bandeau : le mouvement dit où,
  // l'atterrissage dit maintenant, le texte dit quoi. Le nom en premier ferait
  // lire le bandeau au lieu de suivre le vol, et c'est le vol qui enseigne la
  // colonne.
  private async montrerObtention(id: string, el: HTMLElement) {
    try {
      const url = await vignette(id);
      if (url && !mouvementReduit()) await volVersLaCase(this.root, url, el);
    } catch (err) {
      // Montrer un objet ne doit jamais empêcher de l'avoir.
      console.error(`[objet] annonce de "${id}" impossible`, err);
    } finally {
      // Une case restée invisible serait un objet perdu.
      el.classList.remove('inventory__item--arrive');
    }

    el.classList.add('inventory__item--pose');
    el.addEventListener('animationend', () => el.classList.remove('inventory__item--pose'), {
      once: true,
    });
    this.montrerBandeau(annonceDe(id), el);
  }

  // Posé contre la case, et non au centre de l'écran : un bandeau centré
  // nommerait l'objet en laissant ignorer où il est parti.
  private montrerBandeau(texte: string, cible: HTMLElement) {
    this.obtenu.textContent = typographier(texte);
    placerBandeau(this.obtenu, this.root, cible);
    this.obtenu.classList.add('is-visible');
    clearTimeout(this.obtenuTimer);
    this.obtenuTimer = window.setTimeout(
      () => this.obtenu.classList.remove('is-visible'),
      BANDEAU_MS,
    );
  }
}
