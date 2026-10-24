/**
 * Les traductions : ce qu'il y a à traduire, et où le trouver traduit.
 *
 * Le français est la langue source, et son texte sert de clé — c'est la façon
 * de gettext. Une réplique retouchée en français n'a donc plus de traduction :
 * c'est voulu, une traduction restée accrochée à une ligne qui a changé de sens
 * serait l'oubli le plus difficile à voir. `npm run langues` la ressort à revoir,
 * l'ancienne traduction en guise de brouillon.
 *
 * Deux sources de texte, une seule liste :
 *   - le récit, lu dans le JSON compilé par ink et non dans `story.ink` : c'est
 *     là que chaque texte affichable est un fragment `^…`, conditions et tags
 *     déjà démêlés ;
 *   - l'interface, lue dans les appels `t('…')` du code (src/langues/traduire.ts).
 *
 * Partagé par `compile-ink.mjs`, qui écrit le récit traduit, et `langues.mjs`,
 * qui tient les catalogues et les vérifie : une seconde lecture du JSON finirait
 * par extraire autre chose que ce qui est substitué.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export const DOSSIER_LANGUES = 'content/langues';

// Les catalogues présents : une langue existe dès que son fichier existe, même
// vide — `npm run langues` le remplit alors de tout ce qu'il y a à traduire.
export function languesCibles(racine) {
  let fichiers = [];
  try {
    fichiers = readdirSync(resolve(racine, DOSSIER_LANGUES));
  } catch {
    return [];
  }
  return fichiers
    .filter((f) => /^[a-z]{2,3}(-[A-Za-z0-9]+)?\.po$/.test(f))
    .map((f) => f.slice(0, -3))
    .sort();
}

export const cheminDuCatalogue = (racine, code) => resolve(racine, DOSSIER_LANGUES, `${code}.po`);

// ------------------------------------------------------------------
// Les catalogues (.po)
// ------------------------------------------------------------------

// Le format de gettext, pour pouvoir ouvrir un catalogue dans Poedit ou le
// confier à une plateforme de traduction. On n'en lit que ce dont on se sert :
// pas de pluriels, pas de `msgctxt` — le jeu n'affiche aucun nombre, et un même
// texte français a toujours eu le même sens partout.

const echapper = (s) =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

const desechapper = (s) =>
  s.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[c] ?? c);

const chaine = (ligne) => {
  const m = /^"(.*)"\s*$/.exec(ligne.trim());
  if (!m) throw new Error(`chaîne attendue : ${ligne}`);
  return desechapper(m[1]);
};

/**
 * @typedef {object} Entree
 * @property {string} msgid
 * @property {string} msgstr
 * @property {string[]} commentaires   `# …` — ceux du traducteur, conservés
 * @property {string[]} extraits       `#. …` — le contexte, réécrit à chaque passage
 * @property {string[]} references     `#: …`
 * @property {Set<string>} drapeaux    `#, …`
 * @property {string | null} precedent `#| msgid …` — le français d'avant, pour une
 *                                     entrée à revoir
 */

