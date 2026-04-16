# Tests E2E Playwright — Hellobat

## Statut

3 flows dorés câblés. Chaque spec `test.skip` automatiquement si les
credentials ne sont pas configurés, donc le job CI ne casse pas tant que
les secrets ne sont pas ajoutés.

| Spec | Flow | Skip si absent |
|------|------|----------------|
| `auth-onboarding.spec.ts` | Login user onboardé + modal onboarding affiché pour user fresh | `TEST_SUPABASE_*` |
| `devis-signature.spec.ts` | Create-submission DocuSeal + page `/d/[token]` rend | `TEST_SUPABASE_*` + `TEST_DOCUSEAL_API_KEY` |
| `invoice-payment.spec.ts` | Webhook Stripe HelloPay → facture à `payee` | `TEST_SUPABASE_*` + `STRIPE_HELLOPAY_WEBHOOK_SECRET` + `STRIPE_SECRET_KEY` |

## Stratégie de câblage

- **Bypass signup UI** : `supabase.auth.admin.createUser({ email_confirm: true })`.
  Le formulaire `/signup` a un captcha Turnstile + une étape de vérif email
  qu'on ne peut pas automatiser sans injecter un test mode côté Cloudflare.
- **Login via UI** : le captcha Turnstile s'auto-bypass quand
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` n'est pas défini côté app (cf.
  `components/shared/turnstile.tsx`). Le CI ne le définit pas → OK.
- **Webhook Stripe** : event construit localement et signé avec
  `Stripe.webhooks.generateTestHeaderString` (pas d'appel API Stripe réel).
- **Webhook DocuSeal** : TODO — le handler re-fetch la submission côté
  DocuSeal pour vérifier `status=completed`, donc simuler le webhook sans
  compléter la signature côté sandbox échoue. Extension possible : appel à
  l'API DocuSeal sandbox pour marquer le submitter comme complété, puis POST
  vers `/api/docuseal/webhook` avec `x-docuseal-secret`.

## Secrets à configurer

GitHub → Settings → Secrets and variables → Actions. **Ne jamais** pointer
vers le projet prod `ijdscgzpswlskwaozbuh` — le helper `getTestSupabaseAdmin`
refuse automatiquement cette ref.

### Requis pour Flow 1 (auth-onboarding)
```
TEST_SUPABASE_URL              https://<branch-ref>.supabase.co
TEST_SUPABASE_ANON_KEY         eyJ...
TEST_SUPABASE_SERVICE_ROLE     eyJ...
```

### Requis additionnellement pour Flow 2 (devis-signature)
```
TEST_DOCUSEAL_API_KEY          clé sandbox DocuSeal (https://api.docuseal.eu)
TEST_DOCUSEAL_WEBHOOK_SECRET   string aléatoire, p.ex. openssl rand -hex 32
```

### Requis additionnellement pour Flow 3 (invoice-payment)
```
TEST_STRIPE_SECRET_KEY                  sk_test_...
TEST_STRIPE_PUBLISHABLE_KEY             pk_test_...
TEST_STRIPE_HELLOPAY_WEBHOOK_SECRET     whsec_... (ou string aléatoire, lu
                                        par stripe.webhooks.constructEvent)
```

### Optionnel
```
TEST_RESEND_API_KEY            re_... (si absent, les emails Resend échouent
                                       silencieusement côté routes API mais
                                       ça ne bloque pas les tests)
```

## Créer une branche Supabase de test

```
Dashboard Supabase → projet prod ijdscgzpswlskwaozbuh
  → Branches → Create branch → nom "test-e2e"
  → copier l'URL + les clés dans les secrets ci-dessus
```

La branche clone le schéma mais pas les données. Les tests nettoient après
eux (`afterEach` implicite via `try/finally`).

## Lancer les tests

### En local
```bash
# Terminal 1
npm run dev

# Terminal 2 — charge tes secrets de test dans l'env local d'abord
TEST_SUPABASE_URL=... TEST_SUPABASE_ANON_KEY=... TEST_SUPABASE_SERVICE_ROLE=... \
  npx playwright test

npx playwright test auth-onboarding     # un seul flow
npx playwright test --ui                # mode interactif
npx playwright show-report              # rapport HTML après échec
```

### En CI
Déclenché sur `push main` + `pull_request`. Les specs skip proprement si les
secrets ne sont pas configurés ; `continue-on-error: true` sur le job e2e
évite de bloquer les merges pendant la phase de bring-up.

Quand tous les secrets sont en place et que tu veux rendre l'E2E bloquant :
retirer `continue-on-error: true` du job `e2e` dans `.github/workflows/ci.yml`.

## Viewport

Par défaut : **mobile (iPhone 13)**, cohérent avec la politique mobile-first
du produit. Un projet `desktop-chromium` secondaire existe. En CI les deux
projets tournent (`workers: 1`), ce qui double le temps de chaque spec. Pour
les flows non responsive-sensitives, possible de filtrer à un seul projet
via `test.use({ ...devices['iPhone 13'] })` + `test.skip` sur l'autre.

## Règles

- **Jamais la prod.** Le helper garde-fou `getTestSupabaseAdmin()` rejette
  toute URL contenant la ref prod.
- **Cleanup après chaque test** : chaque spec supprime les entités créées
  en `finally`. Si un test crash, `deleteTestUser` cascade via FK.
- **Pas de flakiness toléré** : marquer `test.skip` temporairement et
  ouvrir un ticket plutôt que retry à l'infini.
