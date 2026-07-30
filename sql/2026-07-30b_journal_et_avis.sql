-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 juillet 2026 (2ᵉ migration du jour)
-- Journal des actions admin + demande d'avis automatique
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- Sans risque : n'ajoute qu'une table et une colonne.
-- Ne remplace PAS la migration précédente, qui est déjà passée.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) JOURNAL DES ACTIONS ADMIN
--    Six personnes utilisent l'interface (Sacha, Elie, Kevin,
--    Ylan, le comptable, l'atelier). Sans trace horodatée, rien
--    n'indique qui a modifié un montant, changé un statut ou
--    ajusté le stock.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auteur     TEXT NOT NULL,          -- identifiant du compte
  role       TEXT,                   -- admin / comptable / atelier
  action     TEXT NOT NULL,          -- commande.modifiee, stock.ajuste, compte.cree…
  cible      TEXT,                   -- n° de commande, référence produit, login
  details    TEXT                    -- champs modifiés, au format JSON
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_cible ON admin_logs (cible, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_date  ON admin_logs (created_at DESC);

-- Accès serveur uniquement (clé service_role), jamais depuis le navigateur.
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_logs IS 'Journal horodaté des actions effectuées dans l''administration';

-- ─────────────────────────────────────────────────────────────
-- 2) DEMANDE D'AVIS APRÈS LIVRAISON
--    Dix jours après le passage en « Livrée », la cliente reçoit
--    une invitation à donner son avis. Cette colonne garantit
--    qu'elle n'est sollicitée qu'une seule fois.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_asked_at TIMESTAMPTZ;
COMMENT ON COLUMN orders.review_asked_at IS 'Date d''envoi de la demande d''avis — évite toute relance';

-- ─────────────────────────────────────────────────────────────
-- 3) CONTRÔLE
--    Doit renvoyer 3 lignes : la colonne review_asked_at et les
--    deux tables shared_configs et admin_logs.
-- ─────────────────────────────────────────────────────────────
SELECT 'Colonne ajoutée' AS verification, column_name AS element
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'review_asked_at'
UNION ALL
SELECT 'Table présente', table_name
FROM information_schema.tables
WHERE table_name IN ('shared_configs','admin_logs')
ORDER BY 1, 2;
