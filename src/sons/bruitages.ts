import { BRUITAGES, type Bruitage } from './catalogue';
import { aChaqueGeste, contexteAudio } from './contexte';
import { reglagesSons } from './reglages';
import { sonCoupe } from './son-coupe';

// Le cri d'un animal qu'on touche, le coup de hache : des sons courts, décodés
// une fois et rejoués sans attendre.

// L'extinction d'un cri raccourci par sa `duree`, en secondes.
const EXTINCTION_S = 0.15;

// La promesse et non le tampon : deux taps rapprochés ne décodent pas deux fois.
const tampons = new Map<Bruitage, Promise<AudioBuffer | null>>();
// Le cri en cours de chacun : retaper la grenouille la fait recommencer, pas
// coasser en double.
const enCours = new Map<Bruitage, AudioBufferSourceNode>();

// Décodés dès le premier geste, avant qu'on touche un animal.
let precharges = false;
aChaqueGeste((ctx) => {
  if (precharges) return;
  precharges = true;
  for (const nom of Object.keys(BRUITAGES) as Bruitage[]) void tampon(ctx, nom);
});

// `finit`, en secondes : le son est éteint à cet instant au plus tard. C'est ainsi
// que le froissement s'arrête avec le papier, le pliage passant sa propre durée.
export function jouerBruitage(nom: Bruitage, finit = Infinity) {
  const ctx = contexteAudio();
  // Sans contexte, aucun geste n'a encore eu lieu : rien ne pourrait jouer.
  if (!ctx || sonCoupe()) return;
  void tampon(ctx, nom).then((decode) => {
    if (!decode) return;
    const { volume, duree = Infinity } = reglagesSons().bruitages[nom];
    const coupe = Math.max(0, Math.min(duree, finit - EXTINCTION_S));
    enCours.get(nom)?.stop();

    const source = ctx.createBufferSource();
    source.buffer = decode;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);

    const debut = ctx.currentTime;
    source.start(debut);
    if (coupe < decode.duration) {
      gain.gain.setValueAtTime(volume, debut + coupe);
      gain.gain.linearRampToValueAtTime(0, debut + coupe + EXTINCTION_S);
      source.stop(debut + coupe + EXTINCTION_S);
    }

    enCours.set(nom, source);
    source.onended = () => {
      if (enCours.get(nom) === source) enCours.delete(nom);
    };
  });
}

// `null` quand le fichier manque ou ne se décode pas : le cri se tait, et la
// console le dit à `npm run qa`.
function tampon(ctx: AudioContext, nom: Bruitage): Promise<AudioBuffer | null> {
  let promesse = tampons.get(nom);
  if (!promesse) {
    promesse = fetch(BRUITAGES[nom])
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`${reponse.status}`);
        return reponse.arrayBuffer();
      })
      .then((octets) => ctx.decodeAudioData(octets))
      .catch((erreur) => {
        console.error(`[son] ${BRUITAGES[nom]} : ${String(erreur)}`);
        return null;
      });
    tampons.set(nom, promesse);
  }
  return promesse;
}
