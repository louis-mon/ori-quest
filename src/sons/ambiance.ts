import { AMBIANCES, type Ambiance } from './catalogue';
import { aChaqueGeste } from './contexte';
import { reglagesSons } from './reglages';

// L'ambiance de la pièce à l'écran, en boucle, enchaînée en fondu d'une pièce à
// l'autre. Plusieurs peuvent se superposer : au ravin, la rivière coule sur
// l'ambiance du chapitre, et passer à la porte n'éteint qu'elle.
//
// Lue en flux par un élément <audio>, jamais décodée comme un bruitage : une
// ambiance dure plusieurs minutes, et dix minutes de stéréo décodée pèsent plus
// de 200 Mo. L'élément passe quand même par le contexte, pour son
// volume : Safari sur iPhone ignore `volume`, et un fondu n'y existe qu'en
// GainNode.
//
// Un lecteur par ambiance, qui garde sa position : revenir au ravin reprend la
// rivière où on l'avait laissée. Deux pièces de même ambiance — salle du trône
// et cuisine — ne la coupent donc pas en passant de l'une à l'autre.

// Le fondu enchaîné d'une pièce à l'autre, en secondes : quatre constantes de
// temps, à 2 % près.
const FONDU_S = 1.2;

// Le raccord d'un tour au suivant, en secondes. Pas de `loop` : le tour suivant
// part avant la fin du précédent, sur un second élément, et les deux se
// croisent. Bouclé tel quel, le château s'éteignait trois secondes à chaque
// tour — ses bords sont des fondus — et Chromium marquait un blanc, le temps de
// relire le début du fichier.
const RACCORD_S = 3;

// Un tour de l'ambiance, et le gain qui le fait entrer ou sortir au raccord.
interface Passe {
  element: HTMLAudioElement;
  gain: GainNode;
}

interface Lecteur {
  // Les deux passes se relaient d'un tour à l'autre.
  passes: [Passe, Passe];
  courante: 0 | 1;
  // Le volume de l'ambiance, et ses fondus d'une pièce à l'autre.
  gain: GainNode;
  // La pause qui suit un fondu sortant, annulée si l'ambiance revient avant.
  arret?: number;
}

let voulues: readonly Ambiance[] = [];
let lecteurs: Map<Ambiance, Lecteur> | null = null;

// `[]` : le silence.
export function jouerLAmbiance(ambiance: Ambiance | readonly Ambiance[]) {
  const noms = typeof ambiance === 'string' ? [ambiance] : ambiance;
  if (noms.length === voulues.length && noms.every((nom) => voulues.includes(nom))) return;
  voulues = noms;
  ajusterLAmbiance();
}

// À rappeler quand le volume a changé (sons.html).
export function ajusterLAmbiance() {
  if (!lecteurs) return;
  for (const [nom, lecteur] of lecteurs) {
    fondre(nom, lecteur, voulues.includes(nom) ? reglagesSons().ambiances[nom] : 0);
  }
}

// Avant le premier geste, rien ne peut jouer : la pièce a seulement dit ce
// qu'elle voulait, et c'est ce geste qui le lance.
aChaqueGeste((ctx) => {
  if (!lecteurs) lecteurs = monter(ctx);
  ajusterLAmbiance();
});

function monter(ctx: AudioContext): Map<Ambiance, Lecteur> {
  const montes = new Map<Ambiance, Lecteur>();
  for (const nom of Object.keys(AMBIANCES) as Ambiance[]) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const passe = (volume: number): Passe => {
      const element = new Audio();
      element.preload = 'none';
      // Ici, pendant le geste, et sans source : Safari ne laisse un élément
      // démarrer de lui-même plus tard qu'une fois touché pendant un geste, et
      // une source posée maintenant ferait télécharger toutes les ambiances.
      element.load();
      const entree = ctx.createGain();
      entree.gain.value = volume;
      ctx.createMediaElementSource(element).connect(entree).connect(gain);
      return { element, gain: entree };
    };
    const lecteur: Lecteur = { passes: [passe(1), passe(0)], courante: 0, gain };

    for (const [index, { element }] of lecteur.passes.entries()) {
      const finit = () => {
        if (index !== lecteur.courante || !voulues.includes(nom)) return;
        const reste = element.duration - element.currentTime;
        if (element.ended || reste <= RACCORD_S) relayer(nom, lecteur);
      };
      // `timeupdate` passe quelques fois par seconde : assez pour un raccord de
      // trois. `ended` ne sert que si la page, ralentie, l'a manqué.
      element.addEventListener('timeupdate', finit);
      element.addEventListener('ended', finit);
    }
    montes.set(nom, lecteur);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      ajusterLAmbiance();
      return;
    }
    for (const { passes } of montes.values()) {
      for (const { element } of passes) element.pause();
    }
  });
  return montes;
}

function fondre(nom: Ambiance, lecteur: Lecteur, volume: number) {
  const { gain } = lecteur;
  gain.gain.setTargetAtTime(volume, gain.context.currentTime, FONDU_S / 4);

  if (volume > 0) {
    window.clearTimeout(lecteur.arret);
    lecteur.arret = undefined;
    lancer(nom, lecteur.passes[lecteur.courante].element);
  } else if (lecteur.passes.some(({ element }) => !element.paused) && lecteur.arret === undefined) {
    // Une seule fois : chaque geste repasse ici, et repousserait la pause.
    lecteur.arret = window.setTimeout(() => {
      for (const { element } of lecteur.passes) element.pause();
      lecteur.arret = undefined;
    }, FONDU_S * 1000);
  }
}

// Le tour suivant entre pendant que le précédent finit.
function relayer(nom: Ambiance, lecteur: Lecteur) {
  const sortante = lecteur.passes[lecteur.courante];
  lecteur.courante = lecteur.courante === 0 ? 1 : 0;
  const entrante = lecteur.passes[lecteur.courante];

  const maintenant = entrante.gain.context.currentTime;
  croiser(entrante.gain, 0, 1, maintenant);
  croiser(sortante.gain, 1, 0, maintenant);
  if (entrante.element.getAttribute('src')) entrante.element.currentTime = 0;
  lancer(nom, entrante.element);
}

function croiser(gain: GainNode, de: number, vers: number, depuis: number) {
  gain.gain.cancelScheduledValues(depuis);
  gain.gain.setValueAtTime(de, depuis);
  gain.gain.linearRampToValueAtTime(vers, depuis + RACCORD_S);
}

function lancer(nom: Ambiance, element: HTMLAudioElement) {
  if (!element.getAttribute('src')) element.src = AMBIANCES[nom];
  // Refusé — hors geste, page masquée —, il repartira au geste suivant.
  if (element.paused && !document.hidden) element.play().catch(() => {});
}
