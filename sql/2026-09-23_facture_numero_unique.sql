-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 23 septembre 2026
-- Numéro de facture unique, garanti par la base
--
-- POURQUOI
-- Un double clic sur « Expédiée », ou deux administrateurs en même temps,
-- pouvaient tirer deux numéros pour une même commande (la cliente recevait
-- deux factures, la séquence avait un trou). Le serveur est corrigé
-- (écriture atomique), et cet index rend le doublon impossible quoi qu'il
-- arrive : art. 242 nonies A annexe II du CGI.
--
-- DÉJÀ APPLIQUÉ le 23/09/2026 via l'outil de migration. Conservé ici pour
-- l'historique et pour toute réinstallation.
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_invoice_number
  ON orders (invoice_number) WHERE invoice_number IS NOT NULL;
