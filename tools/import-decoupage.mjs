#!/usr/bin/env node
/**
 * import-decoupage — les découpages d'énigme deviennent des données de jeu.
 *
 *   npm run enigmes            # tout game-design/enigmes/
 *   npm run enigmes -- --check # valide sans écrire
 *
 * Le fichier `game-design/enigmes/<nom>.json` fait foi, comme une carte Tiled
 * pour la géométrie d'une scène. La sortie est figée en `as const` : une énigme
 * déclarée dans `puzzles.ts` sans découpage est alors une erreur de `tsc`, pas
 * une surprise à l'ouverture.
 *
 * En cas de découpage invalide, rien n'est écrit : le jeu continue de tourner
 * sur la dernière version valide pendant qu'on corrige.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { aire, analyser, boite, lireDecoupage } from './lib/decoupage.mjs';

const DOSSIER = 'game-design/enigmes';
const SORTIE = 'src/generated/enigmes.ts';
// Là où le jeu sert le crease pattern, par convention de nom.
const MOTIF = (nom) => `public/assets/enigmes/${nom}/solution.svg`;

const check = process.argv.includes('--check');

const fichiers = existsSync(DOSSIER)
  ? readdirSync(DOSSIER)
      .filter((f) => f.endsWith('.json'))
      .sort()
  : [];

const decoupages = [];
let echec = false;

for (const fichier of fichiers) {
  const nom = basename(fichier, '.json');
  try {
    const decoupage = lireDecoupage(join(DOSSIER, fichier));
    verifier(nom, decoupage);
    decoupages.push([nom, decoupage]);
  } catch (err) {
    console.error(`✗ ${fichier} : ${err.message}`);
    echec = true;
  }
}

if (echec) process.exit(1);
if (!check) {
  mkdirSync('src/generated', { recursive: true });
  writeFileSync(SORTIE, rendre(decoupages));
}

// Ce qui ne se voit pas à l'œil dans le fichier : le carré couvert exactement
// une fois, et une seule disposition capable de produire l'image de la solution.
function verifier(nom, decoupage) {
  const rapport = analyser(decoupage, MOTIF(nom));

  // Une erreur et pas un avertissement : le jeu suppose que les pièces couvrent
  // le carré.
  if (rapport.etat === 'superposition') {
    throw new Error(`pièces superposées (${rapport.pavage.doubles.length} sous-cellules)`);
  }
  if (rapport.etat === 'trou') {
    throw new Error(`carré non couvert (${rapport.pavage.trous.length} sous-cellules)`);
  }

  // Une pièce minuscule est injouable au doigt bien avant d'être ambiguë : le
  // seuil tactile se mesure à l'écran, mais moins d'une cellule ne passe jamais.
  for (const [i, points] of decoupage.pieces.entries()) {
    if (aire(points) < 1) {
      console.warn(`⚠ ${nom} : pièce ${i} de ${aire(points)} cellule(s) — sans doute trop petite.`);
    }
  }

  if (rapport.etat === 'sans-motif') {
    console.warn(`⚠ ${nom} : ${MOTIF(nom)} introuvable, unicité non vérifiée.`);
    return;
  }
  if (rapport.etat === 'trop-long') {
    console.warn(`⚠ ${nom} : trop de dispositions à énumérer, unicité indécise.`);
    return;
  }
  if (rapport.etat === 'multiple') {
    console.warn(
      `⚠ ${nom} : ${rapport.solutions.length} dispositions donnent la même image — le joueur peut en\n` +
        `  trouver une que la validation refusera. Détail : npm run check-puzzle -- ${nom}`,
    );
    return;
  }
  console.log(`✓ ${nom} : ${decoupage.pieces.length} pièces, pavage exact, solution unique.`);
}

function rendre(decoupages) {
  const corps = decoupages
    .map(([nom, { grille, pieces }]) => {
      const lignes = pieces.map((points) => {
        const b = boite(points);
        const liste = points.map(([x, y]) => `[${x}, ${y}]`).join(', ');
        return `      // (${b.x}, ${b.y}) ${b.w}x${b.h}\n      { points: [${liste}] },`;
      });
      return `  ${nom}: {\n    grille: ${grille},\n    pieces: [\n${lignes.join('\n')}\n    ],\n  },`;
    })
    .join('\n');

  return `// Généré par tools/import-decoupage.mjs — ne pas modifier à la main.
// La source est game-design/enigmes/<nom>.json, dessinée dans decoupage.html.
// Sommets en cellules de la grille d'ancrage, origine en haut à gauche ; le coin
// de la boîte englobante est la position solution de la pièce.

export const DECOUPAGES = {
${corps}
} as const;
`;
}
