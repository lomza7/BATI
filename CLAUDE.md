# BatiFlow — CLAUDE.md

## Projet

BatiFlow est un SaaS tout-en-un pour les artisans du bâtiment en France. Interface entièrement en français (fr-FR). Pas d'i18n — application monolingue.

## Stack technique

- **Framework** : Next.js 14 (App Router) + React 18 + TypeScript 5 (strict)
- **UI** : shadcn/ui (44 composants) + Radix UI + Tailwind CSS 3.3 + Lucide React (icônes)
- **Base de données** : Supabase (PostgreSQL + Row Level Security)
- **Auth** : Supabase Auth (email/password), contexte React via `useAuth()`
- **Formulaires** : React Hook Form + Zod
- **Graphiques** : Recharts
- **Cartes** : Leaflet 1.9 + react-leaflet 4 (compatible React 18)
- **IA** : Anthropic Claude API (route API server-side) + Web Speech Recognition (voix navigateur)
- **Paiements** : Stripe
- **Déploiement** : Netlify (`netlify.toml`)
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
│   ├── dashboard/              # Tableau de bord
│   ├── taches/                 # Gestion des tâches
│   ├── clients/                # Contacts (clients, prospects, prestataires)
│   ├── devis/                  # Devis (+ assistant IA voix/photo)
│   ├── factures/               # Factures
│   ├── chantiers/              # Chantiers
│   ├── planning/               # Planning équipe (drag & drop, vue semaine/mois)
│   ├── carte/                  # Vue carte interactive Leaflet
│   ├── equipe/                 # Équipe et sous-traitants
│   ├── catalogues/             # Catalogues produits
│   ├── mail/                   # Messagerie
│   ├── avis/                   # Avis Google
│   ├── site-web/               # Générateur de site IA
│   ├── prospection/            # CRM / Leads
│   ├── agents/                 # Agents IA
│   ├── paiements/              # Paiements Stripe
│   ├── contrats/               # Contrats récurrents
│   ├── comptabilite/           # Comptabilité / Dépenses
│   └── plans-rendus/           # Plans et rendus IA
├── api/
│   └── ai/quote/route.ts      # API route IA — génération devis (Claude API)
├── c/[token]/                  # Vue catalogue publique (magic link)
└── carte/publique/             # Carte publique (pas d'auth)

components/
├── ui/                         # 44 composants shadcn/ui (NE PAS modifier manuellement)
├── landing/                    # Sections landing page (hero, features, pricing, faq, etc.)
├── sidebar/                    # Navigation (sidebar.tsx, sidebar-nav.tsx, sidebar-user.tsx)
├── dashboard/                  # Composants dashboard (kpi-card.tsx)
├── onboarding/                 # Flux onboarding 5 étapes
├── shared/                     # Composants réutilisables :
│   ├── page-header.tsx         #   En-tête de page
│   ├── status-badge.tsx        #   Badge de statut
│   ├── empty-state.tsx         #   État vide
│   ├── address-autocomplete.tsx#   Autocomplétion adresse (api-adresse.data.gouv.fr)
│   ├── client-picker.tsx       #   Sélecteur/créateur de client
│   ├── map-view.tsx            #   Carte Leaflet
│   └── member-avatar.tsx       #   Avatar membre (image ou initiales)
├── catalogs/                   # Composants catalogues (builder, collections, produits, envoi)
├── devis/                      # Assistant IA devis (quote-ai-assistant.tsx)
├── todos/                      # Composants tâches
└── providers.tsx               # Context providers

lib/
├── supabase.ts                 # Client Supabase
├── auth-context.tsx            # Contexte auth (useAuth hook) — gestion session robuste
├── utils.ts                    # cn() helper Tailwind
├── constants.ts                # Statuts, types contacts, formatters (currency EUR, dates fr-FR)
├── todo-constants.ts           # Priorités et catégories tâches
└── ai/
    └── quote-schema.ts         # Schéma Zod pour validation réponse IA devis

hooks/
└── use-toast.ts                # Hook notifications toast