/** @returns {{ entete: string, entrees: Entree[] }} */
export function lirePo(texte) {
  const entrees = [];
  let entete = '';
  let courante = nouvelle();
  // Le champ que prolonge une ligne `"…"` seule.
  let champ = null;

  function nouvelle() {
    return {
      msgid: null,
      msgstr: null,
      commentaires: [],
      extraits: [],
      references: [],
      drapeaux: new Set(),
      precedent: null,
    };
  }
  function clore() {
    if (courante.msgid === '') entete = courante.msgstr ?? '';
    else if (courante.msgid !== null) entrees.push({ ...courante, msgstr: courante.msgstr ?? '' });
    courante = nouvelle();
    champ = null;
  }

  for (const [i, brute] of texte.split(/\r?\n/).entries()) {
    const ligne = brute.trimEnd();
    try {
      if (!ligne.trim()) {
        clore();
      } else if (ligne.startsWith('#~')) {
        // Une entrée obsolète laissée par un autre outil : son texte a disparu
        // du jeu, il n'y a rien à en garder.
        champ = null;
      } else if (ligne.startsWith('#|')) {
        const reste = ligne.slice(2).trim();
        if (reste.startsWith('msgid ')) {
          courante.precedent = chaine(reste.slice(6));
          champ = 'precedent';
        } else if (reste.startsWith('"') && champ === 'precedent') {
          courante.precedent += chaine(reste);
        }
      } else if (ligne.startsWith('#,')) {
        for (const d of ligne.slice(2).split(',')) if (d.trim()) courante.drapeaux.add(d.trim());
      } else if (ligne.startsWith('#.')) {
        courante.extraits.push(ligne.slice(2).trim());
      } else if (ligne.startsWith('#:')) {
        courante.references.push(...ligne.slice(2).trim().split(/\s+/).filter(Boolean));
      } else if (ligne.startsWith('#')) {
        if (courante.msgid !== null) clore();
        courante.commentaires.push(ligne.replace(/^# ?/, ''));
      } else if (ligne.startsWith('msgctxt ')) {
        throw new Error('msgctxt : le jeu ne distingue pas deux sens d’un même texte');
      } else if (ligne.startsWith('msgid ')) {
        if (courante.msgid !== null) clore();
        courante.msgid = chaine(ligne.slice(6));
        champ = 'msgid';
      } else if (ligne.startsWith('msgstr ')) {
        courante.msgstr = chaine(ligne.slice(7));
        champ = 'msgstr';
      } else if (ligne.trim().startsWith('"') && champ && champ !== 'precedent') {
        courante[champ] += chaine(ligne);
      } else {
        throw new Error(`ligne incomprise : ${ligne}`);
      }
    } catch (err) {
      throw new Error(`ligne ${i + 1} : ${err.message}`);
    }
  }
  clore();
  return { entete, entrees };
}

// Une ligne par chaîne, sans repli à 80 colonnes : une réplique se relit d'un
// bloc, et un mot changé ne déplace pas le reste du paragraphe dans le diff.
export function ecrirePo(code, entrees) {
  const blocs = [
    [
      `# Ori-Quest — traduction (${code}).`,
      '#',
      '# Tenu par `npm run langues` : il ajoute ce qui est nouveau, retire ce qui',
      '# a disparu et réécrit le contexte. À la main, on ne remplit que les msgstr',
      '# — et les commentaires « # », qui sont conservés.',
      '#',
      '# « #, fuzzy » : le français a changé depuis la traduction, rappelée en',
      '# « #| msgid ». Revoir le msgstr, puis retirer la ligne « #, fuzzy ».',
      'msgid ""',
      'msgstr ""',
      `"Language: ${code}\\n"`,
      '"MIME-Version: 1.0\\n"',
      '"Content-Type: text/plain; charset=UTF-8\\n"',
      '"Content-Transfer-Encoding: 8bit\\n"',
    ].join('\n'),
  ];
  for (const e of entrees) {
    const lignes = [];
    for (const c of e.commentaires) lignes.push(c ? `# ${c}` : '#');
    for (const x of e.extraits) lignes.push(`#. ${x}`);
    if (e.references.length) lignes.push(`#: ${e.references.join(' ')}`);
    if (e.drapeaux.size) lignes.push(`#, ${[...e.drapeaux].join(', ')}`);
    if (e.precedent !== null && e.precedent !== undefined) {
      lignes.push(`#| msgid "${echapper(e.precedent)}"`);
    }
    lignes.push(`msgid "${echapper(e.msgid)}"`, `msgstr "${echapper(e.msgstr)}"`);
    blocs.push(lignes.join('\n'));
  }
  return blocs.join('\n\n') + '\n';
}

// Ce que le jeu affiche : une entrée à revoir sert quand même. Le français au
// milieu d'une partie en anglais serait pire qu'une traduction un peu datée, et
// la vérification, elle, ne la laisse pas passer.
export function traductions(entrees) {
  return new Map(entrees.filter((e) => e.msgstr).map((e) => [e.msgid, e.msgstr]));
}

// ------------------------------------------------------------------
// Le récit
// ------------------------------------------------------------------

// Les identifiants qui rendent la parole à la narration (src/game/systems/dialogue.ts).
const NARRATION = new Set(['narrateur', '-', 'aucun']);

const estTexte = (x) => typeof x === 'string' && x.startsWith('^');

// Un conteneur ink est un tableau dont le dernier élément est soit `null`, soit
// le dictionnaire de ses sous-conteneurs nommés (et de ses drapeaux `#f`, `#n`).
function sousConteneurs(conteneur) {
  const fin = conteneur[conteneur.length - 1];
  if (!fin || typeof fin !== 'object' || Array.isArray(fin)) return [];
  return Object.entries(fin).filter(([cle, v]) => cle !== '#f' && cle !== '#n' && Array.isArray(v));
}

/**
 * Visite chaque texte affichable du récit compilé, dans l'ordre de la source.
 *
 * Deux places, et deux seulement, portent du texte :
 *   - un fragment `^…` hors de toute évaluation : une réplique ;
 *   - une chaîne `str … /str` évaluée juste avant un point de choix `{"*": …}` :
 *     le libellé d'une option.
 * Le reste des `str` est de la logique — `trone_feuille("rouge")` compare des
 * chaînes, qui ne s'affichent pas et ne doivent surtout pas changer d'une
 * langue à l'autre. Et ce qui est entre `#` et `/#` est un tag.
 *
 * `visiter(texte, contexte)` reçoit le fragment débarrassé de ses espaces de
 * bord ; s'il rend une chaîne, elle remplace le fragment, espaces remis.
 */
export function parcourirLeRecit(recit, visiter) {
  const parcourir = (conteneur, contexte) => {
    const contenu = conteneur.slice(0, -1);
    let qui = contexte.qui;
    let dansTag = false;
    let dansStr = -1;

    for (let i = 0; i < contenu.length; i++) {
      const x = contenu[i];
      if (Array.isArray(x)) {
        parcourir(x, { ...contexte, qui });
        continue;
      }
      if (x === '#') dansTag = true;
      else if (x === '/#') dansTag = false;
      else if (x === 'str') dansStr = i;
      else if (x === '/str') {
        if (estUneOption(contenu, i)) {
          const debut = dansStr;
          let quiOption;
          let tag = false;
          for (let k = debut + 1; k < i; k++) {
            if (contenu[k] === '#') tag = true;
            else if (contenu[k] === '/#') tag = false;
            else if (tag && estTexte(contenu[k])) quiOption = locuteur(contenu[k]) ?? quiOption;
          }
          tag = false;
          for (let k = debut + 1; k < i; k++) {
            if (contenu[k] === '#') tag = true;
            else if (contenu[k] === '/#') tag = false;
            else if (!tag && estTexte(contenu[k])) {
              remplacer(conteneur, k, visiter, {
                knot: contexte.knot,
                qui: quiOption ?? null,
                option: quiOption ? 'replique' : 'geste',
              });
            }
          }
        }
        dansStr = -1;
      } else if (estTexte(x)) {
        if (dansTag) {
          if (dansStr < 0) {
            const l = locuteur(x);
            if (l !== undefined) qui = l;
          }
        } else if (dansStr < 0) {
          remplacer(conteneur, i, visiter, { knot: contexte.knot, qui, option: null });
        }
      }
    }
    for (const [nom, sous] of sousConteneurs(conteneur)) {
      parcourir(sous, { ...contexte, knot: contexte.knot ?? nom, qui });
    }
  };
  parcourir(recit.root, { knot: null, qui: null });
}

// Une chaîne évaluée est un libellé d'option si l'évaluation qu'elle ouvre se
// referme sur un point de choix — conditions d'apparition comprises, qui
// s'intercalent entre le `/str` et le `/ev`.
function estUneOption(contenu, fin) {
  for (let k = fin + 1; k < contenu.length; k++) {
    if (contenu[k] === '/ev') {
      const suivant = contenu[k + 1];
      return !!suivant && typeof suivant === 'object' && '*' in suivant;
    }
    if (contenu[k] === 'str') return false;
  }
  return false;
}

// `undefined` si le tag n'est pas un `qui:`, `null` pour la narration.
function locuteur(fragment) {
  const m = /^\^\s*qui\s*:\s*(.+?)\s*$/.exec(fragment);
  if (!m) return undefined;
  return NARRATION.has(m[1].toLowerCase()) ? null : m[1];
}

function remplacer(conteneur, i, visiter, contexte) {
  const brut = conteneur[i].slice(1);
  const texte = brut.trim();
  // Une espace seule sépare deux morceaux de logique, elle n'a rien à dire.
  if (!/[\p{L}\p{N}]|\.\.\.|…/u.test(texte)) return;
  const remplacement = visiter(texte, contexte);
  if (typeof remplacement !== 'string') return;
  const avant = brut.match(/^\s*/)[0];
  const apres = brut.match(/\s*$/)[0];
  conteneur[i] = `^${avant}${remplacement}${apres}`;
}

/** @returns {{ texte: string, references: string[], extraits: string[] }[]} */
export function textesDuRecit(recit) {
  const vus = new Map();
  parcourirLeRecit(recit, (texte, { knot, qui, option }) => {
    let e = vus.get(texte);
    if (!e) {
      e = { texte, references: [], extraits: [] };
      vus.set(texte, e);
    }
    if (knot && !e.references.includes(knot)) e.references.push(knot);
    const dit =
      option === 'geste'
        ? 'option du héros : un geste'
        : option === 'replique'
          ? `option prononcée par : ${qui}`
          : qui
            ? `dit par : ${qui}`
            : 'narration';
    if (!e.extraits.includes(dit)) e.extraits.push(dit);
  });
  return [...vus.values()];
}

// Le récit dans une autre langue : le même JSON, à ses textes près. La
// structure — knots, conditions, tags, chaînes de logique — ne bouge pas, donc
// tout ce que le jeu en attend vaut dans toutes les langues.
export function traduireLeRecit(recit, table) {
  const copie = structuredClone(recit);
  const manquants = new Set();
  parcourirLeRecit(copie, (texte) => {
    const traduit = table.get(texte);
    if (traduit) return traduit;
    manquants.add(texte);
    return undefined;
  });
  return { recit: copie, manquants: [...manquants] };
}

// ------------------------------------------------------------------
// L'interface
// ------------------------------------------------------------------

const MODULE_T = /(^|\/)traduire(\.ts)?$/;
const EXCLUS = [`src${sep}generated${sep}`, `src${sep}dev${sep}`];

function fichiersTs(dossier) {
  const tous = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) tous.push(...fichiersTs(chemin));
    else if (entree.name.endsWith('.ts') && !entree.name.endsWith('.d.ts')) tous.push(chemin);
  }
  return tous;
}

