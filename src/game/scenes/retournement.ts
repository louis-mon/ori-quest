import Phaser from 'phaser';

// Retourner un pliage photographié comme on retourne une feuille : on le prend
// par un bord, on le courbe par-dessus l'autre, et il retombe à l'envers. Le
// bord opposé sert de charnière, donc l'image retombe de l'autre côté de lui —
// décalée de sa propre longueur.
//
// Peint une fois au canvas, colonne par colonne, puis joué comme une planche
// d'images : Phaser sait déformer un maillage (`Mesh2D`), pas l'ombrer, et sans
// ombre une feuille qui se courbe se lit comme une image qu'on étire.

export const IMAGES_RETOURNEMENT = 30;

// Les images grossissent en venant vers l'œil : peintes à leur taille, elles
// seraient floues au moment où on les regarde.
const RESOLUTION = 1.5;

// Recul de l'œil, en longueurs de papier. Plus près, la perspective déforme ;
// plus loin, le relief s'aplatit et la feuille ne fait plus que rétrécir.
const RECUL = 4;

// L'œil regarde un peu d'en haut. De face, une feuille qui se courbe vers lui ne
// fait que rétrécir — l'arc est dans l'axe du regard. D'en haut, ce qui vient
// vers l'œil descend à l'écran, et la courbe se voit. La feuille à plat, elle,
// n'en est pas changée : elle reste exactement la photo.
const PENTE_REGARD = Math.tan((16 * Math.PI) / 180);

// Part du mouvement dont le bord saisi devance la charnière. C'est cet écart qui
// courbe la feuille : à zéro, elle pivoterait d'un bloc, comme une porte.
const AVANCE = 0.3;

// L'ombre la plus forte, quand la feuille se présente par la tranche.
const OMBRE_MAX = 0.45;
const NUANCES = 12;

// La lumière vient d'en face, un peu de droite, comme la clé du rendu 3D.
const LUMIERE = normaliser(0.35, 1);

const adoucir = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : (1 - Math.cos(Math.PI * x)) / 2);

function normaliser(x: number, z: number): [number, number] {
  const n = Math.hypot(x, z);
  return [x / n, z / n];
}

interface Planche {
  cle: string;
  // Hauteur de la ligne médiane de l'objet dans une image, en fraction : la
  // courbe descend vers l'œil, donc la place est prise en dessous.
  origineY: number;
}

// Un sprite qui sait se retourner. Image 0 : la photo telle quelle, charnière
// au bord droit. Dernière image : la photo en miroir, de l'autre côté de la
// charnière. L'origine est sur la charnière, donc `setFlipX` joue le même
// mouvement dans l'autre sens, et `x` reste la charnière quel que soit le sens.
//
// `largeur` et `hauteur` sont la taille à l'écran, à plat ; `y` la ligne
// médiane.
export function poserRetournable(
  scene: Phaser.Scene,
  source: string,
  largeur: number,
  hauteur: number,
  x: number,
  y: number,
): Phaser.GameObjects.Sprite {
  const { cle, origineY } = peindrePlanche(scene, source, largeur, hauteur);
  return scene.add
    .sprite(x, y, cle, 0)
    .setOrigin(0.5, origineY)
    .setScale(1 / RESOLUTION);
}

// Une fois par partie : le gestionnaire de textures survit aux changements de
// pièce.
const origines = new Map<string, number>();

