'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientPicker } from '@/components/shared/client-picker';
import {
  CONTRACT_CATEGORIES,
  FREQUENCY_LABELS,
  getContractCategory,
  type ContractCategoryKey,
  type ContractFrequency,
} from '@/lib/contract-types';

export interface ContractLineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
}

export interface ContractWizardValues {
  title: string;
  clientId: string | null;
  categoryKey: ContractCategoryKey;
  clientType: 'b2b' | 'b2c';
  contractChannel: 'sur_site' | 'a_distance' | 'hors_etablissement';
  siteAddress: string;
  siteAccessNotes: string;
  frequency: ContractFrequency;
  visitsPerYear: number;
  weatherDependent: boolean;
  includedOperations: string[];
  excludedOperations: string[];
  interventionHours: string;
  emergencyPhone: string;
  responseTime: string;
  lineItems: ContractLineItem[];
  amountHt: number;
  tvaRate: number;
  durationMode: 'determinee' | 'indeterminee';
  initialTermMonths: number;
  renewalTermMonths: number;
  autoRenewal: boolean;
  noticePeriodMonths: number;
  breachCurePeriodDays: number;
  paymentMethod: 'virement' | 'sepa' | 'cb' | 'cheque' | 'especes';
  paymentTiming: 'terme_a_echoir' | 'terme_echu';
  paymentTermsDays: number;
  latePenaltyRate: number;
  recoveryFee: number;
  startDate: string;
  endDate: string;
  notes: string;
  autoSend: boolean;
}

export function buildEmptyContract(): ContractWizardValues {
  const cat = CONTRACT_CATEGORIES[0];
  return {
    title: '',
    clientId: null,
    categoryKey: cat.key,
    clientType: 'b2c',
    contractChannel: 'sur_site',
    siteAddress: '',
    siteAccessNotes: '',
    frequency: cat.default_frequency,
    visitsPerYear: cat.default_visits_per_year,
    weatherDependent: cat.weather_dependent,
    includedOperations: [...cat.default_included_operations],
    excludedOperations: [...cat.default_excluded_operations],
    interventionHours: 'Du lundi au vendredi, 8h-18h',
    emergencyPhone: '',
    responseTime: '48h ouvrées',
    lineItems: [],
    amountHt: 0,
    tvaRate: 20,
    durationMode: 'determinee',
    initialTermMonths: 12,
    renewalTermMonths: 12,
    autoRenewal: true,
    noticePeriodMonths: 2,
    breachCurePeriodDays: 30,
    paymentMethod: 'virement',
    paymentTiming: 'terme_echu',
    paymentTermsDays: 30,
    latePenaltyRate: 10,
    recoveryFee: 40,
    startDate: new Date().toLocaleDateString('fr-CA'),
    endDate: '',
    notes: '',
    autoSend: false,
  };
}

const STEPS = [
  { id: 0, title: 'Catégorie', description: 'Type de prestation récurrente' },
  { id: 1, title: 'Client & site', description: 'Qui et où' },
  { id: 2, title: 'Prestations & tarifs', description: 'Ce qui est fait, à quelle fréquence, à quel prix' },
  { id: 3, title: 'Conditions légales', description: 'Durée, paiement, pénalités' },
];

