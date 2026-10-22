// Les pages de réglage, que le menu du jeu ouvre en développement, chacune dans
// son onglet. La liste vient du serveur de dev (`listerLesOutils`, dans
// `vite.config.ts`), qui la lit sur le disque.
export interface Outil {
  nom: string;
  page: string;
}

export async function listerOutils(): Promise<Outil[]> {
  const reponse = await fetch('/__outils');
  if (!reponse.ok) throw new Error(`/__outils : ${reponse.status}`);
  return reponse.json();
}

// Rouvrir un outil déjà ouvert le ramène devant sans le recharger, ce qui
// perdrait les curseurs pas encore enregistrés. D'où l'adresse vide : l'onglet
// est retrouvé par son nom sans naviguer, et ne reçoit la page qu'à sa création
// — y compris après un rechargement du jeu, qui oublie tout ce qu'il a ouvert.
export function ouvrirOutil(page: string) {
  const onglet = window.open('', `ori-quest:${page}`);
  if (!onglet) return;
  if (onglet.location.href === 'about:blank') {
    onglet.location.href = new URL(page, location.href).href;
  }
  onglet.focus();
}