// Ce qui ressemble à du français : un accent, ou un mot outil entre deux espaces.
// Le filet des chaînes oubliées hors des endroits où un texte est sûr de
// s'afficher (voir `estAffiche`). « Georgia, serif » ou « Sine.easeInOut » n'ont
// ni l'un ni l'autre.
const FRANCAIS =
  /[À-ÖØ-öø-ÿŒœ]|(^|\s)(le|la|les|un|une|des|du|de|et|ou|à|au|pour|pas|ne|je|tu|il|elle|ce|est|sur|dans|avec|mon|ton|son)(\s|$)/i;
const LETTRES = /\p{L}/u;

// Les propriétés de données qui, dans ce projet, portent du texte affiché.
const CHAMPS_DE_TEXTE = new Set([
  'nom',
  'titre',
  'texte',
  'description',
  'title',
  'label',
  'invite',
  'puis',
]);
const ATTRIBUTS_DE_TEXTE = /\b(aria-label|alt|title|placeholder)\s*=\s*"([^"]*)"/g;

/**
 * Les textes de l'interface, et les fautes qui empêchent de les connaître tous.
 *
 * Un texte se déclare là où il s'écrit, par `t('…')`. Deux fautes :
 *   - `t()` sur autre chose qu'un littéral : on ne peut pas savoir quoi traduire ;
 *   - un texte affiché sans `t()` : c'est l'oubli que ce module existe pour
 *     éviter. Le filet est heuristique — HTML écrit dans un gabarit, attributs
 *     d'accessibilité, `textContent`, champs de données nommés `nom`, `titre`…,
 *     et toute chaîne qui a l'air française.
 *
 * Ne sont pas lus : src/dev (pages de réglage), src/generated, et le code sous
 * `import.meta.env.DEV`, qui n'existe pas dans le jeu livré.
 */
