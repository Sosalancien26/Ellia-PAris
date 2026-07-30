-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 juillet 2026
-- Mode cadeau + partage de configuration
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- Sans risque : n'ajoute que des colonnes et une table, ne touche
-- à aucune donnée existante.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) MODE CADEAU
--    Quand is_gift est vrai, le bon de préparation s'imprime sans
--    aucun prix et l'atelier voit le texte à calligraphier.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift      BOOLEAN     DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_from    TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_date    DATE;

COMMENT ON COLUMN orders.is_gift      IS 'Commande cadeau : bon de livraison sans prix, carte manuscrite jointe';
COMMENT ON COLUMN orders.gift_message IS 'Texte à calligraphier sur la carte (300 caractères max)';
COMMENT ON COLUMN orders.gift_from    IS 'Signature de la carte';
COMMENT ON COLUMN orders.gift_date    IS 'Date d''arrivée souhaitée chez le destinataire';

-- Note client sur la facture (distincte des notes internes, qui
-- contiennent la trace comptable des remises et ne doivent jamais
-- être imprimées sur un document envoyé au client).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes_client TEXT;
COMMENT ON COLUMN orders.notes_client IS 'Note visible par le client sur sa facture PDF';

-- Retrouver rapidement les commandes cadeau à préparer
CREATE INDEX IF NOT EXISTS idx_orders_gift ON orders (is_gift) WHERE is_gift = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 2) PARTAGE DE CONFIGURATION
--    Le visiteur compose sa pochette et obtient un lien court.
--    Il peut se l'envoyer pour revenir plus tard, ou l'envoyer à
--    la personne qui l'offrira.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_configs (
  id          TEXT PRIMARY KEY,                      -- code court dans l'URL
  config      JSONB       NOT NULL,                  -- état du configurateur
  preview     TEXT,                                  -- aperçu 3D (data URI)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  views       INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_configs_expires ON shared_configs (expires_at);

-- Le serveur accède à cette table avec la clé service_role, jamais
-- le navigateur : on active RLS sans aucune politique publique.
ALTER TABLE shared_configs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE shared_configs IS 'Configurations de pochette partagées par lien — expirent après 90 jours';

-- ─────────────────────────────────────────────────────────────
-- 3) CONTRÔLE
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('is_gift','gift_message','gift_from','gift_date','notes_client')
ORDER BY column_name;
