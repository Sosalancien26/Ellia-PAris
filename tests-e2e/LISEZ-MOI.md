# Banc d'essai de bout en bout — ELLIA PARIS

Lance le **vrai** `server.js` en local avec une base Supabase simulée en mémoire,
un Stripe simulé (les signatures de webhook sont vérifiées par la vraie
bibliothèque) et une capture de tous les e-mails. **Rien ne touche au site en
ligne, à la base réelle, à Stripe ni à Brevo.**

    npm install          # une fois
    npm run test:e2e     # personnalisation ouverte (PERSO_OUVERTE=1)
    PERSO_OUVERTE=0 node tests-e2e/run.js   # mode « atelier fermé » (celui de la prod)

Durée : ~3 min (attente de la tâche de libération du stock, 2 min après démarrage).

Ce qui est joué : 50 commandes simultanées, sessions Stripe, 40 paiements,
5 expirations, 5 abandons nettoyés par la tâche automatique, rejeux et
signatures forgées, statuts (préparation, expédition + facture PDF,
livraison, annulation), 20 expéditions simultanées (numéros de facture
séquentiels sans trou), comptes comptable/atelier, suivi client, avis
vérifiés, contact, newsletter, panier abandonné, code promo, mot de passe
oublié, limites anti-abus, corps trop gros, injections.

Sorties dans `tests-e2e/out/` (ignoré par git) : `mails.jsonl` (chaque
e-mail), `pdf-*.pdf` (factures), `serveur.log`, `resume.json`.
