import Link from 'next/link';

/**
 * Pilier article #1 — "logiciel du bâtiment" money keyword.
 *
 * Target keyword: "logiciel du bâtiment"
 * Secondary: "logiciel BTP", "meilleur logiciel BTP", "comparatif logiciel BTP"
 * Intent: commercial investigation — visitors compare solutions.
 */
export function LogicielBatimentChoisirContent() {
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
        Choisir un <strong className="text-[var(--landing-text)]">logiciel du bâtiment</strong> est
        devenu une décision stratégique pour les artisans et les TPE du BTP.
        Entre la réforme de la facture électronique qui entre en vigueur au
        1ᵉʳ septembre 2026, la montée en puissance de l&apos;intelligence
        artificielle appliquée aux devis et la concurrence de plus en plus serrée
        sur les chantiers, le bon outil peut faire gagner plusieurs heures par
        semaine — et faire perdre un temps considérable s&apos;il est mal choisi.
      </p>

      <p className={p}>
        Le marché français compte aujourd&apos;hui plus d&apos;une vingtaine de
        solutions sérieuses : Obat, Batappli, Mediabat, Tolteck, Vertuoza,
        Costructor, EBP Bâtiment, Codial, Graneet, sans parler des nouveaux
        entrants dopés à l&apos;IA. Chacun met en avant des arguments convaincants,
        mais très peu d&apos;entre eux correspondent vraiment à votre façon de
        travailler. Ce guide vous donne une méthode simple et concrète pour
        trancher sans vous tromper, avec les critères qui comptent vraiment sur
        le terrain.
      </p>

      <p className={p}>
        Nous avons structuré l&apos;article en six étapes : comprendre à quoi
        sert vraiment un logiciel BTP, identifier les critères non-négociables,
        passer en revue les grandes catégories d&apos;outils du marché, vérifier
        la conformité réglementaire 2026, estimer le vrai coût d&apos;une
        solution, et éviter les pièges les plus fréquents. À la fin, vous saurez
        exactement quoi tester et quelles questions poser aux éditeurs.
      </p>

      {/* Table of contents */}
      <div className="my-10 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--landing-muted)] mb-3">
          Sommaire
        </div>
        <ol className="space-y-2 text-sm text-[var(--landing-text)]">
          <li>
            <a href="#definition" className="hover:text-[var(--landing-accent)]">
              1. Logiciel du bâtiment : de quoi parle-t-on vraiment ?
            </a>
          </li>
          <li>
            <a href="#criteres" className="hover:text-[var(--landing-accent)]">
              2. Les 7 critères non-négociables pour bien choisir
            </a>
          </li>
          <li>
            <a href="#familles" className="hover:text-[var(--landing-accent)]">
              3. Les grandes familles de logiciels BTP en 2026
            </a>
          </li>
          <li>
            <a href="#conformite" className="hover:text-[var(--landing-accent)]">
              4. Conformité : facture électronique, TVA, décennale
            </a>
          </li>
          <li>
            <a href="#cout" className="hover:text-[var(--landing-accent)]">
              5. Combien ça coûte vraiment ?
            </a>
          </li>
          <li>
            <a href="#pieges" className="hover:text-[var(--landing-accent)]">
              6. Les 5 pièges à éviter lors du choix
            </a>
          </li>
          <li>
            <a href="#faq" className="hover:text-[var(--landing-accent)]">
              FAQ — Logiciel du bâtiment
            </a>
          </li>
        </ol>
      </div>

      {/* H2 1 */}
      <h2 id="definition" className={h2}>
        Logiciel du bâtiment : de quoi parle-t-on vraiment ?
      </h2>
      <p className={p}>
        Un logiciel du bâtiment — aussi appelé logiciel BTP, logiciel de gestion
        pour artisan ou ERP bâtiment — désigne un outil numérique conçu pour
        couvrir les spécificités des métiers du gros œuvre, du second œuvre et de
        la rénovation. Derrière ce terme un peu fourre-tout se cachent en réalité
        trois grandes promesses : faire gagner du temps administratif, sécuriser
        la rentabilité des chantiers et donner une image professionnelle auprès
        des clients.
      </p>
      <p className={p}>
        Concrètement, un bon logiciel BTP permet de créer des devis conformes
        (avec les bonnes mentions obligatoires, la décennale, les taux de TVA
        travaux), de transformer ces devis en factures, de suivre
        l&apos;avancement des chantiers, de planifier les équipes, de gérer la
        relation client et de piloter la trésorerie. Certains vont plus loin
        avec un CRM commercial, une intégration Google Calendar ou Gmail, la
        signature électronique des devis, ou encore la génération de sites
        vitrines.
      </p>

      <h3 className={h3}>Les différences avec un outil de facturation généraliste</h3>
      <p className={p}>
        Un logiciel de facturation généraliste (type Indy, Freebe ou Pennylane)
        sait faire une facture propre. Mais il ignore les spécificités du
        bâtiment : TVA à 5,5 %, 10 % ou 20 % selon la nature des travaux,
        gestion des acomptes sur devis longs, retenues de garantie, situations
        d&apos;avancement, bibliothèques de prestations par corps d&apos;état,
        ou encore les mentions de l&apos;assurance décennale. Un véritable
        logiciel du bâtiment est pensé pour ces contraintes métier dès la
        conception — et c&apos;est ce qui justifie un abonnement dédié plutôt
        qu&apos;un outil générique bricolé.
      </p>

      {/* H2 2 */}
      <h2 id="criteres" className={h2}>
        Les 7 critères non-négociables pour bien choisir son logiciel BTP
      </h2>
      <p className={p}>
        Avant de comparer les prix ou les captures d&apos;écran marketing,
        assurez-vous que la solution que vous testez coche ces sept cases.
        Ce sont les critères qui font la différence entre un logiciel qui
        vous fait vraiment gagner du temps et un abonnement que vous
        finirez par oublier.
      </p>
      <ul className={ul}>
        <li>
          <strong>Ultra-mobile :</strong> vous devez pouvoir créer un devis sur
          le chantier depuis votre téléphone, pas seulement dans votre bureau
          devant un PC. Les statistiques sectorielles montrent que la majorité
          des artisans consultent leur téléphone avant leur ordinateur pour
          gérer leur activité.
        </li>
        <li>
          <strong>Conforme facture électronique 2026 :</strong> la solution doit
          être compatible avec le format Factur-X et connectée à une Plateforme
          Agréée (ex-PDP). Sans cela, vous ne pourrez plus émettre de facture
          valide à partir de septembre 2027.
        </li>
        <li>
          <strong>Bibliothèque de prestations :</strong> vous construisez vos
          devis à partir de blocs réutilisables (main d&apos;œuvre, fournitures,
          descriptions types), pas en repartant d&apos;une feuille blanche à
          chaque fois.
        </li>
        <li>
          <strong>Gestion TVA travaux :</strong> application automatique du
          5,5 % pour la rénovation énergétique en logement de plus de 2 ans,
          du 10 % pour l&apos;entretien et l&apos;amélioration, et du 20 % pour
          le neuf ou le pro.
        </li>
        <li>
          <strong>Signature électronique intégrée :</strong> pour accélérer la
          transformation des devis en chantiers signés, sans relance par
          téléphone ni envoi postal.
        </li>
        <li>
          <strong>Suivi chantier et planning équipe :</strong> pour éviter de
          jongler entre trois outils (Excel, WhatsApp et agenda papier) et
          garder une vue claire sur la charge de travail.
        </li>
        <li>
          <strong>Support francophone et réactif :</strong> quand vous êtes
          bloqué à 18h avant de partir voir un client, vous avez besoin
          d&apos;une réponse rapide — pas d&apos;un ticket ouvert pendant
          trois jours.
        </li>
      </ul>
      <p className={p}>
        Nos propres retours terrain chez Hellobat montrent que les artisans qui
        passent d&apos;un outil généraliste à un logiciel BTP pensé pour la
        mobilité récupèrent en moyenne plusieurs heures par semaine sur la
        partie administrative. C&apos;est autant de temps disponible pour
        produire plus de devis, relancer les prospects ou tout simplement
        finir la journée plus tôt.
      </p>

      {/* H2 3 */}
      <h2 id="familles" className={h2}>
        Les grandes familles de logiciels du bâtiment en 2026
      </h2>
      <p className={p}>
        Tous les outils ne se ressemblent pas. Pour simplifier votre
        comparaison, on peut regrouper les solutions du marché en quatre
        grandes familles, chacune avec ses forces et ses limites.
      </p>

      <h3 className={h3}>1. Les spécialistes devis-facture simples</h3>
      <p className={p}>
        Cette catégorie regroupe les solutions centrées sur l&apos;essentiel :
        produire rapidement un devis propre et le transformer en facture.
        Tolteck en est l&apos;exemple emblématique, avec une interface
        épurée et un positionnement clairement artisan solo. Costructor joue
        sur le même registre avec une offre gratuite généreuse. Ces outils
        sont parfaits pour démarrer, mais montrent leurs limites dès que vous
        voulez gérer des équipes, des chantiers complexes ou une vraie
        prospection commerciale.
      </p>

      <h3 className={h3}>2. Les ERP bâtiment historiques</h3>
      <p className={p}>
        Batappli, Mediabat, EBP Bâtiment ou Codial font partie des éditeurs
        installés depuis des années sur le marché français. Ils proposent des
        fonctionnalités métier très poussées — métrés, retenues de garantie,
        situations d&apos;avancement, interface avec la comptabilité — mais
        leur ergonomie reste souvent marquée par leur héritage logiciel de
        bureau. Ils conviennent particulièrement aux PME du BTP qui ont besoin
        de fonctions avancées et qui disposent d&apos;un collaborateur dédié à
        l&apos;administratif.
      </p>

      <h3 className={h3}>3. Les plateformes cloud tout-en-un</h3>
      <p className={p}>
        Obat, Vertuoza ou Graneet incarnent la génération des logiciels BTP
        nés dans le cloud, avec une approche «&nbsp;plateforme&nbsp;» qui
        couvre devis, factures, chantiers, planning et parfois la comptabilité.
        Ils offrent une expérience plus moderne que les ERP historiques, mais
        leurs tarifs peuvent grimper vite dès qu&apos;on ajoute des utilisateurs
        ou des modules. Le rapport qualité / prix dépend beaucoup de votre
        volume d&apos;activité.
      </p>

      <h3 className={h3}>4. Les outils nouvelle génération dopés à l&apos;IA</h3>
      <p className={p}>
        C&apos;est la famille qui bouge le plus vite en 2026. Des solutions
        comme <Link href="/" className={internal}>Hellobat</Link> repensent
        l&apos;expérience autour de l&apos;intelligence artificielle : devis
        générés à partir d&apos;une dictée vocale ou de photos du chantier,
        assistant pour rédiger les emails, génération automatique de sites
        vitrines, agents IA spécialisés (DTU, juridique, chiffrage). Ces
        outils sont pensés d&apos;abord pour le mobile et intègrent nativement
        la réforme de la facture électronique. Ils représentent le meilleur
        choix pour les artisans qui veulent gagner du temps sans sacrifier la
        qualité de leurs documents.
      </p>

      {/* H2 4 */}
      <h2 id="conformite" className={h2}>
        Conformité réglementaire : les trois points à vérifier absolument
      </h2>
      <p className={p}>
        Un logiciel BTP n&apos;est jamais «&nbsp;bon&nbsp;» s&apos;il ne vous
        maintient pas en conformité avec la réglementation française. En 2026,
        trois sujets demandent une attention particulière avant de signer un
        contrat d&apos;abonnement.
      </p>

      <h3 className={h3}>La réforme de la facture électronique</h3>
      <p className={p}>
        À partir du 1ᵉʳ septembre 2026, toutes les entreprises assujetties à la
        TVA — y compris les artisans et les micro-entrepreneurs du BTP —
        doivent être capables de <strong className="text-[var(--landing-text)]">recevoir</strong> des factures
        électroniques. L&apos;obligation d&apos;émission démarre à la même date
        pour les grandes entreprises et les ETI, puis s&apos;étend au
        1ᵉʳ septembre 2027 aux PME, TPE et micro-entrepreneurs. Votre logiciel
        doit être compatible avec le format Factur-X (ou UBL / CII) et connecté
        à une Plateforme Agréée. On en parle en détail dans notre{' '}
        <Link href="/blog/facture-electronique-2026-artisan-guide" className={internal}>
          guide complet de la facture électronique 2026
        </Link>
        .
      </p>

      <h3 className={h3}>Les mentions obligatoires sur le devis</h3>
      <p className={p}>
        Un devis travaux est obligatoire dès 150 € TTC. Il doit faire
        apparaître la date, les coordonnées complètes du client et de
        l&apos;entreprise, le détail des prestations, la TVA applicable, les
        conditions de paiement, les coordonnées de l&apos;assurance décennale
        et la mention «&nbsp;devis reçu avant exécution des travaux&nbsp;» avec
        signature du client. L&apos;oubli d&apos;une mention peut être
        sanctionné. Référence officielle :{' '}
        <a
          href="https://entreprendre.service-public.gouv.fr/vosdroits/F31144"
          target="_blank"
          rel="noopener"
          className={external}
        >
          service-public.fr — Devis obligatoire
        </a>
        .
      </p>

      <h3 className={h3}>La bonne gestion des taux de TVA travaux</h3>
      <p className={p}>
        Depuis 2014, les travaux en logement sont concernés par trois taux —
        5,5 %, 10 % et 20 % — selon la nature des prestations et
        l&apos;ancienneté du bâtiment. Un bon logiciel du bâtiment applique
        automatiquement le bon taux en fonction du type de prestation
        sélectionné, sans calcul manuel. Pour tout vérifier, la page de
        référence de l&apos;administration est disponible sur{' '}
        <a
          href="https://www.economie.gouv.fr/particuliers/tva-travaux-logement"
          target="_blank"
          rel="noopener"
          className={external}
        >
          economie.gouv.fr
        </a>
        .
      </p>

      {/* H2 5 */}
      <h2 id="cout" className={h2}>
        Combien coûte vraiment un logiciel du bâtiment ?
      </h2>
      <p className={p}>
        Les tarifs affichés sur les sites des éditeurs ne disent pas tout.
        Voici comment estimer le coût réel d&apos;un logiciel BTP sur
        douze mois pour éviter les mauvaises surprises.
      </p>
      <ul className={ul}>
        <li>
          <strong>Abonnement de base :</strong> la plupart des solutions
          modernes démarrent entre 19 € et 35 € HT par mois pour un
          artisan solo. Les plateformes tout-en-un montent facilement entre
          50 € et 100 € HT par mois dès qu&apos;on ajoute plusieurs
          utilisateurs.
        </li>
        <li>
          <strong>Frais par utilisateur :</strong> vérifiez si le prix est par
          compte ou par entreprise. Certains éditeurs facturent chaque
          collaborateur supplémentaire.
        </li>
        <li>
          <strong>Modules optionnels :</strong> signature électronique,
          catalogue d&apos;ouvrages, module CRM, accès comptable, application
          mobile, génération de site vitrine… les modules complémentaires
          peuvent doubler la facture finale.
        </li>
        <li>
          <strong>Mise en service et formation :</strong> les ERP historiques
          facturent souvent plusieurs centaines d&apos;euros pour
          l&apos;installation et la formation initiale. Les solutions cloud
          modernes ne facturent généralement rien.
        </li>
        <li>
          <strong>Engagement annuel :</strong> attention aux réductions
          conditionnées à un engagement de 12 mois. Elles sont intéressantes
          si vous êtes sûr de votre choix, mais risquées si vous testez
          plusieurs solutions.
        </li>
      </ul>
      <p className={p}>
        Pour un artisan solo, le budget réaliste tourne autour de 25 € à
        45 € HT par mois pour une solution moderne, conforme à la facture
        électronique 2026, incluant devis, factures, signature et application
        mobile. Au-delà, vous payez pour des fonctions que vous
        n&apos;utiliserez peut-être pas. Chez Hellobat, nous avons fait le
        choix d&apos;inclure dès le plan de base la réforme de la facture
        électronique, l&apos;assistant devis IA et l&apos;application mobile —
        les détails sont sur la page{' '}
        <Link href="/#pricing" className={internal}>tarifs Hellobat</Link>.
      </p>

      {/* H2 6 */}
      <h2 id="pieges" className={h2}>
        Les 5 pièges à éviter lors du choix d&apos;un logiciel BTP
      </h2>

      <h3 className={h3}>Piège 1 — Se baser uniquement sur le prix affiché</h3>
      <p className={p}>
        Un logiciel bon marché qui vous fait perdre une heure chaque jour à
        cause d&apos;une interface confuse vous coûtera toujours plus cher
        qu&apos;un outil à 35 € par mois qui vous fait gagner trois heures
        par semaine. Calculez le coût en temps, pas seulement en euros.
      </p>

      <h3 className={h3}>Piège 2 — Ignorer la mobilité</h3>
      <p className={p}>
        Un logiciel qui ne fonctionne vraiment que sur PC de bureau est un
        logiciel que vous n&apos;utiliserez pas sur le chantier. Exigez une
        application ou une interface mobile parfaitement utilisable depuis
        votre téléphone.
      </p>

      <h3 className={h3}>Piège 3 — Sous-estimer la compatibilité 2026</h3>
      <p className={p}>
        La facture électronique obligatoire est là. Si l&apos;éditeur ne peut
        pas vous confirmer clairement qu&apos;il sera connecté à une
        Plateforme Agréée au moment de votre migration, passez votre chemin —
        vous risquez de devoir changer d&apos;outil en urgence.
      </p>

      <h3 className={h3}>Piège 4 — Signer un engagement long sans avoir testé</h3>
      <p className={p}>
        Tout éditeur sérieux propose au minimum un essai gratuit de 14 à 30
        jours. Si l&apos;offre exige un engagement annuel sans période
        d&apos;essai, c&apos;est un signal faible à prendre en compte.
      </p>

      <h3 className={h3}>Piège 5 — Choisir un outil surdimensionné</h3>
      <p className={p}>
        Un ERP qui couvre cinquante fonctionnalités dont vous n&apos;en
        utiliserez que cinq vous fera perdre du temps en configuration et en
        formation. Commencez par l&apos;outil qui correspond à votre taille
        d&apos;entreprise aujourd&apos;hui, quitte à changer dans deux ans
        quand vous aurez embauché.
      </p>

      {/* CTA box */}
      <div className="my-12 rounded-3xl border border-[var(--landing-border)] bg-gradient-to-br from-[var(--landing-accent-light)] to-white p-8 sm:p-10">
        <h3 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)] mb-3">
          Envie de tester un logiciel du bâtiment pensé pour 2026 ?
        </h3>
        <p className="text-base text-[var(--landing-muted)] mb-6">
          Hellobat est une solution 100 % française qui coche toutes les cases
          de ce guide : devis générés par IA, conforme facture électronique,
          application mobile, CRM, suivi chantier, signature électronique et
          support humain. Essayez gratuitement pendant 30 jours, sans carte
          bancaire.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center rounded-full bg-[var(--landing-accent)] text-white font-medium px-6 py-3 hover:bg-[#b94800] transition-colors"
        >
          Essayer Hellobat gratuitement
        </Link>
      </div>

      {/* FAQ */}
      <h2 id="faq" className={h2}>
        FAQ — Logiciel du bâtiment
      </h2>

      <h3 className={h3}>Quel est le meilleur logiciel du bâtiment en 2026 ?</h3>
      <p className={p}>
        Il n&apos;existe pas de «&nbsp;meilleur&nbsp;» logiciel universel —
        seulement le meilleur pour votre situation. Un artisan solo privilégiera
        un outil mobile, simple et abordable comme Hellobat ou Tolteck. Une
        PME qui gère plusieurs équipes s&apos;orientera plutôt vers Obat,
        Vertuoza ou Batappli. Vérifiez avant tout la conformité facture
        électronique 2026 et la qualité de l&apos;application mobile.
      </p>

      <h3 className={h3}>Existe-t-il un vrai logiciel BTP gratuit ?</h3>
      <p className={p}>
        Plusieurs solutions proposent une version gratuite : Costructor, Boby,
        FacturesPro ou Qonto. Ces offres sont correctes pour démarrer mais
        limitent rapidement le nombre de documents, les utilisateurs ou les
        modules. Pour une activité régulière, un abonnement payant
        autour de 25–35 € HT par mois devient vite plus rentable, notamment
        parce qu&apos;il intègre la compatibilité facture électronique 2026.
      </p>

      <h3 className={h3}>Peut-on utiliser un logiciel généraliste pour le BTP ?</h3>
      <p className={p}>
        Techniquement oui, mais vous allez rapidement buter sur les
        spécificités métier : gestion des TVA travaux, mentions décennale,
        bibliothèque d&apos;ouvrages, acomptes sur devis longs, situations
        d&apos;avancement. Un logiciel du bâtiment vous fera gagner du temps
        et vous évitera des erreurs de conformité qui peuvent coûter cher.
      </p>

      <h3 className={h3}>Combien de temps pour migrer vers un nouveau logiciel ?</h3>
      <p className={p}>
        Pour un artisan solo avec quelques dizaines de clients, comptez une
        demi-journée pour importer votre base et paramétrer vos mentions
        légales. Les bons éditeurs proposent une importation CSV depuis votre
        ancien outil et un accompagnement gratuit. Pour une PME avec
        plusieurs utilisateurs et un historique conséquent, prévoyez une à
        deux semaines.
      </p>

      <h3 className={h3}>Quand faut-il changer de logiciel BTP ?</h3>
      <p className={p}>
        Trois signaux doivent vous alerter : votre outil actuel n&apos;annonce
        aucune roadmap pour la facture électronique 2026, vous perdez du
        temps chaque jour à cause d&apos;une interface peu ergonomique, ou
        vous payez pour des modules que vous n&apos;utilisez pas. Dans ces
        cas, changer rapidement est souvent plus rentable qu&apos;attendre.
      </p>
    </div>
  );
}