export function textesDeLInterface(racine) {
  const vus = new Map();
  const fautes = [];

  for (const fichier of fichiersTs(resolve(racine, 'src'))) {
    const rel = relative(racine, fichier);
    if (EXCLUS.some((e) => rel.startsWith(e))) continue;
    const code = readFileSync(fichier, 'utf8');
    const source = ts.createSourceFile(rel, code, ts.ScriptTarget.ES2022, true);
    const ligneDe = (n) => source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
    const fauter = (n, message) =>
      fautes.push({ fichier: rel.split(sep).join('/'), ligne: ligneDe(n), message });

    // Les noms sous lesquels ce fichier importe `t`.
    const noms = new Set();
    for (const st of source.statements) {
      if (!ts.isImportDeclaration(st) || !MODULE_T.test(st.moduleSpecifier.text)) continue;
      const liaisons = st.importClause?.namedBindings;
      if (liaisons && ts.isNamedImports(liaisons)) {
        for (const el of liaisons.elements) {
          if ((el.propertyName ?? el.name).text === 't') noms.add(el.name.text);
        }
      }
    }

    const declarer = (n, texte) => {
      const ref = rel.split(sep).join('/');
      let e = vus.get(texte);
      if (!e) {
        e = { texte, references: [], extraits: ['interface'] };
        vus.set(texte, e);
      }
      if (!e.references.includes(ref)) e.references.push(ref);
    };

    const visiter = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && noms.has(n.expression.text)) {
        const [arg] = n.arguments;
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
          declarer(arg, arg.text);
        } else {
          fauter(n, 't() attend un texte littéral : ce qui se calcule ne peut pas se traduire');
        }
        // Les valeurs d'un `{nom}` sont à vérifier comme le reste.
        n.arguments.slice(1).forEach((a) => ts.forEachChild(a, visiter));
        return;
      }
      if (horsDuJeu(n)) return;
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        verifierLitteral(n, n.text, fauter);
      } else if (ts.isTemplateExpression(n)) {
        const morceaux = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)];
        verifierLitteral(n, morceaux.join('\u0000'), fauter);
        n.templateSpans.forEach((s) => visiter(s.expression));
        return;
      }
      ts.forEachChild(n, visiter);
    };
    visiter(source);
  }

  return { textes: [...vus.values()], fautes };
}

