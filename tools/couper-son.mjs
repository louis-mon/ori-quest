#!/usr/bin/env node
/**
 * Ne garde d'un son de l'artiste que ce qui se passe entre deux instants.
 *
 *   node tools/couper-son.mjs <entree.mp3> <sortie.mp3> <debut_s> <fin_s>
 *
 * Un bruitage arrive avec le silence de sa prise autour — la pièce qui respire
 * avant que le papier ne bouge. Joué tel quel, il partirait en retard sur ce
 * qu'il accompagne. Les bords reçoivent un fondu bref : coupé net, le bruit de
 * fond claque.
 *
 * Canaux et fréquence restent ceux du fichier livré.
 */
import { execFileSync } from 'node:child_process';
import { ecrireMp3, lirePcm } from './lib/mp3.mjs';

const DEBIT_KBPS = 128;
// En secondes. L'entrée reste franche, la sortie retombe dans le bruit de fond.
const FONDU_ENTREE_S = 0.02;
const FONDU_SORTIE_S = 0.15;

const [entree, sortie, debutTexte, finTexte] = process.argv.slice(2);
const debut = Number(debutTexte);
const fin = Number(finTexte);
if (!entree || !sortie || !(debut >= 0) || !(fin > debut)) {
  console.error('usage : node tools/couper-son.mjs <entree.mp3> <sortie.mp3> <debut_s> <fin_s>');
  process.exit(1);
}

// « Data format:     1 ch,  48000 Hz, .mp3 »
const format = /(\d+) ch,\s+(\d+) Hz/.exec(execFileSync('afinfo', [entree], { encoding: 'utf8' }));
if (!format) throw new Error(`${entree} : format illisible par afinfo`);
const nbCanaux = Number(format[1]);
const frequence = Number(format[2]);

const canaux = lirePcm(entree, frequence, nbCanaux);
const duree = canaux[0].length / frequence;
if (fin > duree) {
  console.error(`✗ ${entree} dure ${duree.toFixed(2)} s : impossible de couper à ${fin} s.`);
  process.exit(1);
}

const premier = Math.round(debut * frequence);
const coupes = canaux.map((canal) => canal.slice(premier, Math.round(fin * frequence)));
const entreeN = Math.round(FONDU_ENTREE_S * frequence);
const sortieN = Math.round(FONDU_SORTIE_S * frequence);
for (const canal of coupes) {
  for (let k = 0; k < entreeN; k++) canal[k] = Math.round((canal[k] * k) / entreeN);
  for (let k = 0; k < sortieN; k++) {
    const i = canal.length - 1 - k;
    canal[i] = Math.round((canal[i] * k) / sortieN);
  }
}

ecrireMp3(sortie, coupes, frequence, DEBIT_KBPS);
console.log(`✓ ${sortie} : ${(fin - debut).toFixed(2)} s gardées sur ${duree.toFixed(2)}`);
