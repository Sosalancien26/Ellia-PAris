-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 juillet 2026
-- Ajout du statut « Prête à expédier »
--
-- POURQUOI
-- Le passage d'une commande en « Expédiée » déclenche l'émission de la
-- facture : consommation d'un numéro légal séquentiel, génération du PDF
-- et envoi au client d'un e-mail contenant le montant total.
-- Le rôle « atelier » ne doit voir aucune donnée financière : il ne peut
-- donc plus poser ce statut. Il dispose à la place de « Prête à expédier »
-- pour signaler que le marquage est terminé. L'expédition et la facture
-- restent réservées à un compte administrateur.
--
-- AU PASSAGE
-- L'ancienne contrainte listait les statuts SANS accents ('Expediee',
-- 'Livree'…) alors que l'interface d'administration envoie les libellés
-- ACCENTUÉS ('Expédiée', 'Livrée'…). Les deux graphies sont désormais
-- acceptées pour éviter tout rejet silencieux.
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- Sans risque : ne touche à aucune donnée existante.
-- ═══════════════════════════════════════════════════════════════

-- 1) Supprimer l'ancienne contrainte si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_statut_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_statut_check;
  END IF;
END $$;

-- 2) Recréer la contrainte avec le nouveau statut et les deux graphies
ALTER TABLE orders
  ADD CONSTRAINT orders_statut_check
  CHECK (statut IN (
    'En attente paiement',
    'Nouvelle',
    'En préparation',   'En preparation',
    'Prête à expédier', 'Prete a expedier',
    'Expédiée',         'Expediee',
    'Livrée',           'Livree',
    'Annulée',          'Annulee',
    'Remboursée',       'Remboursee'
  ));

-- 3) Contrôle : afficher les statuts réellement présents en base.
--    Si une valeur inattendue apparaît ici, la contrainte ci-dessus
--    l'aurait refusée — prévenez avant de poursuivre.
SELECT statut, COUNT(*) AS nb
FROM orders
GROUP BY statut
ORDER BY nb DESC;
