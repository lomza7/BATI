import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Politique de confidentialité — Hellobat',
};

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--landing-text)] mb-8">
            Politique de confidentialité
          </h1>
          <p className="text-sm text-[var(--landing-muted)] mb-12">
            Dernière mise à jour : 7 avril 2026
          </p>

          <div className="space-y-10">
            <Section title="1. Responsable du traitement">
              <p>
                Le responsable du traitement de vos données personnelles est :<br />
                <strong>Hellobat SAS</strong><br />
                200 rue de la Croix Nivert, 75015 Paris, France<br />
                Email : contact@hellobat.app
              </p>
            </Section>

            <Section title="2. Données collectées">
              <p>Nous collectons les données suivantes :</p>
              <ul>
                <li><strong>Données d&apos;identification</strong> : nom, prénom, email, téléphone, adresse</li>
                <li><strong>Données d&apos;entreprise</strong> : raison sociale, SIRET, activité, adresse professionnelle</li>
                <li><strong>Données de facturation</strong> : devis, factures, montants, coordonnées bancaires (via Stripe)</li>
                <li><strong>Données d&apos;usage</strong> : pages consultées, fonctionnalités utilisées, horodatage</li>
                <li><strong>Données de contenu</strong> : photos de chantiers, documents, messages, notes</li>
                <li><strong>Données de connexion</strong> : adresse IP, type de navigateur, système d&apos;exploitation</li>
              </ul>
            </Section>

            <Section title="3. Finalités du traitement">
              <p>Vos données sont traitées pour les finalités suivantes :</p>
              <ul>
                <li>Création et gestion de votre compte utilisateur</li>
                <li>Fourniture et amélioration des services Hellobat (devis, factures, chantiers, planning, etc.)</li>
                <li>Traitement des paiements via Stripe</li>
                <li>Signature électronique des documents via DocuSeal</li>
                <li>Récupération de vos avis publics Google via l&apos;API Google Places</li>
                <li>Génération de contenu par intelligence artificielle (OpenAI)</li>
                <li>Envoi d&apos;emails transactionnels (confirmations, factures, rappels)</li>
                <li>Recherche d&apos;informations d&apos;entreprise via Pappers</li>
                <li>Support client et communication</li>
                <li>Respect de nos obligations légales et fiscales</li>
              </ul>
            </Section>

            <Section title="4. Bases juridiques">
              <p>Le traitement de vos données repose sur :</p>
              <ul>
                <li><strong>L&apos;exécution du contrat</strong> : fourniture du service Hellobat auquel vous avez souscrit</li>
                <li><strong>Le consentement</strong> : pour les cookies non essentiels et la newsletter</li>
                <li><strong>L&apos;intérêt légitime</strong> : amélioration du service, prévention de la fraude, statistiques anonymisées</li>
                <li><strong>L&apos;obligation légale</strong> : conservation des factures (10 ans), obligations fiscales</li>
              </ul>
            </Section>

            <Section title="5. Sous-traitants et destinataires">
              <p>Vos données peuvent être partagées avec les prestataires suivants :</p>
              <ul>
                <li><strong>Supabase Inc.</strong> — hébergement de la base de données et stockage de fichiers</li>
                <li><strong>Vercel Inc.</strong> — hébergement de l&apos;application web</li>
                <li><strong>Stripe Inc.</strong> — traitement des paiements en ligne</li>
                <li><strong>OpenAI</strong> — traitement IA (génération de devis, réponses email, agents IA)</li>
                <li><strong>DocuSeal</strong> — signature électronique des documents</li>
                <li><strong>Resend Inc.</strong> — envoi d&apos;emails transactionnels</li>
                <li><strong>Google LLC</strong> — récupération d&apos;avis publics via Google Places, mesure d&apos;audience (Google Analytics)</li>
                <li><strong>Pappers SAS</strong> — recherche d&apos;informations d&apos;entreprise</li>
              </ul>
              <p>
                Certains de ces prestataires sont situés en dehors de l&apos;Union européenne
                (États-Unis). Les transferts de données sont encadrés par des clauses
                contractuelles types approuvées par la Commission européenne ou par le
                Data Privacy Framework UE-US.
              </p>
            </Section>

            <Section title="6. Durée de conservation">
              <ul>
                <li><strong>Données de compte</strong> : conservées pendant toute la durée de votre abonnement, puis 3 ans après la clôture du compte</li>
                <li><strong>Données de facturation</strong> : 10 ans (obligation légale fiscale)</li>
                <li><strong>Données de connexion</strong> : 12 mois</li>
                <li><strong>Données supprimées (corbeille)</strong> : 30 jours avant suppression définitive</li>
                <li><strong>Cookies</strong> : 13 mois maximum</li>
              </ul>
            </Section>

            <Section title="7. Vos droits">
              <p>
                Conformément au RGPD (articles 15 à 22) et à la loi Informatique et
                Libertés, vous disposez des droits suivants :
              </p>
              <ul>
                <li><strong>Droit d&apos;accès</strong> : obtenir la confirmation que vos données sont traitées et en obtenir une copie</li>
                <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
                <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de vos données</li>
                <li><strong>Droit à la limitation</strong> : restreindre le traitement dans certains cas</li>
                <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré et lisible</li>
                <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement pour des raisons légitimes</li>
                <li><strong>Droit de retirer votre consentement</strong> : à tout moment, sans affecter la licéité du traitement antérieur</li>
              </ul>
              <p>
                Pour exercer vos droits, écrivez-nous à <strong>contact@hellobat.app</strong>.
                Nous répondrons dans un délai d&apos;un mois. En cas de désaccord, vous pouvez
                introduire une réclamation auprès de la CNIL (www.cnil.fr).
              </p>
            </Section>

            <Section title="8. Sécurité">
              <p>
                Nous mettons en œuvre des mesures techniques et organisationnelles
                appropriées pour protéger vos données : chiffrement en transit (TLS) et
                au repos, authentification sécurisée, contrôle d&apos;accès par rôle (Row
                Level Security), sauvegardes régulières, et monitoring des accès.
              </p>
            </Section>

            <Section title="9. Modifications">
              <p>
                Nous nous réservons le droit de modifier la présente politique de
                confidentialité. En cas de modification substantielle, nous vous en
                informerons par email ou par notification dans l&apos;application. La date de
                dernière mise à jour est indiquée en haut de cette page.
              </p>
            </Section>

            <Section title="10. Contact">
              <p>
                Pour toute question relative à la protection de vos données :<br />
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
