# MaderoShape

Site vitrine et futur module de prise de rendez-vous pour **MaderoShape**,
cabinet d'esthétique spécialisé en **madérothérapie**, **lipocavitation** et
**radiofréquence** (région parisienne).

Site 100 % statique : HTML5, CSS3 et JavaScript vanilla. Pas de build, pas de
dépendance npm.

---

## Contenu livré

### Sprint 1 — page d'accueil

- Page d'accueil responsive (mobile-first) : header, hero, grille tarifaire,
  « Comment ça marche », footer.
- Grille tarifaire complète en 4 blocs (séance, packs 6, packs 10,
  madérothérapie seule) avec légende des zones A / B / C / D / 360°.
- Défilement doux vers la grille tarifaire depuis le header et le hero.

### Sprint 2 — parcours de réservation

- Modale de réservation en 3 étapes, ouverte par les boutons « Choisir » :
  récapitulatif prestation → date et créneau → coordonnées.
- Calendrier maison (aucune librairie) : mois courant, navigation, jours
  passés / fermés / en congés grisés, ouverture au 1er octobre 2026.
- Créneaux calculés selon la prestation : 60 min pour une prestation
  « 1 zone », 90 min sinon, battement de 5 min, sans jamais dépasser 21 h.
- Créneaux déjà pris masqués, lus dans Supabase pour la journée choisie.
- Formulaire validé (nom ≥ 2 caractères, téléphone français) puis
  enregistrement dans la table `reservations` au statut `en_attente`.

### Sprint 3 — règlement de l'acompte

- Étape 4 de la modale : « Votre rendez-vous est enregistré ! », avec le
  récapitulatif complet et le montant de l'acompte.
- Deux moyens de règlement présentés à égalité, côte à côte sur desktop
  et empilés sur mobile : un lien **PayPal.me** et le numéro **Wero** du
  cabinet.
- Aucun paiement n'est encaissé par le site, et aucun SDK externe n'est
  chargé. Toutes les réservations restent en `en_attente` : c'est
  l'esthéticienne qui confirme après avoir constaté le virement.

### Sprint 4 — notification de l'esthéticienne

- Dès qu'une réservation est enregistrée, un e-mail récapitulatif part
  automatiquement vers la boîte du cabinet (via EmailJS, sans serveur).
- L'envoi est « tire et oublie » : la cliente voit ses instructions de
  paiement immédiatement, sans jamais attendre l'e-mail.
- Si EmailJS n'est pas configuré, tombe en panne ou dépasse son quota,
  la réservation est quand même enregistrée et le parcours se termine
  normalement.

---

## Structure des fichiers

```
.
├── index.html        # page complète + modale de réservation
├── css/
│   └── style.css     # styles (variables CSS + media queries mobile-first)
├── js/
│   ├── config.js     # ⚙️ réglages : horaires, congés, Supabase, paiement, e-mail
│   └── app.js        # défilement doux + parcours de réservation
├── sql/
│   ├── schema.sql             # à exécuter en premier
│   └── migration_sprint3.sql  # à exécuter ensuite (paiement)
└── README.md
```

---

## Mise en service de la réservation

À faire **une seule fois**, avant le premier déploiement.

### 1. Créer la base

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite
   suffisante), en choisissant une région européenne (Frankfurt ou Paris)
   pour rester cohérent avec le RGPD.
2. Dans le projet : **SQL Editor** → **New query**.
3. Coller l'intégralité de `sql/schema.sql`, puis **Run**.
4. Nouvelle requête : coller `sql/migration_sprint3.sql`, puis **Run**.
   Ce second script ajoute la colonne `paypal_order_id` et autorise la
   confirmation après paiement. **Lisez l'avertissement de sécurité qu'il
   contient** avant de le lancer.

### 2. Brancher le site

1. Dans Supabase : **Project Settings** → **API**.
2. Copier « Project URL » et la clé **anon public**.
3. Les coller dans `js/config.js`, à la place de `REMPLACER_PAR_URL_PROJET`
   et `REMPLACER_PAR_CLE_ANON`.

⚠️ N'utilisez jamais la clé `service_role` dans `config.js` : elle donne
tous les droits sur la base et le fichier est public.

### 3. Régler les horaires

Tout se pilote depuis `js/config.js`, sans toucher au code :

