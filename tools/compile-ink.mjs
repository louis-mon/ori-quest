#!/usr/bin/env node
/**
 * Compile content/story.ink -> src/generated/story.json, puis le récit de chaque
 * langue de content/langues/ -> src/generated/langues/<code>.json.
 *
 * inkjs embarque le compilateur (build `inkjs/full`), donc ni inklecate ni .NET.
 * Lancé automatiquement par `npm run dev` et `npm run build`.
 *
 * Une langue est compilée avec la narration, jamais à part : le récit traduit
 * est le JSON français à ses textes près, et un story.json neuf à côté d'un
 * récit traduit d'avant ferait jouer en anglais des knots qui n'existent plus.
 * Un texte sans traduction reste en français, et se signale ici.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler, CompilerOptions } from 'inkjs/full';
import {
  cheminDuCatalogue,
  languesCibles,
  lirePo,
  traductions,
  traduireLeRecit,
} from './lib/langues.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'content/story.ink');
const outFile = resolve(root, 'src/generated/story.json');
const dossierLangues = resolve(root, 'src/generated/langues');

const text = readFileSync(source, 'utf8');

// Sans gestionnaire explicite, inkjs se contente de lever « Compilation
// failed. » — sans fichier ni ligne. Le détail n'existe que dans ce callback.
const problemes = [];
const options = new CompilerOptions(null, [], false, (message, type) => {
  problemes.push({ message, type });
});

let story;
try {
  story = new Compiler(text, options).Compile();
} catch (err) {
  console.error('\n✗ Erreur de compilation ink :\n');
  for (const { message } of problemes) console.error(`  ${message}`);
  if (problemes.length === 0) console.error(`  ${err.message ?? err}`);
  process.exit(1);
}

// Les avertissements ne bloquent pas, mais méritent d'être vus.
for (const { message } of problemes) console.warn(`⚠ ${message}`);

// Tout est préparé avant d'écrire quoi que ce soit : un catalogue illisible
// laisse en place la dernière version valide, récit français compris.
const json = story.ToJson();
const recit = JSON.parse(json);
const sorties = [];
for (const code of languesCibles(root)) {
  let entrees;
  try {
    ({ entrees } = lirePo(readFileSync(cheminDuCatalogue(root, code), 'utf8')));
  } catch (err) {
    console.error(`\n✗ content/langues/${code}.po illisible : ${err.message}`);
    process.exit(1);
  }
  const table = traductions(entrees);
  const { recit: traduit, manquants } = traduireLeRecit(recit, table);
  // Le récit est déjà traduit dans son JSON : la table n'a à porter que ce que
  // `t()` demandera. Une entrée sans référence vient d'ailleurs que de
  // `npm run langues` — dans le doute, elle part avec.
  const interfaceSeule = traductions(
    entrees.filter((e) => !e.references.length || e.references.some((r) => r.includes('/'))),
  );
  if (manquants.length) {
    console.warn(
      `⚠ ${code} : ${manquants.length} texte(s) du récit sans traduction, laissés en français` +
        ` — npm run langues, puis content/langues/${code}.po`,
    );
  }
  sorties.push({ code, contenu: { textes: Object.fromEntries(interfaceSeule), recit: traduit } });
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, json);

// Une langue retirée ne doit pas rester jouable par son ancien fichier.
mkdirSync(dossierLangues, { recursive: true });
for (const f of readdirSync(dossierLangues)) {
  if (!sorties.some(({ code }) => f === `${code}.json`)) rmSync(resolve(dossierLangues, f));
}
for (const { code, contenu } of sorties) {
  writeFileSync(resolve(dossierLangues, `${code}.json`), JSON.stringify(contenu));
}

const langues = sorties.length ? ` (+ ${sorties.map(({ code }) => code).join(', ')})` : '';
console.log(`✓ ink compilé -> ${outFile.replace(root + '/', '')}${langues}`);
