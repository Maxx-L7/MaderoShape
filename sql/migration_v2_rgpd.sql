-- =========================================================
-- MaderoShape — migration RGPD + expiration des créneaux
-- ---------------------------------------------------------
-- À exécuter APRÈS sql/schema.sql et sql/migration_sprint3.sql :
--   1. Dashboard Supabase → SQL Editor → New query
--   2. Coller ce fichier
--   3. Run
--
-- Ce que cette migration change :
--   * le site ne peut plus lire la table reservations ;
--   * il interroge une fonction qui ne renvoie que des horaires,
--     sans aucune donnée personnelle ;
--   * une demande jamais payée libère son créneau au bout de 24 h.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Fonction de consultation des créneaux occupés
-- ---------------------------------------------------------
-- security definer : la fonction s'exécute avec les droits de
-- son propriétaire, ce qui lui permet de lire la table même
-- après la suppression de la politique de lecture publique.
--
-- set search_path : sans cette ligne, un objet malveillant placé
-- dans un autre schéma pourrait détourner l'exécution. C'est la
-- précaution standard pour toute fonction "security definer"
-- (le linter Supabase la signale sinon).
create or replace function creneaux_occupes(jour date)
returns table (heure text, duree integer)
security definer
set search_path = public
as $$
  select heure, duree
  from reservations
  where date_rdv = jour
    and statut != 'annule'
    and not (statut = 'en_attente' and created_at < now() - interval '24 hours')
$$ language sql;

-- Autorise le site (clé anon) à appeler la fonction.
grant execute on function creneaux_occupes(date) to anon, authenticated;


-- ---------------------------------------------------------
-- 2. Fermeture de la lecture publique
-- ---------------------------------------------------------
-- Jusqu'ici, n'importe quel visiteur pouvait lire toute la table
-- — noms et téléphones compris — avec la clé anon présente dans
-- js/config.js. C'est cette faille que la ligne ci-dessous ferme.
drop policy "Lecture publique des réservations" on reservations;


-- =========================================================
-- CE QUI RESTE OUVERT — ET POURQUOI
-- ---------------------------------------------------------
-- * INSERT public : conservé. Les clientes doivent pouvoir
--   créer leur réservation sans compte.
--
-- * UPDATE public : conservé à la demande, en prévision d'un
--   éventuel retour du paiement PayPal automatique.
--
--   ⚠️ Attention : le dashboard Supabase n'a PAS besoin de cette
--   politique. Quand vous modifiez une ligne depuis le Table
--   Editor, vous êtes authentifié et les politiques RLS ne vous
--   sont pas appliquées. La confirmation manuelle des rendez-vous
--   fonctionnera donc tout aussi bien sans elle.
--
--   Aujourd'hui, aucune page du site n'écrit directement dans la
--   table : confirmer.html passe par confirmer_reservation (cf.
--   sql/migration_v2_confirmation.sql), qui n'a pas besoin de cette
--   politique. Elle n'est donc utilisée par personne, mais elle
--   permet toujours à un tiers de modifier vos réservations à
--   l'aveugle (par exemple tout basculer en 'annule'), même sans
--   pouvoir les lire.
--
--   POUR LA FERMER, exécuter :
--
--     drop policy "Update public du statut après paiement"
--       on reservations;
--
--   À rouvrir le jour où un paiement automatique en aura besoin.
--
-- ---------------------------------------------------------
-- EXPIRATION DES CRÉNEAUX
-- ---------------------------------------------------------
-- Rien n'est supprimé en base : les lignes 'en_attente' de plus
-- de 24 h restent visibles dans le Table Editor, elles cessent
-- simplement d'être comptées comme occupées.
--
-- Conséquence à connaître : si une cliente paie son acompte
-- 30 heures après avoir réservé, son créneau a pu être repris
-- entre-temps. Confirmez les rendez-vous (statut 'confirmee')
-- sans trop attendre — un rendez-vous confirmé n'expire jamais.
--
-- ---------------------------------------------------------
-- VÉRIFIER QUE LA MIGRATION A PRIS
-- ---------------------------------------------------------
--   select * from creneaux_occupes('2026-10-05');
--     → deux colonnes seulement : heure, duree
--
--   select * from reservations;
--     → fonctionne ici (vous êtes authentifié), mais échoue
--       désormais depuis le site avec la clé anon.

-- =========================================================
