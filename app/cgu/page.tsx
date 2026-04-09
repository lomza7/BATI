import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Conditions générales d\'utilisation — Hellobat',
};

export default function CguPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--landing-text)] mb-8">
            Conditions générales d&apos;utilisation
          </h1>
          <p className="text-sm text-[var(--landing-muted)] mb-12">
            Dernière mise à jour : 7 avril 2026
          </p>

          <div className="space-y-10">
            <Section title="1. Objet">
              <p>
                Les présentes conditions générales d&apos;utilisation (ci-après « CGU »)
                définissent les modalités d&apos;accès et d&apos;utilisation de la plateforme
                Hellobat, accessible à l&apos;adresse hellobat.app, éditée par Hellobat SAS.
              </p>
              <p>
                Hellobat est une plateforme SaaS (Software as a Service) de gestion
                tout-en-un destinée aux artisans et entreprises du bâtiment en France.
              </p>
            </Section>

            <Section title="2. Acceptation des CGU">
              <p>
                L&apos;inscription et l&apos;utilisation de la plateforme Hellobat impliquent
                l&apos;acceptation pleine et entière des présentes CGU. Si vous n&apos;acceptez pas
                ces conditions, vous ne devez pas utiliser le service.
              </p>
              <p>
                Hellobat se réserve le droit de modifier les présentes CGU à tout moment.
                Les utilisateurs seront informés des modifications par email ou par
                notification dans l&apos;application. La poursuite de l&apos;utilisation du
                service après notification vaut acceptation des nouvelles conditions.
              </p>
            </Section>

            <Section title="3. Description du service">
              <p>Hellobat propose les fonctionnalités suivantes :</p>
              <ul>
                <li>Création et gestion de devis et factures</li>
                <li>Assistant IA pour la génération de devis (voix et photo)</li>
                <li>Signature électronique des documents</li>
                <li>Suivi de chantiers avec photos et progression par phases</li>
                <li>Planning d&apos;équipe interactif</li>
                <li>Carnet de contacts (clients, prospects, prestataires)</li>
                <li>Carte interactive des chantiers</li>
                <li>Intégration Gmail, Google Calendar et Google Business</li>
                <li>Prospection CRM avec pipeline visuel</li>
                <li>Génération de site vitrine par IA</li>
                <li>Catalogues produits avec lien de partage</li>
                <li>Paiements en ligne via Stripe</li>
                <li>Contrats récurrents et facturation automatique</li>
                <li>Comptabilité et suivi des dépenses</li>
                <li>Agents IA spécialisés bâtiment</li>
                <li>Avant/Après IA générés à partir d&apos;une photo</li>
              </ul>
              <p>
                Les fonctionnalités disponibles dépendent du plan souscrit (Starter, Pro
                ou Business). Le détail des plans est consultable sur la page Tarifs.
              </p>
            </Section>

            <Section title="4. Inscription et compte">
              <p>
                L&apos;accès au service nécessite la création d&apos;un compte avec une adresse
                email valide et un mot de passe. Vous êtes responsable de la
                confidentialité de vos identifiants et de toute activité effectuée sous
                votre compte.
              </p>
              <p>
                Vous vous engagez à fournir des informations exactes et à jour lors de
                votre inscription et à les maintenir à jour. Hellobat se réserve le droit
                de suspendre ou supprimer tout compte contenant des informations
                manifestement fausses.
              </p>
            </Section>

            <Section title="5. Tarifs et paiement">
              <p>
                Hellobat propose trois plans tarifaires : Starter (gratuit), Pro et
                Business. Les prix sont indiqués en euros TTC sur la page Tarifs et
                peuvent être modifiés à tout moment. Les utilisateurs seront informés de
                toute modification tarifaire au moins 30 jours avant son entrée en vigueur.
              </p>
              <p>
                Le paiement des plans Pro et Business s&apos;effectue par carte bancaire via
                Stripe, sur une base mensuelle ou annuelle selon l&apos;option choisie.
                L&apos;abonnement est reconduit tacitement à chaque échéance.
              </p>
              <p>
                Un essai gratuit de 30 jours est proposé pour les plans payants. Aucun
                prélèvement n&apos;est effectué pendant la période d&apos;essai.
              </p>
            </Section>

            <Section title="6. Résiliation">
              <p>
                Vous pouvez résilier votre abonnement à tout moment depuis les paramètres
                de votre compte ou via le portail client Stripe. La résiliation prend
                effet à la fin de la période de facturation en cours.
              </p>
              <p>
                Après résiliation, vos données sont conservées pendant 90 jours. Passé ce
                délai, elles sont supprimées définitivement, à l&apos;exception des données
                soumises à une obligation légale de conservation (factures : 10 ans).
              </p>
              <p>
                Hellobat se réserve le droit de suspendre ou résilier un compte en cas de
                violation des présentes CGU, d&apos;utilisation frauduleuse ou d&apos;activité
                illégale, après notification préalable sauf urgence.
              </p>
            </Section>

            <Section title="7. Propriété des données">
              <p>
                Vous restez propriétaire de l&apos;ensemble des données que vous saisissez
                dans Hellobat (devis, factures, contacts, photos, documents, etc.).
                Hellobat ne revendique aucun droit de propriété sur vos données.
              </p>
              <p>
                Vous accordez à Hellobat une licence limitée d&apos;utilisation de vos données
                aux seules fins de fourniture du service (affichage, stockage, traitement
                IA sur votre demande, synchronisation avec les services tiers que vous
                avez connectés).
              </p>
            </Section>

            <Section title="8. Intelligence artificielle">
              <p>
                Hellobat utilise l&apos;intelligence artificielle (Claude d&apos;Anthropic) pour
                certaines fonctionnalités : génération de devis, réponse aux emails,
                contenu de site web, agents spécialisés, comptabilité et avant/après visuels.
              </p>
              <p>
                Les contenus générés par l&apos;IA sont des suggestions et ne constituent pas
                des avis professionnels. Vous êtes responsable de la vérification et de
                la validation de tout contenu généré avant son utilisation. Hellobat ne
                saurait être tenu responsable d&apos;erreurs dans les contenus produits par
                l&apos;IA.
              </p>
              <p>
                L&apos;utilisation de l&apos;IA est soumise à des limites par plan (nombre de
                requêtes par mois), sauf pour le plan Business qui offre un usage
                illimité.
              </p>
            </Section>

            <Section title="9. Intégrations tierces">
              <p>
                Hellobat s&apos;intègre avec des services tiers (Google, Stripe, DocuSeal,
                Pappers). La connexion à ces services est optionnelle et soumise à votre
                consentement explicite. L&apos;utilisation de ces services est régie par leurs
                propres conditions d&apos;utilisation et politiques de confidentialité.
              </p>
              <p>
                Hellobat ne saurait être tenu responsable des interruptions, modifications
                ou dysfonctionnements des services tiers.
              </p>
            </Section>

            <Section title="10. Disponibilité du service">
              <p>
                Hellobat s&apos;efforce d&apos;assurer une disponibilité du service 24h/24, 7j/7.
                Toutefois, Hellobat ne garantit pas une disponibilité ininterrompue et ne
                saurait être tenu responsable des interruptions pour maintenance,
                mise à jour ou cas de force majeure.
              </p>
              <p>
                En cas de maintenance programmée, les utilisateurs seront informés dans un
                délai raisonnable.
              </p>
            </Section>

            <Section title="11. Limitation de responsabilité">
              <p>
                Hellobat est fourni « en l&apos;état ». Hellobat SAS ne saurait être tenu
                responsable des dommages indirects, pertes de données, pertes de chiffre
                d&apos;affaires ou manque à gagner résultant de l&apos;utilisation ou de
                l&apos;impossibilité d&apos;utiliser le service.
              </p>
              <p>
                La responsabilité totale d&apos;Hellobat SAS est limitée au montant des
                sommes effectivement versées par l&apos;utilisateur au cours des 12 mois
                précédant l&apos;événement ayant donné lieu à la réclamation.
              </p>
            </Section>

            <Section title="12. Propriété intellectuelle">
              <p>
                Hellobat, son logo, son interface, son code source et ses contenus sont
                la propriété exclusive d&apos;Hellobat SAS. Toute reproduction ou utilisation
                non autorisée est interdite.
              </p>
              <p>
                Les marques, logos et noms commerciaux des services tiers (Google, Stripe,
                etc.) appartiennent à leurs propriétaires respectifs.
              </p>
            </Section>

            <Section title="13. Droit applicable et litiges">
              <p>
                Les présentes CGU sont soumises au droit français. En cas de litige, les
                parties s&apos;engagent à rechercher une solution amiable. À défaut, les
                tribunaux de Paris seront seuls compétents.
              </p>
              <p>
                Conformément à l&apos;article L. 612-1 du Code de la consommation, vous
                pouvez recourir gratuitement au service de médiation de la consommation.
              </p>
            </Section>

            <Section title="14. Contact">
              <p>
                Pour toute question relative aux présentes CGU :<br />
                <strong>Hellobat SAS</strong><br />
                200 rue de la Croix Nivert, 75015 Paris, France<br />
                Email : contact@hellobat.app
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg sm:text-xl font-semibold text-[var(--landing-text)] mb-3">
        {title}
      </h2>
      <div className="text-sm text-[var(--landing-muted)] leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
