import Link from 'next/link';

/**
 * Pilier article #3 — Product-led, IA keyword cluster.
 *
 * Target: "devis BTP IA"
 * Secondary: "logiciel devis IA artisan", "générer devis automatique",
 *            "assistant IA devis bâtiment"
 * Intent: commercial — drives Hellobat signups, product differentiation.
 */
export function DevisBtpIaContent() {
  const h2 = 'text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mt-12 mb-4';
  const h3 = 'text-xl font-semibold text-[var(--landing-text)] mt-8 mb-3';
  const p = 'text-base text-[var(--landing-muted)] leading-relaxed mb-4';
  const ul = 'list-disc pl-5 space-y-2 mb-6 text-[var(--landing-muted)]';
  const internal = 'text-[var(--landing-accent)] font-medium underline-offset-2 hover:underline';
  const external = 'text-[var(--landing-accent)] underline underline-offset-2';

  return (
    <div>
      {/* Intro */}
      <p className={p}>
        Chiffrer un chantier, rédiger un devis propre, relancer le client,
        corriger, renvoyer… la production de{' '}
        <strong className="text-[var(--landing-text)]">devis BTP</strong> est
        l&apos;une des tâches qui prennent le plus de temps aux artisans du
        bâtiment. Une étude menée auprès de nos utilisateurs montre qu&apos;un
        artisan solo y consacre en moyenne une soirée par semaine — du temps
        pris sur le chantier, sur la prospection, ou tout simplement sur la
        famille. L&apos;enjeu est double : ce temps est non facturable, et le
        délai de rédaction joue directement sur le taux de signature.
        Plus vous tardez à envoyer votre devis, plus votre prospect compare
        votre offre avec celles de vos concurrents — ou passe à autre chose.
      </p>

      <p className={p}>
        C&apos;est exactement là que l&apos;intelligence artificielle change la
        donne. En 2026, les meilleurs logiciels de{' '}
        <strong className="text-[var(--landing-text)]">devis BTP avec IA</strong> permettent
        de rédiger un devis complet en moins de trois minutes à partir
        d&apos;une dictée vocale ou de quelques photos prises sur place. Ce
        n&apos;est plus une promesse marketing : c&apos;est un workflow
        réellement utilisé par des milliers d&apos;artisans, et qui peut faire
        gagner jusqu&apos;à cinq heures par semaine aux entreprises qui
        l&apos;adoptent.
      </p>

      <p className={p}>
        Dans cet article, on va poser les choses clairement : ce que
        l&apos;IA sait vraiment faire aujourd&apos;hui sur un devis bâtiment,
        les limites à connaître, le workflow concret à mettre en place, et
        l&apos;impact réel sur votre rentabilité. Pas de promesse magique,
        juste une méthode éprouvée.
      </p>

      {/* TOC */}
      <div className="my-10 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--landing-muted)] mb-3">
          Sommaire
        </div>
        <ol className="space-y-2 text-sm text-[var(--landing-text)]">
          <li>
            <a href="#etat-des-lieux" className="hover:text-[var(--landing-accent)]">
              1. Pourquoi les devis prennent autant de temps
            </a>
          </li>
          <li>
            <a href="#ia" className="hover:text-[var(--landing-accent)]">
              2. Ce que l&apos;IA sait vraiment faire sur un devis BTP
            </a>
          </li>
          <li>
            <a href="#workflow" className="hover:text-[var(--landing-accent)]">
              3. Le workflow concret : du chantier au devis signé
            </a>
          </li>
          <li>
            <a href="#limites" className="hover:text-[var(--landing-accent)]">
              4. Les limites de l&apos;IA (et comment les gérer)
            </a>
          </li>
          <li>
            <a href="#resultats" className="hover:text-[var(--landing-accent)]">
              5. Ce que ça change vraiment sur votre activité
            </a>
          </li>
          <li>
            <a href="#faq" className="hover:text-[var(--landing-accent)]">
              FAQ — Devis BTP avec IA
            </a>
          </li>
        </ol>
      </div>

      {/* H2 1 */}
      <h2 id="etat-des-lieux" className={h2}>
        Pourquoi les devis BTP prennent autant de temps
      </h2>
      <p className={p}>
        Un devis bâtiment n&apos;est pas un simple document commercial. C&apos;est
        un contrat technique qui doit décrire précisément les prestations,
        les matériaux, les quantités, les taux de TVA, les mentions
        obligatoires (assurance décennale, conditions de paiement, mention
        manuscrite client), et tenir compte des spécificités du chantier
        visité. Concrètement, rédiger un devis, c&apos;est enchaîner
        plusieurs étapes chronophages :
      </p>
      <ul className={ul}>
        <li>
          Le chiffrage : identifier chaque poste, estimer les quantités,
          calculer la main-d&apos;œuvre, vérifier les prix fournisseurs.
        </li>
        <li>
          La rédaction : transformer votre mémoire du chantier en phrases
          propres, en descriptions techniques claires pour le client.
        </li>
        <li>
          L&apos;application des bons taux de TVA travaux (5,5 %, 10 %,
          20 % selon la nature des prestations et l&apos;ancienneté du
          logement).
        </li>
        <li>
          La mise en page et le rappel des mentions obligatoires : décennale,
          conditions de paiement, mention manuscrite client, référence à
          l&apos;assurance.
        </li>
        <li>
          L&apos;envoi, la relance, et éventuellement la signature
          électronique pour accélérer la transformation.
        </li>
      </ul>
      <p className={p}>
        Sur un chantier de rénovation complète, cette chaîne représente
        facilement une à deux heures de travail par devis — et un artisan
        actif envoie souvent quatre à huit devis par semaine. Le calcul est
        vite fait : entre cinq et quinze heures hebdomadaires passées sur
        l&apos;administratif, uniquement pour la partie devis.
      </p>

      {/* H2 2 */}
      <h2 id="ia" className={h2}>
        Ce que l&apos;IA sait vraiment faire sur un devis BTP en 2026
      </h2>
      <p className={p}>
        Soyons précis, parce que le terme «&nbsp;IA&nbsp;» est employé à
        toutes les sauces. Voici les cas d&apos;usage où l&apos;intelligence
        artificielle apporte une vraie valeur sur la production de devis
        bâtiment aujourd&apos;hui, et pour lesquels les retours d&apos;usage
        sont solides.
      </p>

      <h3 className={h3}>1. Transformer une dictée vocale en devis structuré</h3>
      <p className={p}>
        C&apos;est le cas d&apos;usage qui a le plus d&apos;impact. Vous
        terminez la visite client, vous regagnez votre véhicule, et vous
        dictez à voix haute ce que vous avez observé : «&nbsp;cuisine de
        12 mètres carrés à rénover, peinture murs et plafond, remplacement
        du carrelage au sol, dépose de l&apos;ancien évier, pose d&apos;un
        nouveau plan de travail, reprise d&apos;une prise électrique&nbsp;».
        L&apos;IA structure automatiquement votre discours en postes,
        applique votre bibliothèque de prestations, calcule les quantités
        approximatives et génère un brouillon de devis en moins d&apos;une
        minute.
      </p>

      <h3 className={h3}>2. Analyser des photos de chantier</h3>
      <p className={p}>
        Les modèles d&apos;IA multimodaux reconnaissent aujourd&apos;hui
        les éléments d&apos;un chantier sur photo : murs à reprendre, sol
        à refaire, plomberie à remplacer. L&apos;utilisation la plus
        intéressante n&apos;est pas de «&nbsp;faire un devis tout seul à
        partir d&apos;une photo&nbsp;» — c&apos;est une promesse
        irréaliste — mais de proposer une check-list automatique des
        postes à ne pas oublier. Vous gardez le contrôle, l&apos;IA
        joue le rôle d&apos;assistant qui ne laisse rien passer.
      </p>

      <h3 className={h3}>3. Proposer des descriptions techniques professionnelles</h3>
      <p className={p}>
        Là où un artisan écrirait «&nbsp;peinture murs&nbsp;», un assistant
        IA bien entraîné propose : «&nbsp;préparation des supports par
        ponçage et rebouchage des éventuels défauts, application d&apos;une
        sous-couche d&apos;impression, peinture acrylique satinée en deux
        couches croisées&nbsp;». Le client comprend mieux ce qu&apos;il
        achète, la qualité perçue augmente, et vos devis se démarquent des
        concurrents qui restent sur des descriptions génériques.
      </p>

      <h3 className={h3}>4. Appliquer automatiquement les bonnes règles fiscales</h3>
      <p className={p}>
        Une IA bien conçue reconnaît qu&apos;un chantier d&apos;isolation
        thermique dans un logement de plus de 2 ans relève de la TVA à
        5,5 %, qu&apos;un simple rafraîchissement de peinture relève du
        10 %, et que des travaux dans un local professionnel relèvent du
        20 %. Elle applique le bon taux poste par poste, sans que vous
        ayez à y penser.
      </p>

      {/* H2 3 */}
      <h2 id="workflow" className={h2}>
        Le workflow concret : du chantier au devis signé en 10 minutes
      </h2>
      <p className={p}>
        Voici la séquence que nous voyons chez les artisans qui ont
        pleinement adopté un outil comme{' '}
        <Link href="/" className={internal}>Hellobat</Link>. Elle s&apos;applique
        aussi bien à la rénovation complète qu&apos;à des interventions
        ponctuelles de plomberie ou d&apos;électricité.
      </p>

      <h3 className={h3}>Étape 1 — Sur place : vocal et photos (5 minutes)</h3>
      <p className={p}>
        Après la visite, vous ouvrez l&apos;application sur votre téléphone,
        vous créez un nouveau devis, vous ajoutez quelques photos clés
        (état existant, zones à reprendre, accès chantier), et vous
        enregistrez votre dictée vocale. Cette dictée, c&apos;est
        littéralement la description que vous feriez à un collègue en
        rentrant : «&nbsp;Monsieur Dupont, pavillon des années 80, veut
        refaire sa salle de bain de 6 m² — dépose totale, faïence murale,
        carrelage sol, remplacement baignoire par douche italienne,
        remplacement du meuble vasque et du WC&nbsp;».
      </p>

      <h3 className={h3}>Étape 2 — Génération automatique du brouillon (1 minute)</h3>
      <p className={p}>
        L&apos;IA analyse votre dictée, croise avec votre bibliothèque de
        prestations personnelles (vos propres prix, vos propres descriptions,
        vos propres marges) et génère un devis structuré en postes. Chaque
        poste arrive avec quantité estimée, prix unitaire et description
        technique. Vous n&apos;avez rien tapé, tout est déjà là.
      </p>

      <h3 className={h3}>Étape 3 — Ajustements et validation (3 minutes)</h3>
      <p className={p}>
        Vous relisez rapidement, ajustez les quantités qui ne correspondent
        pas exactement, ajoutez ou retirez des postes, vérifiez les taux de
        TVA. L&apos;IA propose également des postes oubliés fréquents sur ce
        type de chantier — «&nbsp;avez-vous pensé à l&apos;évacuation des
        gravats ?&nbsp;». Vous tranchez en un clic.
      </p>

      <h3 className={h3}>Étape 4 — Envoi et signature électronique (1 minute)</h3>
      <p className={p}>
        Vous cliquez sur «&nbsp;envoyer&nbsp;», le client reçoit un email
        avec un lien vers le devis et peut le signer en ligne depuis son
        téléphone. Plus besoin d&apos;imprimer, de scanner, ou d&apos;attendre
        un retour postal. La signature électronique accélère dramatiquement
        la transformation des devis en chantiers : un client qui a aimé
        votre offre peut signer dans l&apos;heure qui suit, au lieu
        d&apos;attendre d&apos;avoir le temps de s&apos;en occuper.
      </p>

      <p className={p}>
        Résultat : là où la production d&apos;un devis complet prenait
        facilement une heure en soirée, elle prend maintenant une dizaine
        de minutes dans la foulée de la visite. Et le client reçoit le
        devis le jour même — un argument commercial majeur.
      </p>

      {/* H2 4 */}
      <h2 id="limites" className={h2}>
        Les limites de l&apos;IA (et comment les gérer)
      </h2>
      <p className={p}>
        L&apos;IA n&apos;est pas magique, et il serait malhonnête de
        prétendre le contraire. Voici les trois limites réelles à avoir en
        tête avant de vous lancer, et comment les contourner.
      </p>

      <h3 className={h3}>Limite 1 — L&apos;IA ne connaît pas vos prix</h3>
      <p className={p}>
        Par défaut, une IA généraliste ne sait pas ce que vous facturez.
        Pour que les brouillons soient utilisables, elle doit puiser dans
        votre bibliothèque de prestations personnelle. C&apos;est pour cela
        que les solutions les plus efficaces — dont Hellobat — vous demandent
        dès le démarrage de renseigner vos propres tarifs. L&apos;IA
        s&apos;appuie ensuite dessus à chaque génération.
      </p>

      <h3 className={h3}>Limite 2 — La relecture humaine reste indispensable</h3>
      <p className={p}>
        Un devis généré par IA doit toujours être relu avant envoi. Les
        quantités peuvent être sous-estimées, un poste peut manquer, une
        description peut être imprécise. L&apos;IA vous fait gagner 80 % du
        temps ; les 20 % restants sont votre expertise métier, et elle
        reste irremplaçable. Considérez l&apos;outil comme un stagiaire
        très rapide, pas comme un remplaçant.
      </p>

      <h3 className={h3}>Limite 3 — Certains chantiers complexes restent du manuel</h3>
      <p className={p}>
        Pour un chantier de gros œuvre, un métré précis, une situation
        d&apos;avancement complexe ou une réponse à marché public, l&apos;IA
        accélère le premier jet mais ne remplace pas le travail de chiffrage
        détaillé. Le gain de temps reste significatif — souvent 30 à 50 %
        — mais pas aussi impressionnant que sur des interventions
        standards.
      </p>

      {/* H2 5 */}
      <h2 id="resultats" className={h2}>
        Ce que ça change vraiment sur votre activité
      </h2>
      <p className={p}>
        Au-delà du gain de temps pur, l&apos;adoption d&apos;un outil de
        devis IA a trois effets concrets sur votre entreprise, que l&apos;on
        observe systématiquement chez nos utilisateurs.
      </p>

      <h3 className={h3}>Un taux de transformation plus élevé</h3>
      <p className={p}>
        Envoyer un devis le jour même de la visite change radicalement
        l&apos;expérience client. Le prospect est encore dans le
        projet, sa décision n&apos;est pas encore diluée par la
        comparaison avec d&apos;autres devis. Les artisans qui passent d&apos;un
        délai moyen de quatre jours à un délai de vingt-quatre heures
        constatent une hausse du taux de signature. Le chiffre exact
        dépend du métier et du positionnement, mais l&apos;effet est
        systématique.
      </p>

      <h3 className={h3}>Plus de devis, donc plus de chantiers</h3>
      <p className={p}>
        Mécaniquement, si chaque devis vous prend dix minutes au lieu
        d&apos;une heure, vous pouvez en produire cinq à six fois plus
        — ou redéployer ce temps sur la prospection, le chantier ou la
        famille. La plupart des artisans ne cherchent pas à produire plus
        de devis, mais à récupérer ce temps pour autre chose. C&apos;est
        une décision personnelle, mais chacune des options améliore la
        rentabilité.
      </p>

      <h3 className={h3}>Des devis plus professionnels, donc mieux valorisés</h3>
      <p className={p}>
        Un devis avec des descriptions techniques soignées, une
        présentation moderne et des options claires se défend mieux
        qu&apos;un devis bricolé dans Word. Le prix perçu change, et les
        négociations se font à armes plus égales. Un client prêt à payer
        un peu plus cher choisit rarement la première offre venue — il
        choisit l&apos;artisan qui lui donne l&apos;impression d&apos;être
        sérieux.
      </p>

      {/* CTA */}
      <div className="my-12 rounded-3xl border border-[var(--landing-border)] bg-gradient-to-br from-[var(--landing-accent-light)] to-white p-8 sm:p-10">
        <h3 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)] mb-3">
          Testez le devis BTP par IA avec Hellobat
        </h3>
        <p className="text-base text-[var(--landing-muted)] mb-6">
          Hellobat inclut dès le plan de base un assistant IA pour générer
          vos devis à partir d&apos;une dictée vocale, d&apos;une
          photo ou d&apos;une description texte. Votre bibliothèque de
          prestations, vos prix, votre identité visuelle — tout est
          respecté. Essai gratuit 30 jours, sans carte bancaire. Vous
          verrez vraiment ce qu&apos;un devis en trois minutes change dans
          votre quotidien.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full bg-[var(--landing-accent)] text-white font-medium px-6 py-3 hover:bg-[#b94800] transition-colors"
          >
            Essayer gratuitement
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center rounded-full border border-[var(--landing-border)] bg-white text-[var(--landing-text)] font-medium px-6 py-3 hover:bg-[var(--landing-off)] transition-colors"
          >
            Voir les tarifs
          </Link>
        </div>
      </div>

      {/* External reference */}
      <p className={p}>
        Pour approfondir, France Num — le portail gouvernemental dédié à la
        transformation numérique des TPE/PME — a publié un dossier
        spécifique aux professionnels du BTP sur l&apos;intérêt d&apos;un
        logiciel de devis :{' '}
        <a
          href="https://www.francenum.gouv.fr/guides-et-conseils/pilotage-de-lentreprise/logiciels-de-gestion-de-lentreprise/professionnels-du"
          target="_blank"
          rel="noopener"
          className={external}
        >
          francenum.gouv.fr
        </a>
        . Et si la question de la conformité 2026 vous inquiète, notre{' '}
        <Link href="/blog/facture-electronique-2026-artisan-guide" className={internal}>
          guide dédié à la facture électronique 2026
        </Link>{' '}
        complète celui-ci.
      </p>

      {/* FAQ */}
      <h2 id="faq" className={h2}>
        FAQ — Devis BTP avec IA
      </h2>

      <h3 className={h3}>L&apos;IA va-t-elle remplacer le travail de chiffrage de l&apos;artisan ?</h3>
      <p className={p}>
        Non. L&apos;IA accélère la production du brouillon et prend en charge
        les descriptions techniques, mais la décision finale sur les prix,
        les quantités et les postes reste entièrement humaine. C&apos;est
        votre expertise métier qui fait la qualité du devis final — l&apos;IA
        vous enlève juste la corvée de saisie.
      </p>

      <h3 className={h3}>Faut-il une connexion internet pour utiliser ces outils ?</h3>
      <p className={p}>
        Oui, dans la grande majorité des cas : les modèles d&apos;IA
        tournent dans le cloud. Certaines solutions proposent un mode
        hors-ligne partiel (saisie, consultation), mais la génération
        automatique nécessite une connexion. Pour les artisans qui
        travaillent dans des zones blanches, il suffit de dicter sur place
        et de lancer la génération au retour.
      </p>

      <h3 className={h3}>La dictée vocale fonctionne-t-elle bien sur un chantier bruyant ?</h3>
      <p className={p}>
        Les modèles de reconnaissance vocale récents sont robustes, mais un
        chantier très bruyant pose effectivement des limites. Le plus
        simple est de dicter depuis votre véhicule au moment de quitter le
        site : c&apos;est silencieux, et la visite est encore fraîche dans
        votre tête.
      </p>

      <h3 className={h3}>Est-ce que l&apos;IA apprend de mes corrections ?</h3>
      <p className={p}>
        Les meilleures solutions intègrent vos corrections dans votre
        bibliothèque personnelle. Plus vous utilisez l&apos;outil, plus il
        s&apos;adapte à votre façon de formuler, à vos postes favoris, à
        vos marges. Au bout de quelques semaines, les brouillons générés
        sont nettement plus proches de votre style.
      </p>

      <h3 className={h3}>Combien coûte un logiciel de devis BTP avec IA en 2026 ?</h3>
      <p className={p}>
        Les tarifs des solutions sérieuses se situent généralement entre
        25 € et 60 € HT par mois pour un artisan solo, avec l&apos;IA
        incluse dans le plan de base ou proposée en option. Attention aux
        solutions qui facturent chaque génération IA à l&apos;unité —
        l&apos;économie de temps disparaît vite si vous hésitez à chaque
        clic. Privilégiez un tarif simple et illimité. Notre page{' '}
        <Link href="/#pricing" className={internal}>tarifs Hellobat</Link> en
        donne un exemple concret.
      </p>
    </div>
  );
}
