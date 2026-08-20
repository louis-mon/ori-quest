import Phaser from 'phaser';
import type { Box } from './layout';
import { apercuOrigami } from '../../origami/apercu';
import { echelleDe } from '../../origami/vue';

/**
 * Un origami plié, posé dans le décor.
 *
 * Ce qui est affiché est **le modèle lui-même**, rendu depuis le `.origami` que
 * le joueur vient de voir se plier — pas une illustration qui lui ressemble.
 * Les dessins d'appoint qui tenaient la place ici (une gouttière pour le pont,
 * un arbre mort au trait, deux battants nervurés) finissaient par ne plus rien
 * avoir de commun avec le pliage : on regardait une animation, et la scène
 * montrait autre chose.
 *
 * **Le rendu n'est demandé qu'à la première apparition**, d'où `montrer()`
 * plutôt qu'un `setVisible()` direct. Un pont et un arbre rendus à l'ouverture
 * de la première scène, alors que rien n'est encore plié, feraient télécharger
 * three.js (~190 Ko gzip) avant le premier écran — exactement ce que le
 * chargement différé de la couche de pliage cherche à éviter.
 */

const cle = (nom: string) => `origami:${nom}`;

export interface OptionsOrigamiDecor {
  /**
   * Où le modèle se cale dans sa boîte.
   *
   * `bas` par défaut, comme les sprites : une boîte de plan est une emprise au
   * sol. `centre` sert à ce qui n'est posé sur rien — le pont, qui doit rester
   * centré sur le ravin quelle que soit la hauteur que prend son rendu.
   */
  ancrage?: 'bas' | 'centre';
}

export interface OrigamiDecor {
  /** L'objet Phaser, pour la profondeur ou un réglage ponctuel. */
  image: Phaser.GameObjects.Image;
  /** Montre ou cache le modèle. Le rendu part à la première apparition. */
  montrer(visible: boolean): void;
}

/**
 * Pose le modèle `nom` dans la boîte `box`, calé sur le **bas** — une boîte de
 * plan est une emprise au sol, comme pour les sprites de personnages.
 *
 * `onPose` reçoit l'emprise réellement occupée une fois l'image arrivée : c'est
 * elle, et non la boîte du plan, qui doit servir de zone tactile.
 */
export function poserOrigami(
  scene: Phaser.Scene,
  nom: string,
  box: Box,
  onPose?: (emprise: Box) => void,
  options: OptionsOrigamiDecor = {},
): OrigamiDecor {
  const auCentre = options.ancrage === 'centre';

  // `__DEFAULT` est la texture vide de Phaser : l'objet existe et se place
  // normalement, mais ne dessine rien tant que le rendu n'est pas là.
  const image = scene.add
    .image(box.x + box.w / 2, auCentre ? box.y + box.h / 2 : box.y + box.h, '__DEFAULT')
    .setOrigin(0.5, auCentre ? 0.5 : 1)
    .setVisible(false);

  let demande = false;

  const rendre = () => {
    demande = true;
    apercuOrigami(nom)
      .then((canvas) => {
        // La scène a pu être quittée pendant le rendu : Phaser met `scene` à
        // `undefined` en détruisant l'objet, et toucher à sa texture planterait.
        if (!image.scene) return;

        const nomTexture = cle(nom);
        if (!scene.textures.exists(nomTexture)) scene.textures.addCanvas(nomTexture, canvas);
        image.setTexture(nomTexture);

        // Comme `placeSprite` : le modèle tient **entièrement** dans la boîte,
        // sans déformation. Un origami étiré ne ressemble plus à du papier.
        //
        // Puis l'échelle propre au modèle (`POSES`), qui rattrape ce que
        // l'ajustement ne sait pas faire : une silhouette longue et fine
        // n'occupe qu'une fraction de son emprise, et se retrouve minuscule à
        // côté d'une silhouette carrée logée dans la même boîte.
        const echelle = Math.min(box.w / canvas.width, box.h / canvas.height) * echelleDe(nom);
        image.setScale(echelle);

        const w = canvas.width * echelle;
        const h = canvas.height * echelle;
        onPose?.({
          x: image.x - w / 2,
          y: auCentre ? image.y - h / 2 : box.y + box.h - h,
          w,
          h,
        });
      })
      .catch((err) => {
        // Un modèle manquant laisse un trou dans le décor, jamais une scène
        // cassée : la progression, elle, ne dépend que des drapeaux.
        console.error(`[origami] rendu de "${nom}" impossible`, err);
      });
  };

  return {
    image,
    montrer(visible) {
      image.setVisible(visible);
      if (visible && !demande) rendre();
    },
  };
}
