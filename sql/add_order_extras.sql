-- Migration : ajout colonnes pour stocker tous les details de gravure + tracking email
-- A executer dans Supabase SQL Editor

-- 1. Colonne items_data : JSON contenant le panier complet (incluant flame/extra/extra2/extra3)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS items_data JSONB;

-- 2. Colonne email_sent_at : evite double envoi de mail apres webhook
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- 3. Index pour les requetes filtrant par statut paiement
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- 4. Mise a jour CHECK constraint sur statut (ajout "En attente paiement")
--    Si la contrainte existe deja, on la drop puis on la recree
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_statut_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_statut_check;
  END IF;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_statut_check
  CHECK (statut IN (
    'En attente paiement',
    'Nouvelle',
    'En préparation',
    'Expediee',
    'Livree',
    'Annulee',
    'Remboursee'
  ));

-- Verifier
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('items_data','email_sent_at','statut','preview')
ORDER BY column_name;
