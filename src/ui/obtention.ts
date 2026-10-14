// L'objet est donné pendant que le joueur lit une réplique en bas du cadre et
// arrive dans une colonne haute à gauche : rien ne bougeait dans le champ, et
// les testeurs ignoraient et l'objet reçu et l'existence de l'inventaire. Le vol
// remplit la fonction de l'animation de ramassage du genre, qu'un héros qui ne
// se penche pas ne peut pas jouer.
//
// Le départ est le centre du cadre pour tous les objets : c'est déjà l'endroit
// où ce jeu montre. Partir de la source dans le décor serait faux dès le
// deuxième cas — l'idée de la hache se forme dans la tête de la grenouille, pas
// dans le corps du renard. L'objet qu'on vient de plier y est déjà, à sa
// taille : la vignette part de lui.

const APPARITION = 180; // millisecondes
// Le regard doit avoir le temps de se poser dessus, sinon il ne suit pas le
// mouvement : il le voit finir.
const TENUE = 340;
const VOL = 560;

// En pixels de design. Pour ce qui n'est pas déjà à l'écran — une idée, un
// objet reçu sans pliage — : la taille d'une vignette qu'on montre, pas d'une
// icône.
const TAILLE_CENTRE = 190;

export function mouvementReduit(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// L'élément volant est posé à l'arrivée et animé depuis son départ, pas
// l'inverse : la fin d'un mouvement est ce qu'on regarde, et c'est elle qui doit
// tomber au pixel sur la vignette de la case.
//
// `depart`, en pixels de la page, est l'emprise que l'image doit couvrir au
// départ : celle du modèle qu'on vient de plier, que la vignette relaie pendant
// que la couche 3D s'efface. Sans lui, le centre du cadre.
export async function volVersLaCase(
  racine: HTMLElement,
  url: string,
  cible: HTMLElement,
  depart: DOMRect | null = null,
): Promise<void> {
  const cadre = racine.getBoundingClientRect();
  const dest = rectArrivee(cible);
  if (!cadre.width || !dest.width || !dest.height) return;

  const el = document.createElement('img');
  el.className = 'vol';
  el.src = url;
  el.alt = '';
  el.style.left = `${dest.left - cadre.left}px`;
  el.style.top = `${dest.top - cadre.top}px`;
  el.style.width = `${dest.width}px`;
  el.style.height = `${dest.height}px`;
  racine.appendChild(el);

  try {
    let k: number;
    let dx: number;
    let dy: number;
    if (depart) {
      // Couvrir le modèle, c'est couvrir de l'IMAGE et non de l'élément : en
      // `object-fit: contain`, elle n'occupe la case que dans un sens.
      await el.decode();
      const ajuste = Math.min(dest.width / el.naturalWidth, dest.height / el.naturalHeight);
      k = Math.sqrt(
        (depart.width / (el.naturalWidth * ajuste)) * (depart.height / (el.naturalHeight * ajuste)),
      );
      dx = depart.left + depart.width / 2 - (dest.left + dest.width / 2);
      dy = depart.top + depart.height / 2 - (dest.top + dest.height / 2);
    } else {
      // L'UI est en pixels CSS et le cadre rétrécit avec la fenêtre : sans ce
      // facteur, l'image garderait sa taille de design sur un écran deux fois
      // plus petit et couvrirait la moitié de la scène.
      const echelle = Number(getComputedStyle(racine).getPropertyValue('--ui-scale')) || 1;
      k = (TAILLE_CENTRE * echelle) / Math.max(dest.width, dest.height);
      dx = cadre.width / 2 - (dest.left - cadre.left + dest.width / 2);
      dy = cadre.height / 2 - (dest.top - cadre.top + dest.height / 2);
    }
    const centre = `translate(${dx}px, ${dy}px) scale(${k})`;
    const total = APPARITION + TENUE + VOL;

    await el.animate(
      [
        {
          // Le relais apparaît sur place : grandir sous les yeux, c'est ne
          // plus être le modèle qu'il remplace.
          transform: `translate(${dx}px, ${dy}px) scale(${depart ? k : k * 0.82})`,
          opacity: 0,
          offset: 0,
          easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
        },
        { transform: centre, opacity: 1, offset: APPARITION / total, easing: 'linear' },
        {
          transform: centre,
          opacity: 1,
          offset: (APPARITION + TENUE) / total,
          easing: 'cubic-bezier(0.55, 0, 0.25, 1)',
        },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 1 },
      ],
      { duration: total },
    ).finished;
  } catch {
    // Une animation annulée (page masquée, élément retiré) n'est pas une erreur :
    // ce qui compte est que l'objet soit dans l'inventaire, et il y est déjà.
  } finally {
    el.remove();
  }
}

// La vignette arrive en différé et reste `hidden` quand l'objet n'en a pas. Un
// élément masqué mesure zéro, d'où le repli sur la case entière.
function rectArrivee(cible: HTMLElement): DOMRect {
  const image = cible.querySelector<HTMLElement>('.inventory__image');
  const rect = image?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : cible.getBoundingClientRect();
}

// Contre la colonne et non au centre : centré, il nommerait l'objet en laissant
// ignorer où il est parti, soit la moitié du problème qu'on cherche à régler.
export function placerBandeau(bandeau: HTMLElement, racine: HTMLElement, cible: HTMLElement) {
  const cadre = racine.getBoundingClientRect();
  const c = cible.getBoundingClientRect();
  bandeau.style.left = `${c.right - cadre.left}px`;
  bandeau.style.top = `${c.top - cadre.top + c.height / 2}px`;
}
