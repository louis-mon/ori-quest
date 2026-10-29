import { surUnEchec } from '../chargement/telecharger';
import { t } from '../langues/traduire';

// Une pièce ne se montre qu'entière. Sur un téléphone en 3G, ses images
// arrivaient en dix secondes et ses pliages — three.js d'abord — en vingt : le
// joueur regardait un écran noir sans savoir si le jeu avait planté, puis un
// ravin sans son pont alors que la partie le savait posé. D'ici, il voit que ça
// charge, et combien il en reste.
//
// Rien ne s'affiche pour un chargement court : un éclair d'écran de chargement
// à chaque porte franchie serait pire que l'attente qu'il annonce.
const DELAI_MS = 300;

// Après ce délai sans fin de chargement, on dit pourquoi c'est long.
const LENTEUR_MS = 8000;

export class EcranDeChargement {
  private el: HTMLElement;
  private barre: HTMLElement;
  private message: HTMLElement;
  private bouton: HTMLButtonElement;
  private minuteurs: number[] = [];
  private enCours = false;
  private echoue = false;
  private progression = 0;
  private suiveurs = new Set<(progression: number) => void>();

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'chargement';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.el.innerHTML = `
      <div class="chargement__feuille" aria-hidden="true"><span></span></div>
      <div class="chargement__jauge"><div class="chargement__barre"></div></div>
      <p class="chargement__message"></p>
      <button class="chargement__bouton" type="button" hidden>${t('Réessayer')}</button>
    `;
    root.prepend(this.el);
    this.barre = this.el.querySelector('.chargement__barre')!;
    this.message = this.el.querySelector('.chargement__message')!;
    this.bouton = this.el.querySelector('.chargement__bouton')!;

    // Recharger est le seul nouvel essai qui vaille pour tout : le navigateur
    // ne refait jamais un `import()` qui a échoué. La partie est sur le disque,
    // et une conversation interrompue se rejoue comme après tout rechargement.
    this.bouton.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      window.location.reload();
    });

    surUnEchec(() => this.echouer());
  }

  // Une pièce commence à charger. `visible` à faux derrière l'accueil, qui en
  // montre l'avancée sur son bouton : l'écran transparaissait sous son flou.
  commencer(visible = true) {
    if (this.echoue) return;
    this.annuler();
    this.enCours = true;
    this.progresser(0);
    this.message.textContent = '';
    this.minuteurs.push(
      window.setTimeout(() => {
        this.el.hidden = !visible;
      }, DELAI_MS),
      window.setTimeout(() => {
        this.message.textContent = t('La connexion est lente, encore un instant…');
      }, LENTEUR_MS),
    );
  }

  // De 0 à 1.
  progresser(progression: number) {
    this.progression = Math.max(0, Math.min(1, progression));
    this.barre.style.transform = `scaleX(${this.progression})`;
    // Une énigme n'a qu'un fichier à attendre : une jauge restée vide n'y dirait
    // rien de plus que la feuille qui se plie.
    this.el.classList.toggle('chargement--sans-jauge', this.progression === 0);
    for (const suiveur of this.suiveurs) suiveur(this.progression);
  }

  terminer() {
    if (this.echoue) return;
    this.annuler();
    this.enCours = false;
    this.progresser(1);
    this.el.hidden = true;
  }

  // Pour l'écran d'accueil, qui couvre celui-ci : son bouton dit où en est la
  // première pièce.
  suivre(suiveur: (progression: number) => void) {
    this.suiveurs.add(suiveur);
    suiveur(this.progression);
  }

  // Pendant le chargement d'une pièce, l'écran reste couvert et le dit. En
  // pleine partie — un pliage du récit, celui qui doit paraître dans le décor —
  // un bandeau suffit : la pièce reste jouable, il lui manque une image.
  private echouer() {
    if (this.echoue) return;
    this.echoue = true;
    this.annuler();
    this.el.classList.toggle('chargement--bandeau', !this.enCours);
    this.el.classList.toggle('chargement--echec', this.enCours);
    this.message.textContent = t('Une partie du jeu n’a pas pu se charger. Vérifie ta connexion.');
    this.bouton.hidden = false;
    this.el.hidden = false;
  }

  private annuler() {
    for (const minuteur of this.minuteurs) clearTimeout(minuteur);
    this.minuteurs = [];
  }
}
