import { Story } from 'inkjs';
import type { Overlay } from '../../ui/overlay';
import { personnage, type Personnage } from './personnages';
import { gameState } from './state';

// Les effets de jeu passent par des tags ink :
//
//     Le tracé est juste, le papier sait quoi faire. # origami: pont
//     Le pont enjambe le vide. # flag: pont_plie
//
// Ajouter un effet = ajouter une entrée dans `handlers`, pas réécrire le runner.

export interface DialogueEffects {
  origami(name: string): Promise<void>;
  goto(room: string): void;
  // Donne un objet ET le montre arriver. Passe par les effets plutôt que par
  // `gameState.give()` parce que c'est le seul chemin où l'on sait que l'objet
  // vient d'être obtenu : l'état est aussi rempli au chargement d'une sauvegarde
  // et par le menu des points d'étape.
  donner(item: string): void;
  // Le verdict est publié dans un drapeau `<nom>_resolu`, donc le tag doit être
  // posé sur une ligne SANS texte : la ligne suivante ne doit être évaluée
  // qu'une fois le drapeau connu.
  puzzle(name: string): Promise<void>;
}

// Un handler peut renvoyer le nom d'un knot : le récit y repart aussitôt le tag
// appliqué. Voir `puzzle` pour la raison de ce détour.
type TagHandler = (value: string, fx: DialogueEffects) => void | string | Promise<void | string>;

// Identifiants qui rendent la parole à la narration.
const NARRATION = new Set(['narrateur', '-', 'aucun']);

const handlers: Record<string, TagHandler> = {
  give: (value, fx) => fx.donner(value),
  drop: (value) => gameState.take(value),
  flag: (value) => gameState.setFlag(value),
  unflag: (value) => gameState.setFlag(value, false),
  origami: (value, fx) => fx.origami(value),
  goto: (value, fx) => fx.goto(value),
  // À accompagner systématiquement d'un `# then:`. ink évalue son contenu en
  // avance : une condition `{ flag_<nom>_resolu: ... }` écrite à la suite serait
  // résolue pendant le `Continue()` qui émet ce tag, donc avant le verdict — le
  // joueur lisait toujours la branche d'échec. La destination ne peut pas
  // s'écrire `-> knot` : ink y verrait un divert et l'exécuterait lui-même.
  puzzle: (value, fx) => fx.puzzle(value),
  // Repart au knot indiqué, une fois les tags précédents appliqués.
  then: (value) => value,
  // Traité en amont par `readSpeaker`. Listé ici pour ne pas ressortir en « tag
  // inconnu ».
  qui: () => {},
};

// `null` pour un tag sans deux-points.
function parseTag(tag: string): { key: string; value: string } | null {
  const sep = tag.indexOf(':');
  if (sep < 0) return null;
  return { key: tag.slice(0, sep).trim(), value: tag.slice(sep + 1).trim() };
}

export class DialogueRunner {
  private story: Story;
  private running = false;
  // Rémanent d'une ligne à l'autre. `null` = narration.
  private speaker: Personnage | null = null;

  constructor(
    storyJson: Record<string, unknown>,
    private overlay: Overlay,
    private fx: DialogueEffects,
  ) {
    this.story = new Story(storyJson);
    this.bindStateToInk();
  }

  // Expose l'inventaire et les drapeaux à ink, pour écrire des conditions
  // directement dans la narration : `{ has_crease_pattern: ... }`.
  private bindStateToInk() {
    gameState.subscribe((state) => {
      for (const name of Object.keys(this.story.variablesState as object)) {
        if (name.startsWith('has_')) {
          const item = name.slice(4);
          this.story.variablesState[name] = state.inventory.includes(item);
        } else if (name.startsWith('flag_')) {
          this.story.variablesState[name] = state.flags[name.slice(5)] === true;
        }
      }
    });
  }

  get isRunning() {
    return this.running;
  }

  async run(knot: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    // Chaque dialogue s'ouvre sur la narration : un `# qui:` laissé par le
    // précédent ferait parler un personnage absent de la scène.
    this.speaker = null;
    try {
      this.story.ChoosePathString(knot);
      await this.pump();
    } catch (err) {
      console.error(`[ink] échec du knot "${knot}"`, err);
      await this.overlay.say('…');
    } finally {
      this.running = false;
      this.overlay.hideDialogue();
    }
  }

  private async pump() {
    for (;;) {
      while (this.story.canContinue) {
        const line = this.story.Continue()?.trim() ?? '';
        const tags = this.story.currentTags ?? [];
        // Le locuteur se lit à part et de façon synchrone : `say()` écrit dans
        // le DOM dès l'appel, `applyTags` est asynchrone. Passer `# qui:` par les
        // handlers afficherait la ligne sous le nom du personnage précédent.
        this.readSpeaker(tags);
        // Les tags s'appliquent avant l'affichage : un `# origami:` doit pouvoir
        // jouer pendant que la ligne est lue.
        let effetFini = false;
        const pending = this.applyTags(tags).then(() => {
          effetFini = true;
        });

        if (!line) {
          await pending;
          continue;
        }

        await this.overlay.say(line, this.speaker);
        // Tapé AVANT la fin de l'effet, le tap a payé la lecture de la ligne et
        // non le passage à la suivante : sans cette question, la réplique d'après
        // prend la place à la seconde où le pliage se termine. Tapé après, il n'y
        // a rien à redemander — c'est le cas courant, une réplique se lit plus
        // longtemps qu'un pliage ne dure.
        const depense = !effetFini;
        await pending;
        if (depense) await this.overlay.attendreUnTap();
      }

      const choices = this.story.currentChoices;
      if (choices.length === 0) return;

      const picked = await this.overlay.choose(choices.map((c) => c.text));
      this.story.ChooseChoiceIndex(picked);
    }
  }

  // Le locuteur est rémanent jusqu'au prochain `# qui:` ou la fin du dialogue :
  // une tirade de dix lignes ne demande qu'un seul tag.
  private readSpeaker(tags: string[]) {
    for (const tag of tags) {
      const parsed = parseTag(tag);
      if (parsed?.key !== 'qui') continue;
      const id = parsed.value.toLowerCase();
      this.speaker = NARRATION.has(id) ? null : personnage(parsed.value);
    }
  }

  private async applyTags(tags: string[]) {
    for (const tag of tags) {
      const parsed = parseTag(tag);
      if (!parsed) continue;
      const { key, value } = parsed;
      const handler = handlers[key];
      if (!handler) {
        console.warn(`[ink] tag inconnu : ${key}`);
        continue;
      }
      const divert = await handler(value, this.fx);
      if (divert) this.story.ChoosePathString(divert);
    }
  }
}
