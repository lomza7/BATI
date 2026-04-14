import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = 'airclimat77@icloud.com';

async function main() {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: users, error: usersError } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const user = users.users.find((u) => u.email === EMAIL);
  if (!user) throw new Error(`User ${EMAIL} not found`);
  console.log(`User: ${user.id}`);

  const { data: invoices, error: listError } = await sb
    .from('invoices')
    .select('id, invoice_number, title, total_ttc, status')
    .eq('payment_method', 'hellopay')
    .eq('user_id', user.id);
  if (listError) throw listError;

  console.log(`\n${invoices?.length ?? 0} factures HelloPay trouvées :`);
  invoices?.forEach((i) => console.log(`  ${i.invoice_number} — ${i.title} — ${i.total_ttc}€ — ${i.status}`));
  if (!invoices?.length) return;

  const ids = invoices.map((i) => i.id);

  const { error: linesError } = await sb.from('invoice_lines').delete().in('invoice_id', ids);
  if (linesError) throw linesError;
  console.log('\nLignes supprimées.');

  const { error: invError } = await sb.from('invoices').delete().in('id', ids);
  if (invError) throw invError;
  console.log(`${ids.length} factures supprimées.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
