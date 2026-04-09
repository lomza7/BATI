import Link from 'next/link';

/**
 * Pilier article #2 — Regulatory compliance money keyword.
 *
 * Target: "facture électronique 2026 artisan"
 * Secondary: "facture électronique obligatoire 2026 BTP",
 *            "plateforme agréée PDP", "Factur-X artisan"
 * Intent: high — very concrete compliance problem with deadline.
 *
 * Factual sources cross-checked (April 2026): economie.gouv.fr,
 * impots.gouv.fr, service-public.fr, FFB, compta-online.
 */
export function FactureElectronique2026Content() {
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
        La <strong className="text-[var(--landing-text)]">facture électronique 2026</strong> est
        la réforme administrative la plus importante pour les artisans du
        bâtiment depuis l&apos;instauration de la TVA réduite sur les travaux.
        À partir du 1ᵉʳ septembre 2026, toutes les entreprises françaises
        assujetties à la TVA — y compris les artisans, les TPE et les
        micro-entrepreneurs du BTP — devront être capables de{' '}
        <strong className="text-[var(--landing-text)]">recevoir</strong> des
        factures au format électronique structuré. L&apos;obligation
        d&apos;émettre ces factures s&apos;étendra ensuite progressivement
        jusqu&apos;en septembre 2027.
      </p>

      <p className={p}>
        Le sujet est complexe : entre la disparition du Portail Public de
        Facturation (PPF) en tant qu&apos;outil d&apos;émission gratuite, le
        rôle confirmé de Chorus Pro pour le secteur public, le passage
        obligatoire par une «&nbsp;Plateforme Agréée&nbsp;» (ex-PDP) et les
        formats techniques Factur-X, UBL et CII, beaucoup d&apos;artisans ne
        savent pas par où commencer. Ce guide fait le point complet sur ce
        que vous devez savoir, ce que vous devez faire, et surtout ce qui
        n&apos;est <em>pas</em> vrai dans ce qui circule sur le sujet.
      </p>

      <p className={p}>
        Nous allons couvrir le calendrier officiel, les entreprises
        concernées, le fonctionnement des Plateformes Agréées, les formats
        autorisés, les sanctions en cas de non-conformité, et une
        check-list pratique pour être prêt avant l&apos;échéance.
      </p>

      {/* TOC */}
      <div className="my-10 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--landing-muted)] mb-3">
          Sommaire
        </div>
        <ol className="space-y-2 text-sm text-[var(--landing-text)]">
          <li>
            <a href="#calendrier" className="hover:text-[var(--landing-accent)]">
              1. Le calendrier officiel 2026–2027
            </a>
          </li>
          <li>
            <a href="#qui" className="hover:text-[var(--landing-accent)]">
              2. Qui est concerné dans le BTP ?
            </a>
          </li>
          <li>
            <a href="#plateformes" className="hover:text-[var(--landing-accent)]">
              3. Plateforme Agréée, PPF, Chorus Pro : qui fait quoi
            </a>
          </li>
          <li>
            <a href="#formats" className="hover:text-[var(--landing-accent)]">
              4. Factur-X, UBL, CII : les formats autorisés
            </a>
          </li>
          <li>
            <a href="#ereporting" className="hover:text-[var(--landing-accent)]">
              5. E-reporting : la partie souvent oubliée
            </a>
          </li>
          <li>
            <a href="#sanctions" className="hover:text-[var(--landing-accent)]">
              6. Sanctions : combien coûte une non-conformité
            </a>
          </li>
          <li>
            <a href="#checklist" className="hover:text-[var(--landing-accent)]">
              7. Check-list : comment se préparer maintenant
            </a>
          </li>
          <li>
            <a href="#faq" className="hover:text-[var(--landing-accent)]">
              FAQ — Facture électronique 2026
            </a>
          </li>
        </ol>
      </div>

      {/* H2 1 */}
      <h2 id="calendrier" className={h2}>
        Le calendrier officiel 2026–2027 de la facture électronique
      </h2>
      <p className={p}>
        Le calendrier a été stabilisé par la loi de finances et confirmé à
        plusieurs reprises par le ministère de l&apos;Économie. Il s&apos;appuie
        sur deux dates clés :
      </p>
      <ul className={ul}>
        <li>
          <strong>1ᵉʳ septembre 2026 :</strong> toutes les entreprises
          assujetties à la TVA doivent être capables de{' '}
          <strong>recevoir</strong> des factures électroniques, sans
          exception. À cette même date, les grandes entreprises et les
          entreprises de taille intermédiaire (ETI) doivent également{' '}
          <strong>émettre</strong> leurs factures au format électronique
          structuré.
        </li>
        <li>
          <strong>1ᵉʳ septembre 2027 :</strong> l&apos;obligation
          d&apos;émission s&apos;étend aux PME, TPE, artisans du bâtiment et
          micro-entrepreneurs assujettis à la TVA. C&apos;est la date
          butoir pour basculer toute votre facturation sortante au format
          électronique.
        </li>
      </ul>
      <p className={p}>
        Concrètement, pour un artisan du BTP : vous avez jusqu&apos;au
        1ᵉʳ septembre 2026 pour pouvoir <em>recevoir</em> les factures de vos
        fournisseurs au bon format, et jusqu&apos;au 1ᵉʳ septembre 2027 pour
        envoyer vos propres factures à vos clients professionnels. La
        source officielle à consulter est la page dédiée sur{' '}
        <a
          href="https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises"
          target="_blank"
          rel="noopener"
          className={external}
        >
          economie.gouv.fr
        </a>
        .
      </p>
      <p className={p}>
        Il est important de noter que le calendrier a déjà été reporté une
        fois (la première version prévoyait 2024), et que le ministère a
        depuis réaffirmé que les dates de septembre 2026 et septembre 2027
        ne bougeront plus. L&apos;hypothèse d&apos;un nouveau report n&apos;est
        plus sur la table — mieux vaut donc vous préparer dès maintenant.
      </p>

      {/* H2 2 */}
      <h2 id="qui" className={h2}>
        Qui est concerné dans le BTP ?
      </h2>
      <p className={p}>
        La réponse courte est : presque tout le monde. La réforme s&apos;applique
        à toutes les entreprises établies en France et assujetties à la TVA,
        quelle que soit leur forme juridique ou leur secteur d&apos;activité.
        Dans le bâtiment, cela concerne donc :
      </p>
      <ul className={ul}>
        <li>
          Les artisans exerçant en entreprise individuelle (EI), y compris
          sous le régime du micro-entrepreneur dès lors qu&apos;ils
          dépassent les seuils de franchise en base de TVA.
        </li>
        <li>
          Les sociétés unipersonnelles (EURL, SASU) et les sociétés à
          plusieurs associés (SARL, SAS, SA) du BTP.
        </li>
        <li>
          Les entreprises du gros œuvre comme du second œuvre (maçonnerie,
          plomberie, électricité, peinture, menuiserie, couverture,
          rénovation énergétique…).
        </li>
        <li>
          Les bureaux d&apos;études, les architectes et les économistes de
          la construction, dès lors qu&apos;ils sont assujettis à la TVA.
        </li>
      </ul>

      <h3 className={h3}>Et les micro-entrepreneurs du bâtiment ?</h3>
      <p className={p}>
        Les micro-entrepreneurs qui bénéficient de la franchise en base de
        TVA (et qui n&apos;ont donc pas de numéro de TVA intracommunautaire)
        sont <strong>partiellement</strong> concernés. Ils devront être
        capables de recevoir des factures électroniques dès septembre 2026,
        et ils devront émettre des factures électroniques pour leurs
        échanges B2B. Même sans collecter de TVA, ils font partie du champ de
        la réforme dès lors qu&apos;ils facturent des entreprises. Seules les
        factures adressées à des particuliers (B2C) échappent au dispositif
        — mais restent concernées par l&apos;e-reporting que nous verrons
        plus bas.
      </p>

      {/* H2 3 */}
      <h2 id="plateformes" className={h2}>
        Plateforme Agréée, PPF, Chorus Pro : qui fait quoi
      </h2>
      <p className={p}>
        C&apos;est le point qui génère le plus de confusion, notamment parce
        que l&apos;architecture initiale de la réforme a été modifiée en
        cours de route. Voici ce qu&apos;il faut retenir aujourd&apos;hui.
      </p>

      <h3 className={h3}>La Plateforme Agréée (ex-PDP)</h3>
      <p className={p}>
        Une Plateforme Agréée — anciennement appelée Plateforme de
        Dématérialisation Partenaire (PDP) — est un opérateur privé
        enregistré auprès de l&apos;administration fiscale, autorisé à
        transmettre, recevoir et conserver les factures électroniques entre
        entreprises. Concrètement, votre logiciel du bâtiment doit être
        connecté à l&apos;une de ces plateformes pour que vos factures
        soient considérées comme valides au regard de la réforme. Chaque
        artisan choisira la plateforme par l&apos;intermédiaire de son
        logiciel de facturation — vous n&apos;avez pas besoin de vous
        inscrire directement sur une plateforme.
      </p>

      <h3 className={h3}>Le PPF (Portail Public de Facturation)</h3>
      <p className={p}>
        Le PPF était initialement pensé comme une alternative publique et
        gratuite aux plateformes privées. Ce rôle a été officiellement
        abandonné en octobre 2024 par la Direction générale des Finances
        publiques (DGFiP). Le PPF n&apos;assurera plus l&apos;émission ni la
        réception directe de factures. Il conserve en revanche deux
        fonctions essentielles : celle d&apos;<strong>annuaire central</strong>{' '}
        (qui indique quelle Plateforme Agréée utilise chaque entreprise
        destinataire) et celle de <strong>concentrateur de données</strong>{' '}
        fiscales, pour transmettre les informations nécessaires à
        l&apos;administration.
      </p>
      <p className={p}>
        Conclusion pratique : aucun artisan n&apos;utilisera le PPF pour
        envoyer ou recevoir ses factures. Passer par une Plateforme Agréée
        — directement ou via son logiciel — est obligatoire.
      </p>

      <h3 className={h3}>Chorus Pro : toujours utile pour les marchés publics</h3>
      <p className={p}>
        Chorus Pro n&apos;est pas concerné par cette suppression : il reste
        la plateforme officielle pour la facturation entre les entreprises
        et les entités publiques (B2G). Si vous réalisez des chantiers pour
        des mairies, des départements, des bailleurs sociaux publics ou
        toute autre collectivité, Chorus Pro reste votre point de passage
        obligatoire. Cette information a été confirmée par la{' '}
        <a
          href="https://www.impots.gouv.fr/actualite/chorus-pro-restera-la-plateforme-de-reference-pour-la-facturation-electronique-du-secteur"
          target="_blank"
          rel="noopener"
          className={external}
        >
          DGFiP sur impots.gouv.fr
        </a>
        . Pour le secteur privé, en revanche, Chorus Pro n&apos;a aucun
        rôle : c&apos;est une Plateforme Agréée qu&apos;il vous faudra
        utiliser.
      </p>

      {/* H2 4 */}
      <h2 id="formats" className={h2}>
        Factur-X, UBL, CII : les formats autorisés
      </h2>
      <p className={p}>
        La réforme n&apos;autorise plus la simple facture PDF que vous
        envoyez par email. À partir des dates indiquées plus haut, seuls
        trois formats structurés conformes à la norme européenne EN 16931
        seront acceptés :
      </p>
      <ul className={ul}>
        <li>
          <strong>Factur-X :</strong> c&apos;est un format hybride, composé
          d&apos;un PDF/A-3 lisible par un humain et d&apos;un fichier XML
          structuré intégré en pièce jointe. C&apos;est le format le mieux
          adapté aux artisans du bâtiment, car il préserve l&apos;expérience
          de lecture d&apos;un PDF classique tout en permettant à la machine
          d&apos;extraire automatiquement les données.
        </li>
        <li>
          <strong>UBL (Universal Business Language) :</strong> un format XML
          pur, très répandu à l&apos;échelle européenne. Plutôt utilisé par
          les grands éditeurs et dans les échanges internationaux.
        </li>
        <li>
          <strong>CII (Cross Industry Invoice) :</strong> autre format XML,
          historiquement utilisé dans l&apos;industrie et dans certains
          secteurs logistiques.
        </li>
      </ul>
      <p className={p}>
        <strong className="text-[var(--landing-text)]">Ce qui n&apos;est plus autorisé :</strong>{' '}
        une facture Word ou Excel convertie en PDF, un PDF simple sans
        structure XML, ou une image scannée. Si vous envoyez encore vos
        factures de cette manière, vous devez changer d&apos;outil avant
        septembre 2027 au plus tard — idéalement bien avant, pour tester et
        vous habituer.
      </p>
      <p className={p}>
        La bonne nouvelle est que vous n&apos;avez pas à vous préoccuper
        directement du format technique : un logiciel de facturation
        conforme — comme <Link href="/" className={internal}>Hellobat</Link>{' '}
        — génère automatiquement la bonne structure Factur-X en arrière-plan.
        Vous continuez à saisir votre facture comme d&apos;habitude.
      </p>

      {/* H2 5 */}
      <h2 id="ereporting" className={h2}>
        L&apos;e-reporting : la partie que tout le monde oublie
      </h2>
      <p className={p}>
        La réforme ne se limite pas à l&apos;e-invoicing. Elle inclut
        également un dispositif d&apos;<strong>e-reporting</strong> : une
        obligation de transmettre à l&apos;administration fiscale les données
        de certaines transactions qui ne passent pas par le circuit des
        factures électroniques interentreprises.
      </p>
      <p className={p}>
        Pour un artisan du BTP, l&apos;e-reporting concerne principalement :
      </p>
      <ul className={ul}>
        <li>
          Les ventes et prestations réalisées pour des{' '}
          <strong>particuliers</strong> (B2C) — typiquement la rénovation
          chez un propriétaire privé.
        </li>
        <li>
          Les transactions avec des entreprises étrangères, hors champ de la
          facturation électronique française.
        </li>
        <li>
          Les opérations d&apos;acquisition intracommunautaire ou
          d&apos;importation.
        </li>
      </ul>
      <p className={p}>
        Concrètement, pour vos chantiers particuliers, vous ne serez pas
        obligé d&apos;envoyer une facture électronique structurée à votre
        client, mais votre logiciel devra transmettre les données de cette
        facture à l&apos;administration fiscale, via la Plateforme Agréée.
        Là encore, un logiciel bien conçu gère cela automatiquement, sans
        tâche supplémentaire pour vous.
      </p>

      {/* H2 6 */}
      <h2 id="sanctions" className={h2}>
        Sanctions : combien coûte une non-conformité ?
      </h2>
      <p className={p}>
        Le législateur a prévu un régime de sanctions pour inciter les
        entreprises à se mettre en conformité. Les montants sont les
        suivants :
      </p>
      <ul className={ul}>
        <li>
          <strong>15 € par facture non conforme</strong> (format incorrect
          ou absence d&apos;émission au bon format), plafonnée à{' '}
          <strong>15 000 € par année civile</strong>.
        </li>
        <li>
          <strong>250 € par défaut de transmission</strong> dans le cadre de
          l&apos;e-reporting, également plafonnés à{' '}
          <strong>15 000 € par année civile</strong>.
        </li>
      </ul>
      <p className={p}>
        Ces montants peuvent paraître modestes au regard d&apos;un gros
        chantier, mais le vrai coût de la non-conformité est ailleurs : un
        client professionnel qui reçoit une facture non conforme peut
        refuser de la traiter, ce qui retarde d&apos;autant votre
        paiement. Dans le BTP, où les délais de règlement sont déjà
        souvent tendus, cela devient un vrai problème de trésorerie.
      </p>

      {/* H2 7 */}
      <h2 id="checklist" className={h2}>
        Check-list : comment vous préparer dès maintenant
      </h2>
      <p className={p}>
        Vous avez encore le temps, mais la préparation devrait commencer
        maintenant. Voici les étapes à suivre en priorité.
      </p>

      <h3 className={h3}>1. Identifiez votre outil actuel</h3>
      <p className={p}>
        Si vous facturez aujourd&apos;hui sous Word, Excel ou un PDF
        généré à la main, vous devrez obligatoirement changer d&apos;outil.
        Ces méthodes ne seront plus conformes. Même chose si vous
        utilisez un logiciel historique qui n&apos;annonce pas clairement
        sa feuille de route vers la réforme.
      </p>

      <h3 className={h3}>2. Vérifiez la conformité de votre éditeur</h3>
      <p className={p}>
        Demandez explicitement à votre éditeur s&apos;il sera connecté à une
        Plateforme Agréée, et à quelle date. S&apos;il ne peut pas
        répondre, c&apos;est un signal d&apos;alerte. Tous les logiciels
        sérieux du marché communiquent sur le sujet depuis 2024.
      </p>

      <h3 className={h3}>3. Mettez à jour votre base de clients</h3>
      <p className={p}>
        La Plateforme Agréée aura besoin du SIRET de chacun de vos clients
        professionnels pour acheminer correctement les factures. Profitez
        des prochains mois pour compléter votre base : SIRET, numéro de TVA
        intracommunautaire, adresse de facturation précise. Vous pouvez
        utiliser des outils comme{' '}
        <a
          href="https://annuaire-entreprises.data.gouv.fr/"
          target="_blank"
          rel="noopener"
          className={external}
        >
          annuaire-entreprises.data.gouv.fr
        </a>{' '}
        pour compléter rapidement ces informations.
      </p>

      <h3 className={h3}>4. Testez le circuit de bout en bout</h3>
      <p className={p}>
        Dès que votre logiciel est conforme, envoyez une première facture
        de test à un client pilote et vérifiez qu&apos;elle est bien reçue
        dans son propre outil. C&apos;est la seule façon de vous assurer
        que tout fonctionne avant l&apos;échéance.
      </p>

      <h3 className={h3}>5. Formez-vous et formez votre équipe</h3>
      <p className={p}>
        Si vous avez un collaborateur administratif ou un conjoint qui vous
        aide sur la facturation, prenez le temps d&apos;expliquer le
        nouveau circuit. Les changements sont surtout dans le back-office
        — l&apos;expérience utilisateur reste très proche — mais il est
        important que tout le monde comprenne pourquoi on change de
        méthode.
      </p>

      {/* CTA */}
      <div className="my-12 rounded-3xl border border-[var(--landing-border)] bg-gradient-to-br from-[var(--landing-accent-light)] to-white p-8 sm:p-10">
        <h3 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)] mb-3">
          Prêt pour la facture électronique 2026 avec Hellobat
        </h3>
        <p className="text-base text-[var(--landing-muted)] mb-6">
          Hellobat est pensé dès sa conception pour la réforme de la facture
          électronique : génération Factur-X automatique, connexion
          Plateforme Agréée, e-reporting géré en arrière-plan. Vous pouvez
          continuer à produire vos devis et factures comme d&apos;habitude,
          sans vous soucier du reste. Essai gratuit 30 jours, sans
          engagement.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center rounded-full bg-[var(--landing-accent)] text-white font-medium px-6 py-3 hover:bg-[#b94800] transition-colors"
        >
          Tester Hellobat gratuitement
        </Link>
      </div>

      {/* FAQ */}
      <h2 id="faq" className={h2}>
        FAQ — Facture électronique 2026 pour les artisans
      </h2>

      <h3 className={h3}>Dois-je m&apos;inscrire sur Chorus Pro si je n&apos;ai pas de marchés publics ?</h3>
      <p className={p}>
        Non. Chorus Pro est uniquement destiné aux échanges entre
        entreprises et entités publiques. Si vos clients sont tous privés
        (particuliers ou entreprises), vous n&apos;avez aucune démarche à
        faire sur Chorus Pro. C&apos;est votre logiciel, via une Plateforme
        Agréée, qui gèrera vos factures.
      </p>

      <h3 className={h3}>Un PDF envoyé par email compte-t-il comme une facture électronique ?</h3>
      <p className={p}>
        Non. Un PDF simple n&apos;est pas une facture électronique au sens
        de la réforme. Il s&apos;agit d&apos;une facture dématérialisée,
        mais pas structurée. Seuls les formats Factur-X, UBL et CII sont
        valides à partir des échéances.
      </p>

      <h3 className={h3}>Je suis micro-entrepreneur en franchise de TVA. Suis-je concerné ?</h3>
      <p className={p}>
        Oui, partiellement. Vous devez être capable de recevoir des
        factures électroniques dès septembre 2026 et d&apos;en émettre
        pour vos clients professionnels à partir de septembre 2027, même
        si vous ne collectez pas de TVA. Les factures adressées à des
        particuliers ne passent pas par le circuit électronique mais
        doivent faire l&apos;objet d&apos;un e-reporting.
      </p>

      <h3 className={h3}>Dois-je choisir moi-même ma Plateforme Agréée ?</h3>
      <p className={p}>
        Pas directement. Dans la grande majorité des cas, vous passerez par
        votre logiciel de facturation, qui est lui-même connecté à une ou
        plusieurs Plateformes Agréées. Vous n&apos;avez donc pas à créer
        de compte séparé ni à gérer deux outils.
      </p>

      <h3 className={h3}>Que se passe-t-il si je ne suis pas prêt au 1ᵉʳ septembre 2027 ?</h3>
      <p className={p}>
        Vous vous exposez aux sanctions évoquées plus haut (15 € par
        facture non conforme, 250 € par défaut d&apos;e-reporting, dans
        la limite de 15 000 € par an chacun). Surtout, vous risquez des
        refus de paiement de la part de vos clients professionnels, ce qui
        peut rapidement déséquilibrer votre trésorerie. Le mieux est de
        démarrer la migration dès 2026, sans attendre l&apos;échéance.
      </p>
    </div>
  );
}
