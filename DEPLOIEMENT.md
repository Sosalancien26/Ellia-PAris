# Guide de déploiement — ELLIA PARIS

Ce guide explique comment mettre le site en ligne : **GitHub → Hostinger (Node.js) → domaine OVH**.
Rien d'irréversible ici n'est fait sans toi. Suis les étapes dans l'ordre.

---

## 0. Avant de commencer — tester en local

Sur ton PC (tu as Node.js installé) :

1. Ouvre **PowerShell** dans le dossier du site (`Site\Ellia PARIS`).
2. Lance :
   ```
   npm start
   ```
3. Ouvre `http://localhost:3000` (boutique) et `http://localhost:3000/admin` (mot de passe : `ellia2026`).

Pour afficher les **vraies données** Supabase et changer le mot de passe admin :
```
$env:SUPABASE_SERVICE_KEY="ta_cle_service_role"
$env:ADMIN_PASSWORD="ton_mot_de_passe"
npm start
```

---

## 1. Déposer le code sur GitHub

1. Crée un nouveau dépôt **privé** sur github.com (ex. `ellia-paris-site`).
2. Dans PowerShell, dans le dossier du site :
   ```
   git init
   git add .
   git commit -m "Site ELLIA PARIS"
   git branch -M main
   git remote add origin https://github.com/TON_COMPTE/ellia-paris-site.git
   git push -u origin main
   ```
   > Important : ne jamais committer de clé secrète. Les clés sont fournies via les **variables d'environnement** (étape 3), pas dans le code.

---

## 2. Configurer Hostinger (application Node.js)

1. Dans hPanel Hostinger → **Site web → Node.js** (offre Business/Cloud).
2. **Create application** :
   - Source : **GitHub** → connecte ton dépôt `ellia-paris-site`, branche `main`.
   - Fichier de démarrage : `server.js`
   - Commande de démarrage : `npm start`
   - Version de Node : 18 ou supérieure.
3. Hostinger installe et démarre l'application.

> Le site n'utilise aucune dépendance npm : `npm start` lance directement `node server.js`.

---

## 3. Variables d'environnement (sur Hostinger)

Dans les réglages de l'application Node, ajoute ces variables :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | `https://wwzaqbpyojpzjacbjyqi.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (clé **service_role** depuis Supabase → Settings → API) |
| `ADMIN_PASSWORD` | (un mot de passe fort pour l'admin) |
| `PORT` | (souvent fourni automatiquement par Hostinger) |

> La clé `service_role` est **secrète** : elle ne va que dans ces variables, jamais dans le code ni dans une page.

Redémarre l'application après avoir enregistré les variables.

---

## 4. Brancher le domaine OVH

Une fois l'app en ligne, Hostinger te donne soit une **adresse IP**, soit des **serveurs DNS**.

- **Méthode simple (recommandée)** : chez OVH → Zone DNS → modifie l'enregistrement **A** (`@`) vers l'**IP** fournie par Hostinger, et l'enregistrement **CNAME** `www` vers ton domaine. (On garde les DNS OVH — ta messagerie n'est pas impactée.)
- **Méthode alternative** : remplacer les **serveurs DNS** OVH par ceux de Hostinger (page « Modifier les serveurs DNS »). À éviter si tu as des e-mails sur le domaine.

La propagation DNS prend de quelques minutes à 24 h.

---

## 5. HTTPS (cadenas)

Dans Hostinger → **SSL** : active le certificat **Let's Encrypt** (gratuit) sur ton domaine. Vérifie que le site répond bien en `https://`.

---

## 6. Sécurité — à faire avant l'ouverture

- [ ] Changer le mot de passe admin (`ADMIN_PASSWORD`) — ne pas laisser `ellia2026`.
- [ ] Vérifier que `/admin` demande bien le mot de passe.
- [ ] Compléter les **mentions légales**, **CGV** et **confidentialité** (champs entre crochets) — idéalement relus par un juriste.

---

## 7. Plus tard — Stripe (paiement réel)

Quand ton compte Stripe sera créé (après obtention du SIRET) :
1. Récupère tes clés Stripe (publique + secrète).
2. On ajoutera la création de session de paiement côté `server.js` (clé secrète en variable d'environnement) et le bouton de paiement au checkout.
3. Test en mode « test » Stripe, puis passage en réel.

---

## Récapitulatif des accès

- **Boutique** : `https://ton-domaine` (ou `/`)
- **Admin** : `https://ton-domaine/admin`
- **Base de données** : Supabase, projet « Ellia Paris » (`wwzaqbpyojpzjacbjyqi`)
- **Hébergement** : Hostinger (Node.js) · **Domaine** : OVH

Dernière mise à jour : 27 mai 2026.
