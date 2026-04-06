# DevOps Runbook — Hellobat

> Version : Sprint 2 | Updated: 2026-04-06

---

## 1. Infrastructure Overview

| Service | Provider | Usage |
|---|---|---|
| App hosting | Vercel | Serverless, Edge Functions, Preview Deployments |
| Database | Supabase | PostgreSQL managed, auto-backups |
| Repository | GitHub (private) | `lomza7/BATI`, branch `main` protected |
| CI/CD | GitHub Actions → Vercel | Auto-deploy preview on PR, prod on merge main |
| DNS | hellobat.app | Production domain |
| Error tracking | Sentry | Frontend + backend errors |
| Performance | Vercel Analytics | Core Web Vitals |
| Payments | Stripe Connect | Webhooks monitored |
| Uptime | BetterUptime / UptimeRobot | Ping every 5 min |

---

## 2. Environments

| Environment | URL | Trigger |
|---|---|---|
| Production | `hellobat.app` | Merge `main` (Board approval required) |
| Preview | `*.vercel.app` | PR opened/updated on `main` or `develop` |
| Development | `localhost:3000` | Local dev (Max) |

---

## 3. CI/CD Pipeline

### GitHub Actions Workflows

All workflows are located in `.github/workflows/`.

#### `ci.yml` — Continuous Integration
- **Trigger**: PR on `main`/`develop`, push on `develop`
- **Jobs**:
  1. `lint` — ESLint + TypeScript typecheck
  2. `unit-tests` — Vitest with coverage upload
  3. `e2e-tests` — Playwright (continue-on-error while Supabase secrets being configured)
- **Artifacts**: coverage report, playwright report (7 days)

#### `deploy-preview.yml` — Preview Deployment
- **Trigger**: PR on `main`/`develop`
- **Environment**: `preview` (no protection required)
- **Jobs**: Vercel CLI build + deploy → comments preview URL on PR
- **Required secrets**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

#### `deploy-prod.yml` — Production Deployment
- **Trigger**: Merge to `main` (after Board approval)
- **Environment**: `production` (Board review required)
- **Jobs**: Vercel CLI build + deploy → Sentry release sourcemaps
- **Required secrets**: All Vercel secrets + all Sentry secrets

### Required GitHub Secrets

Configure in: **GitHub repo `lomza7/BATI` > Settings > Secrets and variables > Actions**

#### Vercel
| Secret | Source |
|---|---|
| `VERCEL_TOKEN` | Vercel Dashboard > Settings > Tokens > Create |
| `VERCEL_ORG_ID` | Vercel Dashboard > Settings |
| `VERCEL_PROJECT_ID` | Vercel Dashboard > Project > Settings > General |

#### Supabase
| Secret | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |

#### Sentry
| Secret | Source |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry > Project > Settings > Client Keys |
| `SENTRY_AUTH_TOKEN` | Sentry > Settings > Auth Tokens > Create |
| `SENTRY_ORG` | Sentry organisation slug |
| `SENTRY_PROJECT` | Sentry project slug |

### Required GitHub Environments

Configure in: **GitHub repo `lomza7/BATI` > Settings > Environments**

| Environment | Protection |
|---|---|
| `production` | Required reviewers: Board members |
| `preview` | None |

---

## 4. Deploy Production Procedure

1. Verify all CI checks pass on the PR (GitHub Actions green)
2. Thomas (QA) approval required
3. Hector (CTO) approval required
4. Create a "Deploy prod" ticket in Paperclip with:
   - Changelog
   - Included PRs
   - DB migrations (if any)
   - New env vars (if any)
5. Board approves the ticket
6. Merge PR to `main` → Vercel auto-deploys
7. Monitor Sentry and logs for 30 minutes post-deploy
8. Post recap: deploy time, PRs included, Sentry status, Core Web Vitals

---

## 5. Rollback Procedure

1. Go to **Vercel Dashboard > Deployments**
2. Find the last stable deployment
3. Click **Promote to Production**
4. Alert team via Paperclip ticket (incident)
5. Investigate with Max and Thomas

---

## 6. Incident Response

| Severity | Definition | Action |
|---|---|---|
| P1 | Site down / payment failure | Rollback immediately + alert Board + incident ticket |
| P2 | Feature broken | Urgent ticket for Max + alert Hector |
| P3 | Minor bug | Normal ticket for Max |

Post-mortem within 24h: root cause, timeline, corrective actions.

---

## 7. Monitoring & Alerts

### Sentry Alerts (to configure)

Navigate to: **Sentry > Project > Alerts > Create Alert Rule**

| Alert | Condition | Action |
|---|---|---|
| High error rate | Error rate > 1% over 5 min | Notify Romain + Hector |
| Slow API | P95 response time > 3s | Notify Romain |
| New issue type | New error type detected | Notify Romain |
| Build failure | Workflow failed | Notify Romain |

### Sentry Environments

| Sentry Environment | Mapped to |
|---|---|
| `production` | `hellobat.app` |
| `preview` | `*.vercel.app` |

### Vercel Analytics

Monitor **Core Web Vitals** in Vercel dashboard:
- LCP (Largest Contentful Paint) — target < 2.5s
- FID (First Input Delay) — target < 100ms
- CLS (Cumulative Layout Shift) — target < 0.1

### Uptime Monitoring

Configure **BetterUptime** or **UptimeRobot**:
- Ping `hellobat.app` every 5 minutes
- Alert Romain immediately on downtime
- Secondary alert to Hector after 10 min

---

## 8. Backup & Restore

### Supabase Backups

- Automatic daily backups are enabled by default
- Retention: 7 days (free tier) / 30 days (Pro)
- Verify in: **Supabase Dashboard > Project Settings > Backups**

### Restore Procedure

1. Go to **Supabase Dashboard > Project Settings > Backups**
2. Select the backup point-in-time
3. Click **Restore** and confirm
4. Estimated time: ~15 min for small DB
5. Alert team during restore window (maintenance mode)

**Quarterly restore test required** — verify with a shadow project.

---

## 9. Environment Variables Management

### Vercel Environment Variables

Manage in: **Vercel Dashboard > Project > Settings > Environment Variables**

| Variable | Environment |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | Production, Preview |
| `STRIPE_SECRET_KEY` | Production |
| `STRIPE_PUBLISHABLE_KEY` | All |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | All |
| `CLERK_SECRET_KEY` | Production, Preview |
| `ANTHROPIC_API_KEY` | Production |
| `DOCUSEAL_API_KEY` | Production |

**Security rule**: Never log, print, or expose any secret in code, comments, or outputs.

---

## 10. Security Checklist

- [ ] HTTP security headers configured (CSP, HSTS, X-Frame-Options) — `next.config.ts`
- [ ] SSL/TLS valid on `hellobat.app`
- [ ] Dependabot enabled for dependency updates
- [ ] No secrets in code (audit with `git secrets` or `gitleaks`)
- [ ] GitHub repo: branch `main` protected (required reviews + status checks)
- [ ] Sentry: source maps uploaded but not publicly accessible

---

## 11. Paperclip Infrastructure (VPS Hostinger)

The Paperclip orchestration runs on a Hostinger VPS (Ubuntu 24.04, KVM 2).

### Health Checks

```bash
# Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Disk space
df -h

# PostgreSQL health
docker exec paperclip-db pg_isready
```

### Alert Conditions

- Docker container down → restart immediately + alert
- Disk > 80% → cleanup logs, alert Hector
- Agent heartbeat missing > 30 min → investigate + alert Hector
