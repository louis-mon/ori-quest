#!/usr/bin/env node
/**
 * Compile content/story.ink -> src/generated/story.json
 *
 * inkjs embarque le compilateur (build `inkjs/full`), donc pas besoin
 * d'inklecate ni de .NET. Lancé automatiquement par `npm run dev` et
 * `npm run build`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler, CompilerOptions } from 'inkjs/full';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'content/story.ink');
const outFile = resolve(root, 'src/generated/story.json');

const text = readFileSync(source, 'utf8');

/**
 * Sans gestionnaire d'erreurs explicite, inkjs se contente de lever
 * « Compilation failed. » — sans fichier, sans ligne, sans rien. Le détail
 * n'existe que dans ce callback, et une erreur de syntaxe ink sans numéro de
 * ligne se cherche à l'œil dans plusieurs centaines de lignes.
 */
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

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, story.ToJson());
console.log(`✓ ink compilé -> ${outFile.replace(root + '/', '')}`);
