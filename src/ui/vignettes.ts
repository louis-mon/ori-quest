import { objet, type Dessin } from '../game/systems/objets';
import { urlApercuOrigami } from '../origami/apercu';

/**
 * La vignette d'un objet d'inventaire.
 *
 * Deux sources, et une règle : **tout ce qui est un pliage se montre par son
 * modèle**. La vignette d'une idée et le but affiché pendant l'énigme sont donc
 * la même image, et l'objet obtenu la garde — le joueur suit un seul dessin de
 * « je sais faire ça » jusqu'à « j'ai ça ».
 *
 * Le reste est dessiné ici, au canvas, pour les mêmes raisons que les textures
 * de papier : quelques lignes plutôt qu'un PNG à télécharger.
 */

/** Côté de la vignette, en pixels. Elle s'affiche à ~48 px. */
const TAILLE = 128;

const vignettes = new Map<string, Promise<string | null>>();

/**
 * URL de la vignette d'un objet, ou `null` s'il n'en a pas.
 *
 * Le résultat est mis en cache par identifiant : l'inventaire est redessiné à
 * chaque changement d'état, et rendre un modèle 3D à chaque fois serait absurde.
 */
export function vignette(id: string): Promise<string | null> {
  let promesse = vignettes.get(id);
  if (!promesse) {
    promesse = resoudre(id);
    vignettes.set(id, promesse);
  }
  return promesse;
}

async function resoudre(id: string): Promise<string | null> {
  const { modele, dessin } = objet(id);
  if (modele) {
    try {
      return await urlApercuOrigami(modele, { taille: TAILLE * 2 });
    } catch (err) {
      // Une vignette manquante laisse la case au seul nom de l'objet, ce qui
      // reste parfaitement jouable.
      console.error(`[objet] vignette de "${id}" impossible`, err);
      return null;
    }
  }
  if (dessin) return dessiner(dessin);
  return null;
}

const DESSINS: Record<Dessin, (ctx: CanvasRenderingContext2D) => void> = {
  /**
   * Du bois : trois rondins vus en bout, empilés.
   *
   * Les cernes concentriques sont ce qui fait lire « bois coupé » plutôt que
   * « cailloux » à 48 px — c'est le seul détail qu'on garde à cette taille.
   */
  bois: (ctx) => {
    const rondin = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = '#8a6440';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#59402a';
      ctx.lineWidth = TAILLE * 0.018;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(89, 64, 42, 0.6)';
      ctx.lineWidth = TAILLE * 0.014;
      for (const part of [0.68, 0.42, 0.18]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * part, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const r = TAILLE * 0.2;
    rondin(TAILLE * 0.32, TAILLE * 0.66, r);
    rondin(TAILLE * 0.68, TAILLE * 0.66, r);
    rondin(TAILLE * 0.5, TAILLE * 0.34, r);
  },
};

function dessiner(nom: Dessin): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TAILLE;
  DESSINS[nom](canvas.getContext('2d')!);
  return canvas.toDataURL('image/png');
}