// Ce qui ne s'affiche jamais : messages de console et d'erreur, types,
// importations, comparaisons, clés — et le code de développement.
function horsDuJeu(n) {
  if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return true;
  if (ts.isTypeNode(n) || ts.isCaseClause(n)) return true;
  if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && /Error$/.test(n.expression.text)) {
    return true;
  }
  if (ts.isThrowStatement(n)) return true;
  if (ts.isCallExpression(n)) {
    const appel = n.expression.getText();
    if (/^console\./.test(appel)) return true;
    // Les sélecteurs, les classes, les événements, les attributs techniques.
    if (
      /\.(querySelector|querySelectorAll|closest|addEventListener|removeEventListener|toggleAttribute|getItem|setItem|removeItem|matches|matchMedia|setProperty|getPropertyValue)$/.test(
        appel,
      ) ||
      /classList\.\w+$/.test(appel)
    ) {
      return true;
    }
  }
  if (
    ts.isBinaryExpression(n) &&
    [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(
      n.operatorToken.kind,
    )
  ) {
    return true;
  }
  if (ts.isIfStatement(n) && /import\.meta\.env\.DEV/.test(n.expression.getText())) return true;
  // `if (!import.meta.env.DEV) return …;` en tête de fonction : la suite est du
  // développement elle aussi.
  if (ts.isBlock(n) || ts.isSourceFile(n)) return false;
  const bloc = n.parent;
  if (bloc && ts.isBlock(bloc) && ts.isStatement(n)) {
    for (const st of bloc.statements) {
      if (st === n) break;
      if (
        ts.isIfStatement(st) &&
        /^!\s*import\.meta\.env\.DEV$/.test(st.expression.getText()) &&
        ts.isReturnStatement(st.thenStatement)
      ) {
        return true;
      }
    }
  }
  return false;
}

