#!/usr/bin/env node
/**
 * Réencode une ambiance de l'artiste au débit du jeu.
 *
 *   node tools/alleger-ambiance.mjs <entree.mp3> <sortie.mp3>
 *
 * Telles que livrées, les ambiances dépassaient à elles seules le budget du jeu
 * (< 30 Mo) : elles durent plusieurs minutes. Elles restent en stéréo — leurs
 * deux canaux diffèrent vraiment — mais passent à 24 kHz, la fréquence à
 * laquelle l'artiste en exporte déjà une partie.
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

const FREQUENCE = 24_000;
const DEBIT_KBPS = 64;
// Un multiple de la trame MP3 (576 échantillons en MPEG-2).
const BLOC = 1152 * 8;

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie) {
  console.error('usage : node tools/alleger-ambiance.mjs <entree.mp3> <sortie.mp3>');
  process.exit(1);
}

const dossier = mkdtempSync(join(tmpdir(), 'ori-ambiance-'));
try {
  const wav = join(dossier, 'pcm.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${FREQUENCE}`, '-c', '2', entree, wav]);
  const { gauche, droite } = lirePcmStereo(readFileSync(wav));

  const encodeur = new Mp3Encoder(2, FREQUENCE, DEBIT_KBPS);
  // lamejs rend des Int8Array, que `Buffer.concat` refuse.
  const morceaux = [];
  const garder = (trames) =>
    morceaux.push(Buffer.from(trames.buffer, trames.byteOffset, trames.length));
  for (let i = 0; i < gauche.length; i += BLOC) {
    garder(encodeur.encodeBuffer(gauche.subarray(i, i + BLOC), droite.subarray(i, i + BLOC)));
  }
  garder(encodeur.flush());
  writeFileSync(sortie, Buffer.concat(morceaux));
} finally {
  rmSync(dossier, { recursive: true, force: true });
}

// `afconvert` écrit un en-tête WAVE dont les blocs varient d'une version à
// l'autre : on cherche `data` au lieu de supposer 44 octets.
function lirePcmStereo(octets) {
  let i = 12;
  while (i < octets.length) {
    const id = octets.toString('ascii', i, i + 4);
    const taille = octets.readUInt32LE(i + 4);
    if (id === 'data') {
      const pcm = new Int16Array(octets.buffer, octets.byteOffset + i + 8, taille / 2);
      const n = pcm.length / 2;
      const gauche = new Int16Array(n);
      const droite = new Int16Array(n);
      for (let k = 0; k < n; k++) {
        gauche[k] = pcm[2 * k];
        droite[k] = pcm[2 * k + 1];
      }
      return { gauche, droite };
    }
    i += 8 + taille + (taille % 2);
  }
  throw new Error(`${entree} : pas de bloc data dans le WAVE décodé`);
}
