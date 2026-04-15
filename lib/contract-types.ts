/**
 * Catalogue des catégories de contrats récurrents dans le BTP.
 * Chaque catégorie porte un label affiché dans l'UI et dans le PDF,
 * plus des valeurs par défaut (opérations incluses/exclues, fréquence)
 * pour pré-remplir la modale de création.
 */

export type ContractCategoryKey =
  | 'entretien_piscine'
  | 'entretien_clim'
  | 'entretien_chaudiere'
  | 'entretien_jardin'
  | 'ramonage'
  | 'entretien_toiture'
  | 'nettoyage_vitres_facades'
  | 'entretien_ascenseurs_portails'
  | 'entretien_plomberie'
  | 'depannage_multitech'
  | 'entretien_securite_alarme'
  | 'desinfection_3d'
  | 'autre';

export type ContractFrequency = 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';

export interface ContractCategory {
  key: ContractCategoryKey;
  label: string;
  emoji: string;
  /** Phrase d'objet par défaut pour l'article 1 du contrat */
  service_family_label: string;
  /** Opérations typiquement incluses (pré-remplissage annexe 1) */
  default_included_operations: string[];
  /** Opérations typiquement exclues */
  default_excluded_operations: string[];
  /** Fréquence de visite par défaut */
  default_frequency: ContractFrequency;
  /** Nombre de visites incluses pour une année à la fréquence par défaut */
  default_visits_per_year: number;
  /** Dépendant de la météo / saisonnier */
  weather_dependent: boolean;
}

