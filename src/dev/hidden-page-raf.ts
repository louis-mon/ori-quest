// DÉVELOPPEMENT UNIQUEMENT : en production, une page masquée DOIT geler, sinon
// elle vide la batterie d'un téléphone resté en poche.
//
// Un volet de preview intégré à l'éditeur rapporte `document.hidden`, et le
// navigateur coupe alors complètement rAF — 0 frame en 400 ms. La boucle de
// Phaser s'arrête avec ses tweens et ses `time.delayedCall`, et la promesse de la
// couche origami ne se résout jamais, ce qui bloque le dialogue.
//
// Un Worker plutôt qu'un `setInterval` de page : le navigateur bride aussi les
// timers d'un document masqué — sur une seconde, 1 tick pour la page, 48 pour le
// worker.

const BEAT_MS = 33;

export function installHiddenPageRaf(): void {
  const nativeRequest = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);

  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    if (!document.hidden) return nativeRequest(callback);
    // Les identifiants négatifs ne peuvent pas entrer en collision avec ceux du
    // navigateur : `cancelAnimationFrame` sait à qui s'adresser, même si la page
    // redevient visible entre-temps.
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
    // Vider la file avant d'appeler : les callbacks se réinscrivent presque
    // toujours, et on tournerait sinon en boucle dans la même frame.
    const due = [...pending.values()];
    pending.clear();
    const now = performance.now();
    for (const callback of due) callback(now);
  };
}
