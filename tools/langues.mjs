#!/usr/bin/env node
/**
 * Les catalogues de traduction, tenus d'accord avec le jeu.
 *
 *   npm run langues          # ajoute les textes nouveaux, retire les disparus
 *   npm run check-langues    # échoue si une langue n'est pas complète (CI)
 *
 * Ajouter une langue : créer `content/langues/<code>.po` vide, puis
 * `npm run langues` le remplit de tout ce qu'il y a à traduire. Elle apparaît
 * dans les options du jeu dès le `npm run ink` suivant.
 *
 * La vérification refuse :
 *   - un texte du jeu sans entrée, ou une entrée sans traduction ;
 *   - une entrée « fuzzy » : son français a changé depuis qu'elle est traduite ;
 *   - une entrée dont le texte a disparu du jeu ;
 *   - une traduction qui perd ou invente un champ `{nom}` ;
 *   - un texte d'interface affiché sans passer par `t()`, ou un `t()` sur autre
 *     chose qu'un littéral (tools/lib/langues.mjs, `textesDeLInterface`).
 *
 * `src/generated/story.json` étant généré, le script npm recompile l'ink avant.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accorder,
  cheminDuCatalogue,
  ecrirePo,
  languesCibles,
  lirePo,
  problemes,
  textesDeLInterface,
  textesDuRecit,
} from './lib/langues.mjs';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verifier = process.argv.includes('--verifier');

const recit = JSON.parse(readFileSync(resolve(racine, 'src/generated/story.json'), 'utf8'));
const interface_ = textesDeLInterface(racine);

// Le récit d'abord, dans l'ordre où il se joue, puis l'interface : on traduit
// une conversation d'un bout à l'autre, pas un texte isolé de son contexte.
const textes = [...textesDuRecit(recit)];
const vus = new Set(textes.map((t) => t.texte));
for (const t of interface_.textes) {
  if (vus.has(t.texte)) {
    const deja = textes.find((x) => x.texte === t.texte);
    deja.references.push(...t.references);
    deja.extraits.push(...t.extraits);
  } else {
    textes.push(t);
    vus.add(t.texte);
  }
}

let echec = false;
const court = (s) => (s.length > 90 ? `${s.slice(0, 87)}…` : s);

if (interface_.fautes.length) {
  echec = true;
  console.error(
    `✗ ${interface_.fautes.length} texte(s) d'interface hors de portée des traductions :`,
  );
  for (const { fichier, ligne, message } of interface_.fautes) {
    console.error(`  ${fichier}:${ligne}  ${court(message)}`);
  }
  console.error(
    '  → envelopper le texte dans t() (src/langues/traduire.ts) ; une chaîne qui ne' +
      ' s’affiche pas se signale par un commentaire « // hors traduction ».\n',
  );
}

const codes = languesCibles(racine);
if (!codes.length) console.log('· aucune langue dans content/langues/ : rien à traduire');

const LIBELLES = {
  absent: 'pas encore dans le catalogue',
  vide: 'sans traduction',
  'a-revoir': 'à revoir (fuzzy) : le français a changé',
  obsolete: 'n’existe plus dans le jeu',
  champs: 'champs {…} différents de l’original',
};

for (const code of codes) {
  const chemin = cheminDuCatalogue(racine, code);
  const rel = `content/langues/${code}.po`;
  let actuel;
  try {
    actuel = lirePo(readFileSync(chemin, 'utf8'));
  } catch (err) {
    console.error(`✗ ${rel} illisible : ${err.message}`);
    echec = true;
    continue;
  }

  if (verifier) {
    const liste = problemes(actuel.entrees, textes);
    if (!liste.length) {
      console.log(`✓ ${code} : ${textes.length} textes, tous traduits`);
      continue;
    }
    echec = true;
    console.error(`✗ ${code} : ${liste.length} problème(s) dans ${rel}`);
    for (const { genre, texte } of liste)
      console.error(`  ${LIBELLES[genre]} — « ${court(texte)} »`);
    console.error(`  → npm run langues, puis compléter ${rel}\n`);
    continue;
  }

  const { entrees, bilan } = accorder(actuel.entrees, textes);
  writeFileSync(chemin, ecrirePo(code, entrees));
  const restants = problemes(entrees, textes).filter((p) => p.genre !== 'obsolete');
  const morceaux = [
    bilan.nouveaux.length && `${bilan.nouveaux.length} nouveau(x)`,
    bilan.aRevoir.length && `${bilan.aRevoir.length} à revoir`,
    bilan.retires.length && `${bilan.retires.length} retiré(s)`,
  ].filter(Boolean);
  console.log(
    `✓ ${rel} : ${morceaux.length ? morceaux.join(', ') : 'à jour'}` +
      (restants.length ? ` — ${restants.length} texte(s) à traduire` : ''),
  );
}

if (echec) process.exitCode = 1;
