#!/usr/bin/env node
/**
 * check-puzzle — un découpage d'énigme a-t-il bien une solution unique ?
 *
 *   npm run check-puzzle                      # toutes les énigmes
 *   npm run check-puzzle -- pont
 *   npm run check-puzzle -- pont --with-borders
 *
 * Le joueur ne valide qu'une disposition : celle d'origine. Si une AUTRE
 * disposition produit exactement la même image, il croit avoir résolu l'énigme
 * et se voit refusé. C'est arrivé sur le pont, dont le motif — deux plis
 * horizontaux pleine largeur — ne fixe aucune abscisse : toute solution admet
 * son miroir.
 *
 * L'outil compare les pièces par leur CONTENU : les portions du motif tombant
 * dans le polygone, ramenées en coordonnées locales. Deux emplacements sont
 * interchangeables si ce contenu est identique. On énumère ensuite tous les
 * pavages compatibles.
 *
 * `import-decoupage` fait la même vérification à chaque enregistrement et le
 * signale en une ligne ; cet outil-ci est là quand la ligne dit non et qu'on
 * veut voir quelles dispositions se valent.
 *
 * Les traits de bord (`bo`) sont ignorés par défaut : le jeu ne les affiche pas,
 * justement pour ne pas révéler quelle pièce vient d'une rive. `--with-borders`
 * les recompte, ce qui montre ce qu'on gagnerait à les rendre visibles.
 */
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { analyser, boite, lireDecoupage } from './lib/decoupage.mjs';

const DOSSIER = 'game-design/enigmes';
const MOTIF = (nom) => `public/assets/enigmes/${nom}/solution.svg`;

const args = process.argv.slice(2);
const bords = args.includes('--with-borders');
const demandes = args.filter((a) => !a.startsWith('--'));

const connues = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.json'))
  .map((f) => basename(f, '.json'))
  .sort();

for (const nom of demandes) {
  if (!connues.includes(nom)) {
    console.error(`✗ Énigme inconnue : « ${nom} ». Connues : ${connues.join(', ')}`);
    process.exit(1);
  }
}

const enigmes = demandes.length ? demandes : connues;
let fatal = false;

for (const nom of enigmes) {
  if (!verifier(nom)) fatal = true;
  console.log('');
}

process.exit(fatal ? 1 : 0);

function verifier(nom) {
  const decoupage = lireDecoupage(join(DOSSIER, `${nom}.json`));
  const motif = MOTIF(nom);

  console.log(`── ${nom} ${'─'.repeat(Math.max(0, 60 - nom.length))}`);
  console.log(
    `Découpage : grille ${decoupage.grille}x${decoupage.grille}, ${decoupage.pieces.length} pièce(s)`,
  );
  console.log(
    '            ' +
      decoupage.pieces
        .map((points) => {
          const b = boite(points);
          return `(${b.x},${b.y}) ${b.w}x${b.h}${points.length > 4 ? `/${points.length} sommets` : ''}`;
        })
        .join('  '),
  );

  const rapport = analyser(decoupage, motif, { bords });

  if (rapport.etat === 'superposition') {
    console.error(`✗ Pièces superposées : ${rapport.pavage.doubles.slice(0, 6).join(', ')}`);
    return false;
  }
  if (rapport.etat === 'trou') {
    console.error(`✗ Carré non couvert : ${rapport.pavage.trous.slice(0, 6).join(', ')}`);
    return false;
  }
  console.log('✓ Pavage exact : le carré est couvert une fois et une seule.');

  if (rapport.etat === 'sans-motif') {
    console.error(`✗ Motif introuvable : ${motif}`);
    return false;
  }
  console.log(
    `Motif     : ${motif} — ${rapport.traits} trait(s) retenu(s)` +
      `${bords ? ', bords compris' : ', bords exclus (comme en jeu)'}`,
  );

  if (rapport.etat === 'trop-long') {
    console.error('✗ Trop de dispositions à énumérer : unicité indécise.');
    return false;
  }
  if (rapport.etat === 'unique') {
    console.log('✓ Solution unique : aucune autre disposition ne donne la même image.');
    return true;
  }

  console.error(
    `✗ ${rapport.solutions.length} dispositions produisent la même image. Le joueur peut en\n` +
      `  trouver une que la validation refusera. Les premières :`,
  );
  for (const s of rapport.solutions.slice(0, 4)) {
    console.error('    ' + s.map(([x, y], i) => `p${i}->(${x},${y})`).join('  '));
  }
  console.error(
    `\n  Pistes : un motif sans trait vertical ni oblique ne fixe aucune abscisse,\n` +
      `  et toute solution admet alors son miroir. Des pièces de tailles et de\n` +
      `  formes différentes lèvent l'ambiguïté ; --with-borders montre ce que\n` +
      `  gagnerait un motif plus riche.`,
  );
  return false;
}
