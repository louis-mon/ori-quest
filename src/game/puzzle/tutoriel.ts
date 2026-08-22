/**
 * Le moteur des tutoriels d'énigme — ce qui joue les étapes écrites dans
 * `tutoriels.ts`. Voir game-design/07-tutoriel-puzzle-crease-pattern.md.
 *
 * Un tutoriel est une **couche posée sur l'énigme ouverte** : elle en interdit
 * tous les taps, écrit dans la boîte de dialogue habituelle, et pilote l'énigme
 * par la poignée que celle-ci lui tend (`ControlePuzzle`). Le joueur ne quitte
 * jamais l'énigme pour aller lire une aide ailleurs — c'est tout l'intérêt :
 * ce qu'on lui montre, il l'a sous les yeux.
 *
 * **La démonstration du pli est un vrai pliage.** Une feuille `.origami` bakée
 * depuis un crease pattern d'un seul trait, sur laquelle le trait de pli est
 * **peint dans la texture du papier** — il se plie donc avec elle. Le projet
 * s'interdit de dessiner ce qui se plie (CLAUDE.md) et un tutoriel du pliage
 * était le dernier endroit où on aurait pu être tenté de faire l'exception.
 *
 * **Trois pièges de superposition** valent d'être connus avant de toucher au
 * CSS de cette couche :
 *
 * - l'énigme est à `z-index: 4` et la boîte de dialogue n'en a pas : sans
 *   `mettreDevant()`, tout ce que le tutoriel raconte se joue *derrière*
 *   l'énigme, invisible ;
 * - `.tuto` n'est **pas** positionné, exprès. Positionné, il ferait contexte
 *   d'empilement et ses enfants ne pourraient plus encadrer la boîte de
 *   dialogue — le voile dessous, la fenêtre de confirmation dessus ;
 * - le voile est transparent tant qu'on ne montre pas la feuille, mais il est
 *   là dès le début : c'est **lui** qui absorbe les taps destinés à l'énigme.
 */

import type { Overlay } from '../../ui/overlay';
import { OrigamiLayer } from '../../origami/origami-layer';
import { papierTrace, type PapierTrace } from '../../origami/papier';
import { pliageDe } from '../../origami/vue';
import { personnage } from '../systems/personnages';
import { gameState } from '../systems/state';
import type { ControlePuzzle, CreasePuzzleDef, LanceurTutoriel } from './crease-puzzle';
import { TUTORIELS, type Effet, type NomTutoriel, type Tutoriel } from './tutoriels';

/** Durée du tracé du pli sur la feuille. */
const TRACE_MS = 1100;

/** Durée du pliage de démonstration. Lent : c'est le sujet de la leçon. */
const PLIAGE_MS = 4200;

/**
 * Temps où la flèche désigne une pièce avant qu'elle ne bouge.
 *
 * Long, et volontairement : c'est le temps qu'il faut pour quitter la boîte de
 * dialogue des yeux, trouver la flèche à l'autre bout de l'écran, et regarder ce
 * qu'elle montre. Un clignotement bref ne se voit que si on regardait déjà.
 */
const DESIGNATION_MS = 3000;

/** Espace entre la pointe de la flèche et ce qu'elle désigne, en pixels. */
const ECART_FLECHE = 14;

/** Fondus du voile et de la feuille, calés sur les transitions CSS. */
const FONDU_MS = 420;

/** C'est le héros qui explique : personne d'autre n'est là pendant une énigme. */
const HEROS = personnage('heros');

/**
 * Un tutoriel déjà proposé ne se repropose pas. Le drapeau est levé **au moment
 * où la question est posée**, pas à la fin : le joueur qui passe le tutoriel
 * n'a pas envie qu'on lui redemande à chaque fois qu'il rouvre l'énigme.
 */
const vu = (nom: NomTutoriel) => `tuto_${nom}_vu`;

/**
 * Les effets qui **touchent à l'énigme** au lieu de l'expliquer.
 *
 * Un tutoriel rejoué depuis une autre énigme que la sienne les saute : poser une
 * pièce ailleurs, ce serait offrir un morceau de solution dans une énigme dont
 * ce tutoriel ne parle même pas.
 */
const TOUCHE_A_LENIGME = new Set<Effet>(['poser-une-piece']);

