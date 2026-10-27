// Un seul AudioContext pour tout le jeu, né au premier geste du joueur — ou au
// chargement, quand la page a hérité d'un geste (plus bas).
//
// Pas plus tôt : créé sans geste, il naît suspendu et Chromium le signale en
// console — ce que `npm run qa` compte comme une faute. Et au geste lui-même,
// parce que Safari ne laisse démarrer le son que pendant qu'on le traite :
// c'est là que l'ambiance débloque ses lecteurs (`ambiance.ts`).
//
// Écoutés à la capture sur `window` : l'interface arrête la propagation des
// pointeurs (`src/ui/isolation.ts`), et le premier tap est souvent un bouton de
// l'écran d'accueil. Ce sont les événements qui valent geste pour le navigateur
// — `pointerdown` n'en est pas un au doigt, `pointerup` et `touchend` si.
const GESTES = ['pointerup', 'touchend', 'mousedown', 'keydown'] as const;

let contexte: AudioContext | null = null;
const auxGestes: ((ctx: AudioContext) => void)[] = [];

export function contexteAudio(): AudioContext | null {
  return contexte;
}

// Rappelé pendant chaque geste, le premier compris : ce qu'un refus a laissé
// muet y repart. Pas d'écouteur à usage unique — un appel téléphonique laisse
// le contexte « interrupted » sur iOS, et c'est au geste suivant qu'il reprend.
export function aChaqueGeste(faire: (ctx: AudioContext) => void) {
  auxGestes.push(faire);
}

export function demarrerLeSonAuPremierGeste() {
  // Sur iPhone : se mêler à la musique du joueur au lieu de la couper, et se
  // taire avec l'interrupteur de silence, comme un jeu. Sans ça, l'ambiance —
  // un élément <audio> — passe pour un lecteur de musique. Safari 16.4 et plus.
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'ambient';

  const reveiller = () => {
    if (!contexte) contexte = new AudioContext();
    if (contexte.state !== 'running' && !document.hidden) reprendre(contexte);
    for (const faire of auxGestes) faire(contexte);
  };
  for (const type of GESTES) window.addEventListener(type, reveiller, true);

  // Un point d'étape, une langue, « Recommencer » : le jeu se recharge dans un
  // tap, et Chrome en garde le geste pour la page suivante. Le son y reprend donc
  // sans attendre qu'on touche l'écran. Safari, lui, en exige un nouveau.
  if (navigator.userActivation?.hasBeenActive) reveiller();

  // Un téléphone rangé ne joue plus rien.
  document.addEventListener('visibilitychange', () => {
    if (!contexte) return;
    if (document.hidden) contexte.suspend().catch(() => {});
    else reprendre(contexte);
  });
}

// Un refus n'a rien à dire au joueur : le geste suivant réessaiera.
function reprendre(ctx: AudioContext) {
  ctx.resume().catch(() => {});
}
