import Phaser from 'phaser';
import { COLORS } from '../config';

// Le socle des deux marqueurs (game-design/03-langage-visuel.md) : un origami de
// l'artiste posé au-dessus du décor.
//
// L'ombre n'est pas décorative : ces deux pliages sont en papier clair, et posés
// sur une rive au soleil ils disparaissaient — alors qu'ils sont le seul signe
// qui dise au joueur qu'il peut agir.

// Dilatation de l'ombre : ce qui en dépasse fait le liseré.
const OMBRE_DILATATION = 1.12;
const OMBRE_ALPHA = 0.5;
// En pixels du jeu : le marqueur flotte sur le décor.
const OMBRE_DESCENTE = 3;

// Au-dessus de tout le décor.
export const PROFONDEUR = 50;

// Un marqueur endormi reste à sa place — la zone existe toujours — mais ne bat
// plus et perd sa couleur : c'est ce qui distingue « rien à faire pour
// l'instant » de « rien ici ».
const GRIS = 0x9c968c;
const ALPHA_ENDORMI = 0.4;

// De quoi endormir un marqueur : son battement, le pliage à griser, et la pose
// où l'arrêter. La pose est enregistrée et non relevée au moment venu : figé en
// cours de tween, le marqueur reste penché ou à moitié transparent, ce qui se
// lit comme un défaut d'affichage plutôt que comme une pause.
interface Battement {
  tween?: Phaser.Tweens.Tween;
  dessin: Phaser.GameObjects.Image;
  x: number;
}

const CLE = 'battement';

// Chemin relatif : itch.io sert le jeu depuis un sous-dossier.
export function preloadMarqueur(scene: Phaser.Scene, key: string, fichier: string): void {
  if (scene.textures.exists(key)) return;
  scene.load.image(key, fichier);
}

// C'est le conteneur qui s'anime, donc l'ombre suit le pliage au lieu de se
// décoller de lui. `hauteur` est la taille voulue en pixels du jeu ; le fichier
// est livré en double densité pour rester net sur un téléphone.
export function creerMarqueur(
  scene: Phaser.Scene,
  texture: string,
  x: number,
  y: number,
  hauteur: number,
  miroir = false,
): Phaser.GameObjects.Container {
  const source = scene.textures.get(texture).getSourceImage();
  const echelle = hauteur / source.height;

  const ombre = scene.add
    .image(0, OMBRE_DESCENTE, texture)
    .setScale(echelle * OMBRE_DILATATION)
    .setTint(COLORS.ink)
    .setAlpha(OMBRE_ALPHA)
    .setFlipX(miroir);

  const dessin = scene.add.image(0, 0, texture).setScale(echelle).setFlipX(miroir);

  const marqueur = scene.add.container(x, y, [ombre, dessin]).setDepth(PROFONDEUR);
  marqueur.setData(CLE, { dessin, x } satisfies Battement);
  return marqueur;
}

// Le battement passe par ici plutôt que par `scene.tweens.add` : c'est ce qui
// permet de l'arrêter et de le reprendre sans que l'appelant ait à le garder.
export function battre(
  marqueur: Phaser.GameObjects.Container,
  config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>,
): void {
  const battement = marqueur.getData(CLE) as Battement | undefined;
  if (!battement) return;
  battement.tween = marqueur.scene.tweens.add({ targets: marqueur, ...config });
}

// Appelé par `PointClickScene` pendant un déplacement bloquant, et remis à
// l'endroit dès qu'il finit — voir `attentes` là-bas.
export function endormirMarqueur(marqueur: Phaser.GameObjects.Container, endormi: boolean): void {
  const battement = marqueur.getData(CLE) as Battement | undefined;
  if (!battement) return;

  if (endormi) {
    battement.tween?.pause();
    marqueur.setPosition(battement.x, marqueur.y).setScale(1).setAngle(0).setAlpha(ALPHA_ENDORMI);
    battement.dessin.setTint(GRIS);
    return;
  }
  battement.dessin.clearTint();
  marqueur.setAlpha(1);
  // Repris là où il s'était arrêté, le tween reposerait d'un coup la valeur
  // qu'il avait en s'endormant, et le marqueur sauterait. Il repart donc du
  // début de son cycle.
  battement.tween?.restart();
}
