# Hellobat — CLAUDE.md

## Projet

Hellobat est un SaaS tout-en-un pour les artisans du bâtiment en France. Interface entièrement en français (fr-FR). Pas d'i18n — application monolingue.

## Stack technique

- **Framework** : Next.js 14.2 (App Router) + React 18 + TypeScript 5 (strict)
- **UI** : shadcn/ui (49 composants) + Radix UI + Tailwind CSS 3.3 + Lucide React (icônes)
- **Base de données** : Supabase (PostgreSQL + Row Level Security + Storage)
- **Auth** : Supabase Auth (email/password), contexte React via `useAuth()`
- **Formulaires** : React Hook Form + Zod
- **Graphiques** : Recharts
- **Cartes** : Leaflet 1.9 + react-leaflet 4 (compatible React 18)
- **IA** : OpenAI API (routes API server-side, gpt-4o-mini par défaut) + Web Speech Recognition (voix navigateur)
- **Paiements** : Stripe (checkout, portal, subscriptions)
- **Emails** : Resend (transactionnel)
- **Signature électronique** : DocuSeal
- **Recherche entreprise** : Pappers API
- **Déploiement** : Vercel
- **Font** : Inter (Google Fonts) + Geist

## Structure du projet

```
app/
├── page.tsx                    # Landing page (publique)
├── layout.tsx                  # Root layout (fonts, providers)
├── globals.css                 # Styles globaux + animations custom
├── (auth)/                     # Routes publiques
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (app)/                      # Routes protégées (avec sidebar)
│   ├── layout.tsx              # Layout app (sidebar + main)
│   ├── dashboard/              # Tableau de bord (KPIs, graphiques, pipeline)
│   ├── calendrier/             # Calendrier personnel (sync iCloud via ICS)
│   ├── taches/                 # Gestion des tâches (todos)
│   ├── clients/                # Contacts (clients, prospects, prestataires)
│   ├── devis/                  # Devis (+ assistant IA voix/photo + signature DocuSeal)
│   ├── factures/               # Factures
│   ├── prestations/            # Bibliothèque de prestations/services
│   ├── chantiers/              # Chantiers
│   ├── planning/               # Planning équipe (drag & drop, vue semaine/mois)
│   ├── carte/                  # Vue carte interactive Leaflet
│   ├── equipe/                 # Équipe et sous-traitants
│   ├── catalogues/             # Catalogues produits (magic link partage)
│   ├── prospection/            # CRM / Leads pipeline
│   ├── site-web/               # Générateur de site web IA
│   ├── assistant-email/        # Assistant IA pour rédiger des réponses email (paste-based)
│   ├── avis/                   # Avis clients (manuels + demande par SMS)
│   ├── agents/                 # Agents IA (pannes, DTU, chiffrage, juridique, RGE/CEE)
│   ├── paiements/              # Paiements Stripe
│   ├── contrats/               # Contrats récurrents
│   ├── comptabilite/           # Comptabilité / Dépenses (IA)
│   ├── parametres/             # Paramètres, templates documents
│   └── admin/                  # Administration (restreint à louis@maaza.pro)
├── api/
│   ├── ai/
│   │   ├── quote/route.ts      # Génération devis IA (Claude + voix + photos)
│   │   ├── email-reply/route.ts# Réponse email IA (contexte client)
│   │   └── site-content/route.ts# Génération contenu site web IA
│   ├── carte/share/            # POST — partage carte par email (Resend)
│   ├── icloud-calendar/        # Export ICS pour abonnement iCloud/Apple Calendar
│   ├── docuseal/               # Signature électronique
│   │   ├── create-submission/  # POST — créer demande signature
│   │   ├── webhook/            # POST — webhook fin de signature
│   │   ├── sync-status/        # POST — sync statut
│   │   └── resend-email/       # POST — renvoyer email
│   ├── stripe/                 # Paiements
│   │   ├── checkout/           # POST — session checkout
│   │   ├── portal/             # POST — portail client
│   │   └── prices/             # GET — tarifs depuis platform_config
│   ├── pappers/                # Recherche entreprises
│   │   ├── search/             # GET — recherche par nom
│   │   └── company/            # GET — détail entreprise
│   ├── admin/                  # Admin
│   │   ├── sites/              # GET/POST — gestion sites artisans
│   │   └── ai-usage/           # GET — stats usage IA
│   └── site/revalidate/        # POST — ISR revalidation sites publiés
├── c/[token]/                  # Vue catalogue publique (magic link)
├── d/[token]/                  # Vue devis publique (signature)
├── carte/publique/             # Carte publique (pas d'auth)
└── site/[slug]/                # Sites artisans publiés

components/
├── ui/                         # 49 composants shadcn/ui (NE PAS modifier manuellement)
├── landing/                    # Sections landing page (hero, features, pricing, faq, etc.)
├── sidebar/                    # Navigation (sidebar.tsx, sidebar-nav.tsx, sidebar-user.tsx)
├── dashboard/                  # kpi-card.tsx (avec sparkline Recharts en fond)
├── onboarding/                 # Flux onboarding multi-étapes
├── shared/                     # Composants réutilisables :
│   ├── page-header.tsx         #   En-tête de page
│   ├── status-badge.tsx        #   Badge de statut
│   ├── empty-state.tsx         #   État vide
│   ├── address-autocomplete.tsx#   Autocomplétion adresse (api-adresse.data.gouv.fr)
│   ├── client-picker.tsx       #   Sélecteur/créateur de client
│   ├── map-view.tsx            #   Carte Leaflet
│   └── member-avatar.tsx       #   Avatar membre (image ou initiales)
├── catalogs/                   # Composants catalogues (builder, collections, produits, envoi)
├── devis/                      # Assistant IA devis, signature DocuSeal, envoi, service picker
├── parametres/                 # Preview et config templates documents
├── todos/                      # Composants tâches (carte, graphique catégories)
└── providers.tsx               # Context providers

lib/
├── supabase.ts                 # Client Supabase (browser)
├── supabase-admin.ts           # Client Supabase admin (service role, server-side)
├── auth-context.tsx            # Contexte auth (useAuth hook) — gestion session robuste
├── utils.ts                    # cn() helper Tailwind
├── constants.ts                # Statuts, types contacts, formatters (currency EUR, dates fr-FR)
├── todo-constants.ts           # Priorités et catégories tâches
├── pricing-plans.ts            # Définitions plans (Starter, Pro, Business)
├── lead-pipeline.ts            # Stages CRM et couleurs
├── lead-sources.ts             # Types et labels sources leads
├── icloud-calendar.ts          # Génération feed ICS pour abonnement Apple Calendar
├── docuseal.ts                 # API DocuSeal (signature électronique)
├── email-templates.ts          # Templates HTML emails transactionnels
├── document-templates.ts       # Templates documents (devis, factures)
├── ai-usage.ts                 # Tracking et limites usage IA par plan
├── site-utils.ts               # Utilitaires sites artisans publiés
└── ai/
    └── quote-schema.ts         # Schéma Zod validation réponse IA devis

hooks/
├── use-toast.ts                # Hook notifications toast (Sonner)
└── use-platform-config.ts      # Fetch et cache config plateforme
```

