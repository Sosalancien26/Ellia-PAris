-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 juillet 2026 (3ᵉ migration)
-- Date de livraison réelle
--
-- POURQUOI
-- La demande d'avis partait 10 jours après la COMMANDE, pas après la
-- livraison. Comme une pièce gravée met 5 à 7 jours à être fabriquée,
-- toute commande a déjà plus de 10 jours au moment où elle arrive :
-- l'e-mail « votre pochette est arrivée il y a quelques jours » partait
-- dans l'heure suivant le passage en « Livrée ».
--
-- Cette colonne enregistre la vraie date de livraison. Le délai de
-- 10 jours court désormais à partir d'elle.
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
COMMENT ON COLUMN orders.delivered_at IS 'Date réelle de passage au statut Livrée — point de départ du délai avant demande d''avis';

-- Les commandes DÉJÀ livrées avant cette migration n'ont pas de date.
-- On les considère livrées à leur date de commande : elles ne seront
-- donc pas sollicitées si elles datent de plus de 90 jours, et le seront
-- normalement sinon. Sans cette ligne, aucune commande existante ne
-- recevrait jamais de demande d'avis.
UPDATE orders
   SET delivered_at = created_at
 WHERE delivered_at IS NULL
   AND statut ILIKE 'Livr%';

-- Retrouver rapidement les commandes à solliciter
CREATE INDEX IF NOT EXISTS idx_orders_delivered
    ON orders (delivered_at)
 WHERE delivered_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- CONTRÔLE — doit afficher la colonne et le nombre de commandes
-- livrées qui ont désormais une date.
-- ─────────────────────────────────────────────────────────────
SELECT 'Colonne créée'          AS verification,
       COUNT(*)::text           AS valeur
  FROM information_schema.columns
 WHERE table_name = 'orders' AND column_name = 'delivered_at'
UNION ALL
SELECT 'Commandes livrées datées',
       COUNT(*)::text
  FROM orders
 WHERE delivered_at IS NOT NULL;
