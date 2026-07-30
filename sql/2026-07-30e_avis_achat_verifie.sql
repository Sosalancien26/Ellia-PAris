-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 juillet 2026
-- Avis clients : mention « Achat vérifié » réellement fondée
--
-- POURQUOI
-- Le site affichait « Avis vérifié » sous CHAQUE témoignage, alors
-- qu'aucune vérification n'existait : le formulaire ne demande qu'un
-- prénom, une adresse e-mail et un commentaire. N'importe qui pouvait
-- écrire, et le site certifiait.
--
-- L'article L.111-7-2 du Code de la consommation impose d'indiquer si
-- les avis font l'objet d'un contrôle et, le cas échéant, lequel.
-- Annoncer une vérification qui n'a pas lieu est une pratique
-- commerciale trompeuse, au même titre que publier de faux avis.
--
-- Désormais, à la réception d'un avis, le serveur cherche une commande
-- LIVRÉE portant la même adresse e-mail. Le badge ne s'affiche que si
-- elle existe. Les autres avis restent publiables, simplement sans
-- badge.
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- Sans risque : n'ajoute qu'une colonne.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS achat_verifie BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN reviews.achat_verifie IS
  'Vrai si l''adresse de l''auteur correspondait à une commande livrée au moment du dépôt — conditionne l''affichage du badge « Achat vérifié »';

-- Retrouver rapidement les avis en attente de modération
CREATE INDEX IF NOT EXISTS idx_reviews_moderation
    ON reviews (validated, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- CONTRÔLE — doit afficher la colonne, avec 0 avis en base
-- ─────────────────────────────────────────────────────────────
SELECT 'Colonne créée'  AS verification, column_name AS valeur
  FROM information_schema.columns
 WHERE table_name = 'reviews' AND column_name = 'achat_verifie'
UNION ALL
SELECT 'Avis en base', COUNT(*)::text FROM reviews;
