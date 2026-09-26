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

// Le zoom d'un marqueur qui part ou revient. Assez court pour ne pas retarder le
// mouvement qu'il annonce, assez long pour qu'on le voie partir.
export const ZOOM_MS = 180;

// Deux conteneurs l'un dans l'autre : le battement anime celui de l'intérieur,
// le zoom celui de l'extérieur. Sur un seul, ils se disputaient l'échelle — il
// fallait figer le battement pour zoomer, et le marqueur sautait en le reprenant.
interface Zoom {
  interieur: Phaser.GameObjects.Container;
  // Là où le zoom l'emmène, pas là où il en est.
  montre: boolean;
}

const CLE = 'zoom';

// Chemin relatif : itch.io sert le jeu depuis un sous-dossier.
export function preloadMarqueur(scene: Phaser.Scene, key: string, fichier: string): void {
  if (scene.textures.exists(key)) return;
  scene.load.image(key, fichier);
}

// `hauteur` est la taille voulue en pixels du jeu ; le fichier est livré en
// double densité pour rester net sur un téléphone.
//
// Il naît retiré : c'est la scène qui décide quand il paraît.
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

  // Dans le conteneur qui bat, pour que l'ombre suive le pliage au lieu de se
  // décoller de lui.
  const ombre = scene.add
    .image(0, OMBRE_DESCENTE, texture)
    .setScale(echelle * OMBRE_DILATATION)
    .setTint(COLORS.ink)
    .setAlpha(OMBRE_ALPHA)
    .setFlipX(miroir);
  const dessin = scene.add.image(0, 0, texture).setScale(echelle).setFlipX(miroir);
  const interieur = scene.add.container(0, 0, [ombre, dessin]);

  const marqueur = scene.add
    .container(x, y, [interieur])
    .setDepth(PROFONDEUR)
    .setScale(0)
    .setVisible(false);
  marqueur.setData(CLE, { interieur, montre: false } satisfies Zoom);
  return marqueur;
}

// Le battement, en coordonnées locales : il ne touche jamais au zoom.
export function battre(
  marqueur: Phaser.GameObjects.Container,
  config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>,
): void {
  const zoom = marqueur.getData(CLE) as Zoom | undefined;
  if (!zoom) return;
  marqueur.scene.tweens.add({ targets: zoom.interieur, ...config });
}

// Paraître ou se retirer. Sans effet quand le marqueur va déjà là où on
// l'envoie : la scène le redemande à chaque changement d'état.
//
// Repart de la taille du moment, pour une durée proportionnelle à ce qui reste :
// un retrait interrompu par un retour ne saute pas.
export function montrerMarqueur(marqueur: Phaser.GameObjects.Container, montre: boolean): void {
  const zoom = marqueur.getData(CLE) as Zoom | undefined;
  if (!zoom || zoom.montre === montre) return;
  zoom.montre = montre;

  const tweens = marqueur.scene.tweens;
  tweens.killTweensOf(marqueur);
  const cible = montre ? 1 : 0;
  const reste = Math.abs(cible - marqueur.scaleX);
  if (reste === 0) {
    marqueur.setVisible(montre);
    return;
  }

  marqueur.setVisible(true);
  tweens.add({
    targets: marqueur,
    scaleX: cible,
    scaleY: cible,
    duration: ZOOM_MS * Math.min(reste, 1),
    // Le léger dépassement dit « objet posé » plutôt que « objet effacé ».
    ease: montre ? 'Back.easeOut' : 'Back.easeIn',
    onComplete: () => marqueur.setVisible(montre),
  });
}

export function estMontre(marqueur: Phaser.GameObjects.Container): boolean {
  return (marqueur.getData(CLE) as Zoom | undefined)?.montre ?? false;
}

// Un marqueur refait — son emprise a changé — reprend là où l'ancien en était :
// refait entier, il annulerait un retrait en cours ; refait à zéro, il
// clignoterait.
export function succeder(
  nouveau: Phaser.GameObjects.Container,
  ancien: Phaser.GameObjects.Container,
): void {
  const zoom = nouveau.getData(CLE) as Zoom | undefined;
  if (!zoom) return;
  const montre = estMontre(ancien);
  nouveau.setScale(ancien.scaleX).setVisible(ancien.visible);
  // Posé à l'inverse, pour que la demande reparte d'ici vers la même cible.
  zoom.montre = !montre;
  montrerMarqueur(nouveau, montre);
}

// Le battement vise le conteneur intérieur : détruire le marqueur sans l'arrêter
// laisserait un tween sur un objet détruit.
export function detruireMarqueur(marqueur: Phaser.GameObjects.Container): void {
  const zoom = marqueur.getData(CLE) as Zoom | undefined;
  const tweens = marqueur.scene?.tweens;
  tweens?.killTweensOf(marqueur);
  if (zoom) tweens?.killTweensOf(zoom.interieur);
  marqueur.destroy();
}
