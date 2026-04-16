-- Admin bypass paywall : les comptes `is_admin = true` ont un accès Pro
-- illimité et ne consomment pas de crédits IA. Résout le cas où un admin
-- voyait "Abonnement Pro requis" sur /site-web et consorts.
--
-- Modifie deux fonctions :
--   - has_pro_access : renvoie true si is_admin, sinon check plan+subscription
--   - consume_ai : early-return pour admin (log usage_counters mais pas de
--     décompte de crédits ni de credit_transactions)

create or replace function public.has_pro_access(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from profiles p
    where p.id = p_user_id
      and (
        p.is_admin = true
        or (
          p.plan = 'pro'
          and (
            p.subscription_status = 'active'
            or (p.subscription_status = 'trialing' and p.trial_end_at > now())
          )
        )
      )
  );
$$;

create or replace function public.consume_ai(p_user_id uuid, p_feature text, p_credit_cost integer, p_free_quota integer default 0)
returns jsonb
language plpgsql
as $$
DECLARE
  v_is_admin boolean;
  v_is_pro boolean;
  v_period text := to_char(now(), 'YYYY-MM');
  v_free_used int;
  v_allocation int;
  v_monthly_used int;
  v_monthly_remaining int;
  v_purchased int;
  v_total_remaining int;
  v_consume_monthly int;
  v_consume_purchased int;
BEGIN
  SELECT COALESCE(is_admin, false) INTO v_is_admin FROM profiles WHERE id = p_user_id;
  IF v_is_admin THEN
    INSERT INTO usage_counters (user_id, period, feature, count)
    VALUES (p_user_id, v_period, p_feature, 1)
    ON CONFLICT (user_id, period, feature)
    DO UPDATE SET count = usage_counters.count + 1, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'source', 'admin');
  END IF;

  v_is_pro := has_pro_access(p_user_id);

  IF NOT v_is_pro THEN
    IF p_free_quota <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_pro_access');
    END IF;
    SELECT COALESCE(count, 0) INTO v_free_used
      FROM usage_counters
      WHERE user_id = p_user_id AND period = v_period AND feature = p_feature;
    IF v_free_used >= p_free_quota THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'free_quota_reached',
        'limit', p_free_quota, 'used', v_free_used);
    END IF;
    INSERT INTO usage_counters (user_id, period, feature, count)
    VALUES (p_user_id, v_period, p_feature, 1)
    ON CONFLICT (user_id, period, feature)
    DO UPDATE SET count = usage_counters.count + 1, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'source', 'free_quota');
  END IF;

  PERFORM refresh_credits_period(p_user_id);

  SELECT monthly_credits_allocation, monthly_credits_used, COALESCE(ai_credits_balance, 0)
    INTO v_allocation, v_monthly_used, v_purchased
    FROM profiles WHERE id = p_user_id FOR UPDATE;

  v_monthly_remaining := GREATEST(v_allocation - v_monthly_used, 0);
  v_total_remaining := v_monthly_remaining + v_purchased;

  IF v_total_remaining < p_credit_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'insufficient_credits',
      'balance', v_total_remaining,
      'monthly_remaining', v_monthly_remaining,
      'purchased', v_purchased,
      'required', p_credit_cost
    );
  END IF;

  v_consume_monthly := LEAST(v_monthly_remaining, p_credit_cost);
  v_consume_purchased := p_credit_cost - v_consume_monthly;

  UPDATE profiles
  SET monthly_credits_used = monthly_credits_used + v_consume_monthly,
      ai_credits_balance = ai_credits_balance - v_consume_purchased
  WHERE id = p_user_id;

  INSERT INTO credit_transactions (user_id, delta, kind, feature, metadata)
    VALUES (p_user_id, -p_credit_cost, 'usage', p_feature,
            jsonb_build_object('monthly', v_consume_monthly, 'purchased', v_consume_purchased));

  INSERT INTO usage_counters (user_id, period, feature, count)
  VALUES (p_user_id, v_period, p_feature, 1)
  ON CONFLICT (user_id, period, feature)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now();

  RETURN jsonb_build_object(
    'ok', true, 'source', 'credits',
    'consumed', p_credit_cost,
    'monthly_consumed', v_consume_monthly,
    'purchased_consumed', v_consume_purchased,
    'monthly_remaining', v_monthly_remaining - v_consume_monthly,
    'purchased', v_purchased - v_consume_purchased
  );
END;
$$;