export const CONTRACT_CATEGORIES: ContractCategory[] = [
  {
    key: 'entretien_piscine',
    label: 'Entretien de piscine',
    emoji: '🏊',
    service_family_label: "entretien et maintenance de bassin de piscine",
    default_included_operations: [
      "Contrôle et ajustement du pH et du chlore",
      "Nettoyage du panier skimmer et du préfiltre",
      "Brossage des parois et du fond",
      "Vérification du niveau d'eau et appoint",
      "Contrôle du fonctionnement de la filtration",
    ],
    default_excluded_operations: [
      "Fourniture des produits de traitement",
      "Réparation de fuites",
      "Remplacement du liner",
      "Hivernage / remise en route complète",
    ],
    default_frequency: 'mensuel',
    default_visits_per_year: 8,
    weather_dependent: true,
  },
  {
    key: 'entretien_clim',
    label: 'Entretien climatisation / PAC / VMC',
    emoji: '❄️',
    service_family_label: "entretien des équipements de climatisation, pompe à chaleur et VMC",
    default_included_operations: [
      "Nettoyage des filtres",
      "Contrôle des pressions et températures",
      "Vérification de l'étanchéité du circuit frigorifique",
      "Contrôle des organes de sécurité",
      "Nettoyage des unités intérieures et extérieures",
    ],
    default_excluded_operations: [
      "Recharge de fluide frigorigène",
      "Remplacement de composants défectueux",
      "Travaux de mise en conformité",
    ],
    default_frequency: 'annuel',
    default_visits_per_year: 1,
    weather_dependent: false,
  },
  {
    key: 'entretien_chaudiere',
    label: 'Entretien chaudière / chauffage',
    emoji: '🔥',
    service_family_label: "entretien annuel obligatoire de l'installation de chauffage",
    default_included_operations: [
      "Nettoyage du corps de chauffe et du brûleur",
      "Contrôle du tirage et de l'évacuation des fumées",
      "Vérification des organes de sécurité",
      "Mesure des rejets polluants",
      "Remise de l'attestation d'entretien",
    ],
    default_excluded_operations: [
      "Pièces d'usure défaillantes",
      "Désembouage du circuit",
      "Détartrage du ballon",
    ],
    default_frequency: 'annuel',
    default_visits_per_year: 1,
    weather_dependent: false,
  },
  {
    key: 'entretien_jardin',
    label: 'Entretien espaces verts & jardins',
    emoji: '🌿',
    service_family_label: "entretien des espaces verts et jardins",
    default_included_operations: [
      "Tonte de la pelouse",
      "Taille des haies et arbustes",
      "Désherbage des massifs et allées",
      "Ramassage des feuilles et déchets verts",
    ],
    default_excluded_operations: [
      "Abattage d'arbres",
      "Création de massifs",
      "Évacuation vers déchèterie au-delà du forfait",
      "Fourniture de végétaux",
    ],
    default_frequency: 'mensuel',
    default_visits_per_year: 10,
    weather_dependent: true,
  },
  {
    key: 'ramonage',
    label: 'Ramonage',
    emoji: '🧹',
    service_family_label: "ramonage des conduits de fumée",
    default_included_operations: [
      "Ramonage mécanique du conduit",
      "Contrôle visuel de l'état du conduit",
      "Vérification du tirage",
      "Remise du certificat de ramonage",
    ],
    default_excluded_operations: [
      "Débistrage",
      "Réparation du conduit",
      "Remplacement du chapeau de cheminée",
    ],
    default_frequency: 'annuel',
    default_visits_per_year: 1,
    weather_dependent: false,
  },
  {
    key: 'entretien_toiture',
    label: 'Entretien toiture / démoussage',
    emoji: '🏠',
    service_family_label: "entretien et démoussage de toiture",
    default_included_operations: [
      "Démoussage de la couverture",
      "Nettoyage des gouttières",
      "Contrôle visuel de l'état des tuiles / ardoises",
      "Application d'un traitement anti-mousse hydrofuge",
    ],
    default_excluded_operations: [
      "Remplacement de tuiles cassées",
      "Réfection d'étanchéité",
      "Travaux de zinguerie",
    ],
    default_frequency: 'annuel',
    default_visits_per_year: 1,
    weather_dependent: true,
  },
  {
    key: 'nettoyage_vitres_facades',
    label: 'Nettoyage vitres & façades',
    emoji: '🪟',
    service_family_label: "nettoyage des vitres et façades",
    default_included_operations: [
      "Nettoyage des vitres intérieures et extérieures",
      "Nettoyage des encadrements",
      "Nettoyage des façades accessibles depuis le sol ou échafaudage léger",
    ],
    default_excluded_operations: [
      "Nettoyage haute pression de façade",
      "Ravalement",
      "Nettoyage nécessitant nacelle ou cordiste",
    ],
    default_frequency: 'trimestriel',
    default_visits_per_year: 4,
    weather_dependent: false,
  },
  {
    key: 'entretien_ascenseurs_portails',
    label: 'Ascenseurs, portails & portes automatiques',
    emoji: '🚪',
    service_family_label: "entretien des ascenseurs, portails et portes automatiques",
    default_included_operations: [
      "Contrôle des organes de sécurité",
      "Graissage et lubrification",
      "Test de fonctionnement",
      "Remise du compte rendu d'intervention",
    ],
    default_excluded_operations: [
      "Remplacement de moteur / carte électronique",
      "Mise en conformité réglementaire",
    ],
    default_frequency: 'semestriel',
    default_visits_per_year: 2,
    weather_dependent: false,
  },
  {
    key: 'entretien_plomberie',
    label: 'Plomberie sanitaire',
    emoji: '🚿',
    service_family_label: "entretien préventif de l'installation de plomberie sanitaire",
    default_included_operations: [
      "Contrôle des robinetteries et mitigeurs",
      "Contrôle des évacuations et siphons",
      "Détartrage des pommeaux et aérateurs",
      "Contrôle des flotteurs et chasses",
    ],
    default_excluded_operations: [
      "Débouchage de canalisation",
      "Remplacement d'éléments sanitaires",
      "Recherche de fuite",
    ],
    default_frequency: 'annuel',
    default_visits_per_year: 1,
    weather_dependent: false,
  },
  {
    key: 'depannage_multitech',
    label: 'Dépannage électrique / multi-techniques',
    emoji: '⚡',
    service_family_label: "dépannage multi-techniques avec astreinte",
    default_included_operations: [
      "Intervention de diagnostic sous 48h ouvrées",
      "Petit dépannage électrique (disjoncteur, prise, interrupteur)",
      "Remise en service après coupure",
      "Astreinte téléphonique aux horaires convenus",
    ],
    default_excluded_operations: [
      "Fourniture de pièces",
      "Travaux de mise aux normes",
      "Interventions nuit / week-end hors astreinte",
    ],
    default_frequency: 'mensuel',
    default_visits_per_year: 0,
    weather_dependent: false,
  },
  {
    key: 'entretien_securite_alarme',
    label: 'Système de sécurité / alarme',
    emoji: '🛡️',
    service_family_label: "entretien du système de sécurité et d'alarme",
    default_included_operations: [
      "Test des détecteurs et sirènes",
      "Contrôle des piles et batteries",
      "Vérification des communications GSM / IP",
      "Remise du rapport de contrôle",
    ],
    default_excluded_operations: [
      "Remplacement de détecteur",
      "Évolution du système",
      "Télésurveillance (contrat séparé)",
    ],
    default_frequency: 'semestriel',
    default_visits_per_year: 2,
    weather_dependent: false,
  },
  {
    key: 'desinfection_3d',
    label: 'Dératisation / désinsectisation / désinfection',
    emoji: '🐭',
    service_family_label: "prestations 3D (dératisation, désinsectisation, désinfection)",
    default_included_operations: [
      "Pose et contrôle des postes d'appâtage",
      "Traitement des zones à risque",
      "Remise du registre sanitaire",
    ],
    default_excluded_operations: [
      "Travaux d'obturation de passages",
      "Nettoyage de locaux souillés",
    ],
    default_frequency: 'trimestriel',
    default_visits_per_year: 4,
    weather_dependent: false,
  },
  {
    key: 'autre',
    label: 'Autre (saisie libre)',
    emoji: '📄',
    service_family_label: "prestations récurrentes sur site",
    default_included_operations: [],
    default_excluded_operations: [],
    default_frequency: 'mensuel',
    default_visits_per_year: 12,
    weather_dependent: false,
  },
];

export function getContractCategory(key: ContractCategoryKey | string | null | undefined): ContractCategory {
  const found = CONTRACT_CATEGORIES.find((c) => c.key === key);
  return found || CONTRACT_CATEGORIES[CONTRACT_CATEGORIES.length - 1];
}

export const FREQUENCY_LABELS: Record<ContractFrequency, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
};

export const FREQUENCY_PER_YEAR: Record<ContractFrequency, number> = {
  mensuel: 12,
  trimestriel: 4,
  semestriel: 2,
  annuel: 1,
};
