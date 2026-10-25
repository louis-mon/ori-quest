import { t } from '../langues/traduire';

// Les crédits, dans l'ordre où ils défilent — le fichier « Crédit » du dossier
// partagé, rangé en sections. Le moteur est `credits.ts`.
//
// Les titres des modèles et des livres restent ceux de leur publication, dans
// toutes les langues : ce sont des noms d'œuvres.

export interface Role {
  role: string;
  qui: string;
}

export interface Modele {
  modele: string;
  auteur: string;
  livre?: string;
}

export interface Plieur {
  intitule: string;
  modeles: Modele[];
}

export const ROLES: Role[] = [
  { role: t('Game design, scénario'), qui: t('Pierre et Louis Monestier') },
  { role: t('Photographie'), qui: 'Pierre Monestier' },
  { role: t('Écriture'), qui: 'Louis Monestier' },
  { role: t('Développement'), qui: t('Louis Monestier, assisté par Claude Code') },
];

const FERNANDO = 'Fernando Gilgado Gomez';
const MONTROLL = 'John Montroll';
const PULIDO = 'Leonardo Pulido Martinez';
const MOMOTANI = 'Yoshihide Momotani';

export const PLIEURS: Plieur[] = [
  {
    intitule: t('Les modèles suivants ont été pliés par Pierre Monestier'),
    modeles: [
      { modele: 'Tree', auteur: FERNANDO, livre: 'Papirolandia 1' },
      { modele: 'Cloud', auteur: FERNANDO, livre: 'Papirolandia 1' },
      { modele: 'Elephant', auteur: FERNANDO, livre: 'Papirolandia 1' },
      { modele: 'Frog', auteur: FERNANDO, livre: 'Papirolandia 2' },
      { modele: 'Brontosaurus', auteur: FERNANDO, livre: 'Papirolandia 3' },
      { modele: 'Cow', auteur: FERNANDO, livre: 'Papirolandia 3' },
      { modele: 'Owl', auteur: FERNANDO, livre: 'Papirolandia 3' },
      { modele: 'Sun', auteur: 'Peter Engel', livre: 'Origami Odyssey' },
      { modele: 'Penguin', auteur: FERNANDO, livre: 'Tanteidan 17th convention' },
      { modele: 'Fox - Vixen', auteur: 'Roman Diaz', livre: 'Origami Essence' },
      { modele: 'Cat', auteur: 'Martha Mitchen', livre: 'usa Convention 1990' },
      { modele: 'Koi carp', auteur: 'Meng Weining (212moving)', livre: 'Origami montents' },
      { modele: 'Camelot Castle', auteur: 'Lew Rozelle', livre: "Origami in King Arthur's Court" },
      { modele: 'Arrow', auteur: 'Masamichi Noma', livre: 'NOA Magazine 218' },
      {
        modele: 'Clover',
        auteur: 'Fumiaki Kawahata',
        livre: 'Creative Origami Ideas and Techniques',
      },
      { modele: 'Hydra', auteur: MONTROLL, livre: 'Dragons and Other Fantastic Creatures' },
      { modele: 'Cat on moon', auteur: 'Kakami Hitoshi', livre: 'Tanteidan 22nd convention' },
      { modele: 'Lily of the Valley brooch', auteur: 'Takenao Handa', livre: 'NOA Magazine 559' },
      { modele: 'Armchair', auteur: 'Mark Bolitho', livre: 'Tanteidan 23rd convention' },
      { modele: 'Chinese chair', auteur: 'Ichiro Kinoshita', livre: 'Tanteidan 13th convention' },
      { modele: 'Table', auteur: 'Juan Lopez Figueroa', livre: 'Origami USA Convention 1997' },
      { modele: 'Sword', auteur: 'Lee in Seop', livre: 'Origami Skill Up-Advanced Level' },
      {
        modele: 'Shield (Left)',
        auteur: MONTROLL,
        livre: 'Dragons and Other Fantastic Creatures',
      },
      { modele: 'Shield (right)', auteur: 'Pierre Monestier' },
      { modele: 'Shield (right)', auteur: 'David Brill', livre: 'Brilliant Origami' },
      { modele: 'Torch', auteur: FERNANDO, livre: 'Create and Play with Origami Dinosaurs 1' },
      { modele: 'Caballo en el cuadro 2D V. 3.0', auteur: PULIDO, livre: 'Hiporigami 3' },
      { modele: 'Escudo con Caballos', auteur: PULIDO, livre: 'Hiporigami 1' },
      { modele: 'Deer head', auteur: 'Andrey Ermakov', livre: 'Origami: School of Masters' },
      {
        modele: 'Fish skeleton',
        auteur: 'Makoto Yamaguchi',
        livre: 'Quarterly ORU Folding Diagrams - Vol. 1',
      },
      {
        modele: 'Black Forest Cuckoo Clock',
        auteur: 'Robert J. Lang',
        livre: 'Origami Design Secrets Mathematical Methods for an Ancient Art',
      },
    ],
  },
  {
    intitule: t('Les modèles suivants ont été pliés par Valérie'),
    modeles: [
      { modele: 'Pergola', auteur: MOMOTANI, livre: 'Lay Out a Garden with Origami' },
      { modele: 'Flower', auteur: MOMOTANI, livre: 'Lay Out a Garden with Origami' },
      { modele: 'Home', auteur: MOMOTANI, livre: 'Origami Architectures' },
      { modele: 'Stone wall', auteur: MOMOTANI, livre: 'Origami Architectures' },
      { modele: 'A big wooden framed house', auteur: MOMOTANI, livre: 'Origami Architectures' },
    ],
  },
];

export const REMERCIEMENTS: string[] = [
  t('Le MFPP et ses adhérents.'),
  'Matthieu, Jérôme, Béatrice, Younès, Noah, Paul, Valérie, Julien', // hors traduction
];
