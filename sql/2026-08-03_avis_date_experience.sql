-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 3 août 2026
-- Avis clients : date de l'expérience de consommation
--
-- POURQUOI
-- L'article L.111-7-2 du Code de la consommation impose d'afficher,
-- à côté de chaque avis, la date de publication ET la date de
-- l'expérience de consommation. Le site n'affichait que le mois de
-- publication (« mars 2026 »).
--
-- La sanction est une amende administrative pouvant atteindre
-- 75 000 € pour une personne physique et 375 000 € pour une société.
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- Sans risque : n'ajoute qu'une colonne.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS date_experience DATE;

COMMENT ON COLUMN reviews.date_experience IS
  'Date à laquelle la cliente a reçu sa pochette — affichée à côté de l''avis (art. L.111-7-2)';

-- ─────────────────────────────────────────────────────────────
-- CONTRÔLE — doit afficher la colonne et 0 avis en base
-- ─────────────────────────────────────────────────────────────
SELECT 'Colonne créée' AS verification, column_name AS valeur
  FROM information_schema.columns
 WHERE table_name = 'reviews' AND column_name = 'date_experience'
UNION ALL
SELECT 'Avis en base', COUNT(*)::text FROM reviews;
