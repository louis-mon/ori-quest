// Volontairement minimal : des drapeaux booléens et un inventaire de chaînes.
// C'est tout ce dont un point & click a besoin, et ça tient en une ligne de
// localStorage.

const SAVE_KEY = 'ori-quest.save.v1';

// Scène de départ, et point de retour après une remise à zéro.
export const FIRST_ROOM = 'pont';

export interface SaveData {
  room: string;
  flags: Record<string, boolean>;
  inventory: string[];
}

type Listener = (state: SaveData) => void;

class GameState {
  private data: SaveData = { room: FIRST_ROOM, flags: {}, inventory: [] };
  private listeners = new Set<Listener>();

  get room() {
    return this.data.room;
  }

  get inventory(): readonly string[] {
    return this.data.inventory;
  }

  flag(name: string): boolean {
    return this.data.flags[name] === true;
  }

  setFlag(name: string, value = true) {
    this.data.flags[name] = value;
    this.emit();
  }

  has(item: string): boolean {
    return this.data.inventory.includes(item);
  }

  give(item: string) {
    if (!this.has(item)) {
      this.data.inventory.push(item);
      this.emit();
    }
  }

  take(item: string) {
    const i = this.data.inventory.indexOf(item);
    if (i >= 0) {
      this.data.inventory.splice(i, 1);
      this.emit();
    }
  }

  goTo(room: string) {
    this.data.room = room;
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.data);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.data);
    this.autosave();
  }

  // Une conversation est une TRANSACTION : ce qu'un knot pose en chemin vit en
  // mémoire, et n'atteint le disque qu'une fois ce knot terminé. Sans ça, un
  // rechargement à mi-dialogue enregistrait une demi-conversation, et le Petit
  // Chat en donne le cas exact : `chat_lait` tombe à sa deuxième réplique,
  // `os_tombe` à sa dernière, dix répliques plus loin. Entre les deux, le lait
  // est bu, le pot dépensé, et ni l'un ni l'autre ne se refait — le papier de
  // l'os restait accroché trop haut pour toujours, et le chapitre 2 ne se
  // finissait plus. Interrompue, une conversation n'a donc pas eu lieu : elle se
  // rejoue en entier, énigme comprise, depuis un état que le joueur a déjà
  // traversé.
  private transactions = new Set<symbol>();

  // Rend de quoi la refermer, à appeler quoi qu'il arrive.
  ouvrirUneTransaction(): () => void {
    const jeton = Symbol('conversation');
    this.transactions.add(jeton);
    // `delete` fait office de garde : une transaction refermée deux fois, ou
    // balayée entre-temps par une remise à zéro, ne rouvre pas la porte à une
    // écriture.
    return () => {
      if (this.transactions.delete(jeton) && this.transactions.size === 0) this.save();
    };
  }

  // `visibilitychange` et `pagehide` ne suffisaient pas : ils ne se déclenchent
  // pas quand l'onglet est tué sans passer en arrière-plan, et la progression de
  // la session était perdue. Un changement d'état est rare, donc écrire à chaque
  // fois ne coûte rien ; le délai regroupe la rafale de tags d'une réplique.
  private autosaveTimer = 0;

  private autosave() {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => this.save(), 200);
  }

  save() {
    clearTimeout(this.autosaveTimer);
    // Le seul point d'écriture, donc le seul endroit où tenir la transaction :
    // `pagehide` écrit au dernier moment utile, y compris au milieu d'un
    // dialogue — et c'est précisément là qu'il ne faut pas. La sauvegarde d'avant
    // la conversation reste en place ; on ne perd que la conversation.
    if (this.transactions.size > 0) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Safari en navigation privée refuse localStorage : ne jamais crasher le
      // jeu pour une sauvegarde ratée.
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveData;
      if (!parsed || typeof parsed.room !== 'string') return false;
      this.data = {
        room: parsed.room,
        flags: parsed.flags ?? {},
        inventory: parsed.inventory ?? [],
      };
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  // On réécrit plutôt qu'on ne supprime : effacer la clé laisserait `pagehide`
  // réenregistrer l'état courant pendant le rechargement qui suit, et
  // ressusciter la partie qu'on vient d'effacer.
  reset() {
    // Une remise à zéro emporte la conversation en cours avec le reste, sinon
    // le `save()` ci-dessous se heurterait à sa transaction ouverte.
    this.transactions.clear();
    this.data = { room: FIRST_ROOM, flags: {}, inventory: [] };
    this.save();
    this.emit();
  }
}

export const gameState = new GameState();
