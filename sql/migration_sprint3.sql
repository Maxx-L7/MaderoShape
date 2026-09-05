-- =========================================================
-- MaderoShape — migration sprint 3 : paiement de l'acompte
-- ---------------------------------------------------------
-- À exécuter UNE SEULE FOIS, APRÈS sql/schema.sql :
--   1. Dashboard Supabase → SQL Editor → New query
--   2. Coller ce fichier
--   3. Run
-- =========================================================


-- ---------------------------------------------------------
-- 1. Identifiant de la commande PayPal
-- ---------------------------------------------------------
alter table reservations add column paypal_order_id text;


-- ---------------------------------------------------------
-- 2. Autoriser la mise à jour après paiement
-- ---------------------------------------------------------
create policy "Update public du statut après paiement"
  on reservations for update
  using (true)
  with check (true);


-- =========================================================
-- ⚠️ AVERTISSEMENT DE SÉCURITÉ — À LIRE
-- ---------------------------------------------------------
-- La politique ci-dessus autorise N'IMPORTE QUEL visiteur du
-- site à modifier N'IMPORTE QUELLE ligne de la table : passer
-- un rendez-vous en "confirmee" sans avoir payé, ou changer le
-- nom et le téléphone d'une autre cliente.
--
-- C'est la contrepartie d'un paiement capturé côté navigateur,
-- sans serveur : le site n'a aucun moyen de prouver à la base
-- qu'un paiement a réellement eu lieu.
--
-- Au volume d'un cabinet individuel le risque reste théorique
-- (il faut connaître l'URL du projet Supabase et savoir s'en
-- servir), mais il faut le connaître.
--
-- VERSION DURCIE — recommandée dès que possible.
-- Elle interdit de retoucher un rendez-vous déjà confirmé ou
-- annulé : seules les lignes encore "en_attente" sont
-- modifiables. Pour l'utiliser, remplacez la politique
-- ci-dessus par celle-ci :
--
--   drop policy "Update public du statut après paiement"
--     on reservations;
--
--   create policy "Confirmation d'un rendez-vous en attente"
--     on reservations for update
--     using (statut = 'en_attente')
--     with check (statut in ('en_attente', 'confirmee'));
--
-- La suppression définitive du risque passe par une fonction
-- serverless qui vérifie le paiement auprès de PayPal avec une
-- clé secrète, et par le retrait de toute politique UPDATE
-- publique. Cf. la section "Limites du paiement sans serveur"
-- du README.
--
-- ---------------------------------------------------------
-- Valeurs de la colonne "statut" après ce sprint :
--   'en_attente' → créneau réservé, acompte pas encore reçu
--                  (c'est aussi le cas d'un paiement Wero, que
--                   vous confirmez à la main ici)
--   'confirmee'  → acompte de 10 € encaissé via PayPal
--   'annule'     → rendez-vous annulé, le créneau se libère
-- =========================================================