/**
 * La couche 3D de la démonstration, créée **une fois pour toute la partie**.
 *
 * Un contexte WebGL par lecture du tutoriel, c'était la première version, et
 * elle finissait par casser le jeu : `renderer.dispose()` ne rend pas le
 * contexte tout de suite, ils s'accumulent, et au-delà d'une quinzaine le
 * navigateur tue le **plus ancien** — celui de Phaser. L'écran clignotait, et
 * la feuille ne s'affichait plus. Un seul contexte, gardé et redonné à chaque
 * démonstration, supprime le problème à la racine ; c'est aussi ce que fait
 * `main.ts` avec la couche du récit.
 *
 * La toile sort et rentre du DOM avec chaque tutoriel — déplacer un canvas ne
 * touche pas à son contexte.
 */
let toileDemo: HTMLCanvasElement | null = null;

/**
 * La couche de la toile ci-dessus, mémorisée **en promesse**.
 *
 * En mémorisant l'objet plutôt que la promesse, deux appels rapprochés
 * passaient tous deux le test « pas encore créée » — `await create()` rend la
 * main — et fabriquaient chacun un contexte WebGL, dont l'un restait orphelin
 * pour toujours. C'est la fuite qui finit par faire tuer le contexte de Phaser.
 * La promesse, elle, est posée avant le premier `await` : le second appel
 * attend la même.
 */
let coucheDemo_: Promise<OrigamiLayer> | null = null;

/** Le papier de la dernière démonstration, gardé le temps de le remplacer. */
let papierDemo: PapierTrace | null = null;

async function coucheDemo() {
  if (!toileDemo || !coucheDemo_) {
    const canvas = document.createElement('canvas');
    canvas.className = 'tuto__feuille';
    // Un contexte perdu ne se répare pas : on oublie la couche ici même, et la
    // démonstration suivante en refabriquera une. L'oubli est **synchrone**,
    // au moment de la perte, donc aucun appel ne peut attendre une couche
    // morte. Rien à `dispose()` — il n'y a plus de contexte à rendre.
    canvas.addEventListener('webglcontextlost', () => {
      console.warn('[tutoriel] contexte WebGL perdu, la feuille sera refaite');
      toileDemo = null;
      coucheDemo_ = null;
    });
    toileDemo = canvas;
    coucheDemo_ = OrigamiLayer.create(canvas);
  }
  return { canvas: toileDemo, couche: await coucheDemo_ };
}

/**
 * Abandon volontaire du tutoriel — le bouton « Passer ».
 *
 * Une **exception**, parce que le tutoriel passe son temps à attendre — un tap,
 * un fondu, un pliage de quatre secondes — et qu'un drapeau seul ne serait relu
 * qu'à la fin de l'attente en cours ; le joueur qui passe veut que ça s'arrête
 * maintenant. Et un **drapeau en plus** (`Scene.abandonne`), parce qu'une
 * exception ne rattrape pas ce qui a déjà démarré : une étape est *appelée* pour
 * produire la promesse qu'on attend, donc ses effets de bord partent avant toute
 * course. Les deux, donc : l'un coupe l'attente, l'autre empêche la suivante de
 * commencer.
 */
class Passe extends Error {}

/**
 * Fabrique le lanceur que l'énigme appellera — à son ouverture, et à chaque tap
 * sur « ? ».
 */
export function lanceurTutoriel(
  root: HTMLElement,
  overlay: Overlay,
  def: CreasePuzzleDef,
): LanceurTutoriel {
  return async (controle, auto) => {
    let impose: NomTutoriel | null = null;
    if (auto) {
      const nom = def.tutoriel;
      if (!nom || gameState.flag(vu(nom))) return;
      gameState.setFlag(vu(nom));
      impose = nom;
    }
    await ouvrir(root, overlay, controle, def, impose);
  };
}

/**
 * Monte la couche, choisit le tutoriel, le joue, puis nettoie — quoi qu'il
 * arrive.
 *
 * `impose` est le tutoriel du lancement automatique. `null` = le joueur a tapé
 * « ? » et choisit lui-même dans la liste.
 */
