// Le moteur des tutoriels d'énigme, qui joue les étapes écrites dans
// `tutoriels.ts`. Voir game-design/07-tutoriel-puzzle-crease-pattern.md.
//
// Un tutoriel est une couche posée sur l'énigme ouverte : elle en interdit tous
// les taps, écrit dans la boîte de dialogue habituelle, et pilote l'énigme par
// `ControlePuzzle`. La démonstration du pli est un vrai pliage, comme partout
// dans le projet — rien n'est dessiné pour ressembler.
//
// Trois pièges de superposition, à connaître avant de toucher au CSS :
//
// - l'énigme est à z-index 4 et la boîte de dialogue n'en a pas : sans
//   `mettreDevant()`, ce que le tutoriel raconte se joue derrière elle ;
// - `.tuto` n'est PAS positionné, exprès : positionné, il ferait contexte
//   d'empilement et ses enfants ne pourraient plus encadrer la boîte ;
// - le voile est transparent tant qu'on ne montre pas la feuille, mais présent
//   dès le début : c'est lui qui absorbe les taps destinés à l'énigme.

import type { Overlay } from '../../ui/overlay';
import { OrigamiLayer } from '../../origami/origami-layer';
import { papierTrace, type PapierTrace, type TracePli } from '../../origami/papier';
import { pliageDe } from '../../origami/vue';
import { personnage } from '../systems/personnages';
import { gameState } from '../systems/state';
import type { ControlePuzzle, CreasePuzzleDef, LanceurTutoriel } from './crease-puzzle';
import {
  TUTORIELS,
  type Effet,
  type EtapeEffet,
  type NomTutoriel,
  type Tutoriel,
} from './tutoriels';

// Par trait et non par feuille : la base de la bombe à eau en a quatre, et les
// dessiner tous dans le temps d'un seul les réduirait à un clignotement.
const TRACE_MS = 1100;

// Lent : c'est le sujet de la leçon.
const PLIAGE_MS = 4200;

// Long, volontairement : c'est le temps de quitter la boîte de dialogue des
// yeux, de trouver la flèche à l'autre bout de l'écran et de regarder ce qu'elle
// montre. Un clignotement bref ne se voit que si on regardait déjà.
const DESIGNATION_MS = 3000;

// Le silence qu'on laisse pour regarder ce qui vient d'arriver : sans lui,
// l'étape suivante démarre pendant que l'œil cherche encore ce qui a changé.
const UN_TEMPS_MS = 3000;

const ECART_FLECHE = 14;

// Calés sur les transitions CSS.
const FONDU_MS = 420;

// C'est le héros qui explique : personne d'autre n'est là pendant une énigme.
const HEROS = personnage('heros');

// Levé au moment où la question est posée, pas à la fin : le joueur qui passe le
// tutoriel n'a pas envie qu'on lui redemande à chaque ouverture.
const vu = (nom: NomTutoriel) => `tuto_${nom}_vu`;

// Les effets qui touchent à l'énigme au lieu de l'expliquer. Un tutoriel rejoué
// depuis une autre énigme les saute : poser une pièce là-bas offrirait un
// morceau de solution dans une énigme dont ce tutoriel ne parle pas.
const TOUCHE_A_LENIGME = new Set<Effet>(['poser-une-piece']);

// Une seule couche 3D pour toute la partie. Un contexte WebGL par lecture du
// tutoriel — la première version — les accumulait, et au-delà d'une quinzaine le
// navigateur tue le plus ancien, celui de Phaser. La toile sort et rentre du DOM
// à chaque tutoriel : déplacer un canvas ne touche pas à son contexte.
let toileDemo: HTMLCanvasElement | null = null;

// Mémorisée EN PROMESSE : en mémorisant l'objet, deux appels rapprochés passaient
// tous deux le test « pas encore créée » — `await create()` rend la main — et
// fabriquaient chacun leur contexte, dont l'un restait orphelin.
let coucheDemo_: Promise<OrigamiLayer> | null = null;

// Gardé le temps de le remplacer.
let papierDemo: PapierTrace | null = null;

async function coucheDemo() {
  if (!toileDemo || !coucheDemo_) {
    const canvas = document.createElement('canvas');
    canvas.className = 'tuto__feuille';
    // Un contexte perdu ne se répare pas. L'oubli est synchrone, au moment de la
    // perte, donc aucun appel ne peut attendre une couche morte. Rien à
    // `dispose()` : il n'y a plus de contexte à rendre.
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

// Une exception, parce que le tutoriel passe son temps à attendre et qu'un
// drapeau seul ne serait relu qu'à la fin de l'attente en cours. Et un drapeau
// EN PLUS (`Scene.abandonne`), parce qu'une exception ne rattrape pas ce qui a
// déjà démarré : une étape est appelée pour produire la promesse qu'on attend,
// donc ses effets de bord partent avant toute course.
class Passe extends Error {}

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

// `impose` est le tutoriel du lancement automatique ; `null`, le joueur a tapé
// « ? » et choisit lui-même.
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
    // Un abandon est une fin normale ; le reste ne doit jamais laisser le joueur
    // devant une énigme recouverte d'un voile qui ne s'en va plus.
    if (!(err instanceof Passe)) console.error('[tutoriel] interrompu', err);
  } finally {
    scene.demonter();
  }
}

