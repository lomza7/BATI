-- Suivi du statut de délivrabilité email pour les envois devis et factures.
--
-- Cycle de vie :
--   pending   : lien créé, pas encore d'appel Resend (rare)
--   sent      : Resend a accepté l'envoi (réponse 2xx, email_id reçu)
--   delivered : webhook Resend `email.delivered` — le MX destinataire a accepté
--   bounced   : webhook Resend `email.bounced` — rejet définitif (adresse invalide, etc.)
--   complained: webhook Resend `email.complained` — marqué spam par le destinataire
--   failed    : erreur côté Resend (domaine non vérifié, rate limit, etc.)
--   skipped   : pas d'email envoyé (email manquant, config Resend absente)

alter table public.invoice_sends
  add column if not exists email_status text not null default 'pending'
    check (email_status in ('pending','sent','delivered','bounced','complained','failed','skipped')),
  add column if not exists email_error text,
  add column if not exists email_provider_id text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_delivered_at timestamptz,
  add column if not exists email_bounced_at timestamptz;

alter table public.quote_sends
  add column if not exists email_status text not null default 'pending'
    check (email_status in ('pending','sent','delivered','bounced','complained','failed','skipped')),
  add column if not exists email_error text,
  add column if not exists email_provider_id text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_delivered_at timestamptz,
  add column if not exists email_bounced_at timestamptz;

create index if not exists idx_invoice_sends_email_provider_id
  on public.invoice_sends (email_provider_id)
  where email_provider_id is not null;

create index if not exists idx_quote_sends_email_provider_id
  on public.quote_sends (email_provider_id)
  where email_provider_id is not null;