| Réglage         | Rôle                                                    |
|-----------------|---------------------------------------------------------|
| `dateOuverture` | premier jour réservable                                  |
| `horaires`      | plages semaine et week-end                               |
| `buffer`        | battement entre deux rendez-vous, en minutes             |
| `joursFermes`   | fermeture hebdomadaire (`1` = lundi) et/ou dates isolées |
| `conges`        | dates isolées et/ou périodes `{ debut, fin }`            |
| `prestations60min` | prestations d'une heure ; toutes les autres durent 90 min |

Après chaque modification : enregistrer, puis recharger la page avec
**Ctrl + F5** pour contourner le cache du navigateur.

### 4. Le lien de paiement PayPal

Aucun compte PayPal Developer n'est nécessaire : le site ouvre simplement
votre lien de paiement dans un nouvel onglet.

Le lien en place est un **QR code P2P**, récupéré depuis l'application
PayPal (« Demander » → QR code → partager le lien) :

```
https://www.paypal.com/qrcodes/p2pqrc/AHSQHRX7SMJ4J
```

⚠️ **Ce format ne préremplit pas le montant.** La cliente saisit
elle-même les 10 €. Le texte affiché sous le bouton le lui demande
explicitement : « Saisissez le montant de 10 € et indiquez votre nom en
note… »

