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

// Le zoom d'aller-retour d'un marqueur qui suit son objet. Assez court pour ne
// pas retarder le mouvement qu'il annonce, assez long pour qu'on le voie partir.
const ESCAMOTAGE_MS = 180;

// Un marqueur endormi reste à sa place — la zone existe toujours — mais ne bat
// plus et perd sa couleur : c'est ce qui distingue « rien à faire pour
// l'instant » de « rien ici ».
const GRIS = 0x9c968c;
const ALPHA_ENDORMI = 0.4;

// De quoi endormir un marqueur : son battement, le pliage à griser, et la pose
// où l'arrêter. La pose est enregistrée et non relevée au moment venu : figé en
// cours de tween, le marqueur reste penché ou à moitié transparent, ce qui se
// lit comme un défaut d'affichage plutôt que comme une pause.
//
// Endormi et escamoté sont deux états distincts et cumulables — le premier dit
// « pas maintenant », le second « plus ici » —, et ils se disputent l'échelle du
// conteneur : d'où les deux drapeaux, sans lesquels un réveil ferait réapparaître
// un marqueur parti avec son objet.
interface Battement {
  tween?: Phaser.Tweens.Tween;
  dessin: Phaser.GameObjects.Image;
  x: number;
  endormi: boolean;
  escamote: boolean;
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
  marqueur.setData(CLE, { dessin, x, endormi: false, escamote: false } satisfies Battement);
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

  battement.endormi = endormi;

  if (endormi) {
    battement.tween?.pause();
    marqueur.setPosition(battement.x, marqueur.y).setAngle(0).setAlpha(ALPHA_ENDORMI);
    // Un marqueur escamoté n'a pas d'échelle de repos : la lui reposer le ferait
    // rentrer dans le cadre le temps du trajet, à l'endroit que son objet quitte.
    if (!battement.escamote) marqueur.setScale(1);
    battement.dessin.setTint(GRIS);
    return;
  }
  battement.dessin.clearTint();
  // Escamoté, il se réveillera en réapparaissant, pas avant.
  if (battement.escamote) return;
  marqueur.setAlpha(1);
  // Repris là où il s'était arrêté, le tween reposerait d'un coup la valeur
  // qu'il avait en s'endormant, et le marqueur sauterait. Il repart donc du
  // début de son cycle.
  battement.tween?.restart();
}

// Le marqueur d'un objet qui se déplace part avec lui — mais pas en le suivant :
// une cocotte qui court après le Petit Chat se lit comme un bug, et le battement
// pilote déjà sa position. Elle se retire donc avant le trajet et revient à
// l'arrivée, sur l'emprise que la scène vient de recaler.
//
// La promesse se dénoue à la fin du zoom ; `duree` à zéro pose l'état sans
// animation, pour un marqueur refait pendant que son objet est en route.
export function escamoterMarqueur(
  marqueur: Phaser.GameObjects.Container,
  escamote: boolean,
  duree = ESCAMOTAGE_MS,
): Promise<void> {
  const battement = marqueur.getData(CLE) as Battement | undefined;
  if (!battement) return Promise.resolve();
  battement.escamote = escamote;
  // Le battement anime la même échelle : le laisser tourner rendrait le zoom
  // illisible, et reposerait le marqueur au cycle suivant.
  battement.tween?.pause();

  const cible = escamote ? 0 : 1;
  const finir = () => {
    if (!escamote) endormirMarqueur(marqueur, battement.endormi);
  };

  if (duree === 0) {
    marqueur.setScale(cible);
    finir();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    marqueur.scene.tweens.add({
      targets: marqueur,
      scaleX: cible,
      scaleY: cible,
      duration: duree,
      // Le léger dépassement dit « objet posé » plutôt que « objet effacé ».
      ease: escamote ? 'Back.easeIn' : 'Back.easeOut',
      onComplete: () => {
        finir();
        resolve();
      },
    });
  });
}

export function estEscamote(marqueur: Phaser.GameObjects.Container): boolean {
  return (marqueur.getData(CLE) as Battement | undefined)?.escamote ?? false;
}
