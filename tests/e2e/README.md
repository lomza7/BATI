# Tests E2E Playwright — Hellobat

## Statut

3 flows dorés sont scaffoldés, **actuellement skippés** tant que les credentials
de test ne sont pas fournis.

| Spec | Flow | Credentials requis |
|------|------|--------------------|
| `auth-onboarding.spec.ts` | Signup → onboarding → dashboard | Supabase de test |
| `devis-signature.spec.ts` | Devis → envoi → signature DocuSeal | Supabase + DocuSeal sandbox |
| `invoice-payment.spec.ts` | Facture → HelloPay → Stripe test | Supabase + Stripe test mode |

## Lancer les tests

### En local

```bash
# Terminal 1 — dev server
npm run dev

# Terminal 2 — tests
npx playwright test                     # tous
npx playwright test auth-onboarding     # un seul
npx playwright test --ui                # mode interactif (recommandé)
npx playwright show-report              # dernier rapport HTML
```

### En CI

Workflow `.github/workflows/ci.yml` — déclenché sur `push main` + `pull_request`.
Les specs passent en mode "skipped" tant que les secrets GitHub Actions ne sont
pas configurés, pour ne pas bloquer les merges.

## Secrets à configurer (GitHub → Settings → Secrets and variables → Actions)

```
# Supabase branche de test (JAMAIS le projet prod ijdscgzpswlskwaozbuh)
TEST_SUPABASE_URL              https://<branch-ref>.supabase.co
TEST_SUPABASE_ANON_KEY         eyJ...
TEST_SUPABASE_SERVICE_ROLE     eyJ...

# Stripe test mode (dashboard Stripe → Developers → API keys → mode test)
TEST_STRIPE_SECRET_KEY         sk_test_...
TEST_STRIPE_PUBLISHABLE_KEY    pk_test_...

# DocuSeal sandbox
TEST_DOCUSEAL_API_KEY          ds_test_...

# Optionnel : intercepter les emails de vérif (sinon mock côté service_role)
TEST_RESEND_API_KEY            re_...

# URL de l'app pendant les tests (par défaut http://localhost:3000)
PLAYWRIGHT_BASE_URL            http://localhost:3000
```

## Créer la branche Supabase de test

```bash
# Depuis le Supabase Dashboard (projet prod ijdscgzpswlskwaozbuh)
# → Branches → Create branch
# → Nommer "test-e2e" → Next will clone schema (pas les data)
```

Puis seeder un user de test via SQL :
```sql
-- À exécuter sur la branche de test uniquement
insert into auth.users (id, email, email_confirmed_at, encrypted_password, ...)
values ('<uuid>', 'e2e@test.hellobat.app', now(), ...);
```

## Viewport

Par défaut les tests tournent sur **mobile (iPhone 13)**, cohérent avec la
politique mobile-first du produit. Un projet `desktop-chromium` secondaire
existe pour les parcours spécifiques desktop (`playwright test --project=desktop-chromium`).

## Règles

- **Ne jamais** pointer les tests vers le projet prod (`ijdscgzpswlskwaozbuh`).
  Refus automatique si l'URL Supabase contient cette ref (voir helper à câbler).
- **Nettoyer après chaque test** : chaque spec doit supprimer les entités créées
  (via `afterEach` ou hooks globaux), sinon la branche de test se pollue.
- **Pas de flakiness toléré** : si un test devient flaky, marquer `test.skip`
  temporairement et ouvrir un ticket plutôt que retry à l'infini.
