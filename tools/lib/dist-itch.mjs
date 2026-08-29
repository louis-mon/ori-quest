/**
 * Ce qu'un `dist/` doit respecter pour tourner sur itch.io.
 *
 * Partagé par `npm run zip` et `npm run itch` : les deux envoient le même
 * dossier, une seule des deux routes le vérifierait sinon.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Les problèmes trouvés, un message par entrée — tableau vide si tout va bien.
 *
 * Contraintes vérifiées :
 *  - `index.html` doit être à la RACINE de ce qu'on envoie, pas dans un
 *    sous-dossier ;
 *  - tous les chemins doivent être relatifs, itch.io servant le jeu depuis un
 *    sous-dossier arbitraire (assuré par `base: './'` côté Vite).
 */
export function verifierDist(dist) {
  if (!existsSync(join(dist, 'index.html'))) {
    return ["dist/index.html absent. Lance `npm run build` d'abord."];
  }

  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const absolus = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
  if (absolus.length) {
    return [
      `Chemins absolus dans index.html : ${absolus.join(', ')}\n` +
        `  itch.io sert le jeu depuis un sous-dossier — ils ne résoudront pas.\n` +
        `  Vérifie que vite.config.ts contient bien \`base: './'\`.`,
    ];
  }

  return [];
}

export function tailleDossier(dir) {
  let octets = 0;
  for (const entree of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entree.name);
    octets += entree.isDirectory() ? tailleDossier(p) : statSync(p).size;
  }
  return octets;
}

export const mo = (n) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

// Au-delà, le taux d'abandon sur mobile grimpe vite (game-design : viser 30 Mo).
export const SEUIL_ALERTE = 30 * 1024 * 1024;

// Réglages qui ne sont pas dans le fichier envoyé : ils se cochent dans le
// tableau de bord itch.io, et une seule fois par projet.
export const RAPPEL_ITCH = `Dans les options du fichier, côté itch.io :
  • cocher « This file will be played in the browser »
  • régler la fenêtre sur 1280 × 720 et activer le bouton plein écran
  • cocher « Mobile friendly » (+ orientation paysage)
  • laisser « SharedArrayBuffer support » DÉCOCHÉ (casse Firefox/Safari, inutile ici)`;