function fmtEuro(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

export function ContractWizard({
  open,
  onOpenChange,
  initial,
  onSubmit,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<ContractWizardValues>;
  onSubmit: (values: ContractWizardValues) => Promise<void>;
  editing?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ContractWizardValues>(() => ({ ...buildEmptyContract(), ...initial }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues({ ...buildEmptyContract(), ...initial });
      setStep(0);
    }
  }, [open, initial]);

  const selectedCategory = getContractCategory(values.categoryKey);

  const computedAmount = useMemo(() => {
    const fromLines = values.lineItems.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
    return fromLines > 0 ? fromLines : values.amountHt;
  }, [values.lineItems, values.amountHt]);

  const totalTtc = computedAmount * (1 + values.tvaRate / 100);

  function applyCategoryDefaults(key: ContractCategoryKey) {
    const cat = getContractCategory(key);
    setValues((v) => ({
      ...v,
      categoryKey: key,
      frequency: cat.default_frequency,
      visitsPerYear: cat.default_visits_per_year,
      weatherDependent: cat.weather_dependent,
      // On ne remplace les listes que si elles sont vides (eviter d'ecraser ce que l'utilisateur a saisi)
      includedOperations: v.includedOperations.length === 0 ? [...cat.default_included_operations] : v.includedOperations,
      excludedOperations: v.excludedOperations.length === 0 ? [...cat.default_excluded_operations] : v.excludedOperations,
      title: v.title || `${cat.label} — ${new Date().getFullYear()}`,
    }));
  }

  function canGoNext(): boolean {
    if (step === 0) return Boolean(values.categoryKey);
    if (step === 1) return Boolean(values.clientId);
    if (step === 2) return values.title.trim().length > 0 && computedAmount > 0 && values.visitsPerYear > 0;
    return true;
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({ ...values, amountHt: computedAmount });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier le contrat' : 'Nouveau contrat récurrent'}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  active ? 'bg-[#d35400] text-white' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                }`}
              >
                <span className={`h-5 w-5 rounded-full inline-flex items-center justify-center text-[11px] ${active ? 'bg-white/25' : done ? 'bg-emerald-200' : 'bg-background'}`}>
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s.title}
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          {step === 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">{STEPS[0].description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONTRACT_CATEGORIES.map((cat) => {
                  const selected = values.categoryKey === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => applyCategoryDefaults(cat.key)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selected ? 'border-[#d35400] bg-[#d35400]/5 shadow-sm' : 'border-border hover:border-[#d35400]/40 hover:bg-muted/40'
                      }`}
                    >
                      <div className="text-2xl">{cat.emoji}</div>
                      <div className="text-sm font-medium mt-1">{cat.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {FREQUENCY_LABELS[cat.default_frequency]} · {cat.default_visits_per_year} visites/an
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{STEPS[1].description}</p>
              <div>
                <label className="text-sm font-medium">Client *</label>
                <div className="mt-1">
                  <ClientPicker value={values.clientId} onChange={(id) => setValues({ ...values, clientId: id })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Type de client</label>
                  <Select value={values.clientType} onValueChange={(v: 'b2b' | 'b2c') => setValues({ ...values, clientType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="b2c">Particulier (B2C)</SelectItem>
                      <SelectItem value="b2b">Professionnel (B2B)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Contexte de signature</label>
                  <Select value={values.contractChannel} onValueChange={(v: ContractWizardValues['contractChannel']) => setValues({ ...values, contractChannel: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sur_site">Sur site (établissement)</SelectItem>
                      <SelectItem value="a_distance">À distance (email/web)</SelectItem>
                      <SelectItem value="hors_etablissement">Hors établissement (démarchage)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Accès / particularités</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  placeholder="Code porte, étage, horaires d'accès, clés, chien..."
                  value={values.siteAccessNotes}
                  onChange={(e) => setValues({ ...values, siteAccessNotes: e.target.value })}
                />
              </div>
              {values.clientType === 'b2c' && values.contractChannel !== 'sur_site' && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                  ⚠️ Signature hors établissement ou à distance avec un particulier : un droit de rétractation de 14 jours s&apos;appliquera automatiquement (article L. 221-18 Code conso).
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{STEPS[2].description}</p>
              <div>
                <label className="text-sm font-medium">Intitulé du contrat *</label>
                <Input className="mt-1" placeholder={`Ex: ${selectedCategory.label} ${new Date().getFullYear()}`} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Fréquence</label>
                  <Select value={values.frequency} onValueChange={(v: ContractFrequency) => setValues({ ...values, frequency: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensuel">Mensuel</SelectItem>
                      <SelectItem value="trimestriel">Trimestriel</SelectItem>
                      <SelectItem value="semestriel">Semestriel</SelectItem>
                      <SelectItem value="annuel">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Visites / an</label>
                  <Input className="mt-1" type="number" min={0} value={values.visitsPerYear || ''} onChange={(e) => setValues({ ...values, visitsPerYear: Number(e.target.value) })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" className="rounded" checked={values.weatherDependent} onChange={(e) => setValues({ ...values, weatherDependent: e.target.checked })} />
                    Météo dépendant
                  </label>
                </div>
              </div>

              {/* Operations editor */}
              <div className="grid sm:grid-cols-2 gap-3">
                <OperationsEditor
                  label="Prestations incluses"
                  accent="emerald"
                  items={values.includedOperations}
                  onChange={(items) => setValues({ ...values, includedOperations: items })}
                />
                <OperationsEditor
                  label="Prestations exclues"
                  accent="red"
                  items={values.excludedOperations}
                  onChange={(items) => setValues({ ...values, excludedOperations: items })}
                />
              </div>

              {/* Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Horaires d&apos;intervention</label>
                  <Input className="mt-1" value={values.interventionHours} onChange={(e) => setValues({ ...values, interventionHours: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Tél. astreinte</label>
                  <Input className="mt-1" placeholder="(optionnel)" value={values.emergencyPhone} onChange={(e) => setValues({ ...values, emergencyPhone: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Délai intervention</label>
                  <Input className="mt-1" value={values.responseTime} onChange={(e) => setValues({ ...values, responseTime: e.target.value })} />
                </div>
              </div>

              {/* Pricing */}
              <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Lignes tarifaires (facultatif)</span>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setValues({
                    ...values,
                    lineItems: [...values.lineItems, { description: '', quantity: 1, unit: 'forfait', unit_price: 0, tva_rate: values.tvaRate }],
                  })}>
                    <Plus className="h-3 w-3" /> Ligne
                  </Button>
                </div>
                {values.lineItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune ligne — saisir un montant forfaitaire annuel HT ci-dessous.</p>
                ) : (
                  values.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="flex-1 h-8 text-xs" placeholder="Description" value={item.description} onChange={(e) => {
                        const arr = [...values.lineItems];
                        arr[i] = { ...arr[i], description: e.target.value };
                        setValues({ ...values, lineItems: arr });
                      }} />
                      <Input className="w-16 h-8 text-xs text-center" type="number" value={item.quantity || ''} onChange={(e) => {
                        const arr = [...values.lineItems];
                        arr[i] = { ...arr[i], quantity: Number(e.target.value) };
                        setValues({ ...values, lineItems: arr });
                      }} />
                      <Input className="w-24 h-8 text-xs" type="number" step="0.01" placeholder="PU HT" value={item.unit_price || ''} onChange={(e) => {
                        const arr = [...values.lineItems];
                        arr[i] = { ...arr[i], unit_price: Number(e.target.value) };
                        setValues({ ...values, lineItems: arr });
                      }} />
                      <span className="text-xs font-medium w-20 text-right">{fmtEuro(item.quantity * item.unit_price)}</span>
                      <button type="button" className="text-muted-foreground hover:text-red-500" onClick={() => setValues({ ...values, lineItems: values.lineItems.filter((_, j) => j !== i) })}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Montant annuel HT (si pas de lignes)</label>
                    <Input className="mt-1" type="number" value={values.amountHt || ''} onChange={(e) => setValues({ ...values, amountHt: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">TVA</label>
                    <Select value={String(values.tvaRate)} onValueChange={(v) => setValues({ ...values, tvaRate: Number(v) })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 %</SelectItem>
                        <SelectItem value="5.5">5,5 %</SelectItem>
                        <SelectItem value="10">10 %</SelectItem>
                        <SelectItem value="20">20 %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border text-sm">
                  <span>Total annuel TTC</span>
                  <span className="font-semibold text-[#d35400]">{fmtEuro(totalTtc)}</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{STEPS[3].description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Durée</label>
                  <Select value={values.durationMode} onValueChange={(v: 'determinee' | 'indeterminee') => setValues({ ...values, durationMode: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="determinee">Durée déterminée</SelectItem>
                      <SelectItem value="indeterminee">Durée indéterminée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Date de début</label>
                  <Input className="mt-1" type="date" value={values.startDate} onChange={(e) => setValues({ ...values, startDate: e.target.value })} />
                </div>
              </div>
              {values.durationMode === 'determinee' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-sm font-medium">Durée initiale (mois)</label>
                    <Input className="mt-1" type="number" value={values.initialTermMonths} onChange={(e) => setValues({ ...values, initialTermMonths: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" className="rounded" checked={values.autoRenewal} onChange={(e) => setValues({ ...values, autoRenewal: e.target.checked })} />
                      Reconduction tacite
                    </label>
                  </div>
                  {values.autoRenewal && (
                    <>
                      <div>
                        <label className="text-sm font-medium">Période (mois)</label>
                        <Input className="mt-1" type="number" value={values.renewalTermMonths} onChange={(e) => setValues({ ...values, renewalTermMonths: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Préavis (mois)</label>
                        <Input className="mt-1" type="number" value={values.noticePeriodMonths} onChange={(e) => setValues({ ...values, noticePeriodMonths: Number(e.target.value) })} />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Moyen de paiement</label>
                  <Select value={values.paymentMethod} onValueChange={(v: ContractWizardValues['paymentMethod']) => setValues({ ...values, paymentMethod: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="virement">Virement</SelectItem>
                      <SelectItem value="sepa">Prélèvement SEPA</SelectItem>
                      <SelectItem value="cb">Carte bancaire</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="especes">Espèces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Cadence</label>
                  <Select value={values.paymentTiming} onValueChange={(v: 'terme_a_echoir' | 'terme_echu') => setValues({ ...values, paymentTiming: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terme_a_echoir">Terme à échoir</SelectItem>
                      <SelectItem value="terme_echu">Terme échu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Délai paiement (j)</label>
                  <Input className="mt-1" type="number" value={values.paymentTermsDays} onChange={(e) => setValues({ ...values, paymentTermsDays: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Taux pénalité (%)</label>
                  <Input className="mt-1" type="number" step="0.1" value={values.latePenaltyRate} onChange={(e) => setValues({ ...values, latePenaltyRate: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Forfait recouvrement (€)</label>
                  <Input className="mt-1" type="number" value={values.recoveryFee} onChange={(e) => setValues({ ...values, recoveryFee: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Mise en demeure (j)</label>
                  <Input className="mt-1" type="number" value={values.breachCurePeriodDays} onChange={(e) => setValues({ ...values, breachCurePeriodDays: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes internes</label>
                <Input className="mt-1" value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" className="rounded" checked={values.autoSend} onChange={(e) => setValues({ ...values, autoSend: e.target.checked })} />
                Envoyer automatiquement les factures par email
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-5 border-t mt-5">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="text-xs text-muted-foreground">Étape {step + 1} / {STEPS.length}</div>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canGoNext()} onClick={() => setStep(step + 1)}>
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button disabled={!canGoNext() || saving} onClick={handleSubmit}>
              {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le contrat'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OperationsEditor({
  label,
  accent,
  items,
  onChange,
}: {
  label: string;
  accent: 'emerald' | 'red';
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const tone = accent === 'emerald'
    ? { bg: 'bg-emerald-50', text: 'text-emerald-700', sign: '✓' }
    : { bg: 'bg-red-50', text: 'text-red-700', sign: '×' };

  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  }

  return (
    <div className={`rounded-xl border border-border ${tone.bg} p-3`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${tone.text}`}>{label}</div>
      <ul className="mt-2 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={`${tone.text}`}>{tone.sign}</span>
            <span className="flex-1">{it}</span>
            <button type="button" className="text-muted-foreground hover:text-red-500" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          className="h-8 text-xs bg-white"
          placeholder="Ajouter une opération"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={add}>Ajouter</Button>
      </div>
    </div>
  );
}
