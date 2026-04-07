export interface FeatureDetail {
  slug: string;
  title: string;
  subtitle: string;
  heroDescription: string;
  sections: {
    title: string;
    content: string;
  }[];
  highlights: string[];
  plan: 'starter' | 'pro' | 'business';
}

export const FEATURE_DETAILS: FeatureDetail[] = [
  {
    slug: 'devis-ia',
    title: 'Devis IA vocal',
    subtitle: 'Propulse par Claude Sonnet d\'Anthropic',
    heroDescription: 'Dictez votre devis a voix haute depuis le chantier, ajoutez des photos, et l\'IA genere un chiffrage precis en quelques secondes. Fini les soirees a retaper des devis sur l\'ordinateur.',
    sections: [
      {
        title: 'Comment ca marche ?',
        content: 'Ouvrez l\'assistant IA depuis la page Devis, appuyez sur le micro et decrivez les travaux a realiser. Ajoutez des photos du chantier si necessaire. Claude Sonnet analyse votre description vocale et les images pour identifier les prestations, estimer les quantites et proposer un chiffrage coherent. Vous n\'avez plus qu\'a valider et envoyer.',
      },
      {
        title: 'Reconnaissance vocale en temps reel',
        content: 'L\'assistant utilise la Web Speech Recognition de votre navigateur (Chrome, Edge) pour transcrire votre voix en temps reel. Parlez naturellement : "Il faut refaire l\'enduit sur 45 metres carres de facade, poser 3 fenetres double vitrage et remplacer la gouttiere zinc sur 12 metres." L\'IA comprend le contexte metier du batiment.',
      },
      {
        title: 'Analyse photo intelligente',
        content: 'Prenez des photos directement depuis votre telephone. L\'IA identifie les materiaux, les surfaces, l\'etat general et en deduit les travaux necessaires. Combinee avec votre description vocale, cette analyse permet un chiffrage beaucoup plus precis.',
      },
      {
        title: 'Votre bibliotheque de prestations',
        content: 'L\'IA s\'appuie sur votre bibliotheque de prestations personnalisee : vos tarifs, vos unites, vos marges habituelles. Le devis genere respecte vos prix et vos habitudes de chiffrage. Plus vous utilisez Hellobat, plus les devis sont precis.',
      },
    ],
    highlights: [
      'Dictee vocale depuis le chantier',
      'Analyse photo par IA',
      'Chiffrage automatique base sur vos tarifs',
      'Propulse par Claude Sonnet (Anthropic)',
      'Fonctionne sur Chrome et Edge',
    ],
    plan: 'pro',
  },
  {
    slug: 'devis-factures',
    title: 'Devis & Factures',
    subtitle: 'Creation, envoi et suivi en quelques clics',
    heroDescription: 'Gerez l\'integralite de votre cycle commercial : creez des devis professionnels, transformez-les en factures d\'un clic, et suivez les paiements en temps reel. Numerotation automatique, TVA, mentions legales — tout est conforme.',
    sections: [
      {
        title: 'Devis professionnels',
        content: 'Creez des devis structures avec vos lignes de prestations, TVA par taux, conditions de reglement et mentions legales obligatoires. La numerotation suit le format D-YYYY-XXX et s\'incremente automatiquement. Ajoutez votre logo, vos coordonnees et vos conditions generales.',
      },
      {
        title: 'Transformation devis → facture',
        content: 'Quand un devis est accepte, transformez-le en facture en un clic. Toutes les lignes, montants et informations client sont repris automatiquement. La facture recoit son propre numero (F-YYYY-XXX) et peut etre envoyee immediatement.',
      },
      {
        title: 'Envoi et suivi',
        content: 'Envoyez vos devis et factures par email directement depuis Hellobat. Suivez les statuts : brouillon, envoye, accepte, refuse, paye, en retard. Le tableau de bord vous donne une vue d\'ensemble de votre chiffre d\'affaires et des montants en attente.',
      },
      {
        title: 'Templates personnalisables',
        content: 'Personnalisez l\'apparence de vos documents dans les parametres : couleurs, disposition, mentions specifiques a votre corps de metier. Vos devis et factures refletent votre identite professionnelle.',
      },
    ],
    highlights: [
      'Numerotation automatique (D-YYYY-XXX / F-YYYY-XXX)',
      'TVA multi-taux',
      'Transformation devis → facture en 1 clic',
      'Envoi par email integre',
      'Suivi des statuts en temps reel',
      'Templates personnalisables',
    ],
    plan: 'starter',
  },
  {
    slug: 'facture-electronique',
    title: 'Facture electronique 2026',
    subtitle: 'Conforme a la reforme obligatoire',
    heroDescription: 'A partir de septembre 2026, toutes les entreprises francaises devront emettre des factures electroniques. Hellobat vous prepare des maintenant avec le format Factur-X, le e-reporting et l\'archivage legal.',
    sections: [
      {
        title: 'Pourquoi c\'est obligatoire ?',
        content: 'La reforme de la facturation electronique imposee par l\'Etat francais entre en vigueur progressivement a partir de septembre 2026. Toutes les entreprises devront recevoir des factures electroniques, et les emettre selon un calendrier defini par taille d\'entreprise. L\'objectif : lutter contre la fraude a la TVA et simplifier les declarations.',
      },
      {
        title: 'Le format Factur-X',
        content: 'Hellobat genere vos factures au format Factur-X, le standard franco-allemand reconnu par l\'administration. C\'est un PDF lisible par l\'humain qui contient des donnees structurees XML lisibles par les logiciels comptables. Vos clients peuvent lire la facture normalement, et leur logiciel peut l\'importer automatiquement.',
      },
      {
        title: 'E-reporting integre',
        content: 'Pour les transactions avec des particuliers ou des entreprises etrangeres, Hellobat gere le e-reporting : la transmission des donnees de facturation a l\'administration fiscale dans les delais imposes. Vous n\'avez rien a faire manuellement.',
      },
      {
        title: 'Archivage legal',
        content: 'Vos factures sont archivees de maniere securisee et conforme aux exigences legales de conservation (10 ans). L\'integrite des documents est garantie, et vous pouvez retrouver n\'importe quelle facture en quelques secondes.',
      },
    ],
    highlights: [
      'Format Factur-X (PDF + XML)',
      'E-reporting automatique',
      'Archivage legal 10 ans',
      'Conforme des septembre 2026',
      'Rien a configurer',
    ],
    plan: 'pro',
  },
  {
    slug: 'prestations',
    title: 'Bibliotheque de prestations',
    subtitle: 'Vos services et tarifs centralises',
    heroDescription: 'Constituez votre bibliotheque de prestations avec tarifs, unites de mesure et descriptions. Reutilisez-les dans vos devis en un clic. Plus besoin de retaper les memes lignes a chaque devis.',
    sections: [
      {
        title: 'Catalogue structure',
        content: 'Organisez vos prestations par categories : gros oeuvre, second oeuvre, finitions, etc. Chaque prestation a un nom, une description, un prix unitaire HT, une unite de mesure (m², ml, forfait, heure...) et un taux de TVA. Modifiez vos tarifs a tout moment, les anciens devis ne sont pas affectes.',
      },
      {
        title: 'Insertion rapide dans les devis',
        content: 'Quand vous creez un devis, le selecteur de prestations vous propose votre bibliotheque avec recherche instantanee. Selectionnez une prestation, ajustez la quantite, et la ligne est ajoutee au devis avec le bon prix et la bonne TVA.',
      },
      {
        title: 'Utilise par l\'IA',
        content: 'L\'assistant IA devis s\'appuie sur votre bibliotheque pour generer des chiffrages coherents avec vos prix reels. Plus votre bibliotheque est complete, plus les devis IA sont precis et fideles a votre facon de travailler.',
      },
    ],
    highlights: [
      'Prix unitaire HT et TTC',
      'Unites de mesure personnalisables',
      'Recherche instantanee dans les devis',
      'Utilise par l\'assistant IA',
    ],
    plan: 'starter',
  },
  {
    slug: 'contacts',
    title: 'Carnet de contacts',
    subtitle: 'Clients, prospects et prestataires en un seul endroit',
    heroDescription: 'Centralisez tous vos contacts professionnels dans un repertoire unifie. Filtrez par type (client, prospect, prestataire), retrouvez l\'historique complet des devis, factures et chantiers associes.',
    sections: [
      {
        title: 'Fiche contact complete',
        content: 'Chaque contact dispose d\'une fiche detaillee : nom, entreprise, email, telephone, adresse complete avec autocompletion (api-adresse.data.gouv.fr). Ajoutez des notes internes pour garder le contexte : preferences, historique des echanges, particularites.',
      },
      {
        title: 'Historique complet',
        content: 'En un coup d\'oeil, retrouvez tout l\'historique d\'un contact : devis envoyes, factures emises, chantiers en cours ou termines, taches associees. C\'est la memoire de votre relation commerciale.',
      },
      {
        title: 'Recherche entreprise (Pappers)',
        content: 'Creez un contact professionnel en saisissant simplement son nom ou son SIRET. Hellobat interroge l\'API Pappers pour remplir automatiquement les informations legales : raison sociale, adresse du siege, SIREN, code NAF, forme juridique.',
      },
    ],
    highlights: [
      'Types : client, prospect, prestataire',
      'Autocompletion d\'adresse francaise',
      'Recherche entreprise par SIRET (Pappers)',
      'Historique devis, factures et chantiers',
    ],
    plan: 'starter',
  },
  {
    slug: 'signature-electronique',
    title: 'Signature electronique',
    subtitle: 'Faites signer vos devis en ligne avec DocuSeal',
    heroDescription: 'Envoyez vos devis a la signature electronique en un clic. Votre client recoit un email, signe en ligne, et vous etes notifie instantanement. Gratuit et illimite, quel que soit votre plan.',
    sections: [
      {
        title: 'Signature en ligne simple',
        content: 'Depuis la page d\'un devis, cliquez sur "Envoyer a la signature". Votre client recoit un email avec un lien securise vers le document. Il peut lire le devis, le signer electroniquement et telecharger sa copie signee. Tout se fait dans le navigateur, sans application a installer.',
      },
      {
        title: 'Suivi en temps reel',
        content: 'Suivez le statut de chaque signature : envoyee, vue, signee. Un webhook DocuSeal met a jour le statut automatiquement dans Hellobat. Vous pouvez renvoyer l\'email si le client ne l\'a pas recu.',
      },
      {
        title: 'Valeur juridique',
        content: 'La signature electronique via DocuSeal a valeur juridique au sens du reglement eIDAS. Le document signe est horodate et son integrite est verifiable. C\'est l\'equivalent legal d\'une signature manuscrite.',
      },
    ],
    highlights: [
      'Signature en un clic depuis Hellobat',
      'Email automatique au client',
      'Suivi de statut en temps reel',
      'Valeur juridique (eIDAS)',
      'Gratuit et illimite',
    ],
    plan: 'pro',
  },
  {
    slug: 'suivi-chantiers',
    title: 'Suivi de chantiers',
    subtitle: 'Pilotez vos projets de A a Z',
    heroDescription: 'Suivez chaque chantier avec une fiche complete : progression par phases, budget, documents, photos et equipe assignee. Visualisez l\'avancement de tous vos projets en un coup d\'oeil.',
    sections: [
      {
        title: 'Fiche chantier detaillee',
        content: 'Chaque chantier dispose d\'une fiche avec : client, adresse (geolocalisee), dates de debut et fin, budget, statut, notes et documents. Ajoutez des photos de suivi avec categories (avant, pendant, apres, probleme).',
      },
      {
        title: 'Phases personnalisables',
        content: 'Definissez vos propres phases de chantier dans les parametres (gros oeuvre, electricite, plomberie, finitions...). Cochez les phases terminees pour suivre la progression automatiquement. La barre de progression se met a jour en temps reel.',
      },
      {
        title: 'Lien avec devis et factures',
        content: 'Chaque chantier est lie a ses devis et factures. Vous savez exactement combien a ete devis, facture et paye sur un projet. Le suivi financier du chantier est automatique.',
      },
    ],
    highlights: [
      'Progression par phases personnalisables',
      'Photos de suivi categorisees',
      'Geolocalisation sur la carte',
      'Lien automatique devis/factures',
      'Budget et suivi financier',
    ],
    plan: 'starter',
  },
  {
    slug: 'planning-equipe',
    title: 'Planning equipe',
    subtitle: 'Planifiez vos interventions en drag & drop',
    heroDescription: 'Vue semaine et mois avec glisser-deposer pour planifier chantiers, conges, reunions et interventions. Chaque membre de l\'equipe a sa colonne, et vous visualisez les conflits en un coup d\'oeil.',
    sections: [
      {
        title: 'Vue semaine et mois',
        content: 'Basculez entre la vue semaine (detail jour par jour) et la vue mois (vue d\'ensemble). Chaque evenement est code par couleur selon son type : chantier, conge, reunion, autre. Le dirigeant apparait automatiquement comme membre virtuel.',
      },
      {
        title: 'Drag & drop intuitif',
        content: 'Deplacez les evenements d\'un jour a l\'autre, d\'un membre a l\'autre, simplement en les faisant glisser. Redimensionnez pour ajuster la duree. C\'est aussi simple qu\'un calendrier papier, mais avec la puissance du numerique.',
      },
      {
        title: 'Types d\'evenements',
        content: 'Quatre types d\'evenements : chantier (lie a un projet existant), conge, reunion et autre. Les conges sont affiches differemment pour etre reperes immediatement. Les demi-journees sont gerees.',
      },
    ],
    highlights: [
      'Vue semaine et mois',
      'Drag & drop pour planifier',
      'Code couleur par type d\'evenement',
      'Gestion des demi-journees',
      'Colonne par membre d\'equipe',
    ],
    plan: 'pro',
  },
  {
    slug: 'google-calendar',
    title: 'Google Calendar',
    subtitle: 'Synchronisation bidirectionnelle',
    heroDescription: 'Connectez votre Google Calendar a Hellobat. Vos rendez-vous, reunions et interventions sont synchronises dans les deux sens. Ajoutez un evenement dans Hellobat, il apparait dans Google Calendar, et vice versa.',
    sections: [
      {
        title: 'Connexion OAuth securisee',
        content: 'Connectez votre compte Google en un clic depuis les parametres. L\'authentification OAuth ne transmet jamais votre mot de passe a Hellobat. Les tokens sont stockes de maniere securisee en base de donnees.',
      },
      {
        title: 'Synchronisation bidirectionnelle',
        content: 'Push : quand vous creez un evenement dans le calendrier Hellobat, il est automatiquement cree dans Google Calendar. Pull : vos evenements Google Calendar sont recuperes et affiches dans Hellobat. La synchronisation utilise des tokens incrementaux pour etre rapide et efficace.',
      },
      {
        title: 'Calendrier personnel unifie',
        content: 'Votre page Calendrier dans Hellobat affiche a la fois vos evenements locaux et vos evenements Google Calendar. Vous avez une vue unifiee de toute votre activite sans jongler entre les applications.',
      },
    ],
    highlights: [
      'Connexion Google OAuth en 1 clic',
      'Sync bidirectionnelle (push + pull)',
      'Tokens incrementaux pour la performance',
      'Vue calendrier unifiee',
    ],
    plan: 'pro',
  },
  {
    slug: 'equipe',
    title: 'Equipe & sous-traitants',
    subtitle: 'Gerez toute votre equipe terrain',
    heroDescription: 'Salaries, interimaires, sous-traitants : centralisez les informations de votre equipe. Suivez les heures, assignez aux chantiers et gardez des notes sur chaque membre.',
    sections: [
      {
        title: 'Fiches membres',
        content: 'Chaque membre de l\'equipe a une fiche complete : nom, role, telephone, email, type de contrat (salarie, interimaire, sous-traitant). Ajoutez des notes internes pour garder le contexte.',
      },
      {
        title: 'Assignation aux chantiers',
        content: 'Assignez vos membres aux chantiers depuis le planning ou depuis la fiche membre. Hellobat suit qui travaille ou et quand. L\'historique des assignations est conserve pour chaque membre.',
      },
      {
        title: 'Comptes d\'equipe avec permissions',
        content: 'Invitez vos collaborateurs a se connecter a Hellobat avec leur propre compte. Definissez leur role (admin, chef d\'equipe, commercial, assistante, conducteur de travaux) et controlez precisement les sections auxquelles ils ont acces.',
      },
    ],
    highlights: [
      'Salaries, interimaires, sous-traitants',
      'Assignation aux chantiers',
      'Comptes utilisateur avec permissions',
      '5 roles differents',
      'Suivi d\'activite en temps reel',
    ],
    plan: 'pro',
  },
  {
    slug: 'carte-interactive',
    title: 'Carte interactive',
    subtitle: 'Visualisez votre activite sur une carte',
    heroDescription: 'Tous vos chantiers, prospects et contacts geolocalises sur une carte interactive Leaflet. Filtrez par statut, partagez une carte publique avec vos realisations.',
    sections: [
      {
        title: 'Carte Leaflet integree',
        content: 'La carte utilise Leaflet avec les tuiles OpenStreetMap. Chaque chantier et chaque contact avec une adresse apparait comme un marqueur cliquable. Zoomez, deplacez-vous et filtrez en temps reel.',
      },
      {
        title: 'Carte publique partageable',
        content: 'Activez la carte publique pour montrer vos realisations a vos prospects. Les chantiers marques comme publics apparaissent sur une carte accessible sans connexion. Partagez le lien sur votre site web ou vos reseaux sociaux.',
      },
    ],
    highlights: [
      'Carte Leaflet + OpenStreetMap',
      'Chantiers et contacts geolocalises',
      'Filtres par statut',
      'Carte publique partageable (plan Business)',
    ],
    plan: 'starter',
  },
  {
    slug: 'catalogues',
    title: 'Catalogues produits',
    subtitle: 'Partagez vos collections par lien magique',
    heroDescription: 'Creez des catalogues visuels avec vos produits et realisations. Partagez-les a vos clients par un lien magique — ils peuvent consulter et selectionner sans creer de compte.',
    sections: [
      {
        title: 'Collections visuelles',
        content: 'Organisez vos produits en collections thematiques. Ajoutez des photos, descriptions, prix et references. Creez autant de catalogues que necessaire pour segmenter vos offres.',
      },
      {
        title: 'Partage par lien magique',
        content: 'Generez un lien unique pour chaque envoi de catalogue. Votre client ouvre le lien dans son navigateur, consulte les produits et peut selectionner ceux qui l\'interessent. Aucune inscription requise. Vous recevez ses selections dans Hellobat.',
      },
      {
        title: 'Suivi des envois',
        content: 'Gardez une trace de chaque envoi : a qui, quand, combien de produits selectionnes. L\'historique des envois et des selections est conserve pour chaque catalogue.',
      },
    ],
    highlights: [
      'Collections de produits visuelles',
      'Lien magique sans inscription',
      'Selections client recuperees',
      'Historique des envois',
    ],
    plan: 'pro',
  },
  {
    slug: 'site-vitrine',
    title: 'Site vitrine',
    subtitle: 'Votre site web professionnel genere par IA',
    heroDescription: 'Hellobat genere un site web professionnel a partir des informations de votre profil. Votre activite, vos realisations et vos coordonnees sont mis en page automatiquement. Publiez en un clic.',
    sections: [
      {
        title: 'Generation automatique',
        content: 'L\'IA genere le contenu de votre site a partir de votre profil Hellobat : nom de l\'entreprise, activite, localisation, description. Vous obtenez un site professionnel sans avoir a ecrire une seule ligne de texte.',
      },
      {
        title: 'Publication instantanee',
        content: 'Votre site est heberge sur hellobat.app/site/votre-slug. Il est accessible publiquement et indexe par les moteurs de recherche. Aucune configuration technique, aucun hebergement a gerer.',
      },
    ],
    highlights: [
      'Contenu genere par IA',
      'Hebergement inclus sur hellobat.app',
      'Publication en 1 clic',
      'Adapte mobile',
      'Referencement naturel',
    ],
    plan: 'pro',
  },
  {
    slug: 'prospection-crm',
    title: 'Prospection CRM',
    subtitle: 'Pipeline commercial en kanban',
    heroDescription: 'Gerez vos leads avec un pipeline visuel personnalisable. Suivez chaque prospect de la decouverte a la signature, avec sources d\'acquisition et historique complet.',
    sections: [
      {
        title: 'Pipeline kanban',
        content: 'Visualisez vos prospects sur un tableau kanban avec des colonnes personnalisables : nouveau, contact, devis envoye, negocie, gagne, perdu. Deplacez les leads d\'une etape a l\'autre en drag & drop.',
      },
      {
        title: 'Sources d\'acquisition',
        content: 'Suivez d\'ou viennent vos leads : bouche a oreille, site web, Google, salon, apporteur d\'affaires. Analysez quelles sources generent le plus de chiffre d\'affaires. Personnalisez les sources selon votre activite.',
      },
      {
        title: 'Lien avec devis et contacts',
        content: 'Chaque lead est lie a un contact et peut etre associe a un devis. Quand un devis est accepte, le lead passe automatiquement en "gagne". Tout est connecte.',
      },
    ],
    highlights: [
      'Pipeline kanban personnalisable',
      'Sources d\'acquisition trackees',
      'Lien automatique devis/contacts',
      'Etapes personnalisables par utilisateur',
    ],
    plan: 'pro',
  },
  {
    slug: 'gmail-integre',
    title: 'Gmail integre',
    subtitle: 'Votre boite mail dans Hellobat',
    heroDescription: 'Connectez votre compte Gmail et gerez vos emails directement depuis Hellobat. Envoyez, recevez, repondez et utilisez l\'IA pour generer des reponses contextualisees avec l\'historique client.',
    sections: [
      {
        title: 'Boite de reception integree',
        content: 'Votre inbox Gmail est affichee directement dans Hellobat. Lisez vos messages, archivez, marquez comme important ou supprimez sans quitter l\'application. Les messages envoyes et les brouillons sont egalement accessibles.',
      },
      {
        title: 'Envoi et reponse',
        content: 'Envoyez de nouveaux emails ou repondez directement depuis Hellobat. Les emails sont envoyes depuis votre adresse Gmail reelle. Vos correspondants ne voient aucune difference.',
      },
      {
        title: 'Reponse IA contextualisee',
        content: 'L\'IA peut generer une reponse a un email en tenant compte du contexte client : devis en cours, factures, chantiers. Par exemple, si un client demande l\'avancement de son chantier, l\'IA recupere les informations du projet pour rediger une reponse pertinente.',
      },
    ],
    highlights: [
      'Inbox, envoyes, brouillons',
      'Envoi depuis votre adresse Gmail',
      'Reponse IA avec contexte client',
      'Star, archive, suppression',
      'Connexion OAuth securisee',
    ],
    plan: 'pro',
  },
  {
    slug: 'avis-google',
    title: 'Avis Google Business',
    subtitle: 'Gerez votre reputation en ligne',
    heroDescription: 'Connectez votre fiche Google Business et gerez vos avis clients depuis Hellobat. Repondez aux avis, suivez votre note moyenne et ameliorez votre visibilite locale.',
    sections: [
      {
        title: 'Connexion Google Business',
        content: 'Connectez votre fiche Google Business en quelques clics via OAuth. Selectionnez votre etablissement si vous en avez plusieurs. Hellobat recupere automatiquement tous vos avis existants.',
      },
      {
        title: 'Gestion des avis',
        content: 'Consultez tous vos avis dans une interface claire. Repondez directement depuis Hellobat — la reponse est publiee sur Google. Suivez les nouveaux avis et les notes attribuees.',
      },
    ],
    highlights: [
      'Connexion Google Business OAuth',
      'Consultation et reponse aux avis',
      'Publication directe sur Google',
      'Suivi de la note moyenne',
    ],
    plan: 'pro',
  },
  {
    slug: 'paiements-stripe',
    title: 'Paiements Stripe',
    subtitle: 'Acceptez les paiements en ligne',
    heroDescription: 'Integrez Stripe a vos factures pour accepter les paiements par carte bancaire, virement et prelevement. Lien de paiement automatique, suivi en temps reel et reconciliation instantanee.',
    sections: [
      {
        title: 'Paiement par lien',
        content: 'Chaque facture peut inclure un lien de paiement Stripe. Votre client clique, paie par carte ou virement, et la facture est automatiquement marquee comme payee dans Hellobat. Pas de relance a faire.',
      },
      {
        title: 'Portail client Stripe',
        content: 'Vos clients ont acces a un portail Stripe pour gerer leurs moyens de paiement, consulter leurs factures et telecharger leurs recus. Tout est gere par Stripe, vous n\'avez rien a maintenir.',
      },
      {
        title: 'Suivi en temps reel',
        content: 'Le tableau de bord affiche les paiements recus, en attente et en retard. Les webhooks Stripe mettent a jour les statuts en temps reel. Vous savez exactement ou en est chaque paiement.',
      },
    ],
    highlights: [
      'Carte bancaire, virement, prelevement',
      'Lien de paiement automatique',
      'Mise a jour en temps reel (webhooks)',
      'Portail client Stripe',
    ],
    plan: 'business',
  },
  {
    slug: 'contrats-recurrents',
    title: 'Contrats recurrents',
    subtitle: 'Contrats d\'entretien avec facturation automatique',
    heroDescription: 'Gerez vos contrats de maintenance et d\'entretien avec facturation recurrente automatique. Suivez votre MRR (revenu mensuel recurrent) et ne manquez plus aucune echeance.',
    sections: [
      {
        title: 'Creation de contrats',
        content: 'Creez un contrat recurrent a partir d\'un devis accepte ou directement. Definissez la frequence (mensuelle, trimestrielle, annuelle), le montant et la date de debut. Hellobat genere automatiquement les factures aux echeances prevues.',
      },
      {
        title: 'Facturation automatique',
        content: 'A chaque echeance, Hellobat genere la facture correspondante et peut l\'envoyer automatiquement au client. Plus de factures oubliees, plus de retards de facturation.',
      },
      {
        title: 'Suivi MRR',
        content: 'Le tableau de bord affiche votre MRR (Monthly Recurring Revenue) : combien de revenus recurrents vos contrats generent par mois. Suivez l\'evolution dans le temps et identifiez les contrats a renouveler.',
      },
    ],
    highlights: [
      'Frequence mensuelle, trimestrielle, annuelle',
      'Facturation automatique aux echeances',
      'Suivi MRR en temps reel',
      'Lie aux devis acceptes',
    ],
    plan: 'business',
  },
  {
    slug: 'comptabilite-ia',
    title: 'Comptabilite IA',
    subtitle: 'Suivi financier automatise',
    heroDescription: 'Suivez vos revenus, depenses et marges avec categorisation automatique par IA. Hellobat analyse vos operations et vous donne une vision claire de la sante financiere de votre entreprise.',
    sections: [
      {
        title: 'Suivi des depenses',
        content: 'Enregistrez vos depenses manuellement ou laissez l\'IA les categoriser automatiquement : materiaux, sous-traitance, vehicule, assurance, etc. Associez les depenses a des chantiers pour un suivi projet par projet.',
      },
      {
        title: 'Tableau de bord financier',
        content: 'Visualisez vos revenus, depenses et marges sur des graphiques clairs. Filtrez par periode, par chantier ou par categorie. Identifiez les projets les plus rentables et ceux qui depassent le budget.',
      },
      {
        title: 'Rappels fiscaux',
        content: 'Hellobat vous rappelle vos echeances fiscales et sociales : TVA, charges sociales, CFE, DSN. Configurez votre regime fiscal dans les parametres et recevez des rappels adaptes a votre situation.',
      },
    ],
    highlights: [
      'Categorisation automatique par IA',
      'Depenses par chantier',
      'Graphiques revenus/depenses/marges',
      'Rappels fiscaux personnalises',
    ],
    plan: 'business',
  },
  {
    slug: 'agents-ia',
    title: 'Agents IA specialises',
    subtitle: '5 assistants intelligents pour le batiment',
    heroDescription: 'Hellobat integre 5 agents IA specialises dans le batiment : diagnostic de pannes, reglementation DTU, chiffrage rapide, conseil juridique et accompagnement RGE/CEE. Posez vos questions, obtenez des reponses precises.',
    sections: [
      {
        title: 'Agent Pannes',
        content: 'Decrivez un probleme rencontre sur un chantier (fuite, fissure, dysfonctionnement electrique...) et l\'agent vous guide dans le diagnostic. Il identifie les causes probables, les verifications a effectuer et les solutions recommandees.',
      },
      {
        title: 'Agent DTU',
        content: 'Interrogez l\'agent sur les Documents Techniques Unifies applicables a vos travaux. Il connait les DTU en vigueur et vous indique les regles a respecter : epaisseurs, pentes, joints, tolerances.',
      },
      {
        title: 'Agent Chiffreur',
        content: 'Decrivez des travaux et obtenez une estimation rapide basee sur les prix du marche. Utile pour une premiere approche budgetaire avant de faire un devis detaille.',
      },
      {
        title: 'Agent Juridique',
        content: 'Posez vos questions sur la reglementation du batiment : garanties, assurances, responsabilites, litiges. L\'agent vous oriente sur vos droits et obligations.',
      },
      {
        title: 'Agent RGE/CEE',
        content: 'Informez-vous sur les certifications RGE et les Certificats d\'Economies d\'Energie. L\'agent vous aide a comprendre les demarches, les criteres d\'eligibilite et les aides disponibles pour vos clients.',
      },
    ],
    highlights: [
      '5 agents specialises batiment',
      'Conversations avec historique',
      'Base de connaissances PDF',
      'IA illimitee sur le plan Business',
    ],
    plan: 'business',
  },
  {
    slug: 'plans-rendus-ia',
    title: 'Plans & Rendus IA',
    subtitle: 'Visualisez vos projets avant de construire',
    heroDescription: 'Generez des plans et des rendus visuels a partir de descriptions textuelles. L\'IA cree des representations de vos projets pour aider vos clients a se projeter.',
    sections: [
      {
        title: 'Generation de plans',
        content: 'Decrivez votre projet et l\'IA genere un plan schematique. Utile pour les premiers echanges avec le client, avant de passer par un architecte pour les plans definitifs.',
      },
      {
        title: 'Rendus visuels',
        content: 'Obtenez des rendus visuels de vos projets : facades, amenagements interieurs, exterieur. Les rendus aident vos clients a visualiser le resultat final et facilitent la prise de decision.',
      },
    ],
    highlights: [
      'Plans generes par IA',
      'Rendus visuels de projets',
      'Aide a la decision client',
    ],
    plan: 'business',
  },
];

export function getFeatureBySlug(slug: string): FeatureDetail | undefined {
  return FEATURE_DETAILS.find((f) => f.slug === slug);
}

export function getAllFeatureSlugs(): string[] {
  return FEATURE_DETAILS.map((f) => f.slug);
}
