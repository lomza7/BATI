'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  HardHat,
  CalendarDays,
  MapPin,
  Globe,
  Target,
  Mail,
  Star,
  FileImage,
  CreditCard,
  Bot,
  Menu,
  X,
  ChevronDown,
  Hexagon,
} from 'lucide-react';

const features = [
  { icon: FileText, label: 'Devis & Factures', href: '/fonctionnalites/devis-factures' },
  { icon: HardHat, label: 'Suivi chantiers', href: '/fonctionnalites/suivi-chantiers' },
  { icon: CalendarDays, label: 'Planning équipe', href: '/fonctionnalites/planning-equipe' },
  { icon: MapPin, label: 'Carte interactive', href: '/fonctionnalites/carte-interactive' },
  { icon: Globe, label: 'Site vitrine IA', href: '/fonctionnalites/site-vitrine' },
  { icon: Target, label: 'Prospection CRM', href: '/fonctionnalites/prospection-crm' },
  { icon: Mail, label: 'Gmail intégré', href: '/fonctionnalites/gmail-integre' },
  { icon: Star, label: 'Avis Google', href: '/fonctionnalites/avis-google' },
  { icon: FileImage, label: 'Plans & Rendus IA', href: '/fonctionnalites/plans-rendus-ia' },
  { icon: CreditCard, label: 'Paiements Stripe', href: '/fonctionnalites/paiements-stripe' },
  { icon: Bot, label: 'Agents IA', href: '/fonctionnalites/agents-ia' },
];

export function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoClicked, setLogoClicked] = useState(false);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);

  function handleLogoClick() {
    setLogoClicked(true);
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => setLogoClicked(false), 600);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--landing-white)]/80 backdrop-blur-md border-b border-[var(--landing-border)]">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" onClick={handleLogoClick}>
          <div className="w-8 h-8 bg-[var(--landing-accent)] rounded-lg flex items-center justify-center">
            <Hexagon className={`h-4 w-4 text-white ${logoClicked ? 'animate-nut-click' : ''}`} />
          </div>
          <span className="font-semibold text-[var(--landing-text)] text-lg">Hellobat</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors">
              Fonctionnalités
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                <div className="bg-white rounded-2xl shadow-xl border border-[var(--landing-border)] p-5 w-[480px] grid grid-cols-2 gap-2">
                  {features.map((f) => (
                    <Link
                      key={f.label}
                      href={f.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--landing-stone)] transition-colors group"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[var(--landing-stone)] flex items-center justify-center group-hover:bg-[var(--landing-accent-light)] transition-colors">
                        <f.icon className="w-4 h-4 text-[var(--landing-muted)] group-hover:text-[var(--landing-accent)] transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-[var(--landing-text)]">{f.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/#pricing" className="text-sm text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors">
            Tarifs
          </Link>
          <Link href="/#testimonials" className="text-sm text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors">
            Témoignages
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors px-4 py-2"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-white bg-[var(--landing-accent)] hover:bg-[#b94800] transition-colors px-5 py-2.5 rounded-full"
          >
            Essai gratuit
          </Link>
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="w-5 h-5 text-[var(--landing-text)]" />
          ) : (
            <Menu className="w-5 h-5 text-[var(--landing-text)]" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[var(--landing-border)] px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {features.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--landing-stone)] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                <f.icon className="w-4 h-4 text-[var(--landing-muted)]" />
                <span className="text-sm text-[var(--landing-text)]">{f.label}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-[var(--landing-border)] pt-4 space-y-2">
            <Link
              href="/#pricing"
              className="block text-sm text-[var(--landing-muted)] py-2"
              onClick={() => setMobileOpen(false)}
            >
              Tarifs
            </Link>
            <Link
              href="/login"
              className="block text-sm text-[var(--landing-muted)] py-2"
              onClick={() => setMobileOpen(false)}
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="block text-center text-sm font-medium text-white bg-[var(--landing-accent)] py-3 rounded-full"
              onClick={() => setMobileOpen(false)}
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
