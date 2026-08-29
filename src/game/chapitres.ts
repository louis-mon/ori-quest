import type Phaser from 'phaser';
import { PontScene } from './scenes/pont-scene';
import { PorteScene } from './scenes/porte-scene';
import { VillageScene } from './scenes/village-scene';
import { EntreeScene } from './scenes/entree-scene';

// Le registre des chapitres, annoncé dans game-design/02-chapitres-et-scenes.md.
// Il répond à deux questions, et il est seul à y répondre : quelles scènes
// existent dans cette version du jeu, et où celle-ci s'arrête.
//
// Une destination qui n'est pas livrée n'est donc pas une faute de frappe : le
// jeu s'y termine, sur « À suivre… » (src/ui/fin.ts).

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

// Le chapitre 2 se joue de bout en bout, mais son texte est un premier jet (les
// « À ÉCRIRE » de content/story.ink) et ses deux scènes attendent leur fond
// peint : il reste au développement, et le build publié sur itch.io s'arrête à
// la fin du chapitre 1.
//
// Une seule ligne à changer le jour où il est prêt — et rien à toucher dans la
// narration, qui ignore quels chapitres ont été compilés.
const LIVRES = CHAPITRES.slice(0, import.meta.env.DEV ? CHAPITRES.length : 1);

// Les scènes à enregistrer dans Phaser, dans l'ordre de jeu.
export function scenesLivrees(): [string, ClasseDeScene][] {
  return LIVRES.flatMap((chapitre) => Object.entries(chapitre.scenes));
}

export function estLivree(piece: string): boolean {
  return LIVRES.some((chapitre) => piece in chapitre.scenes);
}
