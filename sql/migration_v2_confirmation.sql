-- =========================================================
-- MaderoShape — migration V2 : réservation et confirmation
-- ---------------------------------------------------------
-- À exécuter APRÈS sql/migration_v2_rgpd.sql :
--   1. Dashboard Supabase → SQL Editor → New query
--   2. Coller ce fichier
--   3. Run
--
-- Ces deux fonctions permettent au site de travailler sans
-- jamais lire la table reservations — la politique de lecture
-- publique ayant été supprimée par la migration précédente.
--   * inserer_reservation   → crée la demande, renvoie son id
--   * confirmer_reservation → change le statut depuis l'e-mail
-- =========================================================


-- ---------------------------------------------------------
-- 1. Création d'une réservation
-- ---------------------------------------------------------
-- Le site a besoin de l'identifiant de la ligne qu'il vient de
-- créer, pour construire les liens « Confirmer » et « Annuler »
-- de l'e-mail. Le demander à l'API avec .insert().select()
-- exigerait une politique SELECT sur la table : la fonction
-- contourne le problème en ne renvoyant que l'UUID, sans jamais
-- exposer les autres colonnes.
--
-- Le statut est forcé à 'en_attente' : il ne peut pas être
-- choisi depuis le navigateur.
create or replace function inserer_reservation(
  p_prestation text,
  p_prix integer,
  p_date_rdv date,
  p_heure text,
  p_duree integer,
  p_nom_cliente text,
  p_telephone text
)
returns uuid
security definer
set search_path = public
as $$
  insert into reservations (
    prestation, prix, date_rdv, heure, duree, nom_cliente, telephone, statut
  )
  values (
    p_prestation, p_prix, p_date_rdv, p_heure, p_duree,
    p_nom_cliente, p_telephone, 'en_attente'
  )
  returning id
$$ language sql;

grant execute on function
  inserer_reservation(text, integer, date, text, integer, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------
-- 2. Confirmation ou annulation depuis l'e-mail
-- ---------------------------------------------------------
-- Appelée par confirmer.html. Renvoie un seul mot, jamais de
-- donnée personnelle :
--   'confirme'        → le rendez-vous vient de passer en confirmee
--   'annule'          → il vient de passer en annule
--   'deja_traite'     → son statut avait déjà changé
--   'introuvable'     → aucun rendez-vous avec cet identifiant
--   'action_invalide' → paramètre action inattendu
create or replace function confirmer_reservation(p_id uuid, p_action text)
returns text
security definer
set search_path = public
as $$
declare
  v_statut text;
begin
  select statut into v_statut from reservations where id = p_id;

  if v_statut is null then
    return 'introuvable';
  end if;

  if p_action = 'confirmer' then
    if v_statut != 'en_attente' then
      return 'deja_traite';
    end if;
    update reservations set statut = 'confirmee' where id = p_id;
    return 'confirme';

  elsif p_action = 'annuler' then
    if v_statut = 'annule' then
      return 'deja_traite';
    end if;
    update reservations set statut = 'annule' where id = p_id;
    return 'annule';

  else
    return 'action_invalide';
  end if;
end;
$$ language plpgsql;

grant execute on function confirmer_reservation(uuid, text) to anon, authenticated;


-- =========================================================
-- VÉRIFIER QUE LA MIGRATION A PRIS
-- ---------------------------------------------------------
--   select confirmer_reservation(
--     '00000000-0000-0000-0000-000000000000'::uuid, 'confirmer');
--     → 'introuvable'
--   C'est le résultat attendu : il prouve que la fonction répond,
--   sans rien modifier.
--
-- ---------------------------------------------------------
-- NOTES
-- ---------------------------------------------------------
-- * Les liens de l'e-mail sont des CLÉS. L'identifiant est un UUID
--   tiré au hasard, donc indevinable, mais quiconque possède le
--   lien peut confirmer ou annuler ce rendez-vous. Ne faites pas
--   suivre ces e-mails.
--
-- * Ces deux fonctions étant "security definer", elles écrivent
--   dans la table sans passer par les politiques RLS. Les
--   politiques publiques INSERT et UPDATE ne servent donc plus à
--   rien pour le fonctionnement du site.
--
--   POUR RÉDUIRE LA SURFACE D'ATTAQUE, vous pouvez les fermer :
--
--     drop policy "Insertion publique des réservations"
--       on reservations;
--     drop policy "Update public du statut après paiement"
--       on reservations;
--
--   Testez ensuite une réservation complète : elle doit continuer
--   de fonctionner, puisqu'elle passe désormais par
--   inserer_reservation.
-- =========================================================
