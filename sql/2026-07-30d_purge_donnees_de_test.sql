-- ═══════════════════════════════════════════════════════════════
-- ELLIA PARIS — 30 juillet 2026
-- Purge des données de test avant l'ouverture réelle
--
-- ⚠ CE SCRIPT EFFACE DÉFINITIVEMENT DES DONNÉES.
--   Lis chaque section avant de l'exécuter. Elles sont séparées
--   volontairement : tu peux n'en lancer qu'une partie.
--
-- À EXÉCUTER dans Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 0) SAUVEGARDE — À LANCER SEUL, EN PREMIER
--
-- Copie le résultat dans un fichier texte sur ton ordinateur.
-- Si tu réalises demain qu'une de ces lignes n'était pas un test,
-- c'est ta seule chance de la retrouver.
-- ─────────────────────────────────────────────────────────────
SELECT json_agg(o) FROM orders o;


-- ─────────────────────────────────────────────────────────────
-- 1) LES 14 COMMANDES DE TEST
--
-- Vérifié le 30/07/2026 : aucune ne provient d'un vrai client.
-- Adresses @example.com, tes propres adresses, et un compte
-- mail-tester utilisé pour contrôler la délivrabilité.
-- ─────────────────────────────────────────────────────────────
DELETE FROM orders;


-- ─────────────────────────────────────────────────────────────
-- 2) COMPTEUR DE FACTURES — INDISPENSABLE
--
-- POURQUOI CETTE LIGNE EXISTE
-- La commande EP-635093 avait consommé le numéro F-EP-2026-0001.
-- Si on efface la commande sans remettre le compteur à zéro, ta
-- toute première vraie facture porterait le numéro 0002 et la
-- 0001 n'existerait nulle part.
--
-- L'article 242 nonies A du CGI impose une numérotation continue,
-- sans rupture. Un trou dès la première facture est exactement ce
-- que cherche un contrôle : il laisse penser qu'une vente a été
-- encaissée puis dissimulée. C'est aussi la première chose qu'un
-- comptable te demandera de justifier.
--
-- setval(..., 1, false) veut dire : « le prochain numéro tiré
-- sera le 1 ». Ta première vraie vente sera donc F-EP-2026-0001.
-- ─────────────────────────────────────────────────────────────
SELECT setval('public.invoice_seq', 1, false);


-- ─────────────────────────────────────────────────────────────
-- 3) TRACES LAISSÉES PAR CES MÊMES TESTS
--
-- Ces lignes ne servent plus à rien une fois les commandes
-- effacées, et elles fausseraient tes futures statistiques.
--
--   abandoned_carts  6 paniers, tous à ton adresse hotmail
--   stock_history    4 mouvements liés aux commandes de test
--   admin_logs       1 action, ton propre essai du journal
--   shared_configs   8 liens de partage créés pendant les tests
-- ─────────────────────────────────────────────────────────────
DELETE FROM abandoned_carts;
DELETE FROM stock_history;
DELETE FROM admin_logs;
DELETE FROM shared_configs;


-- ─────────────────────────────────────────────────────────────
-- 4) ⚠ LES QUATRE AVIS CLIENTS SONT FAUX ET SONT EN LIGNE
--
-- Pauline, Margaux, Élodie et Camille n'existent pas. Leurs
-- adresses sont en @example.com. Ils portent validated = true,
-- donc ils s'affichent en ce moment même sur la page produit.
--
-- CE N'EST PAS UN DÉTAIL TECHNIQUE.
-- Publier de faux avis sur un site marchand est une pratique
-- commerciale trompeuse (art. L.121-2 et L.121-4 du Code de la
-- consommation). La DGCCRF la sanctionne jusqu'à 2 ans de prison
-- et 300 000 € d'amende, montant portable à 10 % du chiffre
-- d'affaires. La directive Omnibus t'oblige en plus à pouvoir
-- prouver que chaque avis affiché émane d'un acheteur réel.
--
-- Le risque n'est pas théorique : un concurrent, un client déçu
-- ou un signalement suffit à déclencher un contrôle, et ces
-- quatre lignes constituent la preuve.
--
-- Décoche cette section uniquement si tu comptes les remplacer
-- immédiatement. Sinon, lance-la maintenant.
-- ─────────────────────────────────────────────────────────────
DELETE FROM reviews;


-- ─────────────────────────────────────────────────────────────
-- 5) CONTRÔLE — doit afficher 0 partout, et prochaine_facture = 1
-- ─────────────────────────────────────────────────────────────
SELECT 'commandes'        AS table_videe, COUNT(*)::text AS reste FROM orders
UNION ALL SELECT 'paniers abandonnés',   COUNT(*)::text FROM abandoned_carts
UNION ALL SELECT 'historique de stock',  COUNT(*)::text FROM stock_history
UNION ALL SELECT 'journal admin',        COUNT(*)::text FROM admin_logs
UNION ALL SELECT 'liens partagés',       COUNT(*)::text FROM shared_configs
UNION ALL SELECT 'avis',                 COUNT(*)::text FROM reviews
UNION ALL SELECT 'prochaine facture',    'F-EP-2026-' || lpad(
           (CASE WHEN is_called THEN last_value + 1 ELSE last_value END)::text, 4, '0')
      FROM public.invoice_seq;


-- ─────────────────────────────────────────────────────────────
-- CE QUE CE SCRIPT NE TOUCHE PAS, VOLONTAIREMENT
--
--   products      tes 2 références et leurs prix
--   admin_users   tes 6 comptes d'administration
--   profiles      les comptes clients
--
-- Le stock de ELLIA-NOIR est actuellement à 42. C'est une valeur
-- de démonstration : mets-y ton stock réel avant l'ouverture,
-- depuis l'administration, sinon le site vendra des pièces que
-- tu n'as pas.
-- ─────────────────────────────────────────────────────────────