async function ouvrir(
  root: HTMLElement,
  overlay: Overlay,
  controle: ControlePuzzle,
  def: CreasePuzzleDef,
  impose: NomTutoriel | null,
) {
  const scene = monter(root, overlay, controle);
  try {
    const nom = impose ?? (await choisir(overlay));
    if (!nom) return;

    const tuto = TUTORIELS[nom];
    if (impose && !(await proposer(overlay, tuto))) return;

    scene.passer.hidden = false;
    await jouer(scene, tuto, def.tutoriel === nom);
  } catch (err) {
    // Un abandon est une fin normale ; le reste ne doit jamais laisser le
    // joueur devant une énigme recouverte d'un voile qui ne s'en va plus.
    if (!(err instanceof Passe)) console.error('[tutoriel] interrompu', err);
  } finally {
    scene.demonter();
  }
}

/** La liste du bouton « ? ». Résout `null` si le joueur referme. */
async function choisir(overlay: Overlay): Promise<NomTutoriel | null> {
  const noms = Object.keys(TUTORIELS) as NomTutoriel[];
  // En narration, sans locuteur : c'est une question de l'interface, pas une
  // réplique du héros. La différence se voit avant d'être lue (voir
  // `showSpeaker`), et le tutoriel, lui, parlera bien de sa voix.
  await overlay.say('Quel tutoriel revoir ?');
  const choix = await overlay.choose([...noms.map((n) => TUTORIELS[n].titre), 'Fermer']);
  overlay.hideDialogue();
  return noms[choix] ?? null;
}

/** L'invite du lancement automatique. Faux si le joueur préfère passer. */
async function proposer(overlay: Overlay, tuto: Tutoriel): Promise<boolean> {
  await overlay.say(tuto.invite, HEROS);
  const choix = await overlay.choose(['Lancer le tutoriel', 'Passer le tutoriel']);
  if (choix !== 0) overlay.hideDialogue();
  return choix === 0;
}

/** `sonEnigme` : l'énigme ouverte est bien celle à qui ce tutoriel appartient. */
async function jouer(scene: Scene, tuto: Tutoriel, sonEnigme: boolean) {
  for (const etape of tuto.etapes) {
    if (scene.abandonne) throw new Passe();
    if (typeof etape === 'string') {
      await scene.jusqua(scene.overlay.say(etape, HEROS));
    } else if (sonEnigme || !TOUCHE_A_LENIGME.has(etape.faire)) {
      await scene.jusqua(EFFETS[etape.faire](scene, tuto));
    }
  }
}

// ------------------------------------------------------------------
// La couche
// ------------------------------------------------------------------

interface Scene {
  overlay: Overlay;
  controle: ControlePuzzle;
  el: HTMLElement;
  voile: HTMLElement;
  /**
   * Un `SVGElement`, pas un `HTMLElement` : `hidden` y est un **attribut**, pas
   * une propriété. `fleche.hidden = false` posait bien une propriété JavaScript
   * sur l'objet, sans rien retirer du DOM — la règle `[hidden]` continuait de
   * s'appliquer et la flèche ne se montrait jamais. D'où `toggleAttribute`.
   */
  fleche: SVGElement;
  passer: HTMLButtonElement;
  /**
   * La démonstration en cours. La couche et sa toile appartiennent au module,
   * pas au tutoriel : elles survivent d'une lecture à l'autre (voir
   * `demonstration`). Ce champ ne dit que « il y a une feuille à l'écran ».
   */
  feuille: { couche: OrigamiLayer; papier: PapierTrace } | null;
  /**
   * Le joueur a-t-il renoncé ? À relire **avant de démarrer une étape** : un
   * effet est appelé pour produire la promesse qu'on attend, donc ses effets de
   * bord partent avant toute course. Rien ne doit plus démarrer une fois la
   * couche démontée.
   */
  readonly abandonne: boolean;
  /** Court une attente jusqu'à son terme, ou jusqu'au « Passer » du joueur. */
  jusqua<T>(attente: Promise<T>): Promise<T>;
  /** Attend `ms`, interruptible. */
  pause(ms: number): Promise<void>;
  demonter(): void;
}