// `null` si le joueur referme.
async function choisir(overlay: Overlay): Promise<NomTutoriel | null> {
  const noms = Object.keys(TUTORIELS) as NomTutoriel[];
  // Sans locuteur : c'est une question de l'interface, pas une réplique du
  // héros — qui, lui, parlera bien de sa voix ensuite.
  await overlay.say('Quel tutoriel revoir ?');
  const choix = await overlay.choose([...noms.map((n) => TUTORIELS[n].titre), 'Fermer']);
  overlay.hideDialogue();
  return noms[choix] ?? null;
}

// Faux si le joueur préfère passer.
async function proposer(overlay: Overlay, tuto: Tutoriel): Promise<boolean> {
  await overlay.say(tuto.invite, HEROS);
  const choix = await overlay.choose(['Lancer le tutoriel', 'Passer le tutoriel']);
  if (choix !== 0) overlay.hideDialogue();
  return choix === 0;
}

// `sonEnigme` : l'énigme ouverte est celle à qui ce tutoriel appartient.
//
// Une réplique qui suit un effet attend un tap avant de s'afficher : le joueur a
// tapé pour lancer ce qu'il vient de regarder, ce tap-là est dépensé. Sans
// l'attente, la ligne suivante prend sa place à la seconde où l'animation se
// termine — un tap, deux avancées.
async function jouer(scene: Scene, tuto: Tutoriel, sonEnigme: boolean) {
  // Un effet vient de se jouer : la prochaine réplique doit être demandée.
  let aRegarder = false;

  const dire = async (ligne: string) => {
    if (aRegarder) await scene.jusqua(scene.overlay.attendreUnTap());
    aRegarder = false;
    await scene.jusqua(scene.overlay.say(ligne, HEROS));
  };

  for (const etape of tuto.etapes) {
    if (scene.abandonne) throw new Passe();
    if (typeof etape === 'string') {
      await dire(etape);
      continue;
    }
    if (!sonEnigme && TOUCHE_A_LENIGME.has(etape.faire)) continue;

    // `false` = l'effet n'a rien eu à faire, et sa réplique de commentaire tombe
    // avec lui : « cette pièce semble bien placée » ne veut rien dire quand
    // aucune pièce n'a bougé.
    const fait = (await scene.jusqua(jouerEffet(scene, etape))) !== false;
    if (!fait) continue;

    // Deux effets qui s'enchaînent ne s'interrompent pas : la feuille qui arrive
    // et les plis qui s'y tracent sont un seul geste. C'est le passage à la
    // parole qui se demande.
    aRegarder = true;
    if (etape.puis) await dire(etape.puis);
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
  // Un SVGElement, pas un HTMLElement : `hidden` y est un attribut, pas une
  // propriété. `fleche.hidden = false` posait une propriété JavaScript sans rien
  // retirer du DOM, la règle `[hidden]` continuait de s'appliquer et la flèche
  // ne se montrait jamais. D'où `toggleAttribute`.
  fleche: SVGElement;
  passer: HTMLButtonElement;
  // La couche et sa toile appartiennent au module et survivent d'une lecture à
  // l'autre ; ce champ ne vit que le temps d'une feuille.
  feuille: {
    couche: OrigamiLayer;
    papier: PapierTrace;
    modele: string;
    traits: readonly TracePli[];
  } | null;
  // À relire AVANT de démarrer une étape : un effet est appelé pour produire la
  // promesse qu'on attend, donc ses effets de bord partent avant toute course.
  readonly abandonne: boolean;
  // Court une attente jusqu'à son terme, ou jusqu'au « Passer » du joueur.
  jusqua<T>(attente: Promise<T>): Promise<T>;
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

  // Une promesse qui ne se résout jamais et ne rejette qu'une fois : chaque
  // attente du tutoriel court contre elle.
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
      // DANS CET ORDRE : `interrompre()` résout la réplique en attente, donc
      // l'attente du tutoriel se termine normalement et la boucle enchaînerait
      // sur l'étape suivante alors qu'on vient de tout démonter. Renoncer
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

// Le transtypage est là parce que le compilateur ne rapproche pas `etape.faire`
// de la signature qu'il sert à indexer, alors que les deux sortent du même
// objet. La table, elle, est vérifiée à l'écriture.
function jouerEffet(scene: Scene, etape: EtapeEffet) {
  const effet = EFFETS[etape.faire] as (s: Scene, e: EtapeEffet) => Promise<void | false>;
  return effet(scene, etape);
}

type Declencheur<E extends Effet> = Extract<EtapeEffet, { faire: E }>;

// Un effet qui répond `false` annonce qu'il n'a rien fait, et sa réplique de
// commentaire (`puis`) est sautée avec lui.
const EFFETS: {
  [E in Effet]: (scene: Scene, etape: Declencheur<E>) => Promise<void | false>;
} = {
  // La pièce reste posée : montrer le geste puis défaire ce qu'on vient de faire
  // donnerait une leçon dont il ne resterait rien à l'écran.
  async 'poser-une-piece'(scene) {
    // Rien à démontrer sur un plateau déjà entamé, et ce n'est pas une erreur :
    // le tutoriel se rejoue à tout moment. Voir `pieceADemontrer`.
    const piece = scene.controle.pieceADemontrer();
    if (!piece) return false;

    // Au-dessus du tas d'abord : c'est pendant que la flèche la désigne qu'il
    // faut pouvoir la distinguer de ses voisines.
    scene.controle.mettreEnAvant(piece);
    designer(scene, piece);
    await scene.pause(DESIGNATION_MS);
    scene.fleche.toggleAttribute('hidden', true);
    await scene.jusqua(scene.controle.poserEnSolution(piece));
  },

  async 'montrer-feuille'(scene, { feuille }) {
    scene.voile.classList.add('is-sombre');

    // Sans que le voile s'éclaircisse ni que l'énigme revienne : on change de
    // papier au milieu d'une démonstration, on n'en sort pas.
    if (scene.feuille) {
      scene.feuille.couche.hide();
      scene.feuille = null;
      await scene.pause(FONDU_MS);
    }

    // Une démonstration qui ne charge pas ne doit pas emporter le tutoriel avec
    // elle : les répliques, elles, restent lisibles.
    try {
      const THREE = await scene.jusqua(import('three'));
      const { canvas, couche } = await scene.jusqua(coucheDemo());
      scene.el.appendChild(canvas);
      // La toile vient de rentrer dans le document : hors de lui elle se mesure
      // à zéro, et le rendu serait resté à la taille d'avant.
      couche.ajuster();

      const papier = papierTrace(THREE, feuille.modele, feuille.traits);
      // Posée : on va la regarder un moment avant de la plier, et une feuille
      // qui se balance en se présentant n'a l'air posée sur rien.
      await scene.jusqua(couche.load(feuille.modele, { textures: papier.textures, posee: true }));
      // Le papier précédent n'est lâché qu'ici : jusqu'à ce `load`, c'est encore
      // lui qui est monté sur le mesh.
      papierDemo?.dispose();
      papierDemo = papier;

      couche.setFold(0);
      couche.show();
      scene.feuille = { couche, papier, ...feuille };
    } catch (err) {
      toileDemo?.remove();
      if (err instanceof Passe) throw err;
      console.error(`[tutoriel] démonstration de "${feuille.modele}" indisponible`, err);
    }

    await scene.pause(FONDU_MS);
  },

  async 'tracer-pli'(scene) {
    if (!scene.feuille) return;
    const { papier, traits } = scene.feuille;
    await scene.jusqua(animer(TRACE_MS * traits.length, (t) => papier.tracer(t)));
  },

  async plier(scene) {
    if (!scene.feuille) return;
    const { couche, modele } = scene.feuille;
    await scene.jusqua(couche.playTo(pliageDe(modele), PLIAGE_MS));
  },

  async 'un-temps'(scene) {
    await scene.pause(UN_TEMPS_MS);
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

// Rien n'est détruit : la couche et son contexte WebGL resservent à la prochaine
// démonstration, et le papier reste monté sur le mesh jusqu'à son remplacement.
function rangerFeuille(scene: Scene) {
  if (!scene.feuille) return;
  scene.feuille.couche.hide();
  scene.feuille = null;
  toileDemo?.remove();
}

// À gauche de la cible plutôt qu'à droite : les deux choses qu'on désigne ici —
// une pièce du bac, le bouton « ? » — sont sur le bord droit du cadre, et la
// flèche y sortirait de l'écran.
function designer(scene: Scene, cible: HTMLElement) {
  const { fleche } = scene;
  fleche.toggleAttribute('hidden', false);

  // Calée par la DROITE et centrée par une transformation : ses dimensions
  // n'entrent pas dans le calcul, donc un rendu pas encore mesurable ne la pose
  // plus de travers.
  const repere = scene.el.parentElement!.getBoundingClientRect();
  const ou = cible.getBoundingClientRect();

  fleche.style.right = `${repere.right - ou.left + ECART_FLECHE}px`;
  fleche.style.top = `${ou.top - repere.top + ou.height / 2}px`;
}

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
