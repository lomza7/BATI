'use client';

import { useState } from 'react';
import {
  X, Phone, Mail, MapPin, Star, Wrench, Droplets, Flame,
  Award, Clock, ChevronDown, ChevronUp, Menu,
} from 'lucide-react';
import { SITE_THEMES, type SiteTheme } from '@/lib/site-utils';
import { Button } from '@/components/ui/button';

interface ThemePreviewModalProps {
  open: boolean;
  theme: SiteTheme;
  onClose: () => void;
  onConfirm: () => void;
  isCurrentSelection: boolean;
}

const DUMMY_SERVICES = [
  { icon: Droplets, name: 'Plomberie générale', desc: 'Installation, dépannage et rénovation de tous vos équipements sanitaires.' },
  { icon: Flame, name: 'Chauffage & chaudières', desc: 'Pose, entretien et remplacement de chaudières gaz, fioul et pompes à chaleur.' },
  { icon: Wrench, name: 'Rénovation salle de bain', desc: 'Conception et réalisation clé en main, du devis aux finitions.' },
];

const DUMMY_HIGHLIGHTS = [
  { value: '15+', label: "Années d'expérience" },
  { value: '500+', label: 'Chantiers réalisés' },
  { value: '4.9/5', label: 'Note Google' },
];

const DUMMY_REVIEWS = [
  { name: 'Marie L.', rating: 5, text: "Équipe très professionnelle, intervention rapide et travail soigné. Je recommande !" },
  { name: 'Pierre D.', rating: 5, text: "Devis clair, prix juste, chantier terminé dans les délais. Parfait." },
  { name: 'Sophie M.', rating: 5, text: "Très à l'écoute, conseils avisés. Notre nouvelle salle de bain est magnifique." },
];

const DUMMY_FAQ = [
  { q: 'Proposez-vous des devis gratuits ?', a: 'Oui, tous nos devis sont gratuits et sans engagement. Nous nous déplaçons sous 48h.' },
  { q: 'Quelle est votre zone d\'intervention ?', a: 'Nous intervenons dans toute la métropole lyonnaise et les communes alentours.' },
  { q: 'Êtes-vous certifiés RGE ?', a: 'Oui, nous sommes certifiés RGE Qualibat, ce qui vous permet de bénéficier des aides de l\'État.' },
];

