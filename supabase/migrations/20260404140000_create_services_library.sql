-- Services / Prestations library — reusable line items for quotes
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  description text DEFAULT '',
  unit text DEFAULT 'u',
  unit_price numeric DEFAULT 0,
  category text DEFAULT '',
  tva_rate numeric DEFAULT 20,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own services" ON services
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_services_user_id ON services(user_id);
CREATE INDEX idx_services_category ON services(category);