function monter(root: HTMLElement, overlay: Overlay, controle: ControlePuzzle): Scene {
  const el = document.createElement('div');
  el.className = 'tuto';
  el.innerHTML = `
    <div class="tuto__voile"></div>
    <svg class="tuto__fleche" viewBox="0 0 48 32" aria-hidden="true" hidden>
      <path d="M1 11 h25 V2 l20 14 -20 14 V21 H1 Z" />
    </svg>
    <button class="tuto__passer" type="button" hidden>Passer</button>
    <div class="tuto__confirm" hidden role="alertdialog" aria-modal="true">
      <div class="menu__confirm-box">
        <p class="menu__confirm-text">Passer le tutoriel ?</p>
        <div class="menu__confirm-actions">
          <button class="menu__item" data-action="continuer">Continuer</button>
          <button class="menu__item menu__item--danger" data-action="passer">Passer</button>
        </div>
      </div>
    </div>
  `;
  root.appendChild(el);
  overlay.mettreDevant(true);

  const passer = el.querySelector<HTMLButtonElement>('.tuto__passer')!;
  const confirm = el.querySelector<HTMLElement>('.tuto__confirm')!;

  // L'abandon est une promesse qui ne se résout jamais et ne rejette qu'une
  // fois : chaque attente du tutoriel court contre elle.
  let abandonne = false;
  let abandonner = () => {};
  const abandon = new Promise<never>((_, rejeter) => {
    abandonner = () => {
      abandonne = true;
      rejeter(new Passe());
    };
  });
  // Sans ce `catch`, un tutoriel qui va jusqu'au bout laisse une promesse
  // rejetée sans preneur au démontage, et la console crie au bug.
  abandon.catch(() => {});

  passer.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    confirm.hidden = false;
  });
  confirm.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    const action = (e.target as HTMLElement).closest('[data-action]')?.getAttribute('data-action');
    if (!action) return;
    confirm.hidden = true;
    if (action === 'passer') {
      // **Dans cet ordre.** `interrompre()` résout la réplique en attente, donc
      // l'attente du tutoriel se termine *normalement* et la boucle enchaîne sur
      // l'étape suivante — qui démarrerait alors qu'on vient de tout démonter,
      // une démonstration orpheline en travers de la lecture d'après. Renoncer
      // d'abord fait que la course est déjà perdue quand la réplique se résout.
      abandonner();
      // La réplique en cours attend un tap qui ne viendra plus : sans ça son
      // compteur reste levé et le décor cesse de répondre aux taps.
      overlay.interrompre();
    }
  });

  const scene: Scene = {
    overlay,
    controle,
    el,
    voile: el.querySelector<HTMLElement>('.tuto__voile')!,
    fleche: el.querySelector<SVGElement>('.tuto__fleche')!,
    passer,
    feuille: null,
    get abandonne() {
      return abandonne;
    },
    jusqua: (attente) => Promise.race([attente, abandon]),
    pause: (ms) =>
      Promise.race([new Promise<void>((fini) => window.setTimeout(fini, ms)), abandon]),
    demonter() {
      rangerFeuille(scene);
      overlay.mettreDevant(false);
      overlay.hideDialogue();
      el.remove();
    },
  };
  return scene;
}

// ------------------------------------------------------------------
// Les effets
// ------------------------------------------------------------------