export function ThemePreviewModal({ open, theme, onClose, onConfirm, isCurrentSelection }: ThemePreviewModalProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const s = SITE_THEMES[theme];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center shrink-0"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Aperçu du thème : {s.name}</p>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{s.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
          <Button size="sm" onClick={onConfirm}>
            {isCurrentSelection ? 'Garder ce thème' : 'Choisir ce thème'}
          </Button>
        </div>
      </div>

      {/* Mockup viewport */}
      <div
        className="flex-1 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="min-h-full"
          style={{
            backgroundColor: s.bg,
            color: s.text,
            fontFamily: s.fontFamily,
          }}
        >
          {/* ── Header ── */}
          <header
            className="sticky top-0 z-10 backdrop-blur"
            style={{
              backgroundColor: `${s.bg}f0`,
              borderBottom: `1px solid ${s.border}`,
            }}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: s.accent, color: s.accentText, borderRadius: s.radius }}
                >
                  DP
                </div>
                <div>
                  <p className="font-bold text-base sm:text-lg leading-tight" style={{ color: s.heading }}>
                    Dupont Plomberie
                  </p>
                  <p className="text-xs" style={{ color: s.textMuted }}>Lyon &amp; métropole</p>
                </div>
              </div>
              <nav className="hidden md:flex items-center gap-6 text-sm">
                {['Accueil', 'Services', 'Réalisations', 'Avis', 'Contact'].map((item) => (
                  <a key={item} href="#" style={{ color: s.text }} className="hover:opacity-70">
                    {item}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-2">
                <a
                  href="#"
                  className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2"
                  style={{
                    backgroundColor: s.accent,
                    color: s.accentText,
                    borderRadius: s.radius,
                  }}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Devis gratuit
                </a>
                <button className="md:hidden h-9 w-9 flex items-center justify-center" style={{ color: s.text }}>
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          {/* ── Hero ── */}
          <section
            className="relative px-4 sm:px-6 py-16 sm:py-24"
            style={{
              background: `linear-gradient(135deg, ${s.bg} 0%, ${s.bgAlt} 100%)`,
            }}
          >
            <div className="max-w-4xl mx-auto text-center">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium"
                style={{
                  backgroundColor: `${s.accent}22`,
                  color: s.accent,
                  borderRadius: s.radius,
                }}
              >
                <Award className="h-3 w-3" /> Certifié RGE Qualibat
              </div>
              <h1
                className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6"
                style={{ color: s.heading, fontFamily: s.fontFamily }}
              >
                Votre artisan plombier de confiance a Lyon
              </h1>
              <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8" style={{ color: s.textMuted }}>
                Depannage, installation, renovation. Une equipe experimentee a votre ecoute pour tous vos projets.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-base font-semibold px-6 py-3"
                  style={{
                    backgroundColor: s.accent,
                    color: s.accentText,
                    borderRadius: s.radius,
                  }}
                >
                  <Phone className="h-4 w-4" /> Demander un devis gratuit
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-base font-semibold px-6 py-3 border"
                  style={{
                    borderColor: s.border,
                    color: s.text,
                    borderRadius: s.radius,
                  }}
                >
                  Voir nos realisations
                </a>
              </div>
              <p className="mt-6 text-sm" style={{ color: s.textMuted }}>
                Dupont Plomberie — Devis gratuit et sans engagement
              </p>
            </div>
          </section>

          {/* ── About + highlights ── */}
          <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ backgroundColor: s.bg }}>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-8" style={{ color: s.heading }}>
                Une entreprise familiale au service des Lyonnais
              </h2>
              <p className="mb-4 leading-relaxed" style={{ color: s.text }}>
                Depuis plus de 15 ans, Dupont Plomberie accompagne les particuliers et les professionnels de la metropole lyonnaise. Notre equipe de 6 artisans qualifies intervient avec rigueur, ponctualite et un souci constant de la satisfaction client.
              </p>
              <p className="mb-4 leading-relaxed" style={{ color: s.text }}>
                Specialises dans la plomberie, le chauffage et la renovation de salles de bain, nous mettons notre expertise au service de vos projets les plus ambitieux comme des depannages d&apos;urgence.
              </p>

              <div className="flex flex-wrap justify-center gap-8 mt-10">
                {DUMMY_HIGHLIGHTS.map((h) => (
                  <div key={h.label} className="text-center">
                    <p className="text-3xl sm:text-4xl font-bold" style={{ color: s.accent }}>{h.value}</p>
                    <p className="text-sm mt-1" style={{ color: s.textMuted }}>{h.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Services ── */}
          <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ backgroundColor: s.bgAlt }}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: s.heading }}>
                  Nos services
                </h2>
                <p style={{ color: s.textMuted }}>
                  Une expertise complete pour tous vos besoins en plomberie et chauffage
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {DUMMY_SERVICES.map((service) => {
                  const Icon = service.icon;
                  return (
                    <div
                      key={service.name}
                      className="p-6 border transition-shadow hover:shadow-lg"
                      style={{
                        backgroundColor: s.cardBg,
                        borderColor: s.border,
                        borderRadius: s.radius,
                      }}
                    >
                      <div
                        className="h-12 w-12 flex items-center justify-center mb-4"
                        style={{
                          backgroundColor: `${s.accent}22`,
                          borderRadius: s.radius,
                        }}
                      >
                        <Icon className="h-6 w-6" style={{ color: s.accent }} />
                      </div>
                      <h3 className="font-semibold text-lg mb-2" style={{ color: s.heading }}>
                        {service.name}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: s.textMuted }}>
                        {service.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Projects ── */}
          <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ backgroundColor: s.bg }}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: s.heading }}>
                  Nos realisations
                </h2>
                <p style={{ color: s.textMuted }}>
                  Quelques chantiers recents qui illustrent notre savoir-faire
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { title: 'Renovation salle de bain', city: 'Lyon 6e' },
                  { title: 'Installation pompe a chaleur', city: 'Villeurbanne' },
                  { title: 'Remplacement chaudiere', city: 'Caluire' },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="overflow-hidden border"
                    style={{
                      backgroundColor: s.cardBg,
                      borderColor: s.border,
                      borderRadius: s.radius,
                    }}
                  >
                    <div
                      className="aspect-video flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${s.accent}33 0%, ${s.bgAlt} 100%)`,
                      }}
                    >
                      <Wrench className="h-10 w-10" style={{ color: s.accent, opacity: 0.5 }} />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-base" style={{ color: s.heading }}>{p.title}</h3>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: s.textMuted }}>
                        <MapPin className="h-3 w-3" /> {p.city}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Reviews ── */}
          <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ backgroundColor: s.bgAlt }}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-current" style={{ color: s.accent }} />
                  ))}
                  <span className="ml-2 font-bold text-lg" style={{ color: s.heading }}>4.9/5</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: s.heading }}>
                  Ils nous ont fait confiance
                </h2>
                <p style={{ color: s.textMuted }}>Plus de 120 avis Google verifies</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {DUMMY_REVIEWS.map((r) => (
                  <div
                    key={r.name}
                    className="p-6 border"
                    style={{
                      backgroundColor: s.cardBg,
                      borderColor: s.border,
                      borderRadius: s.radius,
                    }}
                  >
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" style={{ color: s.accent }} />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: s.text }}>
                      &ldquo;{r.text}&rdquo;
                    </p>
                    <p className="text-xs font-medium" style={{ color: s.heading }}>{r.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ backgroundColor: s.bg }}>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10" style={{ color: s.heading }}>
                Questions frequentes
              </h2>
              <div className="space-y-3">
                {DUMMY_FAQ.map((f, i) => (
                  <div
                    key={i}
                    className="border overflow-hidden"
                    style={{
                      borderColor: s.border,
                      backgroundColor: s.cardBg,
                      borderRadius: s.radius,
                    }}
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left"
                    >
                      <span className="font-medium text-sm sm:text-base" style={{ color: s.heading }}>
                        {f.q}
                      </span>
                      {openFaq === i ? (
                        <ChevronUp className="h-4 w-4 shrink-0" style={{ color: s.textMuted }} />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: s.textMuted }} />
                      )}
                    </button>
                    {openFaq === i && (
                      <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: s.textMuted }}>
                        {f.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Contact ── */}
          <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ backgroundColor: s.bgAlt }}>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: s.heading }}>
                Parlons de votre projet
              </h2>
              <p className="mb-10" style={{ color: s.textMuted }}>
                Une question, un devis ? Notre equipe vous repond sous 24h.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Phone, label: 'Telephone', value: '04 78 00 00 00' },
                  { icon: Mail, label: 'Email', value: 'contact@dupont-plomberie.fr' },
                  { icon: Clock, label: 'Horaires', value: 'Lun-Ven : 8h-18h' },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.label}
                      className="p-5 border"
                      style={{
                        backgroundColor: s.cardBg,
                        borderColor: s.border,
                        borderRadius: s.radius,
                      }}
                    >
                      <div
                        className="h-10 w-10 mx-auto flex items-center justify-center mb-3"
                        style={{
                          backgroundColor: `${s.accent}22`,
                          borderRadius: s.radius,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: s.accent }} />
                      </div>
                      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: s.textMuted }}>
                        {c.label}
                      </p>
                      <p className="font-medium text-sm" style={{ color: s.heading }}>{c.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer
            className="px-4 sm:px-6 py-10"
            style={{ backgroundColor: s.bg, borderTop: `1px solid ${s.border}` }}
          >
            <div className="max-w-6xl mx-auto text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div
                  className="h-8 w-8 flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: s.accent, color: s.accentText, borderRadius: s.radius }}
                >
                  DP
                </div>
                <p className="font-bold" style={{ color: s.heading }}>Dupont Plomberie</p>
              </div>
              <p className="text-sm mb-4" style={{ color: s.textMuted }}>
                Votre confort, notre priorite depuis 2010
              </p>
              <p className="text-xs" style={{ color: s.textMuted }}>
                © 2026 Dupont Plomberie — Tous droits reserves
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        className="px-4 py-3 bg-card border-t border-border shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Apercu avec un contenu d&apos;exemple. Votre site sera personnalise avec vos vraies informations.
          </p>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button size="sm" onClick={onConfirm}>
              {isCurrentSelection ? 'Garder ce thème' : 'Choisir ce thème'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
