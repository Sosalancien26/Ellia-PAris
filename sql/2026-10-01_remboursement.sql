-- ELLIA PARIS — 01/10/2026 — Remboursement depuis l'administration
-- DÉJÀ APPLIQUÉ via l'outil de migration. Conservé pour l'historique.
alter table public.orders
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists refund_id text,
  add column if not exists refund_amount numeric,
  add column if not exists refunded_at timestamptz;
