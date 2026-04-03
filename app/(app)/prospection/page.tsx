'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Euro,
  Mail,
  MapPin,
  MoveHorizontal as MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Target,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { LEAD_STAGES, SPECIALTIES, formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddressAutocomplete, type AddressResult } from '@/components/shared/address-autocomplete';
import { cn } from '@/lib/utils';

type ViewMode = 'kanban' | 'list';

interface Lead {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  value: number;
  notes: string;
  project_address: string;
  project_postal_code: string;
  project_city: string;
  project_lat: number | null;
  project_lng: number | null;
  work_type: string;
  work_details: string;
  project_kind: string;
  urgency: string;
  next_action_date: string | null;
  preferred_visit_date: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadForm {
  name: string;
  company_name: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  value: number;
  notes: string;
  project_address: string;
  project_postal_code: string;
  project_city: string;
  project_lat: number | null;
  project_lng: number | null;
  work_type: string;
  work_details: string;
  project_kind: string;
  urgency: string;
  next_action_date: string;
  preferred_visit_date: string;
}

const SOURCES = [
  { value: 'travaux_com', label: 'Travaux.com' },
  { value: 'site_web', label: 'Site web' },
  { value: 'google', label: 'Google' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'bouche_a_oreille', label: 'Bouche a oreille' },
  { value: 'partenaire', label: 'Partenaire' },
  { value: 'autre', label: 'Autre' },
] as const;

const PROJECT_KINDS = [
  { value: 'depannage', label: 'Depannage' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'installation', label: 'Installation' },
  { value: 'entretien', label: 'Entretien' },
  { value: 'neuf', label: 'Neuf' },
  { value: 'travaux', label: 'Travaux divers' },
] as const;

const URGENCY_OPTIONS = [
  { value: 'faible', label: 'Faible' },
  { value: 'normal', label: 'Normale' },
  { value: 'haute', label: 'Haute' },
  { value: 'immediate', label: 'Immediate' },
] as const;

const STAGE_ORDER = ['nouveau', 'contacte', 'devis_envoye', 'negocie', 'gagne', 'perdu'];

function createEmptyForm(): LeadForm {
  return {
    name: '',
    company_name: '',
    email: '',
    phone: '',
    source: 'autre',
    stage: 'nouveau',
    value: 0,
    notes: '',
    project_address: '',
    project_postal_code: '',
    project_city: '',
    project_lat: null,
    project_lng: null,
    work_type: '',
    work_details: '',
    project_kind: 'travaux',
    urgency: 'normal',
    next_action_date: '',
    preferred_visit_date: '',
  };
}

export default function ProspectionPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [view, setView] = useState<ViewMode>('kanban');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | string>('all');
  const [form, setForm] = useState<LeadForm>(createEmptyForm());

