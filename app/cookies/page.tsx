import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Politique de cookies — Hellobat',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--landing-text)] mb-8">
            Politique de cookies
          </h1>
          <p className="text-sm text-[var(--landing-muted)] mb-12">
            Dernière mise à jour : 7 avril 2026
          </p>

          <div className="space-y-10">
            <Section title="1. Qu'est-ce qu'un cookie ?">
              <p>
                Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur,
                téléphone, tablette) lorsque vous visitez un site web. Les cookies
                permettent au site de reconnaître votre appareil et de mémoriser certaines
                informations relatives à votre visite.
              </p>
            </Section>

            <Section title="2. Cookies utilisés par Hellobat">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--landing-border)]">
                      <th className="text-left py-2 pr-4 font-semibold text-[var(--landing-text)]">Cookie</th>
                      <th className="text-left py-2 pr-4 font-semibold text-[var(--landing-text)]">Type</th>
                      <th className="text-left py-2 pr-4 font-semibold text-[var(--landing-text)]">Finalité</th>
                      <th className="text-left py-2 font-semibold text-[var(--landing-text)]">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--landing-muted)]">
                    <tr className="border-b border-[var(--landing-border)]/50">
                      <td className="py-2 pr-4 font-mono text-xs">sb-*-auth-token</td>
                      <td className="py-2 pr-4">Essentiel</td>
                      <td className="py-2 pr-4">Authentification de votre session Supabase</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b border-[var(--landing-border)]/50">
                      <td className="py-2 pr-4 font-mono text-xs">sb-*-auth-token-code-verifier</td>
                      <td className="py-2 pr-4">Essentiel</td>
                      <td className="py-2 pr-4">Sécurité de l&apos;authentification (PKCE)</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b border-[var(--landing-border)]/50">
                      <td className="py-2 pr-4 font-mono text-xs">google_oauth_user_id</td>
                      <td className="py-2 pr-4">Essentiel</td>
                      <td className="py-2 pr-4">Liaison OAuth Google (Calendar, Gmail, Business)</td>
                      <td className="py-2">5 min</td>
                    </tr>
                    <tr className="border-b border-[var(--landing-border)]/50">
                      <td className="py-2 pr-4 font-mono text-xs">__vercel_live_token</td>
                      <td className="py-2 pr-4">Technique</td>
                      <td className="py-2 pr-4">Prévisualisation Vercel (développement uniquement)</td>
                      <td className="py-2">Session</td>
                    </tr>
                    <tr className="border-b border-[var(--landing-border)]/50">
                      <td className="py-2 pr-4 font-mono text-xs">_ga</td>
                      <td className="py-2 pr-4">Analytique</td>
                      <td className="py-2 pr-4">Identification unique du visiteur (Google Analytics)</td>
                      <td className="py-2">2 ans</td>
                    </tr>
                    <tr className="border-b border-[var(--landing-border)]/50">
                      <td className="py-2 pr-4 font-mono text-xs">_ga_*</td>
                      <td className="py-2 pr-4">Analytique</td>
                      <td className="py-2 pr-4">Conservation de l&apos;état de session (Google Analytics)</td>
                      <td className="py-2">2 ans</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="3. Cookies essentiels">
              <p>
                Les cookies essentiels sont nécessaires au fonctionnement du site. Ils
                vous permettent de naviguer sur le site et d&apos;utiliser ses fonctionnalités
                (authentification, sécurité). Ces cookies ne peuvent pas être désactivés
                car le service ne fonctionnerait pas sans eux.
              </p>
              <p>
                <strong>Hellobat n&apos;utilise aucun cookie publicitaire.</strong> Nous
                n&apos;utilisons pas Facebook Pixel ni tout autre outil de suivi marketing.
              </p>
            </Section>

            <Section title="4. Cookies analytiques (Google Analytics)">
              <p>
                Hellobat utilise Google Analytics 4 (GA4) pour mesurer la fréquentation
                du site et comprendre comment les visiteurs utilisent la plateforme :
                pages consultées, durée des visites, provenance du trafic.
              </p>
              <p>
                Ces cookies sont déposés par Google LLC. Les données collectées sont
                anonymisées (pas de collecte d&apos;adresse IP complète) et ne sont pas
                croisées avec d&apos;autres services Google à des fins publicitaires.
              </p>
              <p>
                Vous pouvez refuser ces cookies via le bandeau de consentement affiché
                lors de votre première visite, ou à tout moment via les paramètres de
                votre navigateur. Vous pouvez également installer l&apos;extension{' '}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--landing-accent)] underline"
                >
                  Google Analytics Opt-out
                </a>{' '}
                pour désactiver le suivi sur tous les sites.
              </p>
            </Section>

            <Section title="5. Cookies tiers">
              <p>
                Lorsque vous connectez votre compte Google (Calendar, Gmail ou Business),
                Google peut déposer ses propres cookies conformément à sa politique de
                confidentialité. De même, lors d&apos;un paiement via Stripe, Stripe peut
                utiliser des cookies nécessaires au traitement sécurisé du paiement.
              </p>
            </Section>

            <Section title="6. Gestion des cookies">
              <p>
                Vous pouvez gérer les cookies via les paramètres de votre navigateur :
              </p>
              <ul>
                <li><strong>Chrome</strong> : Paramètres → Confidentialité et sécurité → Cookies</li>
                <li><strong>Firefox</strong> : Paramètres → Vie privée et sécurité → Cookies</li>
                <li><strong>Safari</strong> : Préférences → Confidentialité → Cookies</li>
                <li><strong>Edge</strong> : Paramètres → Cookies et autorisations de site</li>
              </ul>
              <p>
                La suppression des cookies essentiels entraînera la déconnexion de votre
                compte et pourra affecter le fonctionnement du site.
              </p>
            </Section>

            <Section title="7. Durée de conservation">
              <p>
                Les cookies essentiels d&apos;Hellobat ont une durée de vie limitée à la
                session de navigation ou à 13 mois maximum, conformément aux
                recommandations de la CNIL.
              </p>
            </Section>

            <Section title="8. Contact">
              <p>
                Pour toute question relative aux cookies :<br />
                <strong>Hellobat SAS</strong> — contact@hellobat.app
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
