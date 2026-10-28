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
 */
import { ecrireMp3, lirePcm } from './lib/mp3.mjs';

const FREQUENCE = 24_000;
const DEBIT_KBPS = 64;

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie) {
  console.error('usage : node tools/alleger-ambiance.mjs <entree.mp3> <sortie.mp3>');
  process.exit(1);
}

ecrireMp3(sortie, lirePcm(entree, FREQUENCE, 2), FREQUENCE, DEBIT_KBPS);
