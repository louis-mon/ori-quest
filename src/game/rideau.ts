// L'écran d'accueil est un rideau : la première pièce se monte derrière et vit
// déjà — nuages, eau —, mais rien n'y commence avant « Commencer à plier ».
// Le menu le baisse au chargement d'une partie neuve et le lève ; la scène lit
// s'il est baissé en se montant, et attend qu'il se lève (`PointClickScene`).
//
// Il ne se lève que sur une pièce prête : levé plus tôt, sur un téléphone en 3G,
// il découvrait vingt secondes d'écran noir. Le bouton de l'accueil attend donc
// `pret`, que la première pièce tient une fois chargée entière.
export class Rideau {
  private enPlace = false;
  private ouvrir: () => void = () => {};
  private signalerPret: () => void = () => {};
  private estPret = false;
  readonly leve = new Promise<void>((resolve) => (this.ouvrir = resolve));
  readonly pret = new Promise<void>((resolve) => (this.signalerPret = resolve));

  get baisse(): boolean {
    return this.enPlace;
  }

  get piecePrete(): boolean {
    return this.estPret;
  }

  baisser() {
    this.enPlace = true;
  }

  lever() {
    this.enPlace = false;
    this.ouvrir();
  }

  // Par la pièce, une fois montrée.
  pieceChargee() {
    this.estPret = true;
    this.signalerPret();
  }
}
