/**
 * Test d'interface du parcours « émettre un avoir », dans un vrai navigateur.
 *
 * Il exerce ce qu'aucun test de logique ne peut attraper : l'action présente
 * dans le bon menu, le dialog qui s'ouvre et se remplit, le bouton actif, et
 * le document rendu au client.
 *
 * Prérequis : une pile Supabase LOCALE et un serveur de dev pointant dessus,
 * plus un compte de test (email_verified et onboarding_completed à true) avec
 * au moins une facture émise et AUCUN avoir déjà émis dessus — sinon le
 * plafond de créditation désactive le bouton, à juste titre.
 * Ne jamais viser la production.
 *
 *   BASE_URL=http://localhost:3222 \
 *   TEST_EMAIL=artisan@test.local TEST_PASSWORD=Test1234! \
 *   node scripts/ui-avoirs.mjs
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3222';
const EMAIL = process.env.TEST_EMAIL || 'artisan@test.local';
const PASSWORD = process.env.TEST_PASSWORD || 'Test1234!';

if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error('Refus : ce test ne doit jamais viser autre chose qu’un serveur local.');
  process.exit(1);
}
const SHOTS = process.env.SHOTS_DIR || '/tmp';

let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' — ' + detail : ''}`); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  console.log('\n1. Connexion');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500); // le formulaire monte côté client
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // La redirection est faite côté client par le contexte d'auth : on attend que
  // la session soit posée plutôt qu'une navigation précise.
  await page.waitForTimeout(10000); // le contexte d'auth pose la session puis redirige
  ok('connecté (plus sur le formulaire de login)', !/\/login/.test(page.url()), page.url());

  console.log('\n2. Page Factures');
  await page.goto(`${BASE}/factures`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=F-2026-001', { timeout: 45000 });
  ok('la facture F-2026-001 est listée', true);

  console.log('\n3. Ouverture du menu d’actions');
  const row = page.locator('tr', { hasText: 'F-2026-001' }).first();
  await row.locator('button').last().click();
  await page.waitForTimeout(600);
  const menuText = await page.locator('[role="menu"]').innerText().catch(() => '');
  ok('l’action « Créer un avoir » est proposée', /avoir/i.test(menuText), menuText.replace(/\n/g, ' | '));
  await page.screenshot({ path: `${SHOTS}/ui-1-menu.png` });

  console.log('\n4. Dialog d’émission');
  await page.locator('[role="menuitem"]', { hasText: /avoir/i }).first().click();
  const dlg = page.getByRole('dialog', { name: /avoir/i });
  await dlg.waitFor({ timeout: 20000 });
  await page.waitForTimeout(3000); // chargement des lignes + avoirs existants
  const dlgText = await dlg.innerText();
  ok('le dialog annonce un avoir', /avoir/i.test(dlgText));
  ok('le récapitulatif affiche le montant de la facture', /3\s*500|3500/.test(dlgText), dlgText.slice(0, 400).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${SHOTS}/ui-2-dialog.png`, fullPage: true });

  console.log('\n5. Création de l’avoir');
  const submit = dlg.locator('button', { hasText: /^(Créer|Émettre|Valider)/i }).last();
  ok('le bouton de création est actif', await submit.isEnabled());
  await submit.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/ui-3-apres.png`, fullPage: true });

  console.log('\n6. Vérification en base via l’UI');
  await page.goto(`${BASE}/factures`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const body = await page.locator('body').innerText();
  ok('un avoir AV-2026-001 apparaît dans la liste', /AV-2026-001/.test(body), body.match(/AV-\S+/)?.[0] || 'aucun AV- trouvé');
  ok('son montant est négatif', /-\s?3\s*500|−\s?3\s*500|-3500/.test(body), (body.match(/-[\d\s ]+€/g) || []).join(' / '));
  await page.screenshot({ path: `${SHOTS}/ui-4-liste.png`, fullPage: true });

  console.log('\n7. Rendu du document');
  const avoirRow = page.locator('tr', { hasText: 'AV-2026-001' }).first();
  await avoirRow.locator('button').last().click();
  await page.waitForTimeout(700);
  await page.locator('[role="menuitem"]', { hasText: /aper|voir|visualis/i }).first().click();
  await page.waitForTimeout(4000);
  const preview = page.locator('[role="dialog"]').filter({ hasText: /AVOIR|Avoir/ }).last();
  const docText = await preview.innerText();
  ok('le document est titré AVOIR', /\bAVOIR\b/.test(docText), docText.slice(0, 200).replace(/\n/g, ' | '));
  ok('il référence la facture rectifiée', /F-2026-001/.test(docText));
  ok('il porte la mention de régularisation de TVA', /272-1/.test(docText));
  ok('il n’affiche pas d’échéance de paiement', !/Échéance|Date d.échéance/i.test(docText));
  await page.screenshot({ path: `${SHOTS}/ui-5-document.png`, fullPage: true });

  // Deux défauts pré-existants de l'environnement LOCAL, sans rapport avec les avoirs :
  //  - workspace_memberships.permissions existe en prod mais pas dans les migrations
  //  - /api/demo/bootstrap-documents cherche un fichier de démo absent en local
  const known = /favicon|Download the React DevTools|hydrat|workspace_memberships|bootstrap-documents|Failed to load resource|Auth init timeout/i;
  const realErrors = errors.filter((e) => !known.test(e));
  ok('aucune erreur JavaScript propre aux avoirs', realErrors.length === 0, realErrors.slice(0, 3).join(' || '));
} catch (e) {
  fail++;
  console.log('\n  FAIL exception :', e.message);
  await page.screenshot({ path: `${SHOTS}/ui-erreur.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${pass} vérifications passées, ${fail} échouées`);
process.exit(fail === 0 ? 0 : 1);
