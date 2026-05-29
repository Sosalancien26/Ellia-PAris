# Table `reviews` — à créer dans Supabase

## SQL à exécuter dans le SQL Editor de Supabase

```sql
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  prenom        text not null check (char_length(prenom) between 1 and 40),
  email         text not null,
  note          int  not null check (note between 1 and 5),
  titre         text check (char_length(titre) <= 80),
  commentaire   text not null check (char_length(commentaire) between 20 and 1000),
  ref_produit   text default 'ELLIA-NOIR',
  validated     boolean default false,
  created_at    timestamptz default now()
);

create index if not exists idx_reviews_validated on public.reviews (validated, created_at desc);

-- RLS : lecture publique uniquement des avis validés
alter table public.reviews enable row level security;

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select using (validated = true);

-- Pas de policy d'insert : seul le service_role (via server.js) peut écrire.
```

## Variable d'environnement optionnelle

Pour recevoir un email à chaque nouvel avis :

```
CONTACT_TO = ton.email@gmail.com
```

(Sinon, ça utilise `SMTP_USER` par défaut.)

## Validation des avis (modération)

Pour publier un avis soumis, mets `validated = true` dans la table `reviews` depuis Supabase :

1. Va dans **Table editor** → table `reviews`
2. Trouve la ligne `validated: false`
3. Coche la case → l'avis devient public sur le site

Tu peux aussi créer un bouton "Valider" dans `admin.html` plus tard si tu veux le faire depuis le back-office.

## Demo data

Tant que la table n'existe pas, l'API renvoie 4 avis de démonstration (Camille, Élodie, Margaux, Pauline). Une fois la table créée avec des vrais avis validés, ils prendront la place automatiquement.
