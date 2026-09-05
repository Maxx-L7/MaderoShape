/* =========================================================
   MaderoShape — configuration du module de réservation
   ---------------------------------------------------------
   CE FICHIER EST FAIT POUR ÊTRE MODIFIÉ SANS TOUCHER AU CODE.
   Après chaque modification : enregistrer, puis recharger la
   page dans le navigateur (Ctrl + F5 pour vider le cache).
   ========================================================= */

const CONFIG = {

  /* -------------------------------------------------------
     1. Ouverture des réservations
     Aucun créneau ne peut être réservé avant cette date.
     Format : "AAAA-MM-JJ"
     ------------------------------------------------------- */
  dateOuverture: "2026-10-01",

  /* -------------------------------------------------------
     2. Horaires d'ouverture
     debut = heure du tout premier créneau de la journée
     fin   = heure à laquelle la dernière séance doit être
             TERMINÉE (aucun créneau ne dépassera cette heure)
     ------------------------------------------------------- */
  horaires: {
    semaine: { debut: "17:30", fin: "21:00" },   // lundi → vendredi
    weekend: { debut: "12:00", fin: "21:00" }    // samedi + dimanche
  },

  /* -------------------------------------------------------
     3. Battement entre deux rendez-vous, en minutes
     (nettoyage de la cabine, accueil de la cliente suivante)
     ------------------------------------------------------- */
  buffer: 5,

  /* -------------------------------------------------------
     4. Jours de fermeture hebdomadaire
     Deux écritures acceptées, mélangeables :
       - un numéro de jour : 0 = dimanche, 1 = lundi, 2 = mardi,
         3 = mercredi, 4 = jeudi, 5 = vendredi, 6 = samedi
       - une date précise : "2026-11-11"
     Exemple — fermé tous les lundis et le 11 novembre :
       joursFermes: [1, "2026-11-11"]
     ------------------------------------------------------- */
  joursFermes: [],

  /* -------------------------------------------------------
     5. Congés
     Deux écritures acceptées, mélangeables :
       - une date isolée : "2026-12-25"
       - une période      : { debut: "2026-12-24", fin: "2027-01-02" }
         (les deux bornes sont incluses)
     Exemple :
       conges: [
         "2026-12-25",
         { debut: "2027-02-08", fin: "2027-02-15" }
       ]
     ------------------------------------------------------- */
  conges: [],

  /* -------------------------------------------------------
     6. Durée des séances
     Toute prestation NON listée ici dure 90 minutes.
     Les noms doivent correspondre exactement au libellé
     affiché dans la grille tarifaire (sans le prix).
     ------------------------------------------------------- */
  prestations60min: [
    "Lipocavitation",
    "Radiofréquence",
    "Madérothérapie — 1 zone"
  ],
  dureeParDefaut: 90,

  /* -------------------------------------------------------
     7. Connexion Supabase
     À récupérer dans le dashboard Supabase :
     Project Settings → API
       - supabaseUrl     = "Project URL"
       - supabaseAnonKey = clé "anon public"
     La clé anon est publique par nature : elle est protégée
     par les politiques RLS définies dans sql/schema.sql.
     N'utilisez JAMAIS la clé "service_role" ici.
     ------------------------------------------------------- */
  supabaseUrl: "https://ehhmaxdxttffoepyscyo.supabase.co",
  supabaseAnonKey: "sb_publishable_C09sFqmy3IBus7bkxcJlBw_if5MtdKO",

  /* -------------------------------------------------------
     8. Acompte demandé à la réservation, en euros
     ------------------------------------------------------- */
  acompte: 10,

  /* -------------------------------------------------------
     9. Règlement par PayPal
     Aucun compte PayPal Developer n'est nécessaire : le site
     se contente d'ouvrir votre lien de paiement dans un nouvel
     onglet, la cliente valide le paiement chez PayPal.

     Deux formes de lien fonctionnent :

     a) Lien QR code P2P (celui utilisé actuellement), obtenu
        depuis l'application PayPal → "Demander" / QR code :
          "https://www.paypal.com/qrcodes/p2pqrc/XXXXXXXXX"
        ⚠️ Ce format NE PRÉREMPLIT PAS le montant : la cliente
        saisit elle-même les 10 €. Le texte affiché sur le site
        le lui indique.

     b) Lien PayPal.me, créé sur www.paypal.com/paypalme :
          "https://paypal.me/monidentifiant/10"
        Ce format préremplit le montant. Si vous basculez
        dessus, le chiffre à la fin du lien doit correspondre à
        la clé "acompte" ci-dessus, et il faut alors adapter le
        texte du bloc PayPal dans index.html (l'instruction
        « Saisissez le montant de 10 € » n'a plus lieu d'être).

     Videz la valeur pour masquer le bloc PayPal et ne proposer
     que Wero.
     ------------------------------------------------------- */
  paypalMeUrl: "https://www.paypal.com/qrcodes/p2pqrc/AHSQHRX7SMJ4J",

  /* -------------------------------------------------------
     10. Règlement par Wero
     Numéro de téléphone qui reçoit les virements Wero.
     ------------------------------------------------------- */
  weroNumero: "06 64 45 03 37",

  /* -------------------------------------------------------
     11. Notification par e-mail (EmailJS)
     À chaque nouvelle demande de rendez-vous, un e-mail est
     envoyé à l'esthéticienne.

     À récupérer sur https://dashboard.emailjs.com :
       serviceId  → onglet "Email Services", colonne Service ID
       templateId → onglet "Email Templates", colonne Template ID
       publicKey  → onglet "Account", champ "Public Key"

     Ces trois valeurs sont publiques par conception : elles ne
     permettent que d'envoyer le modèle que vous avez défini.
     Ne mettez JAMAIS la "Private Key" ici.

     Laissez les valeurs telles quelles (ou videz-les) pour
     désactiver les notifications : le site continue de
     fonctionner normalement, sans envoyer d'e-mail.
     ------------------------------------------------------- */
  emailjs: {
    serviceId: "service_thhxnxc",
    templateId: "template_i91q2sj",
    publicKey: "D91LsS2NLNjUHa-tk"
  }
};
