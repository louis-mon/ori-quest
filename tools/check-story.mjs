#!/usr/bin/env node
/**
 * Cherche les culs-de-sac de la narration : un menu de dialogue où, pour une
 * combinaison de drapeaux atteignable, AUCUNE option n'est ouverte.
 *
 * ink n'y voit pas une liste vide mais une histoire qui déraille — « ran out of
 * content » —, et l'exception laisse l'instance `Story` en erreur. Le
 * `DialogueRunner` sait s'en relever depuis (`remettreDebout`), mais le knot
 * fauté reste muet et le joueur perd le fil : c'est un bug de contenu, à
 * corriger dans `content/story.ink` par un repli sans texte (`+ -> DONE`).
 *
 * Le cas a été rencontré : le renard de `porte_renard_choix`, une fois qu'il
 * avait tout dit, tuait la narration pour le reste de la partie.
 *
 * On rejoue ce que fait `DialogueRunner` : `# flag:` / `# unflag:` / `# give:` /
 * `# drop:` mettent à jour les variables miroir, `# then:` repart au knot, et
 * `# puzzle:` se branche sur ses deux issues. Les états de départ sont tirés
 * d'une graine fixe : un cul-de-sac trouvé aujourd'hui se retrouve demain.
 *
 * Usage : npm run check-story [tirages]
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Story } from 'inkjs';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = readFileSync(resolve(racine, 'src/generated/story.json'), 'utf8');
const source = readFileSync(resolve(racine, 'content/story.ink'), 'utf8');

const KNOTS = [...source.matchAll(/^=== (\w+) ===/gm)]
  .map((m) => m[1])
  .filter((n) => n !== '_unused');
const VARS = [...source.matchAll(/^VAR (\w+) = /gm)].map((m) => m[1]);

const TIRAGES = Number(process.argv[2] ?? 150);
// Au-delà, on n'explore plus une conversation mais une boucle.
const PROFONDEUR = 12;
const PAS_MAX = 200;
const BRANCHES_MAX = 400;

// mulberry32, comme le vrac des énigmes : même graine, même exploration.
function melangeur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hasard = melangeur(20260830);

function lireTag(tag) {
  const i = tag.indexOf(':');
  return i < 0 ? null : { cle: tag.slice(0, i).trim(), val: tag.slice(i + 1).trim() };
}

// Le miroir que `bindStateToInk` pousse : le jeu écrit dans `gameState`, jamais
// dans ink. On reproduit la même correspondance de noms.
function poser(story, etat) {
  for (const nom of VARS) story.variablesState[nom] = etat[nom] === true;
}

function appliquer(etat, cle, val) {
  if (cle === 'flag') etat[`flag_${val}`] = true;
  else if (cle === 'unflag') etat[`flag_${val}`] = false;
  else if (cle === 'give') etat[`has_${val}`] = true;
  else if (cle === 'drop') etat[`has_${val}`] = false;
}

const trouves = [];

// Une exploration = un knot d'entrée et un état de départ. On rejoue le chemin
// de choix déjà connu, puis on empile les branches du point atteint.
function explorer(knotDepart, etatDepart, etiquette) {
  const pile = [[]];
  let gardefou = BRANCHES_MAX;

  while (pile.length && gardefou-- > 0) {
    const chemin = pile.pop();
    const story = new Story(json);
    let panne = null;
    story.onError = (m) => {
      panne = m;
    };

    const etat = { ...etatDepart };
    poser(story, etat);
    const aChoisir = [...chemin];
    let pas = 0;

    try {
      story.ChoosePathString(knotDepart);
      for (;;) {
        if (++pas > PAS_MAX) break;
        while (story.canContinue) {
          story.Continue();
          if (panne) throw new Error(panne);
          let divert = null;
          for (const tag of story.currentTags ?? []) {
            const t = lireTag(tag);
            if (!t) continue;
            appliquer(etat, t.cle, t.val);
            if (t.cle === 'then') divert = t.val;
            // Le verdict de l'énigme est publié par le TS avant le `# then:`.
            if (t.cle === 'puzzle') etat[`flag_${t.val}_resolu`] = hasard() < 0.5;
          }
          poser(story, etat);
          if (divert) story.ChoosePathString(divert);
          if (panne) throw new Error(panne);
        }
        if (panne) throw new Error(panne);

        const choix = story.currentChoices;
        if (choix.length === 0) break;

        if (aChoisir.length) {
          const i = aChoisir.shift();
          if (i >= choix.length) break;
          story.ChooseChoiceIndex(i);
        } else {
          if (chemin.length < PROFONDEUR) {
            for (let i = 0; i < choix.length; i++) pile.push([...chemin, i]);
          }
          break;
        }
      }
    } catch (err) {
      trouves.push({
        knot: knotDepart,
        etiquette,
        chemin: chemin.join('>'),
        message: String(panne ?? err.message ?? err),
      });
      return;
    }
  }
}

// « Tout levé » n'est pas un cas d'école : c'est exactement l'état qui vidait le
// menu du renard, une fois qu'il avait tout dit.
const etats = [
  ['tout faux', Object.fromEntries(VARS.map((v) => [v, false]))],
  ['tout vrai', Object.fromEntries(VARS.map((v) => [v, true]))],
];
for (let i = 0; i < TIRAGES; i++) {
  etats.push([`tirage ${i}`, Object.fromEntries(VARS.map((v) => [v, hasard() < 0.5]))]);
}

console.log(`${KNOTS.length} knots, ${VARS.length} variables, ${etats.length} états par knot`);
for (const knot of KNOTS) {
  for (const [etiquette, etat] of etats) {
    if (trouves.some((t) => t.knot === knot)) break; // un exemple suffit par knot
    explorer(knot, etat, etiquette);
  }
}

if (trouves.length === 0) {
  console.log('\n✓ aucun cul-de-sac');
} else {
  console.log(`\n✗ ${trouves.length} knot(s) en cul-de-sac :\n`);
  for (const t of trouves) {
    console.log(`  ${t.knot}  [${t.etiquette}${t.chemin ? `, choix ${t.chemin}` : ''}]`);
    console.log(`      ${t.message.split('\n')[0].slice(0, 160)}`);
  }
  console.log('\n  Un menu dont toutes les options peuvent être fermées a besoin');
  console.log('  d’un repli sans texte : « + -> DONE » en dernière ligne.');
  process.exitCode = 1;
}