**Pour changer de lien**, remplacer la clé `paypalMeUrl` dans
`js/config.js`. Un lien PayPal.me (`https://paypal.me/identifiant/10`,
créé sur [paypal.com/paypalme](https://www.paypal.com/paypalme))
préremplirait le montant — dans ce cas, pensez à retirer la phrase
« Saisissez le montant de 10 € » du bloc PayPal dans `index.html`, elle
n'aurait plus lieu d'être.

Videz la clé pour masquer le bloc PayPal et ne proposer que Wero : le
site reste utilisable.

### 5. Régler le paiement Wero

Le numéro destinataire se change dans `js/config.js`, clé `weroNumero`.
Le montant de l'acompte se change avec la clé `acompte` : il s'applique
partout (récapitulatif, bloc PayPal, bloc Wero).

⚠️ La clé `acompte` pilote tous les montants **affichés** sur le site.
Elle ne pilote pas le lien PayPal : avec le lien QR actuel, aucun montant
n'est transmis, c'est la cliente qui le saisit.

### Confirmer un règlement

Le site ne vérifie aucun paiement. Après chaque réservation :

1. Vérifier la réception du virement (notification PayPal, ou application
   bancaire pour Wero). La cliente est invitée à indiquer son nom en
   référence.
2. Dans Supabase → **Table Editor** → `reservations`, passer la ligne
   correspondante de `en_attente` à `confirmee`.
3. Contacter la cliente pour confirmer le rendez-vous.

Les demandes sans paiement au bout de quelques jours : passer la ligne en
`annule` pour libérer le créneau.

### 6. Recevoir les demandes par e-mail

Sans cette étape, il faut ouvrir Supabase pour découvrir les nouvelles
demandes. Une fois configurée, chaque réservation déclenche un e-mail.

**a. Créer le compte.** S'inscrire sur
[emailjs.com](https://www.emailjs.com) — l'offre gratuite couvre
200 e-mails par mois, largement au-dessus du volume attendu.

**b. Connecter la boîte e-mail.** Menu **Email Services** →
**Add New Service** → choisir le fournisseur du cabinet (Gmail, Outlook,
autre) et autoriser l'accès. Noter le **Service ID** affiché.

**c. Créer le modèle.** Menu **Email Templates** → **Create New
Template**. Dans le champ **To Email**, mettre l'adresse du cabinet
(c'est vous qui recevez la notification).

Sujet :

```
Nouveau RDV — {{prestation}} — {{date}} à {{heure}}
```

Corps :

```
Bonjour,

Vous avez une nouvelle demande de rendez-vous :

📋 Prestation : {{prestation}}
💰 Prix : {{prix}}
📅 Date : {{date}}
🕐 Heure : {{heure}}
⏱️ Durée : {{duree}} minutes

👤 Cliente : {{nom}}
📞 Téléphone : {{telephone}}

💳 Statut du paiement : En attente
L'acompte de 10 € sera envoyé par PayPal ou Wero.
Vérifiez votre application PayPal ou bancaire.

---
MaderoShape — Notification automatique
```

Enregistrer, puis noter le **Template ID**.

⚠️ Les noms entre accolades doivent être écrits **exactement** ainsi :
`prestation`, `prix`, `date`, `heure`, `duree`, `nom`, `telephone`.
Une faute de frappe laisse le champ vide dans l'e-mail reçu.

**d. Récupérer la clé publique.** Menu **Account** → champ
**Public Key**.

**e. Coller les trois valeurs** dans `js/config.js`, bloc `emailjs` :
`serviceId`, `templateId`, `publicKey`.

⚠️ Copiez la **Public Key**, jamais la **Private Key**. Ces trois
identifiants sont publics par conception : ils ne permettent d'envoyer
que le modèle que vous avez défini.

**Vérifier.** Faire une réservation de test sur le site : l'e-mail doit
arriver en moins d'une minute. S'il n'arrive pas, ouvrir la console du
navigateur (touche F12) — un message y explique la cause. Pensez aussi
à regarder dans les indésirables.

Tant que le bloc `emailjs` contient encore les valeurs
`REMPLACER_PAR_…`, les notifications sont simplement désactivées : le
site fonctionne, avec un avertissement dans la console.

### 7. Consulter les rendez-vous

Dashboard Supabase → **Table Editor** → table `reservations`.

| Statut       | Signification                                          |
|--------------|--------------------------------------------------------|
| `en_attente` | créneau réservé, acompte pas encore vérifié            |
| `confirmee`  | acompte reçu et vérifié par l'esthéticienne             |
| `annule`     | rendez-vous annulé — le créneau redevient disponible   |

---

## Ce que le site ne fait pas

Le règlement est **semi-manuel** et assumé comme tel : le site enregistre
le rendez-vous et affiche comment payer, rien de plus.

- **Aucun encaissement automatique.** Le site ne sait pas si le virement
  a eu lieu. Un statut `confirmee` reflète votre vérification, pas celle
  d'un système de paiement.
- **Un créneau est bloqué dès la réservation**, avant tout paiement. Une
  cliente qui ne règle jamais immobilise l'horaire jusqu'à ce que vous
  passiez la ligne en `annule`.
- **La colonne `paypal_order_id` reste vide.** Elle est conservée en base
  au cas où le paiement automatique reviendrait un jour ; elle ne sert
  pas aujourd'hui.
- **L'e-mail de notification n'est pas garanti.** C'est un confort, pas
  un registre : quota EmailJS dépassé, panne réseau ou message classé en
  indésirable, et vous ne serez pas prévenu. Supabase reste la source de
  vérité — gardez l'habitude d'y jeter un œil.
- **La politique UPDATE publique reste active** en base (créée au
  sprint 3). Elle n'est plus utilisée par le site, mais elle autorise
  toujours la modification des lignes depuis l'extérieur. Vous pouvez la
  durcir ou la retirer : voir le bas de `sql/migration_sprint3.sql`.

---

## À faire dans les prochains sprints

- [x] **Sprint 3** — règlement semi-manuel de l'acompte de 10 €
      (lien PayPal.me + numéro Wero), confirmation à la main.
- [x] **Sprint 4** — e-mail de notification au cabinet à chaque nouvelle
      demande.
- [ ] E-mail de confirmation à la cliente, une fois l'acompte vérifié.
- [ ] Éventuel retour au paiement automatique (PayPal Checkout côté
      serveur), si le suivi manuel des acomptes devient trop lourd.
- [ ] Renseigner l'adresse exacte du cabinet (placeholder actuel :
      « 📍 Région parisienne »).
- [ ] Renseigner la véritable adresse e-mail de contact (placeholder actuel :
      `contact@maderoshape.fr`).
- [ ] Compléter les mentions légales (raison sociale, SIRET, hébergeur,
      politique de confidentialité) — la table `reservations` contient des
      données personnelles, une mention RGPD devient obligatoire.
- [ ] Ajouter des photos du cabinet et des visuels de prestations.

### Points à surveiller

- **Créneau non payé** : un rendez-vous reste en `en_attente` tant que
  l'acompte n'est pas reçu, mais il bloque déjà le créneau. C'est le cas
  d'une cliente qui abandonne au moment de payer, et de tout paiement
  Wero non encore vérifié. Passez ces lignes en `annule` depuis Supabase
  pour libérer l'horaire.
- **Double réservation simultanée** : deux clientes qui valident le même
  créneau à quelques secondes d'intervalle passeront toutes les deux, la
  vérification ayant lieu à l'affichage des créneaux. Le risque est faible
  au volume actuel ; une contrainte d'unicité en base pourra être ajoutée
  si le cas se présente.