// Un shader : du GLSL dans un gabarit, dont les `<` ne sont pas du HTML et les
// commentaires, en français, ne s'affichent nulle part.
const GLSL = /gl_FragColor|#include|\bprecision\s+\w+p\b|\bvoid\s+main\b/;

// Pour une chaîne que le filet prend à tort pour un texte affiché : le dire sur
// sa ligne, ou sur la précédente, par un commentaire « hors traduction ».
const EXEMPTION = /\/\/.*\bhors traduction\b/;

// `texte` : les morceaux littéraux, joints par \0 là où s'intercale un `${…}`.
function verifierLitteral(n, texte, fauter) {
  if (!LETTRES.test(texte) || GLSL.test(texte)) return;
  const source = n.getSourceFile();
  const ligne = source.getLineAndCharacterOfPosition(n.getStart(source)).line;
  const lignes = source.text.split('\n');
  if (EXEMPTION.test(lignes[ligne] ?? '') || EXEMPTION.test(lignes[ligne - 1] ?? '')) return;
  const parent = n.parent;

  // Du HTML : ses nœuds texte et ses attributs d'accessibilité s'affichent.
  if (/<[a-z][^>]*>/i.test(texte)) {
    const sansCommentaires = texte.replace(/<!--[\s\S]*?-->/g, '');
    for (const [, , valeur] of sansCommentaires.matchAll(ATTRIBUTS_DE_TEXTE)) {
      if (LETTRES.test(valeur.replace(/\0/g, ''))) {
        fauter(n, `attribut affiché sans t() : « ${valeur} »`);
      }
    }
    const noeuds = sansCommentaires
      .replace(/<[^>]*>/g, '\u0000')
      .split('\u0000')
      .map((s) => s.trim())
      .filter((s) => LETTRES.test(s));
    for (const noeud of noeuds) fauter(n, `texte HTML sans t() : « ${noeud} »`);
    return;
  }

  const propre = texte.replace(/\0/g, ' ').trim();
  if (estAffiche(n, parent) || FRANCAIS.test(propre)) {
    fauter(n, `texte affiché sans t() : « ${propre} »`);
  }
}

