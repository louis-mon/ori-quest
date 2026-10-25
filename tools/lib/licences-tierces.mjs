/**
 * Les licences de ce que le jeu embarque, écrites dans dist/ à côté
 * d'index.html — donc dans le zip et dans ce que butler envoie.
 *
 * Tout est en MIT, qui ne demande rien à l'écran mais exige que la notice
 * accompagne chaque copie distribuée ; or le minifieur retire celle d'inkjs.
 *
 * La liste se lit dans ce que Rollup a réellement mis dans le bundle, plus les
 * dépendances de ces paquets : Phaser arrive déjà bundlé, `eventemitter3` fondu
 * dans son fichier, et Rollup ne l'y voit pas. Une notice de trop ne coûte rien.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const FICHIER_LICENCES = 'licences-tierces.txt';

// Vite écrit ses identifiants de module avec des `/`, Windows compris.
const NODE_MODULES = '/node_modules/';
const FICHIER_DE_LICENCE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;

/** @returns {import('vite').Plugin} */
export function licencesTierces() {
  return {
    name: 'ori-quest:licences',
    apply: 'build',
    generateBundle(_options, bundle) {
      const dossiers = new Map();
      for (const sortie of Object.values(bundle)) {
        if (sortie.type !== 'chunk') continue;
        for (const id of Object.keys(sortie.modules)) {
          const paquet = paquetDe(id);
          if (paquet) dossiers.set(paquet.nom, paquet.dossier);
        }
      }
      const aVoir = [...dossiers.values()];
      while (aVoir.length) {
        const dossier = aVoir.pop();
        for (const dep of Object.keys(lirePaquet(dossier).dependencies ?? {})) {
          const sien = dossiers.has(dep) ? null : dossierDe(dep, dossier);
          if (sien) {
            dossiers.set(dep, sien);
            aVoir.push(sien);
          }
        }
      }
      const noms = [...dossiers.keys()].sort();
      this.emitFile({
        type: 'asset',
        fileName: FICHIER_LICENCES,
        source: [ENTETE, ...noms.map((nom) => notice(dossiers.get(nom)))].join('\n'),
      });
    },
  };
}

// Le dernier `node_modules` du chemin : celui d'une dépendance imbriquée, pas
// celui du paquet qui l'a tirée.
function paquetDe(id) {
  const chemin = id.replace(/^\0/, '').split('?')[0];
  const i = chemin.lastIndexOf(NODE_MODULES);
  if (i < 0) return null;
  const reste = chemin.slice(i + NODE_MODULES.length).split('/');
  const nom = reste[0].startsWith('@') ? `${reste[0]}/${reste[1]}` : reste[0];
  return { nom, dossier: chemin.slice(0, i + NODE_MODULES.length) + nom };
}

// La résolution de Node : le `node_modules` du paquet, puis ceux de ses parents.
function dossierDe(nom, depuis) {
  for (let dir = depuis; dirname(dir) !== dir; dir = dirname(dir)) {
    const candidat = join(dir, 'node_modules', nom);
    if (existsSync(join(candidat, 'package.json'))) return candidat;
  }
  return null;
}

const lirePaquet = (dossier) => JSON.parse(readFileSync(join(dossier, 'package.json'), 'utf8'));

const TRAIT = '='.repeat(72);

const ENTETE = `Orifable — licences tierces / third-party licenses

Le jeu embarque les bibliothèques suivantes, chacune sous sa propre licence.
The game bundles the following libraries, each under its own license.
`;

// Un paquet sans fichier de licence arrête le build : le livrer quand même, ce
// serait le livrer sans sa notice.
function notice(dossier) {
  const paquet = lirePaquet(dossier);
  const fichier = readdirSync(dossier).find((f) => FICHIER_DE_LICENCE.test(f));
  if (!fichier) throw new Error(`${paquet.name} : aucun fichier de licence dans ${dossier}`);
  const texte = readFileSync(join(dossier, fichier), 'utf8').trim();
  return `${TRAIT}\n${paquet.name} ${paquet.version} — ${paquet.license}\n${TRAIT}\n\n${texte}\n`;
}
