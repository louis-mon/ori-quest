import type Phaser from 'phaser';
import { PontScene } from './scenes/pont-scene';
import { PorteScene } from './scenes/porte-scene';
import { VillageScene } from './scenes/village-scene';
import { EntreeScene } from './scenes/entree-scene';

// Le registre des chapitres, annoncé dans game-design/02-chapitres-et-scenes.md.
// Il répond à deux questions, et il est seul à y répondre : quelles scènes
// existent dans cette version du jeu, et jusqu'où va la traversée. C'était la
// même réponse tant que le chapitre 2 restait dehors ; les deux se séparent
// depuis qu'il s'embarque sans se raccorder.
//
// Une destination hors de portée n'est donc pas une faute de frappe : le jeu
// s'y termine, sur « À suivre… » (src/ui/fin.ts).

type ClasseDeScene = new () => Phaser.Scene;

interface Chapitre {
  nom: string;
  // Clé Phaser -> classe, dans l'ordre de traversée : la première scène est le
  // point d'entrée du chapitre.
  scenes: Record<string, ClasseDeScene>;
}

const CHAPITRES: Chapitre[] = [
  {
    nom: 'Le ravin et la porte',
    scenes: { pont: PontScene, porte: PorteScene },
  },
  {
    nom: 'Le village et le château',
    scenes: { village: VillageScene, entree: EntreeScene },
  },
];

// Les quatre scènes sont embarquées : le chapitre 2 se joue de bout en bout, et
// le menu des points d'étape y dépose le testeur (src/game/systems/etapes.ts).
const LIVRES = CHAPITRES;

// Mais la traversée, elle, s'arrête toujours à la fin du chapitre 1 : franchir
// la porte pose « À suivre… » au lieu d'ouvrir le village. Les décors du
// chapitre 2 sont encore provisoires — on veut bien qu'on aille l'essayer, pas
// qu'un joueur du récit y débarque sans l'avoir demandé.
//
// Index du dernier chapitre relié au suivant. La narration, elle, ignore tout de
// ce réglage : son knot de fin de chapitre se joue en entier de toute façon.
const DERNIER_TRAVERSE = 0;

function chapitreDe(piece: string): number {
  return CHAPITRES.findIndex((chapitre) => piece in chapitre.scenes);
}

// Les scènes à enregistrer dans Phaser, dans l'ordre de jeu.
export function scenesLivrees(): [string, ClasseDeScene][] {
  return LIVRES.flatMap((chapitre) => Object.entries(chapitre.scenes));
}

export function estLivree(piece: string): boolean {
  return LIVRES.some((chapitre) => piece in chapitre.scenes);
}

// Vrai quand aller de `depuis` à `vers` quitte la traversée livrée.
//
// ⚠ Le test porte sur le FRANCHISSEMENT, pas sur la seule destination : le
// village est hors traversée, mais y revenir depuis l'entrée du château est un
// déplacement interne au chapitre 2. Sur la destination seule, la flèche de
// gauche finirait la partie et enfermerait le testeur dans la seconde scène.
export function sortDeLaTraversee(depuis: string, vers: string): boolean {
  return chapitreDe(depuis) <= DERNIER_TRAVERSE && chapitreDe(vers) > DERNIER_TRAVERSE;
}