## Navigation sidebar (8 groupes)

1. **Principal** : Tableau de bord, Calendrier, Mes tâches, Contacts, Devis, Factures, Mes prestations
2. **Chantiers** : Mes chantiers, Planning, Carte, Équipe
3. **Commercial** : Catalogues, Prospection, Site web IA, Avis clients
6. **Agents IA** : Mes Agents
7. **Finance** : Paiement Stripe, Contrats récurrents, Comptabilité IA
8. **Admin** : Administration (restreint)

## Commandes

```bash
npm run dev          # Serveur de développement
npm run build        # Build production
npm run lint         # ESLint
npm run typecheck    # Vérification types TypeScript
```

## Conventions de code

- **Fichiers** : kebab-case (`page-header.tsx`)
- **Composants** : PascalCase (`PageHeader`)
- **Fonctions** : camelCase
- **Constantes** : UPPER_SNAKE_CASE (`QUOTE_STATUSES`)
- **Imports** : alias `@/*` vers la racine du projet
- **Tout le texte UI est en français** — ne jamais écrire de texte anglais dans l'interface

## Patterns principaux

### Composants client
```tsx
'use client';
// Toutes les pages interactives commencent par 'use client'
```

### Chargement de données
```tsx
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => { loadItems(); }, []);

async function loadItems() {
  const { data } = await supabase.from('table').select('*');
  setItems(data || []);
  setLoading(false);
}
```

### CRUD avec Dialog
```tsx
const [showCreate, setShowCreate] = useState(false);
// Dialog contrôlé avec état séparé pour le formulaire
// Submit → supabase.from('table').insert({...}) → recharger données
```

### Composants partagés
```tsx
<PageHeader title="..." description="...">
  <Button>Action</Button>
</PageHeader>

<StatusBadge label="..." color="..." />

<EmptyState icon={Icon} title="..." description="...">
  <Button>CTA</Button>
</EmptyState>

<ClientPicker value={clientId} onChange={setClientId} />

<AddressAutocomplete value={query} onChange={setQuery} onSelect={handleAddress} />
```

### Routes API — pattern auth
```tsx
// Toutes les routes API vérifient l'auth via Bearer token Supabase
const authHeader = request.headers.get('authorization');
const sb = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
const { data: { user } } = await sb.auth.getUser(token);
```

## Base de données (tables principales)

