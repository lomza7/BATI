import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildPaymentReminderEmail } from '@/lib/email-templates';
import { formatCurrency, formatDate } from '@/lib/constants';

export const runtime = 'nodejs';

interface InvoiceRow {
  id: string;
  user_id: string;
  invoice_number: string;
  title: string;
  total_ttc: number;
  due_date: string;
  clients: { name: string; email: string | null } | null;
}

interface ReminderSettings {
  user_id: string;
  reminders_enabled: boolean;
  r1_enabled: boolean;
  r1_delay_days: number;
  r1_subject: string;
  r1_body: string;
  r2_enabled: boolean;
  r2_delay_days: number;
  r2_subject: string;
  r2_body: string;
  r3_enabled: boolean;
  r3_delay_days: number;
  r3_subject: string;
  r3_body: string;
}

interface ReminderLog {
  invoice_id: string;
  reminder_level: number;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Fetch overdue invoices with reminders enabled
  const invoicesRes = await supabaseAdmin
    .from('invoices')
    .select('id, user_id, invoice_number, title, total_ttc, due_date, clients(name, email)')
    .eq('status', 'envoyee')
    .eq('reminders_enabled', true)
    .not('due_date', 'is', null)
    .lt('due_date', today);

  const invoices = (invoicesRes.data || []) as unknown as InvoiceRow[];

  if (invoicesRes.error || invoices.length === 0) {
    return NextResponse.json({ processed: 0, errors: invoicesRes.error ? [invoicesRes.error.message] : [] });
  }

  // Batch-fetch settings and logs
  const userIdSet = new Set<string>();
  invoices.forEach((i) => userIdSet.add(i.user_id));
  const userIds = Array.from(userIdSet);
  const invoiceIds = invoices.map((i) => i.id);

  const [settingsRes, logsRes] = await Promise.all([
    supabaseAdmin
      .from('payment_reminder_settings')
      .select('*')
      .in('user_id', userIds),
    supabaseAdmin
      .from('invoice_reminder_log')
      .select('invoice_id, reminder_level')
      .in('invoice_id', invoiceIds),
  ]);

  const settingsMap = new Map<string, ReminderSettings>();
  for (const s of (settingsRes.data || []) as unknown as ReminderSettings[]) {
    settingsMap.set(s.user_id, s);
  }
  const sentSet = new Set<string>();
  for (const l of (logsRes.data || []) as unknown as ReminderLog[]) {
    sentSet.add(`${l.invoice_id}:${l.reminder_level}`);
  }

  // Fetch artisan profiles for email content
  const profilesRes = await supabaseAdmin
    .from('profiles')
    .select('id, company_name, full_name')
    .in('id', userIds);
  const profileMap = new Map<string, { company_name: string; full_name: string }>();
  for (const p of (profilesRes.data || []) as { id: string; company_name: string; full_name: string }[]) {
    profileMap.set(p.id, p);
  }

  // Check Stripe connections
  const stripeRes = await supabaseAdmin
    .from('stripe_connections')
    .select('user_id, charges_enabled')
    .in('user_id', userIds);
  const stripeMap = new Map<string, boolean>();
  for (const s of (stripeRes.data || []) as { user_id: string; charges_enabled: boolean }[]) {
    stripeMap.set(s.user_id, s.charges_enabled);
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hellobat <facture@send.hellobat.app>';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 503 });
  }

  const resend = new Resend(resendKey);
  let processed = 0;
  const errors: string[] = [];

  for (const invoice of invoices) {
    try {
      const settings = settingsMap.get(invoice.user_id);
      if (!settings?.reminders_enabled) continue;

      const clientEmail = invoice.clients?.email;
      if (!clientEmail) continue;

      const dueDate = new Date(invoice.due_date);
      const daysPastDue = Math.floor(
        (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const levels = [
        { level: 1 as const, enabled: settings.r1_enabled, delay: settings.r1_delay_days, subject: settings.r1_subject, body: settings.r1_body },
        { level: 2 as const, enabled: settings.r2_enabled, delay: settings.r2_delay_days, subject: settings.r2_subject, body: settings.r2_body },
        { level: 3 as const, enabled: settings.r3_enabled, delay: settings.r3_delay_days, subject: settings.r3_subject, body: settings.r3_body },
      ];

      for (const lvl of levels) {
        if (!lvl.enabled) continue;
        if (daysPastDue < lvl.delay) continue;
        if (sentSet.has(`${invoice.id}:${lvl.level}`)) continue;

        // Get magic link from latest invoice_send
        const { data: sendRow } = await supabaseAdmin
          .from('invoice_sends')
          .select('token')
          .eq('invoice_id', invoice.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!sendRow?.token) break;

        const magicLink = `${siteUrl}/f/${sendRow.token}`;
        const profile = profileMap.get(invoice.user_id);
        const artisanName = profile?.company_name || profile?.full_name || 'Votre artisan';
        const hasOnlinePayment = stripeMap.get(invoice.user_id) === true;

        const vars: Record<string, string> = {
          client: invoice.clients?.name || '',
          numero: invoice.invoice_number,
          montant: formatCurrency(invoice.total_ttc),
          echeance: formatDate(invoice.due_date),
          artisan: artisanName,
        };

        const interpolatedSubject = interpolate(lvl.subject, vars);
        const interpolatedBody = interpolate(lvl.body, vars);

        const html = buildPaymentReminderEmail({
          clientName: invoice.clients?.name || '',
          artisanName,
          invoiceNumber: invoice.invoice_number,
          invoiceTitle: invoice.title,
          totalTtc: formatCurrency(invoice.total_ttc),
          dueDate: formatDate(invoice.due_date),
          magicLink,
          hasOnlinePayment,
          reminderLevel: lvl.level,
          bodyText: interpolatedBody,
        });

        const result = await resend.emails.send({
          from: fromEmail,
          to: clientEmail,
          subject: interpolatedSubject,
          html,
        });

        await supabaseAdmin.from('invoice_reminder_log').insert({
          user_id: invoice.user_id,
          invoice_id: invoice.id,
          reminder_level: lvl.level,
          email_to: clientEmail,
          email_provider_id: result.data?.id || null,
          error: result.error ? result.error.message : null,
        });

        processed++;
        break; // Only one reminder per invoice per run
      }
    } catch (e) {
      errors.push(
        `${invoice.invoice_number}: ${e instanceof Error ? e.message : 'Erreur inconnue'}`,
      );
    }
  }

  return NextResponse.json({ processed, total: invoices.length, errors });
}