// Les endroits où une chaîne est sûre de finir à l'écran.
function estAffiche(n, parent) {
  if (!parent) return false;
  if (ts.isPropertyAssignment(parent) && parent.initializer === n) {
    const nom = parent.name.getText().replace(/['"]/g, '');
    return CHAMPS_DE_TEXTE.has(nom);
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.right === n &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    return /\.(textContent|innerText|innerHTML|alt|title|ariaLabel)$/.test(parent.left.getText());
  }
  if (ts.isCallExpression(parent)) {
    const appel = parent.expression.getText();
    if (/\.(text|setText|append|say|redire)$/.test(appel)) return true;
    if (/\.setAttribute$/.test(appel) && parent.arguments[1] === n) {
      return /^['"](aria-label|alt|title|placeholder)['"]$/.test(parent.arguments[0].getText());
    }
  }
  return false;
}

// ------------------------------------------------------------------
// La tenue des catalogues
// ------------------------------------------------------------------

const ACCOLADES = /\{(\w+)\}/g;
const champsDe = (s) => [...s.matchAll(ACCOLADES)].map((m) => m[1]).sort();

// Bigrammes de lettres : de quoi reconnaître une réplique retouchée d'un mot,
// sans prendre pour elle une réplique voisine qui commence pareil.
function ressemblance(a, b) {
  const paires = (s) => {
    const t = s.toLowerCase().replace(/\s+/g, ' ');
    const m = new Map();
    for (let i = 0; i < t.length - 1; i++) {
      const p = t.slice(i, i + 2);
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  };
  const pa = paires(a);
  const pb = paires(b);
  let commun = 0;
  for (const [p, n] of pa) commun += Math.min(n, pb.get(p) ?? 0);
  const total = Math.max(1, a.length - 1 + (b.length - 1));
  return (2 * commun) / total;
}
const SEUIL_DE_RESSEMBLANCE = 0.6;

/**
 * Le catalogue d'une langue, remis d'accord avec les textes du jeu.
 *
 * Une traduction existante est gardée telle quelle, ses commentaires de
 * traducteur aussi ; le contexte (`#.`, `#:`) est réécrit. Un texte nouveau
 * arrive vide — ou, s'il ressemble à un texte disparu, pré-rempli de son
 * ancienne traduction et marqué à revoir. Ce qui a disparu du jeu est retiré.
 */
export function accorder(entreesActuelles, textes) {
  const actuelles = new Map(entreesActuelles.map((e) => [e.msgid, e]));
  const presents = new Set(textes.map((t) => t.texte));
  const orphelines = entreesActuelles.filter((e) => !presents.has(e.msgid) && e.msgstr);
  const bilan = { nouveaux: [], aRevoir: [], retires: [] };

  const entrees = textes.map(({ texte, references, extraits }) => {
    const connue = actuelles.get(texte);
    if (connue) {
      return { ...connue, references, extraits, drapeaux: new Set(connue.drapeaux) };
    }
    let meilleure = null;
    let score = SEUIL_DE_RESSEMBLANCE;
    for (const o of orphelines) {
      const s = ressemblance(o.msgid, texte);
      if (s > score) {
        score = s;
        meilleure = o;
      }
    }
    if (meilleure) {
      orphelines.splice(orphelines.indexOf(meilleure), 1);
      bilan.aRevoir.push(texte);
      return {
        msgid: texte,
        msgstr: meilleure.msgstr,
        commentaires: meilleure.commentaires,
        extraits,
        references,
        drapeaux: new Set(['fuzzy']),
        precedent: meilleure.msgid,
      };
    }
    bilan.nouveaux.push(texte);
    return {
      msgid: texte,
      msgstr: '',
      commentaires: [],
      extraits,
      references,
      drapeaux: new Set(),
      precedent: null,
    };
  });

  for (const e of entreesActuelles) if (!presents.has(e.msgid)) bilan.retires.push(e.msgid);
  return { entrees, bilan };
}

/** Ce qui empêche une langue d'être livrée complète. */
export function problemes(entrees, textes) {
  const presents = new Set(textes.map((t) => t.texte));
  const connues = new Set(entrees.map((e) => e.msgid));
  const liste = [];
  for (const t of textes) {
    if (!connues.has(t.texte)) liste.push({ genre: 'absent', texte: t.texte });
  }
  for (const e of entrees) {
    if (!presents.has(e.msgid)) liste.push({ genre: 'obsolete', texte: e.msgid });
    else if (!e.msgstr) liste.push({ genre: 'vide', texte: e.msgid });
    else if (e.drapeaux.has('fuzzy')) liste.push({ genre: 'a-revoir', texte: e.msgid });
    else if (champsDe(e.msgid).join() !== champsDe(e.msgstr).join()) {
      liste.push({ genre: 'champs', texte: e.msgid, detail: e.msgstr });
    }
  }
  return liste;
}