| Table | Usage |
|-------|-------|
| `profiles` | Profils utilisateurs + onboarding + entreprise |
| `clients` | Contacts (clients, prospects, prestataires) — `contact_type` |
| `quotes` / `quote_lines` / `quote_sends` | Devis (D-YYYY-XXX) + envoi + signature DocuSeal |
| `invoices` / `invoice_lines` | Factures (F-YYYY-XXX) |
| `services` | Bibliothèque de prestations |
| `projects` / `project_photos` | Chantiers avec géolocalisation + flag `is_public` |
| `team_members` / `team_notes` | Équipe (salariés, sous-traitants, intérimaires) |
| `planning_events` | Planning équipe (chantier, congé, réunion, autre) |
| `calendar_events` | Calendrier personnel (export ICS vers iCloud) |
| `todos` | Tâches avec catégories et priorités |
| `leads` / `lead_sources` / `lead_stages` | CRM pipeline (custom par user) |
| `reviews` | Avis clients (manuels, affichables sur site vitrine) |
| `catalogs` / `catalog_collections` / `catalog_products` | Système catalogues |
| `catalog_sends` / `catalog_client_selections` | Envoi catalogues (magic link) |
| `ai_agents` / `ai_conversations` / `ai_messages` | Agents IA conversationnels |
| `ai_usage` / `ai_plan_limits` | Tracking et limites usage IA |
| `recurring_contracts` | Contrats de maintenance récurrents |
| `expenses` | Comptabilité / dépenses |
| `artisan_sites` | Sites web artisans publiés |
| `platform_config` | Config plateforme (prix Stripe, etc.) |
| `business_reminder_settings` | Rappels admin/fiscal |

Toutes les tables ont RLS activé. Politique : `auth.uid() IS NOT NULL`.
Exceptions : `catalog_sends` (accès anon magic link), `artisan_sites` (lecture publique).

## Intégrations externes

### OpenAI
- Génération devis (voix + photos)
- Réponse email IA (avec contexte client : devis, factures, chantiers)
- Génération contenu site web
- Comptabilité automatisée
- 5 agents IA : pannes, DTU, chiffreur, juriste, RGE/CEE
- Usage tracké par plan (limites)

### Stripe
- Plans : Starter, Pro, Business
- Checkout sessions, portail client
- Config prix dans `platform_config`

### DocuSeal
- Signature électronique des devis
- Webhooks de confirmation

### Resend
- Emails transactionnels (envoi devis, factures)

### Pappers
- Recherche entreprises françaises par nom/SIRET

## Thème / Couleurs

- **Couleur accent** : `#D35400` (orange BTP)
- **Base** : neutral (Tailwind)
- **Dark mode** : supporté via `class` strategy
- **Variables CSS** : définies dans `globals.css`, consommées par Tailwind
- **Landing** : palette séparée (`--landing-accent`, `--landing-off`, `--landing-stone`)

## Variables d'environnement

```
# Public
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=               # Défaut: https://hellobat.app

# Secret (server-side)
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=                       # Optionnel, défaut: gpt-4o-mini
STRIPE_SECRET_KEY=
DOCUSEAL_API_KEY=
DOCUSEAL_API_URL=                   # Défaut: https://api.docuseal.eu
PAPPERS_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

## Règles de développement

- **Mobile-first obligatoire** : chaque page et composant doit être parfaitement responsive. Toujours développer d'abord pour mobile, puis adapter pour tablette et desktop.
- Les artisans utilisent principalement l'app sur leur téléphone depuis les chantiers — le rendu mobile est prioritaire.
- Le produit s'appelle **Hellobat** (pas BatiFlow) — utiliser ce nom partout dans l'UI et le code.

## Points d'attention

- Le middleware (`middleware.ts`) gère les routes publiques (`/carte/publique`, `/c/`, `/d/`, `/site/`) — la protection auth est dans le layout app via `useAuth()`
- `next.config.js` : ESLint ignoré au build, images non optimisées, transpile `lucide-react`
- Les composants `ui/` viennent de shadcn/ui — les ajouter via `npx shadcn-ui@latest add <component>`
- Leaflet nécessite `z-index: 10 !important` sur ses panes pour ne pas cacher les modales
- react-leaflet@4 (pas v5) car incompatible avec React 18
- Le `.next` peut se corrompre facilement → `rm -rf .next && npm run dev` en cas de bug visuel
- L'assistant IA devis utilise Web Speech Recognition (Chrome/Edge uniquement) pour la dictée vocale
- Les catalogues utilisent un système de magic link (token) pour le partage public sans auth
- Les dates doivent utiliser l'heure locale (pas `toISOString()` qui convertit en UTC et décale d'un jour en France)
- Admin via `profiles.is_admin` (booléen) + fonction SQL `is_admin()` — remplace l'ancien hardcode `louis@maaza.pro`
- Le dashboard a par défaut le filtre "année" sélectionné
- Le planning inclut le dirigeant (owner) comme membre virtuel (ID `__owner__`, `team_member_id = null` en DB)
