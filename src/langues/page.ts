import { langue } from './langue';
import { t } from './traduire';

// Ce qu'index.html écrit lui-même, avant tout script : l'attribut `lang`, dont
// dépendent la césure et les guillemets de la CSS, et l'invite du portrait. Le
// français y reste pour le temps du chargement.
export function traduireLaPage(): void {
  document.documentElement.lang = langue;
  const invite = document.querySelector('#rotate-hint p');
  if (invite) invite.textContent = t('Tourne ton téléphone');
}
