-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 septembre 2026 — Durcissement avant mise en production
-- DÉJÀ APPLIQUÉ le 30/09/2026 via l'outil de migration.
--
-- Constats de l'audit (base réelle) :
--  · decrement_stock(text,int) et next_invoice_number() étaient exécutables
--    avec la clé publique : n'importe qui pouvait vider le stock ou brûler
--    des numéros de facture (trous dans la séquence, art. 242 nonies A CGI).
--  · La politique orders_public_insert (with check true) permettait d'insérer
--    des commandes directement en base, sans passer par le serveur.
--  · reviews était lisible avec la clé publique : l'e-mail des auteurs fuyait.
-- Le serveur Node utilise la clé service_role : rien ne change pour lui.
-- ═══════════════════════════════════════════════════════════════
revoke execute on function public.decrement_stock(text, integer) from public, anon, authenticated;
revoke execute on function public.next_invoice_number() from public, anon, authenticated;
revoke execute on function public.auto_confirm_email() from public, anon, authenticated;
alter function public.next_invoice_number() set search_path = public;
alter function public.auto_confirm_email() set search_path = public;
drop policy if exists orders_public_insert on public.orders;
revoke insert, update, delete, truncate, references, trigger on public.orders from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
revoke all on public.admin_users, public.admin_logs, public.shared_configs, public.admin_settings,
  public.stock_history, public.abandoned_carts, public.promo_codes from anon, authenticated;
-- RLS : (select auth.uid()) évalué une fois par requête
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists wishlists_select_own on public.wishlists;
create policy wishlists_select_own on public.wishlists for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists wishlists_insert_own on public.wishlists;
create policy wishlists_insert_own on public.wishlists for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists wishlists_delete_own on public.wishlists;
create policy wishlists_delete_own on public.wishlists for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists idx_orders_user_id on public.orders (user_id) where user_id is not null;
alter table public.orders drop constraint if exists orders_numero_unique;
drop index if exists public.idx_reviews_validated;
