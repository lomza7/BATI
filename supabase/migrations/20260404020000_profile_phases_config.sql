-- Config personnalisable des étapes de chantier par utilisateur
-- Format: [{"key": "devis_signe", "label": "Devis signé", "weight": 5}, ...]
-- NULL = utiliser les étapes par défaut
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS project_phases_config jsonb;