  const loadLeads = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false });

    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  function openCreateDialog() {
    setEditingLead(null);
    setForm(createEmptyForm());
    setShowForm(true);
  }

  function openEditDialog(lead: Lead) {
    setEditingLead(lead);
    setForm({
      name: lead.name || '',
      company_name: lead.company_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || 'autre',
      stage: lead.stage || 'nouveau',
      value: Number(lead.value || 0),
      notes: lead.notes || '',
      project_address: lead.project_address || '',
      project_postal_code: lead.project_postal_code || '',
      project_city: lead.project_city || '',
      project_lat: lead.project_lat ?? null,
      project_lng: lead.project_lng ?? null,
      work_type: lead.work_type || '',
      work_details: lead.work_details || '',
      project_kind: lead.project_kind || 'travaux',
      urgency: lead.urgency || 'normal',
      next_action_date: lead.next_action_date || '',
      preferred_visit_date: lead.preferred_visit_date || '',
    });
    setShowForm(true);
  }

  function closeFormDialog() {
    setShowForm(false);
    setEditingLead(null);
    setForm(createEmptyForm());
  }

  function updateForm<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAddressSelect(result: AddressResult) {
    setForm((prev) => ({
      ...prev,
      project_address: result.label,
      project_postal_code: result.postcode || '',
      project_city: result.city || '',
      project_lat: result.lat,
      project_lng: result.lng,
    }));
  }

  async function saveLead() {
    if (!user || !form.name.trim()) return;

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      company_name: form.company_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source,
      stage: form.stage,
      value: Number(form.value) || 0,
      notes: form.notes.trim(),
      project_address: form.project_address.trim(),
      project_postal_code: form.project_postal_code.trim(),
      project_city: form.project_city.trim(),
      project_lat: form.project_lat,
      project_lng: form.project_lng,
      work_type: form.work_type,
      work_details: form.work_details.trim(),
      project_kind: form.project_kind,
      urgency: form.urgency,
      next_action_date: form.next_action_date || null,
      preferred_visit_date: form.preferred_visit_date || null,
      updated_at: new Date().toISOString(),
    };

    if (editingLead) {
      await supabase
        .from('leads')
        .update(payload)
        .eq('id', editingLead.id);
    } else {
      await supabase
        .from('leads')
        .insert({
          ...payload,
          user_id: user.id,
          last_contact_at: null,
        });
    }

    closeFormDialog();
    await loadLeads();
    setSubmitting(false);
  }

  async function moveStage(id: string, stage: string) {
    await supabase
      .from('leads')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', id);

    await loadLeads();
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesQuery =
        !query.trim() ||
        [lead.company_name, lead.name, lead.email, lead.phone, lead.project_city, lead.project_address, lead.work_type]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query.toLowerCase()));

      const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
      const matchesUrgency = urgencyFilter === 'all' || lead.urgency === urgencyFilter;

      return matchesQuery && matchesStage && matchesUrgency;
    });
  }, [leads, query, stageFilter, urgencyFilter]);

  const totalPipeline = leads
    .filter((lead) => !['gagne', 'perdu'].includes(lead.stage))
    .reduce((sum, lead) => sum + Number(lead.value || 0), 0);

  const totalWon = leads
    .filter((lead) => lead.stage === 'gagne')
    .reduce((sum, lead) => sum + Number(lead.value || 0), 0);

  const relancesThisWeek = leads.filter((lead) => {
    if (!lead.next_action_date || ['gagne', 'perdu'].includes(lead.stage)) return false;
    const due = new Date(lead.next_action_date);
    const today = new Date();
    const diff = due.getTime() - startOfDay(today).getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const qualifiedSites = leads.filter((lead) => lead.project_address && lead.work_type).length;

  const nextDueLead = [...leads]
    .filter((lead) => lead.next_action_date && !['gagne', 'perdu'].includes(lead.stage))
    .sort((a, b) => new Date(a.next_action_date || '').getTime() - new Date(b.next_action_date || '').getTime())[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospection & CRM"
        description="Transformez chaque demande entrante en pre-chantier clair, qualifie et actionnable."
      >
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau lead
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">CRM chantier</p>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">
                Un pipeline fait pour signer plus vite et preparer le terrain avant le devis.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Adresse chantier, nature des travaux, urgence et prochaine action au meme endroit. On reste simple, mais utile.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
              <p className="text-xs font-medium text-primary">Prochaine action critique</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {nextDueLead
                  ? `${getLeadDisplayName(nextDueLead)} - ${formatDate(nextDueLead.next_action_date || new Date())}`
                  : 'Aucune relance urgente'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <KpiCard
            icon={Euro}
            label="Pipeline actif"
            value={formatCurrency(totalPipeline)}
            hint="Montant en cours hors gagne/perdu"
          />
          <KpiCard
            icon={ArrowUpRight}
            label="Signe"
            value={formatCurrency(totalWon)}
            hint="Opportunites gagnees"
            accent="emerald"
          />
          <KpiCard
            icon={CalendarClock}
            label="Relances 7 j"
            value={String(relancesThisWeek)}
            hint="Actions a traiter rapidement"
            accent="amber"
          />
          <KpiCard
            icon={MapPin}
            label="Chantiers qualifies"
            value={String(qualifiedSites)}
            hint="Adresse + travaux renseignes"
            accent="blue"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un contact, une entreprise, une ville ou un type de travaux..."
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes les etapes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les etapes</SelectItem>
                {STAGE_ORDER.map((stageKey) => (
                  <SelectItem key={stageKey} value={stageKey}>
                    {LEAD_STAGES[stageKey as keyof typeof LEAD_STAGES].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes les urgences" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les urgences</SelectItem>
                {URGENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>
              Kanban
            </Button>
            <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
              Liste
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun prospect pour l'instant"
          description="Ajoutez vos demandes entrantes avec l'adresse chantier, le type de travaux et la prochaine action pour alimenter un vrai pipeline BTP."
        >
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un lead
          </Button>
        </EmptyState>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="text-sm font-medium text-foreground">Aucun lead ne correspond a ces filtres.</p>
          <p className="mt-1 text-sm text-muted-foreground">Elargissez la recherche ou creez un nouveau lead.</p>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_ORDER.map((stageKey) => {
            const stage = LEAD_STAGES[stageKey as keyof typeof LEAD_STAGES];
            const stageLeads = filteredLeads.filter((lead) => lead.stage === stageKey);

            return (
              <div key={stageKey} className="flex-shrink-0 w-[320px]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', stage.color)}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatCurrency(stageLeads.reduce((sum, lead) => sum + Number(lead.value || 0), 0))}
                  </span>
                </div>

                <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted/15 p-3 min-h-[280px]">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onOpen={() => openEditDialog(lead)}
                      onMoveStage={moveStage}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Lead</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Chantier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Travaux</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Prochaine action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Etape</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.map((lead) => {
                  const stage = LEAD_STAGES[lead.stage as keyof typeof LEAD_STAGES] || LEAD_STAGES.nouveau;

                  return (
                    <tr
                      key={lead.id}
                      className="cursor-pointer transition-colors hover:bg-muted/20"
                      onClick={() => openEditDialog(lead)}
                    >
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{getLeadDisplayName(lead)}</p>
                          <p className="text-xs text-muted-foreground">{lead.name || 'Contact a preciser'}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {lead.phone && <span>{lead.phone}</span>}
                            {lead.email && <span>{lead.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-sm text-foreground">{lead.project_address || 'Adresse a qualifier'}</p>
                          <p className="text-xs text-muted-foreground">{[lead.project_postal_code, lead.project_city].filter(Boolean).join(' ') || 'Ville non renseignee'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {lead.work_type && <Badge variant="outline">{lead.work_type}</Badge>}
                          {lead.project_kind && <Badge variant="outline">{PROJECT_KINDS.find((item) => item.value === lead.project_kind)?.label || lead.project_kind}</Badge>}
                          {lead.urgency && <Badge className={getUrgencyBadgeClasses(lead.urgency)}>{getUrgencyLabel(lead.urgency)}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">
                        {lead.next_action_date ? formatDate(lead.next_action_date) : 'A programmer'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', stage.color)}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-foreground">
                        {formatCurrency(Number(lead.value || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && closeFormDialog()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Modifier le lead' : 'Nouveau lead BTP'}</DialogTitle>
          </DialogHeader>

          <div className="mt-4 grid gap-6 max-h-[80vh] overflow-y-auto pr-1">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Contact & entreprise</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom du contact">
                  <Input value={form.name} placeholder="Jean Martin" onChange={(e) => updateForm('name', e.target.value)} />
                </Field>
                <Field label="Nom de l'entreprise / chantier">
                  <Input value={form.company_name} placeholder="Martin Renovation" onChange={(e) => updateForm('company_name', e.target.value)} />
                </Field>
                <Field label="Telephone">
                  <Input value={form.phone} placeholder="06 12 34 56 78" onChange={(e) => updateForm('phone', e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} placeholder="contact@entreprise.fr" onChange={(e) => updateForm('email', e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Adresse du chantier</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.6fr_0.8fr] gap-4">
                <Field label="Adresse recherchee">
                  <AddressAutocomplete
                    value={form.project_address}
                    onChange={(value) => updateForm('project_address', value)}
                    onSelect={handleAddressSelect}
                    placeholder="Rechercher l'adresse du chantier..."
                  />
                </Field>
                <Field label="Code postal">
                  <Input value={form.project_postal_code} placeholder="75011" onChange={(e) => updateForm('project_postal_code', e.target.value)} />
                </Field>
                <Field label="Ville">
                  <Input value={form.project_city} placeholder="Paris" onChange={(e) => updateForm('project_city', e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Nature des travaux</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Type d'intervention">
                  <Select value={form.project_kind} onValueChange={(value) => updateForm('project_kind', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_KINDS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Specialite">
                  <Select value={form.work_type || 'none'} onValueChange={(value) => updateForm('work_type', value === 'none' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non precisee</SelectItem>
                      {SPECIALTIES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Urgence">
                  <Select value={form.urgency} onValueChange={(value) => updateForm('urgency', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {URGENCY_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Description des travaux">
                <Textarea
                  rows={4}
                  value={form.work_details}
                  placeholder="Ex: renovation complete salle de bain, remplacement chaudiere, fuite toiture..."
                  onChange={(e) => updateForm('work_details', e.target.value)}
                />
              </Field>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Pilotage commercial</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Source">
                  <Select value={form.source} onValueChange={(value) => updateForm('source', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Etape du pipeline">
                  <Select value={form.stage} onValueChange={(value) => updateForm('stage', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGE_ORDER.map((stageKey) => (
                        <SelectItem key={stageKey} value={stageKey}>
                          {LEAD_STAGES[stageKey as keyof typeof LEAD_STAGES].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valeur estimee">
                  <Input type="number" value={form.value || ''} placeholder="0" onChange={(e) => updateForm('value', Number(e.target.value))} />
                </Field>
                <Field label="Prochaine action">
                  <Input type="date" value={form.next_action_date} onChange={(e) => updateForm('next_action_date', e.target.value)} />
                </Field>
                <Field label="Visite souhaitee">
                  <Input type="date" value={form.preferred_visit_date} onChange={(e) => updateForm('preferred_visit_date', e.target.value)} />
                </Field>
              </div>

              <Field label="Notes internes">
                <Textarea
                  rows={3}
                  value={form.notes}
                  placeholder="Contexte, objections, infos importantes avant rappel ou visite..."
                  onChange={(e) => updateForm('notes', e.target.value)}
                />
              </Field>
            </section>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={closeFormDialog}>Annuler</Button>
              <Button onClick={saveLead} disabled={!form.name.trim() || submitting}>
                {editingLead ? 'Enregistrer' : 'Ajouter au pipeline'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadCard({
  lead,
  onOpen,
  onMoveStage,
}: {
  lead: Lead;
  onOpen: () => void;
  onMoveStage: (id: string, stage: string) => Promise<void>;
}) {
  const stage = LEAD_STAGES[lead.stage as keyof typeof LEAD_STAGES] || LEAD_STAGES.nouveau;

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{getLeadDisplayName(lead)}</p>
          <p className="mt-1 text-xs text-muted-foreground truncate">{lead.name || 'Contact a preciser'}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <Pencil className="mr-2 h-4 w-4" />
              Ouvrir
            </DropdownMenuItem>
            {STAGE_ORDER.filter((stageKey) => stageKey !== lead.stage).map((stageKey) => (
              <DropdownMenuItem key={stageKey} onClick={() => onMoveStage(lead.id, stageKey)}>
                {LEAD_STAGES[stageKey as keyof typeof LEAD_STAGES].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{PROJECT_KINDS.find((item) => item.value === lead.project_kind)?.label || 'Travaux'}</Badge>
        {lead.work_type && <Badge variant="outline">{lead.work_type}</Badge>}
        <Badge className={getUrgencyBadgeClasses(lead.urgency)}>{getUrgencyLabel(lead.urgency)}</Badge>
      </div>

      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        {lead.project_address && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{lead.project_address}</span>
          </div>
        )}
        {(lead.phone || lead.email) && (
          <div className="flex flex-wrap gap-3">
            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
            {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
          </div>
        )}
      </div>

      {(lead.work_details || lead.next_action_date || lead.value > 0) && (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
          {lead.work_details && (
            <p className="text-xs text-foreground line-clamp-2">{lead.work_details}</p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {lead.next_action_date ? `A faire le ${formatDate(lead.next_action_date)}` : 'Prochaine action a definir'}
            </div>
            {lead.value > 0 && <div className="text-xs font-semibold text-primary">{formatCurrency(Number(lead.value || 0))}</div>}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', stage.color)}>
          {stage.label}
        </span>
        <span className="text-[11px] text-muted-foreground">Maj {formatDate(lead.updated_at || lead.created_at)}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: 'default' | 'emerald' | 'amber' | 'blue';
}) {
  const accentClasses = {
    default: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  } as const;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', accentClasses[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function getLeadDisplayName(lead: Pick<Lead, 'company_name' | 'name'>) {
  return lead.company_name || lead.name || 'Lead sans nom';
}

function getUrgencyLabel(value: string) {
  return URGENCY_OPTIONS.find((option) => option.value === value)?.label || 'Normale';
}

function getUrgencyBadgeClasses(value: string) {
  switch (value) {
    case 'immediate':
      return 'bg-red-50 text-red-700 hover:bg-red-50';
    case 'haute':
      return 'bg-orange-50 text-orange-700 hover:bg-orange-50';
    case 'faible':
      return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
    default:
      return 'bg-blue-50 text-blue-700 hover:bg-blue-50';
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
