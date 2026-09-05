-- =========================================================
-- MaderoShape — schéma de la base de réservations
-- ---------------------------------------------------------
-- À exécuter UNE SEULE FOIS dans le dashboard Supabase :
--   1. Ouvrir le projet sur https://supabase.com/dashboard
--   2. Menu de gauche → SQL Editor → New query
--   3. Coller l'intégralité de ce fichier
--   4. Cliquer sur "Run"
--
-- Ensuite : Project Settings → API, copier "Project URL" et
-- la clé "anon public" dans js/config.js.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Table des réservations
-- ---------------------------------------------------------
create table reservations (
  id uuid default gen_random_uuid() primary key,
  prestation text not null,
  prix integer not null,
  date_rdv date not null,
  heure text not null,
  duree integer not null,
  nom_cliente text not null,
  telephone text not null,
  statut text default 'en_attente',
  created_at timestamptz default now()
);


-- ---------------------------------------------------------
-- 2. Sécurité au niveau des lignes (RLS)
-- ---------------------------------------------------------
alter table reservations enable row level security;

-- Politique : lecture publique (pour vérifier les créneaux pris)
create policy "Lecture publique des réservations"
  on reservations for select
  using (true);

-- Politique : insertion publique (pas d'auth requise)
create policy "Insertion publique des réservations"
  on reservations for insert
  with check (true);


-- ---------------------------------------------------------
-- 3. Index de performance
-- ---------------------------------------------------------
-- Le site interroge les réservations d'une journée précise à
-- chaque fois qu'une cliente clique sur un jour du calendrier.
-- Cet index rend cette requête immédiate même avec plusieurs
-- milliers de rendez-vous enregistrés.
create index reservations_date_rdv_idx
  on reservations (date_rdv);


-- =========================================================
-- NOTES IMPORTANTES
-- ---------------------------------------------------------
-- * Aucune politique UPDATE ni DELETE n'est créée : personne
--   ne peut modifier ou supprimer une réservation depuis le
--   site public. Ces opérations se font depuis le dashboard
--   Supabase (Table Editor), où vous êtes authentifié.
--
-- * La politique de lecture est publique. N'ajoutez donc PAS
--   de donnée sensible (e-mail, adresse, notes médicales)
--   dans cette table tant que la lecture n'est pas restreinte.
--   Le nom et le téléphone y sont déjà : c'est le minimum
--   nécessaire au fonctionnement, mais gardez-le en tête si
--   vous ajoutez des colonnes plus tard.
--
-- * Valeurs prévues pour la colonne "statut" :
--     'en_attente' → créneau réservé, acompte pas encore payé
--     'confirmee'  → acompte de 10 € encaissé (sprint 3)
--     'annule'     → rendez-vous annulé, le créneau se libère
--   Le site masque un créneau pour tout statut SAUF 'annule'.
-- =========================================================
