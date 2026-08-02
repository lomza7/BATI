-- Garde-fou : une transaction laissée ouverte (client déconnecté, requête
-- abandonnée) garde ses verrous et sature le pool de connexions (incident du
-- 2026-08-03 : sessions "idle in transaction" + instance sous-dimensionnée →
-- plan de données KO, pages qui ne chargeaient plus). Postgres tue désormais
-- automatiquement ces transactions après 2 minutes. Appliqué en prod le
-- 2026-08-03 (post-restart + upgrade compute).
alter database postgres set idle_in_transaction_session_timeout = '2min';
