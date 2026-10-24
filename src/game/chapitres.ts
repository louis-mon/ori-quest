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
// pas toujours les mêmes : un chapitre peut s'embarquer, pour qu'on l'essaie,
// sans être raccordé.
//
// Une destination hors de portée n'est donc pas une faute de frappe : le jeu
// s'y termine, sur « À suivre… » (src/ui/fin.ts).

type ClasseDeScene = new () => Phaser.Scene;

interface Chapitre {
  // Pour qui lit ce fichier : le joueur ne le voit nulle part. Les noms qu'affiche
  // le menu des points d'étape sont ceux de src/game/systems/etapes.ts.
  nom: string;
  // Clé Phaser -> classe, dans l'ordre de traversée : la première scène est le
  // point d'entrée du chapitre.
  scenes: Record<string, ClasseDeScene>;
}

const CHAPITRES: Chapitre[] = [
  {
    nom: 'Le ravin et la porte', // hors traduction
    scenes: { pont: PontScene, porte: PorteScene },
  },
  {
    nom: 'Le village et le château', // hors traduction
    scenes: { village: VillageScene, entree: EntreeScene },
  },
  {
    nom: 'La salle du trône', // hors traduction
    scenes: { trone: TroneScene, cuisine: CuisineScene, jardin: JardinScene },
  },
];

// Toutes les scènes sont embarquées, et le menu des points d'étape mène à
// chaque chapitre (src/game/systems/etapes.ts).
const LIVRES = CHAPITRES;

// La traversée va jusqu'au bout : la fin du chapitre 3 est celle de l'histoire
// (`# fin:`). Un chapitre ajouté plus loin reste donc hors traversée tant que
// cet index ne bouge pas — on veut bien qu'on aille l'essayer, pas qu'un joueur
// du récit y débarque sans l'avoir demandé.
//
// Index du premier chapitre qui n'est plus relié au suivant. La narration, elle,
// ignore tout de ce réglage : son knot de fin de chapitre se joue en entier de
// toute façon.
const DERNIER_TRAVERSE = 2;

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
// ⚠ Le test porte sur le FRANCHISSEMENT, pas sur la seule destination : dans un
// chapitre hors traversée, revenir à sa première pièce depuis la deuxième est un
// déplacement interne. Sur la destination seule, la première flèche finirait la
// partie et enfermerait le testeur dans la scène voisine.
export function sortDeLaTraversee(depuis: string, vers: string): boolean {
  const de = chapitreDe(depuis);
  return de >= DERNIER_TRAVERSE && chapitreDe(vers) > de;
}
