// Un téléphone en 4G perd une requête de temps en temps, et sur itch.io tout
// arrive par le réseau. Sans nouvel essai, une seule requête perdue retirait un
// pliage du décor pour toute la session — le pont posé disparaissait du ravin.
//
// Les attentes s'allongent : une coupure de quelques secondes (un tunnel, un
// changement d'antenne) se rattrape. Au-delà, c'est l'appelant qui juge : un
// cri d'animal perdu ne vaut pas d'alerter le joueur, un pliage absent du décor
// si (`signalerUnEchec`).
const ATTENTES_MS = [500, 1500, 4000, 8000];

// `low` pour ce qui peut attendre : sur un lien saturé, le navigateur fait
// passer devant lui les images de la pièce qu'on attend.
export async function telecharger(
  url: string,
  priorite: RequestPriority = 'auto',
): Promise<Response> {
  let derniere: unknown;
  for (let essai = 0; essai <= ATTENTES_MS.length; essai++) {
    if (essai > 0) await attendre(ATTENTES_MS[essai - 1]);
    try {
      const reponse = await fetch(url, { priority: priorite });
      if (reponse.ok) return reponse;
      derniere = new Error(`HTTP ${reponse.status}`);
    } catch (err) {
      derniere = err;
    }
  }
  throw new Error(`${url} : ${String(derniere)}`);
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ce qui manque à l'écran malgré les nouveaux essais. L'écran de chargement s'y
// abonne pour proposer de recharger la page : c'est le seul remède quand le
// module three.js a échoué, le navigateur gardant en cache l'échec d'un
// `import()`.
const abonnes = new Set<(err: unknown) => void>();

export function signalerUnEchec(err: unknown): void {
  console.error('[chargement]', err);
  for (const abonne of abonnes) abonne(err);
}

export function surUnEchec(abonne: (err: unknown) => void): void {
  abonnes.add(abonne);
}
