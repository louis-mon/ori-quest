import { objet, type Dessin } from '../game/systems/objets';
import { urlApercuOrigami } from '../origami/apercu';

// Une règle : tout ce qui est un pliage se montre par son modèle. La vignette
// d'une idée, le but de l'énigme et l'objet obtenu sont donc la même image, et
// le joueur suit un seul dessin de « je sais faire ça » à « j'ai ça ».

const TAILLE = 128; // pixels ; elle s'affiche à ~48

const vignettes = new Map<string, Promise<string | null>>();

// En cache par identifiant : l'inventaire est redessiné à chaque changement
// d'état, et rendre un modèle 3D à chaque fois serait absurde.
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
  // Les cernes concentriques font lire « bois coupé » plutôt que « cailloux » à
  // 48 px : c'est le seul détail qui tienne à cette taille.
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
