/*
  # Create lead_sources table

  This table stores user-specific lead origins and partner referrers so the CRM
  and dashboard can measure which acquisition channels perform best.
*/

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  slug text NOT NULL,
  source_type text NOT NULL DEFAULT 'channel' CHECK (source_type IN ('channel', 'partner')),
  contact_name text NOT NULL DEFAULT '',
  reward_note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_sources_user_slug_key UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lead_sources_user_id
  ON public.lead_sources(user_id);

CREATE INDEX IF NOT EXISTS idx_lead_sources_user_active_position
  ON public.lead_sources(user_id, is_active, position);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lead sources"
  ON public.lead_sources FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lead sources"
  ON public.lead_sources FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lead sources"
  ON public.lead_sources FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lead sources"
  ON public.lead_sources FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.lead_sources (user_id, name, slug, source_type, position)
SELECT u.id, source.name, source.slug, source.source_type, source.position
FROM auth.users u
CROSS JOIN (
  VALUES
    ('Travaux.com', 'travaux_com', 'channel', 0),
    ('Site web', 'site_web', 'channel', 1),
    ('Google', 'google', 'channel', 2),
    ('Meta Ads', 'meta_ads', 'channel', 3),
    ('Bouche a oreille', 'bouche_a_oreille', 'channel', 4),
    ('Partenaire', 'partenaire', 'partner', 5),
    ('Autre', 'autre', 'channel', 6)
) AS source(name, slug, source_type, position)
ON CONFLICT (user_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_default_lead_sources_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_sources (user_id, name, slug, source_type, position)
  VALUES
    (p_user_id, 'Travaux.com', 'travaux_com', 'channel', 0),
    (p_user_id, 'Site web', 'site_web', 'channel', 1),
    (p_user_id, 'Google', 'google', 'channel', 2),
    (p_user_id, 'Meta Ads', 'meta_ads', 'channel', 3),
    (p_user_id, 'Bouche a oreille', 'bouche_a_oreille', 'channel', 4),
    (p_user_id, 'Partenaire', 'partenaire', 'partner', 5),
    (p_user_id, 'Autre', 'autre', 'channel', 6)
  ON CONFLICT (user_id, slug) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.business_reminder_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.seed_ai_agents_for_user(NEW.id);
  PERFORM public.seed_default_lead_sources_for_user(NEW.id);
  RETURN NEW;
END;
$$;