const EFFETS: Record<Effet, (scene: Scene, tuto: Tutoriel) => Promise<void>> = {
  /**
   * La démonstration du geste : on désigne une pièce, puis on la pose.
   *
   * Elle **reste posée** — le joueur reprend l'énigme avec une pièce de moins à
   * placer. C'est voulu : montrer le geste puis défaire ce qu'on vient de faire
   * donnerait une leçon dont il ne resterait rien à l'écran.
   */
  async 'poser-une-piece'(scene) {
    // Rien à démontrer sur un plateau déjà entamé — l'énigme n'attend pas qu'on
    // lui explique un geste que le joueur est en train de faire. Ce n'est pas
    // une erreur : le tutoriel se rejoue à tout moment. Voir `pieceADemontrer`.
    const piece = scene.controle.pieceADemontrer();
    if (!piece) return;

    // Au-dessus du tas d'abord : c'est pendant les trois secondes où la flèche
    // la désigne qu'il faut pouvoir la distinguer de ses voisines.
    scene.controle.mettreEnAvant(piece);
    designer(scene, piece);
    await scene.pause(DESIGNATION_MS);
    scene.fleche.toggleAttribute('hidden', true);
    await scene.jusqua(scene.controle.poserEnSolution(piece));
  },

  async 'montrer-feuille'(scene, tuto) {
    scene.voile.classList.add('is-sombre');

    // three.js arrive à la demande, comme partout ailleurs dans le jeu — seul
    // lui mérite son propre chunk, le reste est déjà dans celui de
    // l'application. Une démonstration qui ne charge pas ne doit pas emporter le
    // tutoriel avec elle : les répliques, elles, restent lisibles.
    try {
      const THREE = await scene.jusqua(import('three'));
      const { canvas, couche } = await scene.jusqua(coucheDemo());
      scene.el.appendChild(canvas);
      // La toile vient de rentrer dans le document : hors de lui elle se mesure
      // à zéro, et le rendu serait resté à la taille d'avant.
      couche.ajuster();

      const papier = papierTrace(THREE, tuto.modele, tuto.pli, tuto.trace.de, tuto.trace.a);
      // Posée : on va la regarder un moment avant de la plier, et une feuille
      // qui se présente face à la caméra en se balançant n'a l'air posée sur
      // rien.
      await scene.jusqua(
        couche.load(tuto.modele, { textures: papier.textures, posee: true }),
      );
      // Le papier précédent n'est lâché qu'ici : jusqu'à ce `load`, c'est encore
      // lui qui est monté sur le mesh.
      papierDemo?.dispose();
      papierDemo = papier;

      couche.setFold(0);
      couche.show();
      scene.feuille = { couche, papier };
    } catch (err) {
      toileDemo?.remove();
      if (err instanceof Passe) throw err;
      console.error(`[tutoriel] démonstration de "${tuto.modele}" indisponible`, err);
    }

    await scene.pause(FONDU_MS);
  },

  async 'tracer-pli'(scene) {
    const papier = scene.feuille?.papier;
    if (!papier) return;
    await scene.jusqua(
      animer(TRACE_MS, (t) => papier.tracer(t)),
    );
  },

  async plier(scene, tuto) {
    const couche = scene.feuille?.couche;
    if (!couche) return;
    await scene.jusqua(couche.playTo(pliageDe(tuto.modele), PLIAGE_MS));
  },

  async 'cacher-feuille'(scene) {
    rangerFeuille(scene);
    scene.voile.classList.remove('is-sombre');
    await scene.pause(FONDU_MS);
  },

  async 'designer-aide'(scene) {
    designer(scene, scene.controle.boutonAide);
  },
};

/**
 * Range la feuille : elle s'arrête et sort de l'écran, mais **rien n'est
 * détruit**. La couche et son contexte WebGL resservent à la prochaine
 * démonstration (voir `demonstration`), et son papier reste monté sur le mesh
 * jusqu'à ce qu'un autre le remplace.
 */
function rangerFeuille(scene: Scene) {
  if (!scene.feuille) return;
  scene.feuille.couche.hide();
  scene.feuille = null;
  toileDemo?.remove();
}

/**
 * Pose la flèche à gauche de ce qu'elle désigne, pointe vers la droite.
 *
 * C'est le pliage de l'artiste, celui des sorties de scène — photographié
 * pointant vers la gauche, d'où le miroir (voir `exit-marker.ts`). À gauche de
 * la cible plutôt qu'à droite : les deux choses qu'on désigne ici — une pièce
 * du bac, le bouton « ? » — sont sur le bord droit du cadre, et la flèche y
 * sortirait de l'écran.
 */
function designer(scene: Scene, cible: HTMLElement) {
  const { fleche } = scene;
  fleche.toggleAttribute('hidden', false);

  // Calée par la DROITE et centrée par une transformation : la largeur et la
  // hauteur de la flèche n'entrent donc pas dans le calcul, et un PNG pas encore
  // chargé — donc mesuré à zéro — ne la pose plus de travers.
  const repere = scene.el.parentElement!.getBoundingClientRect();
  const ou = cible.getBoundingClientRect();

  fleche.style.right = `${repere.right - ou.left + ECART_FLECHE}px`;
  fleche.style.top = `${ou.top - repere.top + ou.height / 2}px`;
}

/** Joue `ms` millisecondes d'animation, en passant l'avancement à `pas`. */
function animer(ms: number, pas: (t: number) => void): Promise<void> {
  return new Promise((fini) => {
    const debut = performance.now();
    const image = (maintenant: number) => {
      const t = Math.min((maintenant - debut) / ms, 1);
      pas(t);
      if (t < 1) requestAnimationFrame(image);
      else fini();
    };
    requestAnimationFrame(image);
  });
}
