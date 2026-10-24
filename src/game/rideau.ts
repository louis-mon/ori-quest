// L'écran d'accueil est un rideau : la première pièce se monte derrière et vit
// déjà — nuages, eau —, mais rien n'y commence avant « Commencer à plier ».
// Le menu le baisse au chargement d'une partie neuve et le lève ; la scène lit
// s'il est baissé en se montant, et attend qu'il se lève (`PointClickScene`).
export class Rideau {
  private enPlace = false;
  private ouvrir: () => void = () => {};
  readonly leve = new Promise<void>((resolve) => (this.ouvrir = resolve));

  get baisse(): boolean {
    return this.enPlace;
  }

  baisser() {
    this.enPlace = true;
  }

  lever() {
    this.enPlace = false;
    this.ouvrir();
  }
}
