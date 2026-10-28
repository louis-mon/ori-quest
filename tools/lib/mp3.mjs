/**
 * Lire un son de l'artiste en échantillons, et réécrire des échantillons en MP3.
 * Partagé par les outils d'intégration des sons.
 *
 * MP3 et pas AAC, que `afconvert` saurait écrire sans dépendance : tous les
 * navigateurs lisent le MP3, quand l'AAC dépend, selon le navigateur et le
 * système, de décodeurs que tous n'ont pas.
 *
 * Le décodage passe par `afconvert`, donc macOS seulement ; l'encodage par
 * lamejs, en outil de build (LGPL, hors bundle).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mp3Encoder } from '@breezystack/lamejs';

// Un multiple de la trame MP3, en MPEG-1 (1152 échantillons) comme en MPEG-2 (576).
const BLOC = 1152 * 8;

// Un tableau d'échantillons 16 bits par canal, à la fréquence demandée.
export function lirePcm(entree, frequence, nbCanaux) {
  const dossier = mkdtempSync(join(tmpdir(), 'ori-son-'));
  try {
    const wav = join(dossier, 'pcm.wav');
    execFileSync('afconvert', [
      '-f',
      'WAVE',
      '-d',
      `LEI16@${frequence}`,
      '-c',
      String(nbCanaux),
      entree,
      wav,
    ]);
    return desentrelacer(donneesWave(readFileSync(wav), entree), nbCanaux);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export function ecrireMp3(sortie, canaux, frequence, debitKbps) {
  const encodeur = new Mp3Encoder(canaux.length, frequence, debitKbps);
  // lamejs rend des Int8Array, que `Buffer.concat` refuse.
  const morceaux = [];
  const garder = (trames) =>
    morceaux.push(Buffer.from(trames.buffer, trames.byteOffset, trames.length));
  for (let i = 0; i < canaux[0].length; i += BLOC) {
    garder(encodeur.encodeBuffer(...canaux.map((canal) => canal.subarray(i, i + BLOC))));
  }
  garder(encodeur.flush());
  writeFileSync(sortie, Buffer.concat(morceaux));
}

// `afconvert` écrit un en-tête WAVE dont les blocs varient d'une version à
// l'autre : on cherche `data` au lieu de supposer 44 octets.
function donneesWave(octets, entree) {
  let i = 12;
  while (i < octets.length) {
    const id = octets.toString('ascii', i, i + 4);
    const taille = octets.readUInt32LE(i + 4);
    if (id === 'data') return new Int16Array(octets.buffer, octets.byteOffset + i + 8, taille / 2);
    i += 8 + taille + (taille % 2);
  }
  throw new Error(`${entree} : pas de bloc data dans le WAVE décodé`);
}

function desentrelacer(pcm, nbCanaux) {
  const n = pcm.length / nbCanaux;
  const canaux = Array.from({ length: nbCanaux }, () => new Int16Array(n));
  for (let k = 0; k < n; k++) {
    for (let c = 0; c < nbCanaux; c++) canaux[c][k] = pcm[nbCanaux * k + c];
  }
  return canaux;
}
