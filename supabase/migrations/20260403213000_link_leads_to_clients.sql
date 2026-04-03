/*
  # Link CRM leads to clients

  This migration:
  - adds the missing `client_id` column on leads
  - links historical leads to existing matching clients
  - creates missing clients from older leads
  - updates remaining leads to point to their backfilled client
*/

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id);

WITH lead_candidates AS (
  SELECT
    l.id AS lead_id,
    l.user_id,
    COALESCE(NULLIF(trim(l.company_name), ''), NULLIF(trim(l.name), '')) AS client_name,
    NULLIF(trim(l.email), '') AS email,
    NULLIF(trim(l.phone), '') AS phone,
    NULLIF(trim(l.project_address), '') AS address,
    NULLIF(trim(l.project_city), '') AS city,
    NULLIF(trim(l.project_postal_code), '') AS postal_code,
    NULLIF(trim(l.notes), '') AS notes,
    l.created_at
  FROM public.leads l
  WHERE l.user_id IS NOT NULL
    AND l.client_id IS NULL
    AND COALESCE(NULLIF(trim(l.company_name), ''), NULLIF(trim(l.name), '')) IS NOT NULL
),
matched_existing AS (
  UPDATE public.leads l
  SET client_id = c.id,
      updated_at = now()
  FROM lead_candidates lc
  JOIN public.clients c
    ON c.user_id = lc.user_id
   AND lower(trim(c.name)) = lower(trim(lc.client_name))
  WHERE l.id = lc.lead_id
    AND l.client_id IS NULL
  RETURNING l.id
),
missing_clients AS (
  SELECT DISTINCT ON (
    lc.user_id,
    lower(trim(lc.client_name))
  )
    lc.user_id,
    lc.client_name,
    COALESCE(lc.email, '') AS email,
    COALESCE(lc.phone, '') AS phone,
    COALESCE(lc.address, '') AS address,
    COALESCE(lc.city, '') AS city,
    COALESCE(lc.postal_code, '') AS postal_code,
    COALESCE(lc.notes, '') AS notes
  FROM lead_candidates lc
  LEFT JOIN public.clients c
    ON c.user_id = lc.user_id
   AND lower(trim(c.name)) = lower(trim(lc.client_name))
  WHERE c.id IS NULL
  ORDER BY
    lc.user_id,
    lower(trim(lc.client_name)),
    lc.created_at ASC
),
inserted_clients AS (
  INSERT INTO public.clients (
    user_id,
    name,
    contact_type,
    email,
    phone,
    address,
    city,
    postal_code,
    notes
  )
  SELECT
    user_id,
    client_name,
    'client',
    email,
    phone,
    address,
    city,
    postal_code,
    notes
  FROM missing_clients
  RETURNING id, user_id, name
)
UPDATE public.leads l
SET client_id = c.id,
    updated_at = now()
FROM public.clients c
WHERE l.user_id = c.user_id
  AND l.client_id IS NULL
  AND lower(trim(COALESCE(NULLIF(l.company_name, ''), NULLIF(l.name, '')))) = lower(trim(c.name));
