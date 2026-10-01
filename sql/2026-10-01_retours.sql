-- ELLIA PARIS — suivi des retours avant remboursement (additif, sans perte)
alter table public.orders
  add column if not exists retour_statut      text,          -- null | attendu | recu | annule
  add column if not exists retour_demande_at  timestamptz,
  add column if not exists retour_recu_at     timestamptz,
  add column if not exists retour_etat        text,          -- revendable | non_revendable
  add column if not exists retour_note        text;
create index if not exists orders_retour_statut_idx on public.orders (retour_statut) where retour_statut is not null;
