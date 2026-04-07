import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Mentions légales — Hellobat',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--landing-text)] mb-8">
            Mentions légales
          </h1>
          <p className="text-sm text-[var(--landing-muted)] mb-12">
            Dernière mise à jour : 7 avril 2026
          </p>

          <div className="prose-landing space-y-10">
            <Section title="1. Éditeur du site">
              <p>
                <strong>Hellobat SAS</strong><br />
                Capital social : 1 000 €<br />
                Siège social : 200 rue de la Croix Nivert, 75015 Paris, France<br />
                SIRET : <em>[en cours d&apos;immatriculation]</em><br />
                RCS Paris : <em>[en cours d&apos;immatriculation]</em><br />
                Numéro de TVA intracommunautaire : <em>[en cours d&apos;attribution]</em>
              </p>
              <p>
                Directeur de la publication : Louis Maaza<br />
                Email : contact@hellobat.app
              </p>
            </Section>

            <Section title="2. Hébergement">
              <p>
                <strong>Application web</strong><br />
                Vercel Inc.<br />
                440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
                Site : vercel.com
              </p>
              <p>
                <strong>Base de données et stockage</strong><br />
                Supabase Inc.<br />
                970 Toa Payoh North #07-04, Singapour 318992<br />
                Site : supabase.com
              </p>
            </Section>

            <Section title="3. Propriété intellectuelle">
              <p>
                L&apos;ensemble du contenu du site hellobat.app (textes, images, graphismes,
                logo, icônes, logiciels, base de données) est la propriété exclusive
                d&apos;Hellobat SAS ou de ses partenaires et est protégé par les lois
                françaises et internationales relatives à la propriété intellectuelle.
              </p>
              <p>
                Toute reproduction, représentation, modification, publication ou adaptation
                de tout ou partie des éléments du site, quel que soit le moyen ou le procédé
                utilisé, est interdite sans l&apos;autorisation écrite préalable d&apos;Hellobat SAS.
              </p>
            </Section>

            <Section title="4. Données personnelles">
              <p>
                Les informations relatives au traitement de vos données personnelles sont
                détaillées dans notre{' '}
                <a href="/confidentialite" className="text-[var(--landing-accent)] underline">
                  politique de confidentialité
                </a>.
              </p>
              <p>
                Conformément au Règlement Général sur la Protection des Données (RGPD) et
                à la loi Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez
                d&apos;un droit d&apos;accès, de rectification, de suppression, de limitation et
                de portabilité de vos données. Vous pouvez exercer ces droits en écrivant à
                contact@hellobat.app.
              </p>
            </Section>

            <Section title="5. Cookies">
              <p>
                Le site hellobat.app utilise des cookies. Pour en savoir plus sur les
                cookies utilisés et gérer vos préférences, consultez notre{' '}
                <a href="/cookies" className="text-[var(--landing-accent)] underline">
                  politique de cookies
                </a>.
              </p>
            </Section>

            <Section title="6. Limitation de responsabilité">
              <p>
                Hellobat SAS s&apos;efforce d&apos;assurer au mieux l&apos;exactitude et la mise à jour
                des informations diffusées sur le site. Toutefois, Hellobat SAS ne peut
                garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations
                mises à disposition sur le site.
              </p>
              <p>
                Hellobat SAS décline toute responsabilité pour toute imprécision,
                inexactitude ou omission portant sur des informations disponibles sur le
                site, ainsi que pour tout dommage résultant d&apos;une intrusion frauduleuse
                d&apos;un tiers ayant entraîné une modification des informations.
              </p>
            </Section>

            <Section title="7. Liens hypertextes">
              <p>
                Le site hellobat.app peut contenir des liens hypertextes vers d&apos;autres
                sites internet. Hellobat SAS n&apos;exerce aucun contrôle sur ces sites et
                décline toute responsabilité quant à leur contenu ou aux traitements de
                données personnelles qu&apos;ils opèrent.
              </p>
            </Section>

            <Section title="8. Droit applicable">
              <p>
                Les présentes mentions légales sont soumises au droit français. En cas de
                litige, les tribunaux de Paris seront seuls compétents.
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
      <div className="text-sm text-[var(--landing-muted)] leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
