'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Building2, Search, Loader2, Check, SkipForward, Building, MapPin } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

interface PappersSearchResult {
  siren: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  naf_code: string;
  naf_label: string;
  legal_form: string;
}

interface PappersCompanyData {
  siren: string;
  siret: string;
  name: string;
  legal_form: string;
  naf_code: string;
  naf_label: string;
  creation_date: string;
  capital: number | null;
  effectif: string;
  tva_number: string;
  address: string;
  postal_code: string;
  city: string;
  dirigeant_name: string;
  dirigeant_role: string;
  phone: string;
  website: string;
  rcs: string;
}

const activities = [
  'Plomberie',
  'Electricite',
  'Peinture',
  'Carrelage',
  'Maconnerie',
  'Menuiserie',
  'Couverture',
  'Chauffage / Clim',
  'Renovation generale',
  'Autre',
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepCompany({ data, onChange, onNext, onBack, onSkip }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PappersSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canProceed = data.companyName.trim().length >= 2;

  // Search Pappers on input change
  const searchPappers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setSearchError('');
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setSearchError('');
    setHasSearched(false);
    try {
      const res = await fetch(`/api/pappers/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'La recherche Pappers est indisponible pour le moment.');
      }

      if (Array.isArray(data.results)) {
        setResults(data.results);
        setShowDropdown(data.results.length > 0);
        setHasSearched(true);
        return;
      }

      throw new Error('La recherche Pappers a renvoye une reponse inattendue.');
    } catch (error) {
      setResults([]);
      setShowDropdown(false);
      setHasSearched(true);
      setSearchError(error instanceof Error ? error.message : 'La recherche Pappers est indisponible pour le moment.');
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setCompanyLoaded(false);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPappers(value), 300);
  }

  async function selectCompany(result: PappersSearchResult) {
    setShowDropdown(false);
    setQuery(result.name);
    setLoadingCompany(true);

    // Pre-fill basic info immediately
    onChange({
      companyName: result.name,
      companyCity: result.city,
    });

    // Fetch full details from Pappers
    try {
      const res = await fetch(`/api/pappers/company?siren=${encodeURIComponent(result.siren)}`);
      const company: PappersCompanyData = await res.json();

      if (!company.siren) throw new Error('No data');

      // Map Pappers NAF to our activity categories
      const matchedActivity = matchActivity(company.naf_label);

      onChange({
        companyName: company.name,
        companyCity: company.city,
        companyPhone: company.phone || data.companyPhone,
        companyActivity: matchedActivity || data.companyActivity,
        siren: company.siren,
        siret: company.siret,
        legalForm: company.legal_form,
        nafCode: company.naf_code,
        nafLabel: company.naf_label,
        capital: company.capital,
        tvaNumber: company.tva_number,
        companyAddress: company.address,
        companyPostalCode: company.postal_code,
        companyWebsite: company.website,
        rcs: company.rcs,
        // Auto-fill dirigeant name if fullName is empty
        ...(data.fullName.trim().length < 2 && company.dirigeant_name
          ? { fullName: company.dirigeant_name }
          : {}),
      });

      // Map effectif to team size
      if (company.effectif) {
        const eff = company.effectif.toLowerCase();
        if (eff.includes('0') || eff.includes('1 ') || eff === '1') {
          onChange({ teamSize: 'seul' });
        } else if (eff.includes('2') || eff.includes('3') || eff.includes('4') || eff.includes('5')) {
          onChange({ teamSize: '2-5' });
        } else if (parseInt(company.effectif) <= 10) {
          onChange({ teamSize: '6-10' });
        } else {
          onChange({ teamSize: '10+' });
        }
      }

      setCompanyLoaded(true);
    } catch {
      // Basic info already filled from search result
    } finally {
      setLoadingCompany(false);
    }
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Parlez-nous de votre entreprise
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Tapez le nom de votre entreprise pour pre-remplir automatiquement vos informations.
      </p>

      <div className="mt-6 space-y-4 flex-1">
        {/* Pappers search */}
        <div className="space-y-2 relative" ref={dropdownRef}>
          <label htmlFor="companySearch" className="text-sm font-medium text-foreground">
            Rechercher votre entreprise
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="companySearch"
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              placeholder="Ex: Martin Plomberie, SIREN, ou nom du dirigeant..."
              autoFocus
              className="flex h-11 w-full rounded-xl border border-border bg-muted/30 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            />
            {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Search dropdown */}
          {showDropdown && results.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-[220px] overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.siren}
                  type="button"
                  onClick={() => selectCompany(r)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>SIREN {r.siren}</span>
                        {r.city && (
                          <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{r.city}</span>
                        )}
                        {r.naf_label && <span className="truncate">{r.naf_label}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!searching && searchError && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {searchError.includes('PAPPERS_API_KEY manquante')
                ? 'La recherche d entreprise n est pas encore configuree sur cet environnement. Vous pouvez continuer manuellement ou ajouter PAPPERS_API_KEY.'
                : searchError}
            </p>
          )}

          {!searching && !searchError && hasSearched && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
              Aucune entreprise trouvee pour cette recherche. Vous pouvez continuer manuellement juste en dessous.
            </p>
          )}
        </div>

        {/* Company loaded success */}
        {loadingCompany && (
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement des informations...</p>
          </div>
        )}

        {companyLoaded && !loadingCompany && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">Informations pre-remplies</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <InfoRow label="Entreprise" value={data.companyName} />
              <InfoRow label="SIREN" value={data.siren} />
              <InfoRow label="SIRET" value={data.siret} />
              <InfoRow label="Forme juridique" value={data.legalForm} />
              <InfoRow label="Adresse" value={[data.companyAddress, data.companyPostalCode, data.companyCity].filter(Boolean).join(', ')} />
              {data.nafLabel && <InfoRow label="Activite NAF" value={data.nafLabel} />}
              {data.tvaNumber && <InfoRow label="TVA" value={data.tvaNumber} />}
              {data.companyPhone && <InfoRow label="Telephone" value={data.companyPhone} />}
              {data.companyWebsite && <InfoRow label="Site web" value={data.companyWebsite} />}
              {data.capital && <InfoRow label="Capital" value={`${data.capital.toLocaleString('fr-FR')} EUR`} />}
            </div>
            <p className="text-[10px] text-emerald-600 mt-2">
              Vous pourrez modifier ces informations a tout moment dans les parametres.
            </p>
          </div>
        )}

        {/* Manual fallback if no Pappers or user wants to type manually */}
        {!companyLoaded && !loadingCompany && (
          <>
            <div className="space-y-2">
              <label htmlFor="companyName" className="text-sm font-medium text-foreground">
                Nom de l&apos;entreprise
              </label>
              <input
                id="companyName"
                type="text"
                value={data.companyName}
                onChange={(e) => onChange({ companyName: e.target.value })}
                placeholder="Ou saisissez manuellement..."
                className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Activite principale</label>
              <div className="grid grid-cols-2 gap-2">
                {activities.map((activity) => (
                  <button
                    key={activity}
                    type="button"
                    onClick={() => onChange({ companyActivity: activity })}
                    className={`h-10 px-3 rounded-lg border text-sm text-left transition-all ${
                      data.companyActivity === activity
                        ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                        : 'border-border bg-white text-foreground hover:border-primary/30 hover:bg-muted/20'
                    }`}
                  >
                    {activity}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="companyCity" className="text-sm font-medium text-foreground">
                  Ville
                </label>
                <input
                  id="companyCity"
                  type="text"
                  value={data.companyCity}
                  onChange={(e) => onChange({ companyCity: e.target.value })}
                  placeholder="Ex: Lyon"
                  className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="companyPhone" className="text-sm font-medium text-foreground">
                  Telephone
                </label>
                <input
                  id="companyPhone"
                  type="tel"
                  value={data.companyPhone}
                  onChange={(e) => onChange({ companyPhone: e.target.value })}
                  placeholder="06 12 34 56 78"
                  className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                />
              </div>
            </div>
          </>
        )}

        {/* If Pappers loaded but activity wasn't auto-matched, let user pick */}
        {companyLoaded && !data.companyActivity && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Selectionnez votre activite principale</label>
            <div className="grid grid-cols-2 gap-2">
              {activities.map((activity) => (
                <button
                  key={activity}
                  type="button"
                  onClick={() => onChange({ companyActivity: activity })}
                  className={`h-10 px-3 rounded-lg border text-sm text-left transition-all ${
                    data.companyActivity === activity
                      ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
                      : 'border-border bg-white text-foreground hover:border-primary/30 hover:bg-muted/20'
                  }`}
                >
                  {activity}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="h-11 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-all"
          >
            Passer
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1 overflow-hidden">
      <span className="text-emerald-600 shrink-0">{label} :</span>
      <span className="text-emerald-800 font-medium truncate">{value}</span>
    </div>
  );
}

function matchActivity(nafLabel: string): string {
  if (!nafLabel) return '';
  const lower = nafLabel.toLowerCase();
  if (lower.includes('plomb') || lower.includes('sanitaire')) return 'Plomberie';
  if (lower.includes('electri')) return 'Electricite';
  if (lower.includes('peint') || lower.includes('revetement')) return 'Peinture';
  if (lower.includes('carrel') || lower.includes('sol')) return 'Carrelage';
  if (lower.includes('macon') || lower.includes('gros oeuvre') || lower.includes('beton')) return 'Maconnerie';
  if (lower.includes('menuise') || lower.includes('bois') || lower.includes('charpent')) return 'Menuiserie';
  if (lower.includes('couvert') || lower.includes('toitur') || lower.includes('etanche')) return 'Couverture';
  if (lower.includes('chauff') || lower.includes('clim') || lower.includes('thermique') || lower.includes('froid')) return 'Chauffage / Clim';
  if (lower.includes('renov') || lower.includes('construction') || lower.includes('batiment') || lower.includes('travaux')) return 'Renovation generale';
  return '';
}
