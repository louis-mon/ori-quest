/**
 * Montrer qu'on vient d'obtenir quelque chose.
 *
 * Le problème est de placement, pas de texte : l'objet est donné pendant que le
 * joueur lit une réplique en bas du cadre, et il arrive dans une colonne haute à
 * gauche, à quarante pixels de côté. Rien ne bouge dans le champ, donc rien ne
 * se remarque — les testeurs ne savaient ni qu'ils avaient reçu un objet, ni que
 * l'inventaire existait.
 *
 * Le point & click du genre n'a pas ce problème parce que son inventaire occupe
 * le tiers bas de l'écran en permanence (Monkey Island, Thimbleweed Park) et que
 * le personnage joue le ramassage à l'écran. Ce jeu-ci n'a ni l'un ni l'autre :
 * une colonne de HUD sur un téléphone, et un héros qui ne se penche pas. D'où le
 * vol, qui remplit exactement la fonction de l'animation de ramassage — dire
 * « ceci est à toi, et ça se range là » en un seul mouvement que le regard suit.
 *
 * **Le départ est le centre du cadre, quel que soit l'objet.** C'est déjà
 * l'endroit où ce jeu montre : le pliage s'y joue, l'objet examiné y tourne, le
 * but de l'énigme s'y affiche, la feuille du tutoriel y apparaît. Le joueur a
 * appris cette place bien avant son premier objet. Faire partir chaque chose de
 * sa source dans le décor serait plus joli sur le papier et faux dès le deuxième
 * cas : l'idée de la hache ne sort pas du corps du renard, elle se forme dans la
 * tête de la grenouille.
 */

/** Apparition de l'image au centre, en millisecondes. */
const APPARITION = 180;
/**
 * Temps où elle reste au centre avant de partir.
 *
 * Le regard doit avoir le temps de se poser dessus, sinon il ne suit pas le
 * mouvement — il le voit finir.
 */
const TENUE = 340;
/** Durée du vol proprement dit. */
const VOL = 560;

/**
 * Côté de l'image au centre, en pixels de design.
 *
 * Choisi pour recouvrir à peu près le modèle qui vient d'être plié : après un
 * `# origami:`, la couche 3D s'efface en 400 ms pendant que cette image
 * apparaît, et les deux tailles doivent être assez proches pour que ça se lise
 * comme un relais et non comme un saut.
 */
const TAILLE_CENTRE = 190;

/** Le joueur a-t-il demandé qu'on lui épargne les animations ? */
export function mouvementReduit(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fait voler l'image d'un objet du centre du cadre jusqu'à sa case.
 *
 * L'élément volant est posé **à l'arrivée** et animé depuis le centre, plutôt
 * que l'inverse : la fin d'un mouvement est ce qu'on regarde, et c'est elle qui
 * doit tomber au pixel sur la vignette de la case. Résout quand il est posé.
 */
export async function volVersLaCase(
  racine: HTMLElement,
  url: string,
  cible: HTMLElement,
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

  // L'UI est en pixels CSS et le cadre rétrécit avec la fenêtre : sans ce
  // facteur, l'image partirait à sa taille de design sur un écran deux fois
  // plus petit et couvrirait la moitié de la scène.
  const echelle = Number(getComputedStyle(racine).getPropertyValue('--ui-scale')) || 1;
  const k = (TAILLE_CENTRE * echelle) / Math.max(dest.width, dest.height);
  const dx = cadre.width / 2 - (dest.left - cadre.left + dest.width / 2);
  const dy = cadre.height / 2 - (dest.top - cadre.top + dest.height / 2);
  const centre = `translate(${dx}px, ${dy}px) scale(${k})`;
  const total = APPARITION + TENUE + VOL;

  try {
    await el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${k * 0.82})`,
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

/**
 * Où le vol se pose : la vignette de la case, et la case entière à défaut.
 *
 * La vignette arrive en différé — c'est un rendu 3D — et reste `hidden` quand
 * l'objet n'en a pas. Un élément masqué mesure zéro, d'où le repli.
 */
function rectArrivee(cible: HTMLElement): DOMRect {
  const image = cible.querySelector<HTMLElement>('.inventory__image');
  const rect = image?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : cible.getBoundingClientRect();
}

/**
 * Pose le bandeau « Obtenu : … » contre la case, à sa hauteur.
 *
 * Contre la colonne et non au centre du cadre : centré, il nomme l'objet et
 * laisse le joueur ignorer où il est parti — c'est la moitié du problème qu'on
 * cherche à régler. Posé là, le texte et l'endroit se disent d'un seul coup.
 */
export function placerBandeau(bandeau: HTMLElement, racine: HTMLElement, cible: HTMLElement) {
  const cadre = racine.getBoundingClientRect();
  const c = cible.getBoundingClientRect();
  bandeau.style.left = `${c.right - cadre.left}px`;
  bandeau.style.top = `${c.top - cadre.top + c.height / 2}px`;
}
