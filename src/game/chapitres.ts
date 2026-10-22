import type Phaser from 'phaser';
import { PontScene } from './scenes/pont-scene';
import { PorteScene } from './scenes/porte-scene';
import { VillageScene } from './scenes/village-scene';
import { EntreeScene } from './scenes/entree-scene';
import { TroneScene } from './scenes/trone-scene';
import { CuisineScene } from './scenes/cuisine-scene';
import { JardinScene } from './scenes/jardin-scene';

// Le registre des chapitres, annoncé dans game-design/02-chapitres-et-scenes.md.
// Il répond à deux questions, et il est seul à y répondre : quelles scènes
// existent dans cette version du jeu, et jusqu'où va la traversée. Ce ne sont
// pas les mêmes : le chapitre 3 s'embarque sans se raccorder.
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
  {
    nom: 'La salle du trône',
    scenes: { trone: TroneScene, cuisine: CuisineScene, jardin: JardinScene },
  },
];

// Toutes les scènes sont embarquées : le chapitre 3 se joue de bout en bout, et
// le menu des points d'étape y dépose le testeur (src/game/systems/etapes.ts).
const LIVRES = CHAPITRES;

// Mais la traversée, elle, s'arrête pour l'instant à la fin du chapitre 2 : la
// porte du château pose « À suivre… » au lieu d'ouvrir la salle du trône. Le
// chapitre 3 attend le fond de sa cuisine — on veut bien qu'on aille l'essayer,
// pas qu'un joueur du récit y débarque sans l'avoir demandé.
//
// Index du premier chapitre qui n'est plus relié au suivant. La narration, elle,
// ignore tout de ce réglage : son knot de fin de chapitre se joue en entier de
// toute façon. Le texte de l'écran, lui, nomme ce chapitre (src/ui/fin.ts).
const DERNIER_TRAVERSE = 1;

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

// Vrai quand aller de `depuis` à `vers` passe à un chapitre suivant que la
// traversée livrée ne relie pas.
//
// ⚠ Le test porte sur le FRANCHISSEMENT, pas sur la seule destination : la
// salle du trône est hors traversée, mais y revenir depuis la cuisine est un
// déplacement interne au chapitre 3. Sur la destination seule, la première
// flèche finirait la partie et enfermerait le testeur dans la scène voisine.
export function sortDeLaTraversee(depuis: string, vers: string): boolean {
  const de = chapitreDe(depuis);
  return de >= DERNIER_TRAVERSE && chapitreDe(vers) > de;
}