supabase/migrations/            # 8 fichiers de migration SQL
```

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

### Recherche / Filtres
```tsx
const filtered = items.filter(item =>
  item.field.toLowerCase().includes(search.toLowerCase())
);
```

### Route API (server-side)
```tsx
// app/api/ai/quote/route.ts — seule route API du projet
// POST avec FormData (transcript + photos)
// Appelle l'API Anthropic Claude côté serveur
// Valide la réponse avec Zod avant de retourner
export async function POST(request: Request) { ... }
```

## Base de données (tables principales)

| Table | Usage |
|-------|-------|
| `profiles` | Profils utilisateurs + onboarding |
| `clients` | Contacts (clients, prospects, prestataires) — colonne `contact_type` |
| `quotes` / `quote_lines` | Devis (numérotation D-YYYY-XXX) |
| `invoices` / `invoice_lines` | Factures (numérotation F-YYYY-XXX) |
| `projects` / `project_photos` | Chantiers avec géolocalisation + flag `is_public` |
| `team_members` | Équipe (salariés, sous-traitants, intérimaires) |
| `team_notes` | Notes sur les membres d'équipe |
| `team_assignments` | Suivi heures par projet |
| `planning_events` | Événements planning (chantier, congé, réunion, autre) |
| `leads` | Prospects CRM |
| `reviews` | Avis Google |
| `catalogs` / `catalog_collections` / `catalog_products` | Système catalogues |
| `catalog_sends` / `catalog_client_selections` | Envoi catalogues (magic link) |
| `ai_agents` / `ai_conversations` / `ai_messages` | Agents IA |
| `recurring_contracts` | Contrats récurrents |
| `expenses` / `expense_lines` | Comptabilité |
| `todos` | Tâches |
| `materials_inventory` / `equipment` | Inventaire matériaux et équipements |

Toutes les tables ont RLS activé. Politique : `auth.uid() IS NOT NULL`.
Exception : `catalog_sends` a une politique anon pour accès via magic link.

## Thème / Couleurs

- **Couleur accent** : `#D35400` (orange BTP)
- **Base** : neutral (Tailwind)
- **Dark mode** : supporté via `class` strategy
- **Variables CSS** : définies dans `globals.css`, consommées par Tailwind
- **Landing** : palette séparée (`--landing-accent`, `--landing-off`, `--landing-stone`)

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=              # Clé API Anthropic (server-side, pour route /api/ai/quote)
ANTHROPIC_MODEL=                # Optionnel, défaut: claude-sonnet-4-20250514
```

## Règles de développement

- **Mobile-first obligatoire** : chaque page et composant doit être parfaitement responsive. Toujours développer d'abord pour mobile, puis adapter pour tablette et desktop. Tester systématiquement les breakpoints `sm`, `md`, `lg`, `xl`.
- Les artisans utilisent principalement l'app sur leur téléphone depuis les chantiers — le rendu mobile est prioritaire.

## Points d'attention

- Une seule route API existe : `app/api/ai/quote/route.ts` — tout le reste passe par le client Supabase côté client
- Le middleware (`middleware.ts`) gère les routes publiques (`/carte/publique`, `/c/`) — la protection auth est dans le layout app via `useAuth()`
- `next.config.js` : ESLint ignoré au build, images non optimisées (hosting statique), transpile `lucide-react`
- Les composants `ui/` viennent de shadcn/ui — les ajouter via `npx shadcn-ui@latest add <component>`
- Les migrations Supabase sont dans `supabase/migrations/` (8 fichiers)
- Leaflet nécessite `z-index: 10 !important` sur ses panes pour ne pas cacher les modales
- react-leaflet@4 (pas v5) car incompatible avec React 18
- Le `.next` peut se corrompre facilement → `rm -rf .next && npm run dev` en cas de bug visuel
- L'assistant IA devis utilise Web Speech Recognition (Chrome/Edge uniquement) pour la dictée vocale
- Les catalogues utilisent un système de magic link (token) pour le partage public sans auth