function peindrePlanche(
  scene: Phaser.Scene,
  source: string,
  largeur: number,
  hauteur: number,
): Planche {
  const cle = `${source}:retournement`;
  const deja = origines.get(cle);
  if (deja !== undefined && scene.textures.exists(cle)) return { cle, origineY: deja };

  const m = Math.round(largeur * RESOLUTION);
  const h = Math.round(hauteur * RESOLUTION);
  // Le point le plus proche de l'œil ne dépasse jamais la longueur de la feuille.
  const grossiMax = RECUL / (RECUL - 1);
  const fw = 2 * Math.ceil(m * grossiMax) + 4;
  const milieu = 2 + Math.ceil((h * grossiMax) / 2);
  const fh = milieu + Math.ceil((h * grossiMax) / 2 + m * PENTE_REGARD * grossiMax) + 2;
  const parLigne = 5;

  const planche = document.createElement('canvas');
  planche.width = fw * parLigne;
  planche.height = fh * Math.ceil(IMAGES_RETOURNEMENT / parLigne);
  const ctx = planche.getContext('2d')!;

  // La photo réduite une fois, en autant de nuances d'ombre : chaque colonne
  // n'a plus qu'à être copiée depuis la bonne.
  const photo = scene.textures.get(source).getSourceImage() as CanvasImageSource;
  const nuances = Array.from({ length: NUANCES }, (_, i) => {
    const c = document.createElement('canvas');
    c.width = m;
    c.height = h;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(photo, 0, 0, m, h);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0, 0, 0, ${(OMBRE_MAX * i) / (NUANCES - 1)})`;
    g.fillRect(0, 0, m, h);
    return c;
  });

  for (let k = 0; k < IMAGES_RETOURNEMENT; k++) {
    const cx = (k % parLigne) * fw + fw / 2;
    const cy = Math.floor(k / parLigne) * fh + milieu;
    const t = k / (IMAGES_RETOURNEMENT - 1);

    // À plat, les deux bouts : copiés d'un bloc, pour que l'objet au repos soit
    // exactement la photo, sans les coutures des colonnes.
    if (k === 0 || k === IMAGES_RETOURNEMENT - 1) {
      ctx.save();
      ctx.translate(cx, cy);
      if (k > 0) ctx.scale(-1, 1);
      ctx.drawImage(nuances[0], -m, -h / 2);
      ctx.restore();
      continue;
    }

    // Tangente de la feuille, 0 à plat vers la gauche, π retournée vers la
    // droite. Elle varie linéairement le long du papier, qui décrit donc un arc
    // de cercle entre la charnière et le bord saisi.
    const aCharniere = Math.PI * adoucir((t - AVANCE) / (1 - AVANCE));
    const aBord = Math.PI * adoucir(t / (1 - AVANCE));
    const courbure = (aBord - aCharniere) / m;

    // `s` part de la charnière, au bord droit de la photo ; `z` vient vers l'œil.
    const point = (s: number) => {
      const droit = Math.abs(courbure) < 1e-9;
      const a = aCharniere + courbure * s;
      const x = droit
        ? -s * Math.cos(aCharniere)
        : -(Math.sin(a) - Math.sin(aCharniere)) / courbure;
      const z = droit ? s * Math.sin(aCharniere) : (Math.cos(aCharniere) - Math.cos(a)) / courbure;
      const grossi = (RECUL * m) / (RECUL * m - z);
      return { x: x * grossi, y: z * PENTE_REGARD * grossi, z, grossi };
    };

    const bandes = [];
    for (let j = 0; j < m; j++) {
      const a = point(m - j - 1);
      const b = point(m - j);
      const angle = aCharniere + courbure * (m - j - 0.5);
      // La face qu'on voit : celle de devant tant qu'elle regarde l'œil, le dos
      // ensuite — une photo vue par-derrière, c'est son miroir.
      const sens = Math.cos(angle) >= 0 ? 1 : -1;
      const clarte = Math.max(
        0,
        sens * (Math.sin(angle) * LUMIERE[0] + Math.cos(angle) * LUMIERE[1]),
      );
      const ombre = Math.min(1, Math.max(0, (LUMIERE[1] - clarte) / LUMIERE[1]));
      bandes.push({ j, a, b, z: (a.z + b.z) / 2, nuance: Math.round(ombre * (NUANCES - 1)) });
    }

    // Du plus loin au plus proche : quand le bord saisi passe au-dessus du reste,
    // c'est lui qu'on doit voir.
    bandes.sort((p, q) => p.z - q.z);
    for (const { j, a, b, nuance } of bandes) {
      const large = Math.abs(b.x - a.x);
      if (large < 0.01) continue;
      const haut = (h * (a.grossi + b.grossi)) / 2;
      const bas = (a.y + b.y) / 2;
      // Un demi-pixel de recouvrement : sans lui, l'anticrénelage laisse un
      // liseré transparent entre deux colonnes.
      ctx.drawImage(
        nuances[nuance],
        j,
        0,
        1,
        h,
        cx + Math.min(a.x, b.x),
        cy + bas - haut / 2,
        large + 0.5,
        haut,
      );
    }
  }

  const texture = scene.textures.addCanvas(cle, planche);
  for (let k = 0; k < IMAGES_RETOURNEMENT; k++) {
    texture?.add(k, 0, (k % parLigne) * fw, Math.floor(k / parLigne) * fh, fw, fh);
  }
  const origineY = milieu / fh;
  origines.set(cle, origineY);
  return { cle, origineY };
}
