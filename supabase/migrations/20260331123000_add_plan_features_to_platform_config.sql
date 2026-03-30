INSERT INTO platform_config (key, value, label) VALUES
  (
    'features_starter',
    '["5 devis / mois","2 chantiers actifs","Carnet de contacts","Planning de base","Carte interactive","Support par email"]',
    'Fonctionnalites Starter (JSON)'
  ),
  (
    'features_pro',
    '["Devis IA vocal illimites","Chantiers illimites","Planning drag & drop","Gestion equipe & sous-traitants","Catalogues produits","Site web inclus","Prospection CRM","Emails integres","Avis Google","Support prioritaire"]',
    'Fonctionnalites Pro (JSON)'
  ),
  (
    'features_business',
    '["Tout le plan Pro","Agents IA illimites","Paiements Stripe","Contrats de maintenance","Plans & Rendus IA","Comptabilite avancee","Carte publique partageable","API & Webhooks","Support dedie"]',
    'Fonctionnalites Business (JSON)'
  )
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION update_platform_config(config_key text, config_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'louis@maaza.pro' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO platform_config (key, value, updated_at)
  VALUES (config_key, config_value, now())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();
END;
$$;
