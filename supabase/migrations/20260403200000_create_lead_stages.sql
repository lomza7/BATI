/*
  # Create lead_stages table

  User-specific pipeline stages for the BTP CRM.
  Slugs stay stable for business logic, but labels and order can be customized.
*/

CREATE TABLE IF NOT EXISTS public.lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  slug text NOT NULL,
  label text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_stages_user_slug_key UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lead_stages_user_id
  ON public.lead_stages(user_id);

CREATE INDEX IF NOT EXISTS idx_lead_stages_user_position
  ON public.lead_stages(user_id, position);

ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lead stages"
  ON public.lead_stages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lead stages"
  ON public.lead_stages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lead stages"
  ON public.lead_stages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lead stages"
  ON public.lead_stages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.lead_stages (user_id, slug, label, color, position, is_terminal)
SELECT u.id, seed.slug, seed.label, seed.color, seed.position, seed.is_terminal
FROM auth.users u
CROSS JOIN (
  VALUES
    ('nouveau', 'Nouveau', 'bg-slate-100 text-slate-700', 0, false),
    ('contacte', 'Contacte', 'bg-blue-50 text-blue-700', 1, false),
    ('devis_envoye', 'Devis envoye', 'bg-amber-50 text-amber-700', 2, false),
    ('negocie', 'En nego', 'bg-orange-50 text-orange-700', 3, false),
    ('gagne', 'Gagne', 'bg-emerald-50 text-emerald-700', 4, true),
    ('perdu', 'Perdu', 'bg-red-50 text-red-700', 5, true)
) AS seed(slug, label, color, position, is_terminal)
ON CONFLICT (user_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_default_lead_stages_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lead_stages (user_id, slug, label, color, position, is_terminal)
  VALUES
    (p_user_id, 'nouveau', 'Nouveau', 'bg-slate-100 text-slate-700', 0, false),
    (p_user_id, 'contacte', 'Contacte', 'bg-blue-50 text-blue-700', 1, false),
    (p_user_id, 'devis_envoye', 'Devis envoye', 'bg-amber-50 text-amber-700', 2, false),
    (p_user_id, 'negocie', 'En nego', 'bg-orange-50 text-orange-700', 3, false),
    (p_user_id, 'gagne', 'Gagne', 'bg-emerald-50 text-emerald-700', 4, true),
    (p_user_id, 'perdu', 'Perdu', 'bg-red-50 text-red-700', 5, true)
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
  PERFORM public.seed_default_lead_stages_for_user(NEW.id);
  RETURN NEW;
END;
$$;
