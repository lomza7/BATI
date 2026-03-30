# BatiFlow — CLAUDE.md

## Projet

BatiFlow est un SaaS tout-en-un pour les artisans du bâtiment en France. Interface entièrement en français (fr-FR). Pas d'i18n — application monolingue.

## Stack technique

- **Framework** : Next.js 14 (App Router) + React 18 + TypeScript 5 (strict)
- **UI** : shadcn/ui (50+ composants) + Radix UI + Tailwind CSS 3.3 + Lucide React (icônes)
- **Base de données** : Supabase (PostgreSQL + Row Level Security)
- **Auth** : Supabase Auth (email/password), contexte React via `useAuth()`
- **Formulaires** : React Hook Form + Zod
- **Graphiques** : Recharts
- **Paiements** : Stripe
- **Déploiement** : Netlify (`netlify.toml`)
- **Font** : Inter (Google Fonts)

## Structure du projet

```
app/
├── page.tsx                    # Landing page (publique)
├── layout.tsx                  # Root layout (fonts, providers)
├── globals.css                 # Styles globaux + animations custom
├── (auth)/                     # Routes publiques
│   ├── login/page.tsx
│   └── signup/page.tsx
└── (app)/                      # Routes protégées (avec sidebar)
    ├── layout.tsx              # Layout app (sidebar + main)
    ├── dashboard/              # Tableau de bord
    ├── taches/                 # Gestion des tâches
    ├── devis/                  # Devis
    ├── factures/               # Factures
    ├── chantiers/              # Chantiers
    ├── planning/               # Planning équipe
    ├── carte/                  # Vue carte
    ├── mail/                   # Messagerie
    ├── avis/                   # Avis Google
    ├── site-web/               # Générateur de site IA
    ├── prospection/            # CRM / Leads
    ├── agents/                 # Agents IA
    ├── paiements/              # Paiements Stripe
    ├── contrats/               # Contrats récurrents
    ├── comptabilite/           # Comptabilité / Dépenses
    └── plans-rendus/           # Plans et rendus IA

components/
├── ui/                         # Composants shadcn/ui (NE PAS modifier manuellement)
├── landing/                    # Sections landing page
├── sidebar/                    # Navigation (sidebar.tsx, sidebar-nav.tsx, sidebar-user.tsx)
├── dashboard/                  # Composants dashboard (kpi-card.tsx)
├── onboarding/                 # Flux onboarding 5 étapes
├── shared/                     # Composants réutilisables (page-header, status-badge, empty-state)
├── todos/                      # Composants tâches
└── providers.tsx               # Context providers

lib/
├── supabase.ts                 # Client Supabase
├── auth-context.tsx            # Contexte auth (useAuth hook)
├── utils.ts                    # cn() helper Tailwind
├── constants.ts                # Statuts, formatters (currency EUR, dates fr-FR)
└── todo-constants.ts           # Priorités et catégories tâches

hooks/
└── use-toast.ts                # Hook notifications toast

supabase/migrations/            # Migrations SQL
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
```

### Recherche / Filtres
```tsx
const filtered = items.filter(item =>
  item.field.toLowerCase().includes(search.toLowerCase())
);
```

## Base de données (tables principales)

| Table | Usage |
|-------|-------|
| `profiles` | Profils utilisateurs + onboarding |
| `clients` | Répertoire clients |
| `quotes` / `quote_lines` | Devis (numérotation D-YYYY-XXX) |
| `invoices` / `invoice_lines` | Factures (numérotation F-YYYY-XXX) |
| `projects` / `project_photos` | Chantiers avec géolocalisation |
| `team_members` | Équipe |
| `planning_events` | Événements planning |
| `leads` | Prospects CRM |
| `reviews` | Avis Google |
| `ai_agents` / `ai_conversations` / `ai_messages` | Agents IA |
| `recurring_contracts` | Contrats récurrents |
| `expenses` | Comptabilité |
| `todos` | Tâches |

Toutes les tables ont RLS activé. Politique : `auth.uid() IS NOT NULL`.

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
```

## Règles de développement

- **Mobile-first obligatoire** : chaque page et composant doit être parfaitement responsive. Toujours développer d'abord pour mobile, puis adapter pour tablette et desktop. Tester systématiquement les breakpoints `sm`, `md`, `lg`, `xl`.
- Les artisans utilisent principalement l'app sur leur téléphone depuis les chantiers — le rendu mobile est prioritaire.

## Points d'attention

- Pas de routes API (`app/api/`) — tout passe par le client Supabase côté client
- Le middleware (`middleware.ts`) est minimal — la protection auth est dans le layout app via `useAuth()`
- `next.config.js` : ESLint ignoré au build, images non optimisées (hosting statique)
- Les composants `ui/` viennent de shadcn/ui — les ajouter via `npx shadcn-ui@latest add <component>`
- Les migrations Supabase sont dans `supabase/migrations/`
