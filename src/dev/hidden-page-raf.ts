/**
 * Fait tourner `requestAnimationFrame` quand la page est masquée.
 * **Développement uniquement** — jamais inclus dans le build de production.
 *
 * Un volet de preview intégré à l'éditeur rapporte `document.hidden`. Le
 * navigateur coupe alors *complètement* rAF : mesuré à 0 frame en 400 ms. Tout
 * ce qui en dépend s'arrête net — la boucle de Phaser (donc les tweens et les
 * `time.delayedCall`) et l'interpolation de la couche origami, dont la promesse
 * ne se résout jamais et bloque le dialogue en cours.
 *
 * On corrige à la racine plutôt que par scène : rAF est remplacé par une file
 * que l'on vide au rythme d'un Worker. Un Worker, et pas un `setInterval` de
 * page, parce que le navigateur bride aussi les timers d'un document masqué —
 * mesuré ici, sur une seconde : 1 tick pour la page, 48 pour le worker.
 *
 * Quand la page est visible, rien ne change : les appels repartent directement
 * vers le rAF natif. Et en production, une page masquée DOIT geler — c'est ce
 * qui évite de vider la batterie d'un téléphone resté en poche.
 */

const BEAT_MS = 33;

export function installHiddenPageRaf(): void {
  const nativeRequest = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);

  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    if (!document.hidden) return nativeRequest(callback);
    // Les identifiants négatifs ne peuvent pas entrer en collision avec ceux du
    // navigateur, qui sont positifs : `cancelAnimationFrame` sait ainsi à qui
    // s'adresser, même si la page redevient visible entre-temps.
    const id = -nextId++;
    pending.set(id, callback);
    return id;
  };

  window.cancelAnimationFrame = (id: number): void => {
    if (id < 0) pending.delete(id);
    else nativeCancel(id);
  };

  const source = `setInterval(() => postMessage(0), ${BEAT_MS});`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const beat = new Worker(url);
  URL.revokeObjectURL(url);

  beat.onmessage = () => {
    if (!document.hidden || pending.size === 0) return;
    // On vide la file avant d'appeler : les callbacks se réinscrivent presque
    // toujours, et on tournerait sinon en boucle dans la même frame.
    const due = [...pending.values()];
    pending.clear();
    const now = performance.now();
    for (const callback of due) callback(now);
  };
}
