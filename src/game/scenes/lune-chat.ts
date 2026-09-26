import Phaser from 'phaser';
import { preloadSprite } from './decor-sprite';
import type { Box } from './layout';

// Le Chat Mal Luné, commun à la salle du trône et à la cuisine. Assis sur sa
// lune, il ne touche pas terre : il flotte au-dessus du sol.
//
// Sa boîte de plan reste une emprise au sol, comme les autres : le bas est le
// point d'appui, là où se pose l'ombre, et le pliage flotte au-dessus. C'est ce
// point que `deplacer()` emmène, et d'où partent ses chemins.

const TEXTURE = 'lune_chat';
const FICHIER = 'assets/decor/lune_chat.png';
const OMBRE = 'ombre-douce';

// Le vide sous la lune, en fraction de sa hauteur.
const ECART = 0.2;
// Le flottement : son amplitude, en fraction de la hauteur, et sa période.
// Lent, pour ne pas disputer l'attention aux marqueurs.
const AMPLITUDE = 0.035;
const PERIODE_MS = 2600;

export interface LuneChat {
  // Ce qu'on déplace, montre ou cache.
  conteneur: Phaser.GameObjects.Container;
  // Le pliage au repos, sans l'ombre ni le flottement : c'est la zone tactile.
  emprise(): Box;
}

export function preloadLuneChat(scene: Phaser.Scene): void {
  preloadSprite(scene, TEXTURE, FICHIER);
}

export function placerLuneChat(scene: Phaser.Scene, box: Box): LuneChat {
  const source = scene.textures.get(TEXTURE).getSourceImage();
  const echelle = Math.min(box.w / source.width, box.h / (source.height * (1 + ECART)));
  const w = source.width * echelle;
  const h = source.height * echelle;
  const vol = h * ECART;

  const ombre = scene.add.image(0, 0, ombreDouce(scene)).setDisplaySize(w * 0.8, h * 0.09);
  const chat = scene.add.image(0, -vol, TEXTURE).setOrigin(0.5, 1).setScale(echelle);
  const conteneur = scene.add.container(box.x + box.w / 2, box.y + box.h, [ombre, chat]);

  // Des tweens et non un écouteur d'`update` : ils meurent avec la scène.
  const flottement = {
    duration: PERIODE_MS / 2,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  };
  scene.tweens.add({ targets: chat, y: -vol - h * AMPLITUDE, ...flottement });
  // Plus il monte, plus son ombre se resserre et pâlit.
  scene.tweens.add({ targets: ombre, scaleX: ombre.scaleX * 0.82, alpha: 0.65, ...flottement });

  return {
    conteneur,
    emprise: () => ({ x: conteneur.x - w / 2, y: conteneur.y - vol - h, w, h }),
  };
}

// Floue, parce qu'une ombre nette collerait au sol ce qui doit en être détaché.
// Peinte une fois : les textures survivent au changement de pièce.
function ombreDouce(scene: Phaser.Scene): string {
  if (scene.textures.exists(OMBRE)) return OMBRE;
  const taille = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = taille;
  const ctx = canvas.getContext('2d')!;
  const halo = ctx.createRadialGradient(taille / 2, taille / 2, 0, taille / 2, taille / 2, taille / 2);
  halo.addColorStop(0, 'rgba(26, 23, 20, 0.5)');
  halo.addColorStop(1, 'rgba(26, 23, 20, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, taille, taille);
  scene.textures.addCanvas(OMBRE, canvas);
  return OMBRE;
}
