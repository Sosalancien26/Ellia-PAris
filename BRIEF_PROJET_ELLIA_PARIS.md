# BRIEF PROJET — Site e-commerce de luxe ELLIA PARIS

> À copier-coller pour lancer le projet. Tout ce qui est entre [crochets] est à compléter ou sera confirmé en cours de route.

---

## 1. Contexte & objectif

Créer un site e-commerce **haut de gamme** (esprit Louis Vuitton / Dior / Hermès) pour la marque **ELLIA PARIS**, qui vend des **pochettes en cuir** personnalisables avec des initiales.

- **Marque** : ELLIA PARIS
- **Identité** : logo picto en spirale + wordmark « ELLIA / PARIS », argent sur noir. Univers monochrome noir & blanc, minimaliste, luxueux, foil argenté.
- **Produit principal** : pochette zippée en cuir grainé noir, zip et fermoir gunmetal, livrée dans un écrin noir mat magnétique avec logo argenté.
- **Première étape demandée** : **maquette cliquable** (design + 3D + parcours complet), branchement réel du paiement/déploiement dans un second temps.

## 2. Tarifs (modifiables)

- Pochette : **159 €**
- Option personnalisation (initiales) : **+59 €**

## 3. Côté CLIENT (vitrine + boutique)

### Direction artistique — ULTRA LUXE (noir & blanc)

**Palette (primaire imposée : noir & blanc)**
- Noir absolu `#000000` et noir profond `#0A0A0A` en fonds dominants.
- Blanc pur `#FFFFFF` et blanc cassé `#F5F4F2` pour les respirations / sections claires.
- Gris froids (`#1A1A1A`, `#6B6B6B`, `#9A9A9A`) pour la hiérarchie.
- **Argent métallique** (dégradé `#C7C7C7 → #8A8A8A → #E8E8E8`) en accent rare et précieux (filets, picto, survols) — jamais d'or sur le site (l'or est réservé aux initiales du produit).
- Règle d'or : très peu de couleur, beaucoup de noir, de blanc et de **vide**. Le luxe = l'espace.

**Typographie**
- Un **serif display haut de gamme** (style Didot / Bodoni : fort contraste, élégant) pour les titres et le nom ELLIA PARIS.
- Un **sans-serif épuré** (style Helvetica Neue / Inter, graisse light, fort interlettrage) pour le texte courant, les menus, les prix.
- Lettrage espacé (letter-spacing généreux) sur les petits labels en MAJUSCULES — signature « couture ».

**Mise en page & sensation**
- Grille éditoriale aérée, marges larges, gros blancs, asymétrie maîtrisée façon magazine de mode.
- Hiérarchie par l'échelle et l'espace, pas par la couleur.
- Sensation haut de gamme, lente, posée, confiante — rien de criard.

**Animations & micro-interactions (raffinées, jamais gadget)**
- Apparitions en fondu/translation lentes au scroll (reveal progressif).
- Parallaxe discrète sur les visuels, transitions de page soyeuses.
- Curseur personnalisé subtil, survols élégants (soulignés fins, légers zooms).
- Hero 3D : rotation douce et continue, éclairage studio, reflets sur le cuir et le métal.

**Traitement photo**
- Photos produit sur fonds neutres, contrastées, ombres profondes, ambiance studio.
- Lookbook mannequins en noir & blanc (ou désaturé), éditorial, élégant, intemporel.

- 100 % responsive — **mobile irréprochable** (le luxe se juge d'abord sur mobile).

### Page d'accueil
- **Hero avec vidéo 3D** du produit (pochette qui tourne / mise en scène animée).
- Sections éditoriales **avec mannequins / mises en situation** (lookbook, ambiance studio luxe).
- Mise en avant du produit, du savoir-faire, de la personnalisation.
- Appels à l'action vers la boutique et le configurateur.

### Page produit + CONFIGURATEUR 3D
- **Vraie 3D temps réel** : la pochette tourne en 360°, zoom, matériaux réalistes (cuir grainé, métal).
- Personnalisation **en direct sur le modèle 3D** :
  - **Initiales** (lettres saisies par le client) — **3 lettres maximum**
  - **Couleur / dorure** des initiales — **Or, Or rose, Argent, Noir, Blanc**
  - **Emplacement** des initiales sur la pochette
- Prix qui se met à jour automatiquement (159 € → 218 € avec personnalisation).
- Note : démarrage avec une **3D stylisée fidèle au produit** ; remplacement par le vrai modèle `.glb` quand disponible.

### Parcours d'achat
- Fiche produit, ajout au panier, panier, tunnel de commande.
- **Paiement Stripe** (cartes + Apple Pay / Google Pay), avec PayPal en complément possible plus tard.
- En maquette : tunnel de paiement **simulé** (Stripe en mode test au déploiement).
- Pages : Accueil, Boutique, Produit/Configurateur, Panier, Checkout, À propos / Savoir-faire, Contact, CGV / mentions légales.

## 4. Côté ADMIN (back-office complet)

Espace privé sécurisé (connexion admin) pour tout gérer :

- **Réception des commandes** passées sur le site, en temps réel.
- **Gestion des commandes** : statuts (nouvelle, en préparation, expédiée, livrée, annulée), détail client, détail personnalisation (initiales/couleur/emplacement), suivi.
- **Gestion du stock** : quantités par produit, alertes stock bas, ajout/édition de produits.
- **Tableau de bord / chiffre d'affaires** : CA total, par période, nombre de commandes, panier moyen, produits les plus vendus, taux de personnalisation.
- **Gestion produits** : créer/modifier/supprimer un produit, prix, photos, options de personnalisation.

## 5. Stack technique

- **Front** : site moderne React + 3D temps réel (Three.js).
- **Base de données / backend** : **Supabase** (produits, stock, commandes, suivi, authentification admin).
- **Paiement** : **Stripe** (test d'abord, réel après création du statut + SIRET/IBAN).
- **Hébergement** : Hostinger (application Node.js / fichiers statiques).
- **Domaine** : OVH (DNS à pointer vers Hostinger au déploiement).

## 6. Éléments fournis / à fournir

Fournis / confirmé :
- Logo ELLIA PARIS (PDF N&B + picto) — convertis en PNG, prêts à l'emploi.
- Photos produit (pochette noire + écrin), plusieurs angles — **à déposer comme fichiers dans le dossier du site** (collées dans le chat = non exploitables).
- Options d'initiales : **3 lettres max**, couleurs **Or, Or rose, Argent, Noir, Blanc**.
- Visuels mannequins/lookbook : **générés par Claude** (crédits Higgsfield rechargés : ~1000 dispo).
- Pas de modèle 3D fourni → démarrage avec **pochette 3D stylisée** fidèle au produit.

À fournir plus tard (non bloquant) :
- Modèle 3D `.glb` (si un jour disponible) pour remplacer la 3D stylisée.
- Codes couleurs exacts de la charte + police(s) officielle(s) si différentes.
- Autres modèles de pochettes éventuels.

## 7. Ce que j'attends de Claude

1. Proposer une **direction artistique** (maquette de la page d'accueil) à valider en premier.
2. Construire la **maquette cliquable complète** : accueil (avec hero vidéo 3D + mannequins), boutique, configurateur 3D, panier, checkout simulé.
3. Construire l'**espace admin** (commandes, stock, CA) connecté à Supabase.
4. Penser à **tout** : SEO de base, pages légales, responsive, performance, accessibilité.
5. Me guider pour le **déploiement** (Hostinger + OVH + Stripe) une fois la maquette validée.
