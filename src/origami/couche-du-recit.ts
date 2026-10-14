import type { ApercuOrigami } from '../ui/overlay';
import { OrigamiLayer } from './origami-layer';
import { pliageDe } from './vue';

// Durée du pliage joué par `# origami:`, du papier à plat à la pose du modèle.
const PLIAGE_MS = 2600;

// La couche 3D du récit, partagée entre le pliage d'un `# origami:` et l'aperçu
// d'un objet qu'on examine.
//
// Instanciée à la première demande : tant que le joueur n'a rien plié ni
// examiné, three.js ne coûte ni téléchargement ni contexte WebGL.
export class CoucheDuRecit {
  // Pour les appels synchrones (`hide()`) ; les autres passent par `couche()`.
  private layer: OrigamiLayer | null = null;

  // Mémorisée EN PROMESSE, pas en objet : `x ??= await créer()` laisse passer
  // deux appels rapprochés — l'`await` rend la main avant l'affectation — et
  // chacun fabriquerait son contexte WebGL sur la même toile, dont l'un
  // resterait orphelin.
  private promesse: Promise<OrigamiLayer> | null = null;

  // La couche est unique : présenter un objet d'inventaire pendant qu'un pliage
  // est à l'écran remplacerait le modèle en cours de route. Le cas est rare,
  // mais un pliage se joue justement entre deux répliques.
  private pliageEnCours = false;

  // Un aperçu se demande, puis s'abandonne — la description refermée, un
  // pliage qui prend la couche. Le jeton dit si celui qu'on vient de charger
  // est encore celui qu'on attend : sans lui, le modèle se posait sur la scène
  // APRÈS la fermeture de la boîte, et son voile restait là.
  private apercuDemande = 0;

  constructor(private canvas: HTMLCanvasElement) {}

  private couche(): Promise<OrigamiLayer> {
    this.promesse ??= OrigamiLayer.create(this.canvas)
      .then((layer) => {
        this.layer = layer;
        return layer;
      })
      .catch((err) => {
        // Une création ratée ne doit pas condamner les pliages suivants.
        this.promesse = null;
        throw err;
      });
    return this.promesse;
  }

  // Se dénoue le modèle plié, qui reste à l'écran jusqu'à `ranger()`.
  plier = async (nom: string) => {
    this.pliageEnCours = true;
    try {
      const layer = await this.couche();
      await layer.load(nom);
      layer.setFold(0);
      layer.show();
      // Au pliage de ce modèle-là, pas à 1 : c'est la pose que le décor et
      // l'inventaire montreront ensuite, et la pose finale du solveur est
      // souvent tout à fait plate.
      await layer.playTo(pliageDe(nom), PLIAGE_MS);
    } catch (err) {
      // Une animation manquante ne doit jamais bloquer la progression.
      console.error(`[origami] lecture de "${nom}" impossible`, err);
      this.ranger();
    }
  };

  // Le modèle plié reste à l'écran jusqu'à ce que le joueur quitte la réplique
  // qui l'a plié, pas pendant une durée fixe : la pose tenue au minuteur
  // interdisait d'avancer à qui avait déjà vu, et repartait sous les yeux de
  // qui regardait encore.
  ranger = () => {
    if (!this.pliageEnCours) return;
    this.pliageEnCours = false;
    this.layer?.hide();
  };

  readonly apercu: ApercuOrigami = {
    montrer: (modele) => {
      if (this.pliageEnCours) return;
      const jeton = ++this.apercuDemande;
      void (async () => {
        try {
          const layer = await this.couche();
          // Revérifié après CHAQUE attente : la couche est unique, et un
          // pliage qui démarre entre-temps lui volerait sa pose.
          if (this.pliageEnCours || jeton !== this.apercuDemande) return;
          await layer.load(modele);
          if (this.pliageEnCours || jeton !== this.apercuDemande) return;
          layer.presenter(pliageDe(modele));
        } catch (err) {
          // Regarder un objet ne doit rien casser : sans modèle, il reste sa
          // description.
          console.error(`[origami] aperçu de "${modele}" impossible`, err);
        }
      })();
    },
    cacher: () => {
      this.apercuDemande++;
      if (!this.pliageEnCours) this.layer?.hide();
    },
  };
}
