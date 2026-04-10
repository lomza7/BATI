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
    subtitle: 'Propulsé par Claude Sonnet d\'Anthropic',
    heroDescription: 'Dictez votre devis à voix haute depuis le chantier, ajoutez des photos, et l\'IA génère un chiffrage précis en quelques secondes. Fini les soirées à retaper des devis sur l\'ordinateur.',
    sections: [
      {
        title: 'Comment ça marche ?',
        content: 'Ouvrez l\'assistant IA depuis la page Devis, appuyez sur le micro et décrivez les travaux à réaliser. Ajoutez des photos du chantier si nécessaire. Claude Sonnet analyse votre description vocale et les images pour identifier les prestations, estimer les quantités et proposer un chiffrage cohérent. Vous n\'avez plus qu\'à valider et envoyer.',
      },
      {
        title: 'Reconnaissance vocale en temps réel',
        content: 'L\'assistant utilise la Web Speech Recognition de votre navigateur (Chrome, Edge) pour transcrire votre voix en temps réel. Parlez naturellement : "Il faut refaire l\'enduit sur 45 mètres carrés de façade, poser 3 fenêtres double vitrage et remplacer la gouttière zinc sur 12 mètres." L\'IA comprend le contexte métier du bâtiment.',
      },
      {
        title: 'Analyse photo intelligente',
        content: 'Prenez des photos directement depuis votre téléphone. L\'IA identifie les matériaux, les surfaces, l\'état général et en déduit les travaux nécessaires. Combinée avec votre description vocale, cette analyse permet un chiffrage beaucoup plus précis.',
      },
      {
        title: 'Votre bibliothèque de prestations',
        content: 'L\'IA s\'appuie sur votre bibliothèque de prestations personnalisée : vos tarifs, vos unités, vos marges habituelles. Le devis généré respecte vos prix et vos habitudes de chiffrage. Plus vous utilisez Hellobat, plus les devis sont précis.',
      },
    ],
    highlights: [
      'Dictée vocale depuis le chantier',
      'Analyse photo par IA',
      'Chiffrage automatique basé sur vos tarifs',
      'Propulsé par Claude Sonnet (Anthropic)',
      'Fonctionne sur Chrome et Edge',
    ],
    plan: 'pro',
  },
  {
    slug: 'devis-factures',
    title: 'Devis & Factures',
    subtitle: 'Création, envoi et suivi en quelques clics',
    heroDescription: 'Gérez l\'intégralité de votre cycle commercial : créez des devis professionnels, transformez-les en factures d\'un clic, et suivez les paiements en temps réel. Numérotation automatique, TVA, mentions légales — tout est conforme.',
    sections: [
      {
        title: 'Devis professionnels',
        content: 'Créez des devis structurés avec vos lignes de prestations, TVA par taux, conditions de règlement et mentions légales obligatoires. La numérotation suit le format D-YYYY-XXX et s\'incrémente automatiquement. Ajoutez votre logo, vos coordonnées et vos conditions générales.',
      },
      {
        title: 'Transformation devis → facture',
        content: 'Quand un devis est accepté, transformez-le en facture en un clic. Toutes les lignes, montants et informations client sont repris automatiquement. La facture reçoit son propre numéro (F-YYYY-XXX) et peut être envoyée immédiatement.',
      },
      {
        title: 'Envoi et suivi',
        content: 'Envoyez vos devis et factures par email directement depuis Hellobat. Suivez les statuts : brouillon, envoyé, accepté, refusé, payé, en retard. Le tableau de bord vous donne une vue d\'ensemble de votre chiffre d\'affaires et des montants en attente.',
      },
      {
        title: 'Templates personnalisables',
        content: 'Personnalisez l\'apparence de vos documents dans les paramètres : couleurs, disposition, mentions spécifiques à votre corps de métier. Vos devis et factures reflètent votre identité professionnelle.',
      },
    ],
    highlights: [
      'Numérotation automatique (D-YYYY-XXX / F-YYYY-XXX)',
      'TVA multi-taux',
      'Transformation devis → facture en 1 clic',
      'Envoi par email intégré',
      'Suivi des statuts en temps réel',
      'Templates personnalisables',
    ],
    plan: 'starter',
  },
  {
    slug: 'facture-electronique',
    title: 'Facture électronique 2026',
    subtitle: 'Conforme à la réforme obligatoire',
    heroDescription: 'À partir de septembre 2026, toutes les entreprises françaises devront émettre des factures électroniques. Hellobat vous prépare dès maintenant avec le format Factur-X, le e-reporting et l\'archivage légal.',
    sections: [
      {
        title: 'Pourquoi c\'est obligatoire ?',
        content: 'La réforme de la facturation électronique imposée par l\'État français entre en vigueur progressivement à partir de septembre 2026. Toutes les entreprises devront recevoir des factures électroniques, et les émettre selon un calendrier défini par taille d\'entreprise. L\'objectif : lutter contre la fraude à la TVA et simplifier les déclarations.',
      },
      {
        title: 'Le format Factur-X',
        content: 'Hellobat génère vos factures au format Factur-X, le standard franco-allemand reconnu par l\'administration. C\'est un PDF lisible par l\'humain qui contient des données structurées XML lisibles par les logiciels comptables. Vos clients peuvent lire la facture normalement, et leur logiciel peut l\'importer automatiquement.',
      },
      {
        title: 'E-reporting intégré',
        content: 'Pour les transactions avec des particuliers ou des entreprises étrangères, Hellobat gère le e-reporting : la transmission des données de facturation à l\'administration fiscale dans les délais imposés. Vous n\'avez rien à faire manuellement.',
      },
      {
        title: 'Archivage légal',
        content: 'Vos factures sont archivées de manière sécurisée et conforme aux exigences légales de conservation (10 ans). L\'intégrité des documents est garantie, et vous pouvez retrouver n\'importe quelle facture en quelques secondes.',
      },
    ],
    highlights: [
      'Format Factur-X (PDF + XML)',
      'E-reporting automatique',
      'Archivage légal 10 ans',
      'Conforme dès septembre 2026',
      'Rien à configurer',
    ],
    plan: 'pro',
  },
  {
    slug: 'prestations',
    title: 'Bibliothèque de prestations',
    subtitle: 'Vos services et tarifs centralisés',
    heroDescription: 'Constituez votre bibliothèque de prestations avec tarifs, unités de mesure et descriptions. Réutilisez-les dans vos devis en un clic. Plus besoin de retaper les mêmes lignes à chaque devis.',
    sections: [
      {
        title: 'Catalogue structuré',
        content: 'Organisez vos prestations par catégories : gros œuvre, second œuvre, finitions, etc. Chaque prestation a un nom, une description, un prix unitaire HT, une unité de mesure (m², ml, forfait, heure...) et un taux de TVA. Modifiez vos tarifs à tout moment, les anciens devis ne sont pas affectés.',
      },
      {
        title: 'Insertion rapide dans les devis',
        content: 'Quand vous créez un devis, le sélecteur de prestations vous propose votre bibliothèque avec recherche instantanée. Sélectionnez une prestation, ajustez la quantité, et la ligne est ajoutée au devis avec le bon prix et la bonne TVA.',
      },
      {
        title: 'Utilisé par l\'IA',
        content: 'L\'assistant IA devis s\'appuie sur votre bibliothèque pour générer des chiffrages cohérents avec vos prix réels. Plus votre bibliothèque est complète, plus les devis IA sont précis et fidèles à votre façon de travailler.',
      },
    ],
    highlights: [
      'Prix unitaire HT et TTC',
      'Unités de mesure personnalisables',
      'Recherche instantanée dans les devis',
      'Utilisé par l\'assistant IA',
    ],
    plan: 'starter',
  },
  {
    slug: 'contacts',
    title: 'Carnet de contacts',
    subtitle: 'Clients, prospects et prestataires en un seul endroit',
    heroDescription: 'Centralisez tous vos contacts professionnels dans un répertoire unifié. Filtrez par type (client, prospect, prestataire), retrouvez l\'historique complet des devis, factures et chantiers associés.',
    sections: [
      {
        title: 'Fiche contact complète',
        content: 'Chaque contact dispose d\'une fiche détaillée : nom, entreprise, email, téléphone, adresse complète avec autocomplétion (api-adresse.data.gouv.fr). Ajoutez des notes internes pour garder le contexte : préférences, historique des échanges, particularités.',
      },
      {
        title: 'Historique complet',
        content: 'En un coup d\'œil, retrouvez tout l\'historique d\'un contact : devis envoyés, factures émises, chantiers en cours ou terminés, tâches associées. C\'est la mémoire de votre relation commerciale.',
      },
      {
        title: 'Recherche entreprise (Pappers)',
        content: 'Créez un contact professionnel en saisissant simplement son nom ou son SIRET. Hellobat interroge l\'API Pappers pour remplir automatiquement les informations légales : raison sociale, adresse du siège, SIREN, code NAF, forme juridique.',
      },
    ],
    highlights: [
      'Types : client, prospect, prestataire',
      'Autocomplétion d\'adresse française',
      'Recherche entreprise par SIRET (Pappers)',
      'Historique devis, factures et chantiers',
    ],
    plan: 'starter',
  },
  {
    slug: 'signature-electronique',
    title: 'Signature électronique',
    subtitle: 'Faites signer vos devis en ligne avec DocuSeal',
    heroDescription: 'Envoyez vos devis à la signature électronique en un clic. Votre client reçoit un email, signe en ligne, et vous êtes notifié instantanément. Gratuit et illimité, quel que soit votre plan.',
    sections: [
      {
        title: 'Signature en ligne simple',
        content: 'Depuis la page d\'un devis, cliquez sur "Envoyer à la signature". Votre client reçoit un email avec un lien sécurisé vers le document. Il peut lire le devis, le signer électroniquement et télécharger sa copie signée. Tout se fait dans le navigateur, sans application à installer.',
      },
      {
        title: 'Suivi en temps réel',
        content: 'Suivez le statut de chaque signature : envoyée, vue, signée. Un webhook DocuSeal met à jour le statut automatiquement dans Hellobat. Vous pouvez renvoyer l\'email si le client ne l\'a pas reçu.',
      },
      {
        title: 'Valeur juridique',
        content: 'La signature électronique via DocuSeal a valeur juridique au sens du règlement eIDAS. Le document signé est horodaté et son intégrité est vérifiable. C\'est l\'équivalent légal d\'une signature manuscrite.',
      },
    ],
    highlights: [
      'Signature en un clic depuis Hellobat',
      'Email automatique au client',
      'Suivi de statut en temps réel',
      'Valeur juridique (eIDAS)',
      'Gratuit et illimité',
    ],
    plan: 'pro',
  },
  {
    slug: 'suivi-chantiers',
    title: 'Suivi de chantiers',
    subtitle: 'Pilotez vos projets de A à Z',
    heroDescription: 'Suivez chaque chantier avec une fiche complète : progression par phases, budget, documents, photos et équipe assignée. Visualisez l\'avancement de tous vos projets en un coup d\'œil.',
    sections: [
      {
        title: 'Fiche chantier détaillée',
        content: 'Chaque chantier dispose d\'une fiche avec : client, adresse (géolocalisée), dates de début et fin, budget, statut, notes et documents. Ajoutez des photos de suivi avec catégories (avant, pendant, après, problème).',
      },
      {
        title: 'Phases personnalisables',
        content: 'Définissez vos propres phases de chantier dans les paramètres (gros œuvre, électricité, plomberie, finitions...). Cochez les phases terminées pour suivre la progression automatiquement. La barre de progression se met à jour en temps réel.',
      },
      {
        title: 'Lien avec devis et factures',
        content: 'Chaque chantier est lié à ses devis et factures. Vous savez exactement combien a été devisé, facturé et payé sur un projet. Le suivi financier du chantier est automatique.',
      },
    ],
    highlights: [
      'Progression par phases personnalisables',
      'Photos de suivi catégorisées',
      'Géolocalisation sur la carte',
      'Lien automatique devis/factures',
      'Budget et suivi financier',
    ],
    plan: 'starter',
  },
  {
    slug: 'planning-equipe',
    title: 'Planning équipe',
    subtitle: 'Planifiez vos interventions en drag & drop',
    heroDescription: 'Vue semaine et mois avec glisser-déposer pour planifier chantiers, congés, réunions et interventions. Chaque membre de l\'équipe a sa colonne, et vous visualisez les conflits en un coup d\'œil.',
    sections: [
      {
        title: 'Vue semaine et mois',
        content: 'Basculez entre la vue semaine (détail jour par jour) et la vue mois (vue d\'ensemble). Chaque événement est codé par couleur selon son type : chantier, congé, réunion, autre. Le dirigeant apparaît automatiquement comme membre virtuel.',
      },
      {
        title: 'Drag & drop intuitif',
        content: 'Déplacez les événements d\'un jour à l\'autre, d\'un membre à l\'autre, simplement en les faisant glisser. Redimensionnez pour ajuster la durée. C\'est aussi simple qu\'un calendrier papier, mais avec la puissance du numérique.',
      },
      {
        title: 'Types d\'événements',
        content: 'Quatre types d\'événements : chantier (lié à un projet existant), congé, réunion et autre. Les congés sont affichés différemment pour être repérés immédiatement. Les demi-journées sont gérées.',
      },
    ],
    highlights: [
      'Vue semaine et mois',
      'Drag & drop pour planifier',
      'Code couleur par type d\'événement',
      'Gestion des demi-journées',
      'Colonne par membre d\'équipe',
    ],
    plan: 'pro',
  },
  {
    slug: 'google-calendar',
    title: 'Google Calendar',
    subtitle: 'Synchronisation bidirectionnelle',
    heroDescription: 'Connectez votre Google Calendar à Hellobat. Vos rendez-vous, réunions et interventions sont synchronisés dans les deux sens. Ajoutez un événement dans Hellobat, il apparaît dans Google Calendar, et vice versa.',
    sections: [
      {
        title: 'Connexion OAuth sécurisée',
        content: 'Connectez votre compte Google en un clic depuis les paramètres. L\'authentification OAuth ne transmet jamais votre mot de passe à Hellobat. Les tokens sont stockés de manière sécurisée en base de données.',
      },
      {
        title: 'Synchronisation bidirectionnelle',
        content: 'Push : quand vous créez un événement dans le calendrier Hellobat, il est automatiquement créé dans Google Calendar. Pull : vos événements Google Calendar sont récupérés et affichés dans Hellobat. La synchronisation utilise des tokens incrémentaux pour être rapide et efficace.',
      },
      {
        title: 'Calendrier personnel unifié',
        content: 'Votre page Calendrier dans Hellobat affiche à la fois vos événements locaux et vos événements Google Calendar. Vous avez une vue unifiée de toute votre activité sans jongler entre les applications.',
      },
    ],
    highlights: [
      'Connexion Google OAuth en 1 clic',
      'Sync bidirectionnelle (push + pull)',
      'Tokens incrémentaux pour la performance',
      'Vue calendrier unifiée',
    ],
    plan: 'pro',
  },
  {
    slug: 'equipe',
    title: 'Équipe & sous-traitants',
    subtitle: 'Gérez toute votre équipe terrain',
    heroDescription: 'Salariés, intérimaires, sous-traitants : centralisez les informations de votre équipe. Suivez les heures, assignez aux chantiers et gardez des notes sur chaque membre.',
    sections: [
      {
        title: 'Fiches membres',
        content: 'Chaque membre de l\'équipe a une fiche complète : nom, rôle, téléphone, email, type de contrat (salarié, intérimaire, sous-traitant). Ajoutez des notes internes pour garder le contexte.',
      },
      {
        title: 'Assignation aux chantiers',
        content: 'Assignez vos membres aux chantiers depuis le planning ou depuis la fiche membre. Hellobat suit qui travaille où et quand. L\'historique des assignations est conservé pour chaque membre.',
      },
      {
        title: 'Comptes d\'équipe avec permissions',
        content: 'Invitez vos collaborateurs à se connecter à Hellobat avec leur propre compte. Définissez leur rôle (admin, chef d\'équipe, commercial, assistante, conducteur de travaux) et contrôlez précisément les sections auxquelles ils ont accès.',
      },
    ],
    highlights: [
      'Salariés, intérimaires, sous-traitants',
      'Assignation aux chantiers',
      'Comptes utilisateur avec permissions',
      '5 rôles différents',
      'Suivi d\'activité en temps réel',
    ],
    plan: 'pro',
  },
  {
    slug: 'carte-interactive',
    title: 'Carte interactive',
    subtitle: 'Visualisez votre activité sur une carte',
    heroDescription: 'Tous vos chantiers, prospects et contacts géolocalisés sur une carte interactive Leaflet. Filtrez par statut, partagez une carte publique avec vos réalisations.',
    sections: [
      {
        title: 'Carte Leaflet intégrée',
        content: 'La carte utilise Leaflet avec les tuiles OpenStreetMap. Chaque chantier et chaque contact avec une adresse apparaît comme un marqueur cliquable. Zoomez, déplacez-vous et filtrez en temps réel.',
      },
      {
        title: 'Carte publique partageable',
        content: 'Activez la carte publique pour montrer vos réalisations à vos prospects. Les chantiers marqués comme publics apparaissent sur une carte accessible sans connexion. Partagez le lien sur votre site web ou vos réseaux sociaux.',
      },
    ],
    highlights: [
      'Carte Leaflet + OpenStreetMap',
      'Chantiers et contacts géolocalisés',
      'Filtres par statut',
      'Carte publique partageable (plan Business)',
    ],
    plan: 'starter',
  },
  {
    slug: 'catalogues',
    title: 'Catalogues produits',
    subtitle: 'Partagez vos collections par lien magique',
    heroDescription: 'Créez des catalogues visuels avec vos produits et réalisations. Partagez-les à vos clients par un lien magique — ils peuvent consulter et sélectionner sans créer de compte.',
    sections: [
      {
        title: 'Collections visuelles',
        content: 'Organisez vos produits en collections thématiques. Ajoutez des photos, descriptions, prix et références. Créez autant de catalogues que nécessaire pour segmenter vos offres.',
      },
      {
        title: 'Partage par lien magique',
        content: 'Générez un lien unique pour chaque envoi de catalogue. Votre client ouvre le lien dans son navigateur, consulte les produits et peut sélectionner ceux qui l\'intéressent. Aucune inscription requise. Vous recevez ses sélections dans Hellobat.',
      },
      {
        title: 'Suivi des envois',
        content: 'Gardez une trace de chaque envoi : à qui, quand, combien de produits sélectionnés. L\'historique des envois et des sélections est conservé pour chaque catalogue.',
      },
    ],
    highlights: [
      'Collections de produits visuelles',
      'Lien magique sans inscription',
      'Sélections client récupérées',
      'Historique des envois',
    ],
    plan: 'pro',
  },
  {
    slug: 'site-vitrine',
    title: 'Site vitrine',
    subtitle: 'Votre site web professionnel généré par IA',
    heroDescription: 'Hellobat génère un site web professionnel à partir des informations de votre profil. Votre activité, vos réalisations et vos coordonnées sont mis en page automatiquement. Publiez en un clic.',
    sections: [
      {
        title: 'Génération automatique',
        content: 'L\'IA génère le contenu de votre site à partir de votre profil Hellobat : nom de l\'entreprise, activité, localisation, description. Vous obtenez un site professionnel sans avoir à écrire une seule ligne de texte.',
      },
      {
        title: 'Publication instantanée',
        content: 'Votre site est hébergé sur votre-slug.hellobat.app. Il est accessible publiquement et indexé par les moteurs de recherche. Aucune configuration technique, aucun hébergement à gérer.',
      },
    ],
    highlights: [
      'Contenu généré par IA',
      'Hébergement inclus sur hellobat.app',
      'Publication en 1 clic',
      'Adapté mobile',
      'Référencement naturel',
    ],
    plan: 'pro',
  },
  {
    slug: 'prospection-crm',
    title: 'Prospection CRM',
    subtitle: 'Pipeline commercial en kanban',
    heroDescription: 'Gérez vos leads avec un pipeline visuel personnalisable. Suivez chaque prospect de la découverte à la signature, avec sources d\'acquisition et historique complet.',
    sections: [
      {
        title: 'Pipeline kanban',
        content: 'Visualisez vos prospects sur un tableau kanban avec des colonnes personnalisables : nouveau, contacté, devis envoyé, négocié, gagné, perdu. Déplacez les leads d\'une étape à l\'autre en drag & drop.',
      },
      {
        title: 'Sources d\'acquisition',
        content: 'Suivez d\'où viennent vos leads : bouche à oreille, site web, Google, salon, apporteur d\'affaires. Analysez quelles sources génèrent le plus de chiffre d\'affaires. Personnalisez les sources selon votre activité.',
      },
      {
        title: 'Lien avec devis et contacts',
        content: 'Chaque lead est lié à un contact et peut être associé à un devis. Quand un devis est accepté, le lead passe automatiquement en "gagné". Tout est connecté.',
      },
    ],
    highlights: [
      'Pipeline kanban personnalisable',
      'Sources d\'acquisition trackées',
      'Lien automatique devis/contacts',
      'Étapes personnalisables par utilisateur',
    ],
    plan: 'pro',
  },
  {
    slug: 'gmail-integre',
    title: 'Gmail intégré',
    subtitle: 'Votre boîte mail dans Hellobat',
    heroDescription: 'Connectez votre compte Gmail et gérez vos emails directement depuis Hellobat. Envoyez, recevez, répondez et utilisez l\'IA pour générer des réponses contextualisées avec l\'historique client.',
    sections: [
      {
        title: 'Boîte de réception intégrée',
        content: 'Votre inbox Gmail est affichée directement dans Hellobat. Lisez vos messages, archivez, marquez comme important ou supprimez sans quitter l\'application. Les messages envoyés et les brouillons sont également accessibles.',
      },
      {
        title: 'Envoi et réponse',
        content: 'Envoyez de nouveaux emails ou répondez directement depuis Hellobat. Les emails sont envoyés depuis votre adresse Gmail réelle. Vos correspondants ne voient aucune différence.',
      },
      {
        title: 'Réponse IA contextualisée',
        content: 'L\'IA peut générer une réponse à un email en tenant compte du contexte client : devis en cours, factures, chantiers. Par exemple, si un client demande l\'avancement de son chantier, l\'IA récupère les informations du projet pour rédiger une réponse pertinente.',
      },
    ],
    highlights: [
      'Inbox, envoyés, brouillons',
      'Envoi depuis votre adresse Gmail',
      'Réponse IA avec contexte client',
      'Star, archive, suppression',
      'Connexion OAuth sécurisée',
    ],
    plan: 'pro',
  },
  {
    slug: 'avis-google',
    title: 'Avis Google Business',
    subtitle: 'Gérez votre réputation en ligne',
    heroDescription: 'Connectez votre fiche Google Business et gérez vos avis clients depuis Hellobat. Répondez aux avis, suivez votre note moyenne et améliorez votre visibilité locale.',
    sections: [
      {
        title: 'Connexion Google Business',
        content: 'Connectez votre fiche Google Business en quelques clics via OAuth. Sélectionnez votre établissement si vous en avez plusieurs. Hellobat récupère automatiquement tous vos avis existants.',
      },
      {
        title: 'Gestion des avis',
        content: 'Consultez tous vos avis dans une interface claire. Répondez directement depuis Hellobat — la réponse est publiée sur Google. Suivez les nouveaux avis et les notes attribuées.',
      },
    ],
    highlights: [
      'Connexion Google Business OAuth',
      'Consultation et réponse aux avis',
      'Publication directe sur Google',
      'Suivi de la note moyenne',
    ],
    plan: 'pro',
  },
  {
    slug: 'paiements-stripe',
    title: 'Paiements Stripe',
    subtitle: 'Acceptez les paiements en ligne',
    heroDescription: 'Intégrez Stripe à vos factures pour accepter les paiements par carte bancaire, virement et prélèvement. Lien de paiement automatique, suivi en temps réel et réconciliation instantanée.',
    sections: [
      {
        title: 'Paiement par lien',
        content: 'Chaque facture peut inclure un lien de paiement Stripe. Votre client clique, paie par carte ou virement, et la facture est automatiquement marquée comme payée dans Hellobat. Pas de relance à faire.',
      },
      {
        title: 'Portail client Stripe',
        content: 'Vos clients ont accès à un portail Stripe pour gérer leurs moyens de paiement, consulter leurs factures et télécharger leurs reçus. Tout est géré par Stripe, vous n\'avez rien à maintenir.',
      },
      {
        title: 'Suivi en temps réel',
        content: 'Le tableau de bord affiche les paiements reçus, en attente et en retard. Les webhooks Stripe mettent à jour les statuts en temps réel. Vous savez exactement où en est chaque paiement.',
      },
    ],
    highlights: [
      'Carte bancaire, virement, prélèvement',
      'Lien de paiement automatique',
      'Mise à jour en temps réel (webhooks)',
      'Portail client Stripe',
    ],
    plan: 'business',
  },
  {
    slug: 'contrats-recurrents',
    title: 'Contrats récurrents',
    subtitle: 'Contrats d\'entretien avec facturation automatique',
    heroDescription: 'Gérez vos contrats de maintenance et d\'entretien avec facturation récurrente automatique. Suivez votre MRR (revenu mensuel récurrent) et ne manquez plus aucune échéance.',
    sections: [
      {
        title: 'Création de contrats',
        content: 'Créez un contrat récurrent à partir d\'un devis accepté ou directement. Définissez la fréquence (mensuelle, trimestrielle, annuelle), le montant et la date de début. Hellobat génère automatiquement les factures aux échéances prévues.',
      },
      {
        title: 'Facturation automatique',
        content: 'À chaque échéance, Hellobat génère la facture correspondante et peut l\'envoyer automatiquement au client. Plus de factures oubliées, plus de retards de facturation.',
      },
      {
        title: 'Suivi MRR',
        content: 'Le tableau de bord affiche votre MRR (Monthly Recurring Revenue) : combien de revenus récurrents vos contrats génèrent par mois. Suivez l\'évolution dans le temps et identifiez les contrats à renouveler.',
      },
    ],
    highlights: [
      'Fréquence mensuelle, trimestrielle, annuelle',
      'Facturation automatique aux échéances',
      'Suivi MRR en temps réel',
      'Lié aux devis acceptés',
    ],
    plan: 'business',
  },
  {
    slug: 'comptabilite-ia',
    title: 'Maurice — Comptable IA',
    subtitle: 'Le comptable qui ne dort jamais',
    heroDescription: 'Photographiez vos tickets, importez votre relevé bancaire — Maurice scanne, classe, rapproche, calcule votre TVA et prépare l\'export pour votre comptable. Vous gardez l\'œil sur vos marges, lui s\'occupe de la paperasse.',
    sections: [
      {
        title: 'Maurice scanne tout — propulsé par Claude Sonnet',
        content: 'Photographiez n\'importe quel ticket de caisse, facture fournisseur ou note de frais : Maurice extrait automatiquement le montant HT, la TVA, le fournisseur, la date et la catégorie (matériaux, carburant, sous-traitance, repas...). Le justificatif est archivé conformément à la loi pendant 10 ans, et chaque dépense est rattachée au bon chantier.',
      },
      {
        title: 'Rapprochement bancaire automatique',
        content: 'Importez le relevé de votre banque (CSV ou OFX, toutes banques françaises supportées : BNP, Société Générale, Crédit Agricole, Crédit Mutuel, LCL, Qonto, Shine, Boursorama, Revolut...) et Hellobat associe chaque ligne à votre dépense ou facture en un instant. Pour les libellés ambigus, l\'IA Claude Sonnet propose le bon match avec un score de confiance.',
      },
      {
        title: 'Flux de trésorerie en temps réel',
        content: 'Visualisez vos entrées et sorties au jour le jour, avec un graphique sur 12 mois et le solde projeté. Filtrez par période, par chantier ou par catégorie. Identifiez en un coup d\'œil les chantiers les plus rentables et ceux qui mangent vos marges.',
      },
      {
        title: 'TVA assistée et export comptable',
        content: 'Maurice calcule automatiquement votre TVA collectée et déductible (mensuelle ou trimestrielle, régime réel ou simplifié) et vous prépare l\'export comptable : FEC, CSV ou PDF, prêt à envoyer à votre expert-comptable. Plus de paperasse à compiler en fin de mois — tout est déjà rangé.',
      },
      {
        title: 'Marges par chantier, sans calcul mental',
        content: 'Chaque dépense rattachée à un chantier alimente automatiquement la marge brute du projet. Vous voyez en temps réel : CA HT facturé, coûts main-d\'œuvre, dépenses HT, marge en € et en %. Une vraie boussole pour piloter votre entreprise.',
      },
    ],
    highlights: [
      'Maurice OCR — scan ticket en 2 secondes',
      'Rapprochement bancaire CSV / OFX automatique',
      'Marges par chantier en temps réel',
      'Justificatifs archivés 10 ans (loi)',
      'TVA mensuelle ou trimestrielle assistée',
      'Export FEC / CSV / PDF pour comptable',
    ],
    plan: 'business',
  },
  {
    slug: 'agents-ia',
    title: 'Agents IA spécialisés',
    subtitle: '5 assistants intelligents pour le bâtiment',
    heroDescription: 'Hellobat intègre 5 agents IA spécialisés dans le bâtiment : diagnostic de pannes, réglementation DTU, chiffrage rapide, conseil juridique et accompagnement RGE/CEE. Posez vos questions, obtenez des réponses précises.',
    sections: [
      {
        title: 'Agent Pannes',
        content: 'Décrivez un problème rencontré sur un chantier (fuite, fissure, dysfonctionnement électrique...) et l\'agent vous guide dans le diagnostic. Il identifie les causes probables, les vérifications à effectuer et les solutions recommandées.',
      },
      {
        title: 'Agent DTU',
        content: 'Interrogez l\'agent sur les Documents Techniques Unifiés applicables à vos travaux. Il connaît les DTU en vigueur et vous indique les règles à respecter : épaisseurs, pentes, joints, tolérances.',
      },
      {
        title: 'Agent Chiffreur',
        content: 'Décrivez des travaux et obtenez une estimation rapide basée sur les prix du marché. Utile pour une première approche budgétaire avant de faire un devis détaillé.',
      },
      {
        title: 'Agent Juridique',
        content: 'Posez vos questions sur la réglementation du bâtiment : garanties, assurances, responsabilités, litiges. L\'agent vous oriente sur vos droits et obligations.',
      },
      {
        title: 'Agent RGE/CEE',
        content: 'Informez-vous sur les certifications RGE et les Certificats d\'Économies d\'Énergie. L\'agent vous aide à comprendre les démarches, les critères d\'éligibilité et les aides disponibles pour vos clients.',
      },
    ],
    highlights: [
      '5 agents spécialisés bâtiment',
      'Conversations avec historique',
      'Base de connaissances PDF',
      'IA illimitée sur le plan Business',
    ],
    plan: 'business',
  },
  {
    slug: 'rendus-ia',
    title: 'Avant/Après IA',
    subtitle: 'Vendez le résultat avant même de signer',
    heroDescription: 'Transformez la photo d\'une pièce ou d\'une façade en projection photoréaliste après travaux. Vos clients voient l\'avant et l\'après côte à côte — l\'argument commercial le plus puissant pour faire signer.',
    sections: [
      {
        title: 'Avant/après photoréalistes',
        content: 'Une simple photo suffit : façade, salon, cuisine, salle de bain… L\'IA génère l\'image après travaux dans le style que vous choisissez. Vos clients comparent l\'avant et l\'après et se projettent sans effort.',
      },
    ],
    highlights: [
      'Avant/après photoréalistes en quelques secondes',
      'Argument de vente décisif pour faire signer',
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
