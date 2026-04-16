#!/usr/bin/env tsx
/*
 * audit-public-routes.ts
 *
 * Vérifie que toute route publique (non authentifiée) utilisant
 * `supabaseAdmin` (service role) passe d'abord par un validateur déclaré
 * dans `@/lib/public-access`.
 *
 * Usage :
 *   npx tsx scripts/audit-public-routes.ts           → warn-only (exit 0)
 *   npx tsx scripts/audit-public-routes.ts --strict  → fail si non conforme (exit 1)
 *
 * Motivation (audit §1.3) : les routes publiques n'ont pas de `auth.uid()`
 * donc RLS ne protège pas. La sécurité repose sur une validation explicite
 * du token/slug. On formalise ce contrat pour éviter qu'une future route
 * publique oublie la validation.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'app');

// Routes publiques : chemins dont on sait qu'ils ne nécessitent PAS de
// Bearer token d'utilisateur connecté.
const PUBLIC_PATH_PATTERNS: RegExp[] = [
  /^app\/api\/hellopay\//,
  /^app\/api\/public\//,
  /^app\/api\/comptabilite\/portal\//,
  /^app\/api\/rendus\/public\//,
  /^app\/api\/site\/(quote-request|check-slug)\//,
  /^app\/api\/contact\//,
  /^app\/pay\//,
  /^app\/c\//,
  /^app\/d\//,
  /^app\/r\//,
  /^app\/comptable\//,
  /^app\/site\//,
  /^app\/carte\/publique\//,
];

interface Finding {
  file: string;
  reason: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function isPublicRoute(relPath: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((r) => r.test(relPath));
}

function usesServiceRole(src: string): boolean {
  if (src.includes("from '@/lib/supabase-admin'")) return true;
  if (src.includes('supabaseAdmin')) return true;
  if (src.includes('SUPABASE_SERVICE_ROLE_KEY')) return true;
  return false;
}

function usesPublicAccessContract(src: string): boolean {
  return src.includes("from '@/lib/public-access'");
}

// Certaines routes sont publiques mais légitimement sans validateur
// dédié — cf. /api/contact qui valide via Turnstile + rate-limit mais
// n'interroge pas une ressource "propriétaire" (pas de token/slug).
// Elles restent marquées comme publiques mais sont exemptes du contrat.
const CONTRACT_EXEMPT: RegExp[] = [
  /^app\/api\/contact\/route\.ts$/,
  /^app\/api\/site\/quote-request\/route\.ts$/,
  /^app\/api\/site\/check-slug\/route\.ts$/,
  /^app\/carte\/publique\//,
];

function isExempt(relPath: string): boolean {
  return CONTRACT_EXEMPT.some((r) => r.test(relPath));
}

function main() {
  const strict = process.argv.includes('--strict');
  const findings: Finding[] = [];
  const conformant: string[] = [];

  for (const file of walk(APP_DIR)) {
    const rel = relative(ROOT, file);
    if (!isPublicRoute(rel)) continue;

    const src = readFileSync(file, 'utf8');
    if (!usesServiceRole(src)) continue;

    if (isExempt(rel)) {
      conformant.push(`${rel}  (exempt — validation autre)`);
      continue;
    }

    if (usesPublicAccessContract(src)) {
      conformant.push(rel);
    } else {
      findings.push({
        file: rel,
        reason: "utilise `supabaseAdmin` sans importer `@/lib/public-access`",
      });
    }
  }

  console.log(`\n── Audit routes publiques ──\n`);
  console.log(`Routes publiques avec service_role : ${conformant.length + findings.length}`);
  console.log(`  ✓ conformes : ${conformant.length}`);
  console.log(`  ✗ non conformes : ${findings.length}\n`);

  if (conformant.length > 0) {
    console.log('Conformes :');
    for (const f of conformant) console.log(`  ✓ ${f}`);
    console.log('');
  }

  if (findings.length > 0) {
    console.log('⚠ Non conformes :');
    for (const f of findings) {
      console.log(`  ✗ ${f.file}`);
      console.log(`    → ${f.reason}`);
    }
    console.log('\nMigration attendue : import { validateXxx } from \'@/lib/public-access\';');
    console.log('Puis appeler le validateur AVANT toute requête DB.\n');
    if (strict) {
      process.exit(1);
    }
  } else {
    console.log('✓ Toutes les routes publiques respectent le contrat.\n');
  }
}

main();
