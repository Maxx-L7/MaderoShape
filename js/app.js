/* =========================================================
   MaderoShape — scripts de la page
   ---------------------------------------------------------
   1. Défilement doux vers les ancres
   2. Parcours de réservation en 3 étapes
      prestation → date + créneau → coordonnées → Supabase

   Les réglages (horaires, congés, clés Supabase) vivent dans
   js/config.js. Aucun identifiant en dur dans ce fichier.
   ========================================================= */

/* =========================================================
   1. DÉFILEMENT DOUX
   ========================================================= */
(function () {
  'use strict';

  /**
   * Hauteur de l'en-tête collant, pour ne pas masquer la cible du scroll.
   * @returns {number} hauteur en pixels
   */
  function hauteurEntete() {
    var entete = document.querySelector('.entete');
    return entete ? entete.getBoundingClientRect().height : 0;
  }

  /**
   * Fait défiler la page jusqu'à un élément, en tenant compte de l'en-tête.
   * @param {Element} cible élément vers lequel défiler
   */
  function defilerVers(cible) {
    var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var position = window.pageYOffset + cible.getBoundingClientRect().top - hauteurEntete() - 12;

    window.scrollTo({
      top: Math.max(position, 0),
      behavior: reduit ? 'auto' : 'smooth'
    });
  }

  document.addEventListener('click', function (evenement) {
    if (!(evenement.target instanceof Element)) {
      return;
    }

    var lien = evenement.target.closest('a[href^="#"]');
    if (!lien) {
      return;
    }

    var ancre = lien.getAttribute('href');
    if (!ancre || ancre === '#') {
      return;
    }

    var cible = document.querySelector(ancre);
    if (!cible) {
      return;
    }

    evenement.preventDefault();
    defilerVers(cible);

    // Garde l'ancre dans l'URL sans provoquer de saut brutal.
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', ancre);
    }
  });
})();


/* =========================================================
   2. PARCOURS DE RÉSERVATION
   ========================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------
     2.1 Configuration : lecture avec valeurs de repli
     ------------------------------------------------------ */

  var DEFAUTS = {
    dateOuverture: '2026-10-01',
    horaires: {
      semaine: { debut: '17:30', fin: '21:00' },
      weekend: { debut: '12:00', fin: '21:00' }
    },
    buffer: 5,
    joursFermes: [],
    conges: [],
    prestations60min: ['Lipocavitation', 'Radiofréquence', 'Madérothérapie — 1 zone'],
    dureeParDefaut: 90,
    acompte: 10,
    paypalMeUrl: '',
    weroNumero: '06 64 45 03 37',
    emailjs: null
  };

  // Valeurs que config.js contient tant qu'elles n'ont pas été remplies.
  var MARQUEUR_NON_RENSEIGNE = 'REMPLACER';

  var MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  var JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  /**
   * Récupère l'objet CONFIG défini par js/config.js.
   * Attention : `const CONFIG` crée une variable globale lexicale, qui
   * n'est PAS une propriété de window. On passe donc par `typeof` plutôt
   * que par `window.CONFIG`, qui serait toujours undefined.
   * @returns {Object} configuration, ou objet vide si le fichier manque
   */
  function configuration() {
    try {
      // try/catch : si js/config.js était chargé APRÈS ce fichier, la
      // zone morte temporelle du `const` ferait lever une ReferenceError.
      if (typeof CONFIG !== 'undefined' && CONFIG) {
        return CONFIG;
      }
    } catch (erreur) {
      // On retombe sur les valeurs par défaut, silencieusement.
    }

    if (window.CONFIG) {
      return window.CONFIG;
    }
    return {};
  }

  /**
   * Lit une clé de configuration, avec repli sur la valeur par défaut.
   * @param {string} cle nom de la clé dans CONFIG
   * @returns {*} valeur configurée ou valeur par défaut
   */
  function reglage(cle) {
    var config = configuration();
    return config[cle] === undefined || config[cle] === null ? DEFAUTS[cle] : config[cle];
  }


  /* ------------------------------------------------------
     2.2 Utilitaires de date et d'heure
     Les dates sont manipulées en heure locale et converties
     en clés "AAAA-MM-JJ" à la main : passer par toISOString()
     décalerait les dates d'un jour selon le fuseau.
     ------------------------------------------------------ */

  /**
   * Convertit une date en clé "AAAA-MM-JJ" (heure locale).
   * @param {Date} date date à convertir
   * @returns {string} clé de date
   */
  function cleDate(date) {
    var mois = String(date.getMonth() + 1).padStart(2, '0');
    var jour = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + mois + '-' + jour;
  }

  /**
   * Construit une Date locale à partir d'une clé "AAAA-MM-JJ".
   * @param {string} cle clé de date
   * @returns {Date|null} date à minuit, ou null si la clé est invalide
   */
  function dateDepuisCle(cle) {
    if (typeof cle !== 'string') {
      return null;
    }
    var morceaux = cle.split('-');
    if (morceaux.length !== 3) {
      return null;
    }
    var date = new Date(Number(morceaux[0]), Number(morceaux[1]) - 1, Number(morceaux[2]));
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Convertit "17:30" en nombre de minutes depuis minuit.
   * @param {string} texte heure au format HH:MM
   * @returns {number} minutes depuis minuit
   */
  function enMinutes(texte) {
    var morceaux = String(texte).split(':');
    return Number(morceaux[0]) * 60 + Number(morceaux[1] || 0);
  }

  /**
   * Convertit un nombre de minutes depuis minuit en "17:30".
   * @param {number} minutes minutes depuis minuit
   * @returns {string} heure au format HH:MM
   */
  function enTexte(minutes) {
    var heures = Math.floor(minutes / 60);
    var reste = minutes % 60;
    return String(heures).padStart(2, '0') + ':' + String(reste).padStart(2, '0');
  }

  /**
   * Met en forme une date pour l'affichage, ex. "samedi 3 octobre 2026".
   * @param {Date} date date à afficher
   * @returns {string} date en toutes lettres
   */
  function dateEnToutesLettres(date) {
    return JOURS_FR[date.getDay()] + ' ' + date.getDate() + ' ' +
      MOIS_FR[date.getMonth()] + ' ' + date.getFullYear();
  }

  /**
   * Met une majuscule à la première lettre seulement.
   * En français, « samedi 3 octobre 2026 » ne prend pas de majuscule
   * au mois : text-transform: capitalize en mettrait partout.
   * @param {string} texte texte à capitaliser
   * @returns {string} texte avec une initiale majuscule
   */
  function majusculeInitiale(texte) {
    var chaine = String(texte || '');
    return chaine.charAt(0).toUpperCase() + chaine.slice(1);
  }

  /**
   * Date du jour ramenée à minuit.
   * @returns {Date} aujourd'hui à 00:00
   */
  function aujourdhui() {
    var maintenant = new Date();
    return new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  }


  /* ------------------------------------------------------
     2.3 Règles d'ouverture
     ------------------------------------------------------ */

  /**
   * Indique si une date tombe un samedi ou un dimanche.
   * @param {Date} date date à tester
   * @returns {boolean} vrai si week-end
   */
  function estWeekend(date) {
    var jour = date.getDay();
    return jour === 0 || jour === 6;
  }

  /**
   * Teste si une date figure dans la liste des jours de fermeture.
   * Accepte les numéros de jour (0 = dimanche) et les dates "AAAA-MM-JJ".
   * @param {Date} date date à tester
   * @returns {boolean} vrai si le cabinet est fermé ce jour-là
   */
  function estJourFerme(date) {
    var liste = reglage('joursFermes');
    if (!Array.isArray(liste)) {
      return false;
    }

    var cle = cleDate(date);
    return liste.some(function (entree) {
      if (typeof entree === 'number') {
        return entree === date.getDay();
      }
      return entree === cle;
    });
  }

  /**
   * Teste si une date tombe pendant les congés.
   * Accepte les dates isolées et les périodes { debut, fin } incluses.
   * @param {Date} date date à tester
   * @returns {boolean} vrai si la date est en congés
   */
  function estEnConges(date) {
    var liste = reglage('conges');
    if (!Array.isArray(liste)) {
      return false;
    }

    var cle = cleDate(date);
    return liste.some(function (entree) {
      if (typeof entree === 'string') {
        return entree === cle;
      }
      if (entree && entree.debut && entree.fin) {
        return cle >= entree.debut && cle <= entree.fin;
      }
      return false;
    });
  }

  /**
   * Détermine si un jour peut recevoir des rendez-vous.
   * @param {Date} date date à tester
   * @returns {{ouvert: boolean, raison: string}} verdict et motif de refus
   */
  function evaluerJour(date) {
    if (date < aujourdhui()) {
      return { ouvert: false, raison: 'passé' };
    }

    var ouverture = dateDepuisCle(reglage('dateOuverture'));
    if (ouverture && date < ouverture) {
      return { ouvert: false, raison: 'avant ouverture' };
    }

    if (estJourFerme(date)) {
      return { ouvert: false, raison: 'fermé' };
    }

    if (estEnConges(date)) {
      return { ouvert: false, raison: 'congés' };
    }

    return { ouvert: true, raison: '' };
  }


  /* ------------------------------------------------------
     2.4 Prestations et créneaux
     ------------------------------------------------------ */

  /**
   * Découpe la valeur d'un attribut data-prestation en nom et prix.
   * Le séparateur retenu est le DERNIER " — " : les noms de packs
   * en contiennent déjà un ("Pack 6 séances — Lipo + RF — 400 €").
   * @param {string} valeur contenu de data-prestation
   * @returns {{nom: string, prix: number, prixTexte: string}} prestation
   */
  function analyserPrestation(valeur) {
    var texte = String(valeur || '').trim();
    var separateur = texte.lastIndexOf(' — ');

    if (separateur === -1) {
      return { nom: texte, prix: 0, prixTexte: '' };
    }

    var nom = texte.slice(0, separateur).trim();
    var prixTexte = texte.slice(separateur + 3).trim();
    var chiffres = prixTexte.replace(/[^\d]/g, '');

    return {
      nom: nom,
      prix: chiffres ? parseInt(chiffres, 10) : 0,
      prixTexte: prixTexte
    };
  }

  /**
   * Montant de l'acompte, en euros.
   * @returns {number} montant de l'acompte
   */
  function montantAcompte() {
    var valeur = Number(reglage('acompte'));
    return isNaN(valeur) || valeur <= 0 ? 10 : valeur;
  }

  /**
   * Acompte formaté pour l'affichage, ex. « 10 € ».
   * @returns {string} montant lisible
   */
  function acompteAffiche() {
    return String(montantAcompte()).replace('.', ',') + ' €';
  }

  /**
   * Détermine la durée d'une séance selon la prestation.
   * @param {string} nom libellé de la prestation, sans le prix
   * @returns {number} durée en minutes
   */
  function dureeDe(nom) {
    var courtes = reglage('prestations60min');
    if (Array.isArray(courtes) && courtes.indexOf(nom) !== -1) {
      return 60;
    }
    return Number(reglage('dureeParDefaut')) || 90;
  }

  /**
   * Construit la liste des créneaux théoriques d'une journée.
   * Deux créneaux sont espacés de (durée + buffer) et aucun ne
   * peut se terminer après l'heure de fermeture.
   * @param {Date} date jour concerné
   * @param {number} duree durée de la séance en minutes
   * @returns {Array<{heure: string, debut: number, fin: number}>} créneaux
   */
  function creneauxTheoriques(date, duree) {
    var horaires = reglage('horaires');
    var plage = estWeekend(date) ? horaires.weekend : horaires.semaine;
    var buffer = Number(reglage('buffer')) || 0;

    var debut = enMinutes(plage.debut);
    var fin = enMinutes(plage.fin);
    var pas = duree + buffer;
    var creneaux = [];

    for (var minute = debut; minute + duree <= fin; minute += pas) {
      creneaux.push({
        heure: enTexte(minute),
        debut: minute,
        fin: minute + duree
      });
    }

    return creneaux;
  }

  /**
   * Retire les créneaux qui chevauchent un rendez-vous déjà pris.
   * Le battement est exigé des deux côtés : un créneau candidat
   * doit finir au moins `buffer` minutes avant le début d'un RDV
   * existant, et commencer au moins `buffer` minutes après sa fin.
   * @param {Array} creneaux créneaux théoriques
   * @param {Array} reservations lignes Supabase de la journée
   * @returns {Array} créneaux réellement disponibles
   */
  function filtrerCreneauxPris(creneaux, reservations) {
    var buffer = Number(reglage('buffer')) || 0;

    var occupes = (reservations || []).map(function (ligne) {
      var debut = enMinutes(ligne.heure);
      return { debut: debut, fin: debut + (Number(ligne.duree) || 0) };
    });

    return creneaux.filter(function (creneau) {
      return !occupes.some(function (pris) {
        return creneau.debut < pris.fin + buffer && pris.debut < creneau.fin + buffer;
      });
    });
  }


  /* ------------------------------------------------------
     2.5 Supabase
     ------------------------------------------------------ */

  var clientSupabase = null;
  var supabaseConfigure = false;

  /**
   * Instancie le client Supabase si les identifiants sont renseignés.
   * @returns {boolean} vrai si le client est utilisable
   */
  function initialiserSupabase() {
    var url = reglage('supabaseUrl');
    var cle = reglage('supabaseAnonKey');

    var renseigne = typeof url === 'string' && typeof cle === 'string' &&
      url.indexOf('http') === 0 && cle.length > 20;

    if (!renseigne) {
      return false;
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      return false;
    }

    clientSupabase = window.supabase.createClient(url, cle);
    supabaseConfigure = true;
    return true;
  }

  /**
   * Récupère les rendez-vous déjà enregistrés pour une journée.
   * @param {string} cle date au format "AAAA-MM-JJ"
   * @returns {Promise<Array>} lignes de la table reservations
   */
  function chargerReservations(cle) {
    if (!supabaseConfigure) {
      return Promise.resolve([]);
    }

    return clientSupabase
      .from('reservations')
      .select('heure, duree, statut')
      .eq('date_rdv', cle)
      .neq('statut', 'annule')
      .then(function (reponse) {
        if (reponse.error) {
          throw reponse.error;
        }
        return reponse.data || [];
      });
  }

  /**
   * Enregistre un rendez-vous dans Supabase.
   * @param {Object} rdv données du rendez-vous
   * @returns {Promise<Object>} ligne insérée
   */
  function enregistrerReservation(rdv) {
    if (!supabaseConfigure) {
      return Promise.reject(new Error(
        'La connexion à la base de réservations n\'est pas configurée.'
      ));
    }

    return clientSupabase
      .from('reservations')
      .insert([rdv])
      .select()
      .then(function (reponse) {
        if (reponse.error) {
          throw reponse.error;
        }
        return reponse.data;
      });
  }


  /* ------------------------------------------------------
     2.5.bis Notification e-mail de l'esthéticienne (EmailJS)

     L'envoi est volontairement « tire et oublie » : il ne doit
     jamais retarder ni empêcher l'affichage des instructions de
     paiement. Une notification perdue est un désagrément ; une
     cliente bloquée sur un écran de chargement, un bug.
     ------------------------------------------------------ */

  var emailjsConfigure = false;

  /**
   * Lit le bloc emailjs de config.js et vérifie qu'il est renseigné.
   * @returns {Object|null} identifiants complets, ou null
   */
  function identifiantsEmailjs() {
    var bloc = reglage('emailjs');

    if (!bloc || typeof bloc !== 'object') {
      return null;
    }

    var champs = ['serviceId', 'templateId', 'publicKey'];
    var valeurs = {};

    for (var i = 0; i < champs.length; i += 1) {
      var valeur = String(bloc[champs[i]] || '').trim();
      if (!valeur || valeur.indexOf(MARQUEUR_NON_RENSEIGNE) === 0) {
        return null;
      }
      valeurs[champs[i]] = valeur;
    }

    return valeurs;
  }

  /**
   * Initialise EmailJS si les identifiants sont renseignés.
   * @returns {boolean} vrai si les notifications sont actives
   */
  function initialiserEmailjs() {
    var identifiants = identifiantsEmailjs();

    if (!identifiants) {
      return false;
    }

    if (!window.emailjs || typeof window.emailjs.send !== 'function') {
      return false;
    }

    if (typeof window.emailjs.init === 'function') {
      window.emailjs.init({ publicKey: identifiants.publicKey });
    }

    emailjsConfigure = true;
    return true;
  }

  /**
   * Met un numéro compact en forme lisible : 0612345678 → 06 12 34 56 78.
   * @param {string} numero numéro tel qu'enregistré en base
   * @returns {string} numéro groupé par deux chiffres
   */
  function telephoneLisible(numero) {
    var compact = String(numero || '');

    if (/^0\d{9}$/.test(compact)) {
      return compact.match(/.{2}/g).join(' ');
    }
    return compact;
  }

  /**
   * Envoie la notification de nouvelle demande à l'esthéticienne.
   * N'attend jamais de réponse : les erreurs sont journalisées et
   * la cliente n'en voit rien.
   * @param {Object} rdv rendez-vous tel qu'inséré en base
   */
  function notifierCabinet(rdv) {
    if (!emailjsConfigure) {
      return;
    }

    var identifiants = identifiantsEmailjs();
    var date = dateDepuisCle(rdv.date_rdv);

    var parametres = {
      prestation: rdv.prestation,
      prix: rdv.prix + ' €',
      date: date ? majusculeInitiale(dateEnToutesLettres(date)) : rdv.date_rdv,
      heure: String(rdv.heure).replace(':', 'h'),
      duree: rdv.duree,
      nom: rdv.nom_cliente,
      telephone: telephoneLisible(rdv.telephone)
    };

    try {
      window.emailjs
        .send(identifiants.serviceId, identifiants.templateId, parametres)
        .then(null, function (erreur) {
          console.warn(
            'MaderoShape — notification e-mail non envoyée (la réservation ' +
            'est bien enregistrée) :', erreur
          );
        });
    } catch (erreur) {
      console.warn(
        'MaderoShape — notification e-mail non envoyée (la réservation ' +
        'est bien enregistrée) :', erreur
      );
    }
  }


  /* ------------------------------------------------------
     2.6 Validation du formulaire
     ------------------------------------------------------ */

  /**
   * Valide un nom complet.
   * @param {string} valeur saisie de la cliente
   * @returns {string} message d'erreur, vide si la saisie est valide
   */
  function validerNom(valeur) {
    var propre = String(valeur || '').trim();
    if (propre.length === 0) {
      return 'Merci d\'indiquer votre nom.';
    }
    if (propre.length < 2) {
      return 'Le nom doit contenir au moins 2 caractères.';
    }
    return '';
  }

  /**
   * Normalise un numéro français en supprimant espaces et séparateurs.
   * @param {string} valeur saisie de la cliente
   * @returns {string} numéro compact
   */
  function normaliserTelephone(valeur) {
    return String(valeur || '').replace(/[\s.\-()/]/g, '');
  }

  /**
   * Valide un numéro de téléphone français (0X… sur 10 chiffres ou +33X…).
   * @param {string} valeur saisie de la cliente
   * @returns {string} message d'erreur, vide si la saisie est valide
   */
  function validerTelephone(valeur) {
    var compact = normaliserTelephone(valeur);

    if (compact.length === 0) {
      return 'Merci d\'indiquer un numéro de téléphone.';
    }
    if (/^0[1-9]\d{8}$/.test(compact)) {
      return '';
    }
    if (/^\+33[1-9]\d{8}$/.test(compact)) {
      return '';
    }
    if (/^0033[1-9]\d{8}$/.test(compact)) {
      return '';
    }
    return 'Numéro invalide. Attendu : 06 12 34 56 78 ou +33 6 12 34 56 78.';
  }


  /* ------------------------------------------------------
     2.7 État du parcours et références DOM
     ------------------------------------------------------ */

  var etat = {
    nom: '',
    prix: 0,
    prixTexte: '',
    duree: 90,
    dateChoisie: null,
    heureChoisie: null,
    moisAffiche: null,
    declencheur: null,
    envoiEnCours: false,
    nomCliente: '',
    reservationId: null
  };

  var modale = document.getElementById('modale-reservation');

  // La page d'accueil peut être servie sans la modale : on sort proprement.
  if (!modale) {
    return;
  }

  var elements = {
    boite: modale.querySelector('.modale__boite'),
    filEtapes: modale.querySelectorAll('.fil-etapes__item'),
    sections: modale.querySelectorAll('.etape-resa'),

    resumePrestation: document.getElementById('resume-prestation'),
    resumePrix: document.getElementById('resume-prix'),
    resumeDuree: document.getElementById('resume-duree'),
    boutonContinuer: document.getElementById('btn-continuer-1'),

    moisPrecedent: document.getElementById('mois-precedent'),
    moisSuivant: document.getElementById('mois-suivant'),
    libelleMois: document.getElementById('calendrier-mois'),
    grille: document.getElementById('calendrier-grille'),
    zoneCreneaux: document.getElementById('zone-creneaux'),

    finalPrestation: document.getElementById('final-prestation'),
    finalDate: document.getElementById('final-date'),
    finalHeure: document.getElementById('final-heure'),
    finalPrix: document.getElementById('final-prix'),

    formulaire: document.getElementById('formulaire-resa'),
    champNom: document.getElementById('champ-nom'),
    champTelephone: document.getElementById('champ-telephone'),
    erreurNom: document.getElementById('erreur-nom'),
    erreurTelephone: document.getElementById('erreur-telephone'),
    erreurEnvoi: document.getElementById('erreur-envoi'),
    boutonConfirmer: document.getElementById('btn-confirmer'),

    paiementPrestation: document.getElementById('paiement-prestation'),
    paiementDate: document.getElementById('paiement-date'),
    paiementHeure: document.getElementById('paiement-heure'),
    paiementNom: document.getElementById('paiement-nom'),
    acompteMontant: document.getElementById('acompte-montant'),
    blocPaypal: document.getElementById('bloc-paypal'),
    lienPaypal: document.getElementById('lien-paypal'),
    paypalMontant: document.getElementById('paypal-montant'),
    paypalMontantInstruction: document.getElementById('paypal-montant-instruction'),
    weroMontant: document.getElementById('wero-montant'),
    weroMontantTexte: document.getElementById('wero-montant-texte'),
    weroNumero: document.getElementById('wero-numero')
  };


  /* ------------------------------------------------------
     2.8 Navigation entre les étapes
     ------------------------------------------------------ */

  /**
   * Affiche une étape et masque les autres.
   * @param {number} numero numéro de l'étape (1 à 4)
   */
  function afficherEtape(numero) {
    elements.sections.forEach(function (section) {
      section.hidden = Number(section.getAttribute('data-etape')) !== numero;
    });

    elements.filEtapes.forEach(function (item) {
      var rang = Number(item.getAttribute('data-fil'));
      item.classList.toggle('fil-etapes__item--actif', rang === numero);
      item.classList.toggle('fil-etapes__item--fait', rang < numero);
    });

    if (elements.boite) {
      elements.boite.scrollTop = 0;
    }
  }

  /**
   * Ouvre la modale pour une prestation donnée.
   * @param {Element} bouton bouton « Choisir » cliqué
   */
  function ouvrirModale(bouton) {
    var prestation = analyserPrestation(bouton.getAttribute('data-prestation'));

    etat.nom = prestation.nom;
    etat.prix = prestation.prix;
    etat.prixTexte = prestation.prixTexte;
    etat.duree = dureeDe(prestation.nom);
    etat.dateChoisie = null;
    etat.heureChoisie = null;
    etat.moisAffiche = premierJourAffichable();
    etat.declencheur = bouton;
    etat.envoiEnCours = false;
    etat.nomCliente = '';
    etat.reservationId = null;

    elements.resumePrestation.textContent = prestation.nom;
    elements.resumePrix.textContent = prestation.prixTexte;
    elements.resumeDuree.textContent = etat.duree + ' minutes';

    reinitialiserFormulaire();
    elements.zoneCreneaux.innerHTML =
      '<p class="creneaux__invite">Choisissez d\'abord une date dans le calendrier.</p>';

    dessinerCalendrier();
    afficherEtape(1);

    modale.hidden = false;
    document.body.classList.add('corps--fige');

    window.requestAnimationFrame(function () {
      elements.boutonContinuer.focus();
    });
  }

  /**
   * Ferme la modale et rend le focus au bouton d'origine.
   */
  function fermerModale() {
    modale.hidden = true;
    document.body.classList.remove('corps--fige');

    if (etat.declencheur && document.contains(etat.declencheur)) {
      etat.declencheur.focus();
    }
    etat.declencheur = null;
  }

  /**
   * Remet le formulaire et ses messages d'erreur à zéro.
   */
  function reinitialiserFormulaire() {
    elements.formulaire.reset();
    masquerErreur(elements.erreurNom, elements.champNom);
    masquerErreur(elements.erreurTelephone, elements.champTelephone);
    elements.erreurEnvoi.hidden = true;
    elements.erreurEnvoi.textContent = '';
    elements.boutonConfirmer.disabled = false;
    elements.boutonConfirmer.textContent = 'Confirmer le rendez-vous';
  }


  /* ------------------------------------------------------
     2.9 Calendrier
     ------------------------------------------------------ */

  /**
   * Premier mois à afficher : le mois courant.
   * @returns {Date} premier jour du mois courant
   */
  function premierJourAffichable() {
    var maintenant = new Date();
    return new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  }

  /**
   * Indique si le mois affiché est le premier mois navigable.
   * @returns {boolean} vrai si l'on ne peut pas reculer davantage
   */
  function estPremierMois() {
    var premier = premierJourAffichable();
    return etat.moisAffiche.getFullYear() === premier.getFullYear() &&
      etat.moisAffiche.getMonth() === premier.getMonth();
  }

  /**
   * Construit la grille du mois affiché.
   */
  function dessinerCalendrier() {
    var mois = etat.moisAffiche;
    var annee = mois.getFullYear();
    var indexMois = mois.getMonth();

    elements.libelleMois.textContent = majusculeInitiale(MOIS_FR[indexMois]) + ' ' + annee;
    elements.moisPrecedent.disabled = estPremierMois();

    var premierDuMois = new Date(annee, indexMois, 1);
    // getDay() place dimanche en 0 ; on décale pour commencer le lundi.
    var decalage = (premierDuMois.getDay() + 6) % 7;
    var nbJours = new Date(annee, indexMois + 1, 0).getDate();

    var fragment = document.createDocumentFragment();

    for (var vide = 0; vide < decalage; vide += 1) {
      var creux = document.createElement('span');
      creux.className = 'jour jour--vide';
      creux.setAttribute('aria-hidden', 'true');
      fragment.appendChild(creux);
    }

    for (var numero = 1; numero <= nbJours; numero += 1) {
      fragment.appendChild(construireJour(new Date(annee, indexMois, numero)));
    }

    elements.grille.innerHTML = '';
    elements.grille.appendChild(fragment);
  }

  /**
   * Construit la case d'un jour du calendrier.
   * @param {Date} date jour à représenter
   * @returns {Element} bouton ou span selon la disponibilité
   */
  function construireJour(date) {
    var verdict = evaluerJour(date);
    var cle = cleDate(date);

    if (!verdict.ouvert) {
      var inerte = document.createElement('span');
      inerte.className = 'jour jour--indisponible';
      inerte.textContent = String(date.getDate());
      inerte.title = 'Indisponible (' + verdict.raison + ')';
      inerte.setAttribute('aria-disabled', 'true');
      return inerte;
    }

    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'jour jour--disponible';
    bouton.textContent = String(date.getDate());
    bouton.setAttribute('data-jour', cle);
    bouton.setAttribute('aria-label', dateEnToutesLettres(date));

    if (etat.dateChoisie === cle) {
      bouton.classList.add('jour--choisi');
      bouton.setAttribute('aria-pressed', 'true');
    }

    return bouton;
  }


  /* ------------------------------------------------------
     2.10 Créneaux horaires
     ------------------------------------------------------ */

  /**
   * Charge et affiche les créneaux disponibles pour une date.
   * @param {string} cle date au format "AAAA-MM-JJ"
   */
  function afficherCreneaux(cle) {
    var date = dateDepuisCle(cle);
    if (!date) {
      return;
    }

    var theoriques = creneauxTheoriques(date, etat.duree);

    elements.zoneCreneaux.innerHTML =
      '<p class="creneaux__titre">' + majusculeInitiale(dateEnToutesLettres(date)) + '</p>' +
      '<p class="creneaux__chargement">Recherche des créneaux disponibles…</p>';

    chargerReservations(cle)
      .then(function (reservations) {
        rendreCreneaux(date, filtrerCreneauxPris(theoriques, reservations), '');
      })
      .catch(function (erreur) {
        // Erreur réseau ou base : on affiche les créneaux théoriques en
        // signalant que la disponibilité n'a pas pu être vérifiée.
        console.error('MaderoShape — lecture des réservations impossible :', erreur);
        rendreCreneaux(date, theoriques,
          'Impossible de vérifier les créneaux déjà pris. Votre demande sera confirmée par téléphone.');
      });
  }

  /**
   * Écrit la liste des créneaux dans la modale.
   * @param {Date} date jour concerné
   * @param {Array} creneaux créneaux disponibles
   * @param {string} avertissement message d'alerte éventuel
   */
  function rendreCreneaux(date, creneaux, avertissement) {
    var html = '<p class="creneaux__titre">' + majusculeInitiale(dateEnToutesLettres(date)) + '</p>';

    if (avertissement) {
      html += '<p class="creneaux__alerte">' + avertissement + '</p>';
    }

    if (creneaux.length === 0) {
      html += '<p class="creneaux__vide">Aucun créneau disponible ce jour-là pour cette prestation. ' +
        'Essayez une autre date.</p>';
    } else {
      html += '<p class="creneaux__aide">Séance de ' + etat.duree + ' minutes. ' +
        'Choisissez votre horaire d\'arrivée :</p><div class="creneaux__liste">';

      creneaux.forEach(function (creneau) {
        html += '<button type="button" class="creneau" data-creneau="' + creneau.heure + '">' +
          creneau.heure.replace(':', 'h') + '</button>';
      });

      html += '</div>';
    }

    elements.zoneCreneaux.innerHTML = html;
  }


  /* ------------------------------------------------------
     2.11 Étape 3 : récapitulatif et envoi
     ------------------------------------------------------ */

  /**
   * Remplit le récapitulatif de l'étape 3 et l'affiche.
   */
  function allerAuFormulaire() {
    var date = dateDepuisCle(etat.dateChoisie);

    elements.finalPrestation.textContent = etat.nom;
    elements.finalDate.textContent = date ? majusculeInitiale(dateEnToutesLettres(date)) : '—';
    elements.finalHeure.textContent = etat.heureChoisie.replace(':', 'h') +
      ' (' + etat.duree + ' min)';
    elements.finalPrix.textContent = etat.prixTexte;

    afficherEtape(3);
    window.requestAnimationFrame(function () {
      elements.champNom.focus();
    });
  }

  /**
   * Affiche un message d'erreur sous un champ.
   * @param {Element} zone paragraphe d'erreur
   * @param {Element} champ champ de saisie concerné
   * @param {string} message texte à afficher
   */
  function afficherErreur(zone, champ, message) {
    zone.textContent = message;
    zone.hidden = false;
    champ.classList.add('champ__saisie--erreur');
    champ.setAttribute('aria-invalid', 'true');
  }

  /**
   * Efface le message d'erreur d'un champ.
   * @param {Element} zone paragraphe d'erreur
   * @param {Element} champ champ de saisie concerné
   */
  function masquerErreur(zone, champ) {
    zone.textContent = '';
    zone.hidden = true;
    champ.classList.remove('champ__saisie--erreur');
    champ.removeAttribute('aria-invalid');
  }

  /**
   * Valide la saisie puis enregistre le rendez-vous.
   * @param {Event} evenement soumission du formulaire
   */
  function soumettreFormulaire(evenement) {
    evenement.preventDefault();

    if (etat.envoiEnCours) {
      return;
    }

    var messageNom = validerNom(elements.champNom.value);
    var messageTelephone = validerTelephone(elements.champTelephone.value);

    if (messageNom) {
      afficherErreur(elements.erreurNom, elements.champNom, messageNom);
    } else {
      masquerErreur(elements.erreurNom, elements.champNom);
    }

    if (messageTelephone) {
      afficherErreur(elements.erreurTelephone, elements.champTelephone, messageTelephone);
    } else {
      masquerErreur(elements.erreurTelephone, elements.champTelephone);
    }

    if (messageNom) {
      elements.champNom.focus();
      return;
    }
    if (messageTelephone) {
      elements.champTelephone.focus();
      return;
    }

    if (!etat.dateChoisie || !etat.heureChoisie) {
      afficherErreurEnvoi('Merci de choisir une date et un horaire.');
      return;
    }

    var rdv = {
      prestation: etat.nom,
      prix: etat.prix,
      date_rdv: etat.dateChoisie,
      heure: etat.heureChoisie,
      duree: etat.duree,
      nom_cliente: elements.champNom.value.trim(),
      telephone: normaliserTelephone(elements.champTelephone.value),
      statut: 'en_attente'
    };

    etat.envoiEnCours = true;
    elements.erreurEnvoi.hidden = true;
    elements.boutonConfirmer.disabled = true;
    elements.boutonConfirmer.textContent = 'Enregistrement…';

    enregistrerReservation(rdv)
      .then(function (lignes) {
        etat.envoiEnCours = false;
        etat.nomCliente = rdv.nom_cliente;
        etat.reservationId = lignes && lignes[0] ? lignes[0].id : null;

        // Notification de l'esthéticienne : lancée ici, jamais attendue.
        notifierCabinet(rdv);

        allerAuPaiement();
      })
      .catch(function (erreur) {
        etat.envoiEnCours = false;
        console.error('MaderoShape — enregistrement du rendez-vous impossible :', erreur);
        elements.boutonConfirmer.disabled = false;
        elements.boutonConfirmer.textContent = 'Confirmer le rendez-vous';
        afficherErreurEnvoi(
          'Le rendez-vous n\'a pas pu être enregistré. Vérifiez votre connexion et réessayez.'
        );
      });
  }

  /**
   * Affiche un message d'erreur global sur le formulaire.
   * @param {string} message texte à afficher
   */
  function afficherErreurEnvoi(message) {
    elements.erreurEnvoi.textContent = message;
    elements.erreurEnvoi.hidden = false;
  }

  /* ------------------------------------------------------
     2.12 Étape 4 : confirmation et règlement de l'acompte

     Aucun paiement n'est encaissé par le site. On affiche deux
     moyens de règlement manuels ; la réservation reste en
     « en_attente » jusqu'à ce que l'esthéticienne constate le
     paiement et confirme depuis le dashboard Supabase.
     ------------------------------------------------------ */

  /**
   * Construit le lien PayPal.me à ouvrir, ou une chaîne vide si le
   * lien n'a pas été renseigné dans config.js.
   * @returns {string} URL PayPal.me, ou chaîne vide
   */
  function lienPaypalMe() {
    var lien = String(reglage('paypalMeUrl') || '').trim();

    if (!lien || lien.indexOf('http') !== 0 || lien.indexOf(MARQUEUR_NON_RENSEIGNE) !== -1) {
      return '';
    }
    return lien;
  }

  /**
   * Numéro Wero du cabinet.
   * @returns {string} numéro tel qu'il doit être affiché
   */
  function numeroWero() {
    return String(reglage('weroNumero') || reglage('weroTelephone') || '').trim();
  }

  /**
   * Renseigne le bloc PayPal.me, ou le neutralise s'il n'est pas configuré.
   */
  function preparerPaypalMe() {
    var lien = lienPaypalMe();

    elements.paypalMontant.textContent = acompteAffiche();
    elements.paypalMontantInstruction.textContent = acompteAffiche();

    if (lien) {
      elements.lienPaypal.href = lien;
      elements.lienPaypal.removeAttribute('aria-disabled');
      elements.lienPaypal.classList.remove('lien-paiement--inactif');
      elements.blocPaypal.hidden = false;
      return;
    }

    // Sans lien configuré, mieux vaut masquer le bloc que proposer
    // un bouton qui mènerait à une page d'erreur PayPal.
    elements.blocPaypal.hidden = true;
    console.warn(
      'MaderoShape — lien PayPal.me absent. Renseignez paypalMeUrl dans ' +
      'js/config.js pour proposer le règlement par PayPal.'
    );
  }

  /**
   * Renseigne le bloc Wero.
   */
  function preparerWero() {
    var numero = numeroWero();

    elements.weroMontant.textContent = acompteAffiche();
    elements.weroMontantTexte.textContent = acompteAffiche();
    elements.weroNumero.textContent = numero || '—';
    elements.weroNumero.href = 'tel:' + numero.replace(/[^\d+]/g, '');
  }

  /**
   * Remplit et affiche l'écran de confirmation.
   */
  function allerAuPaiement() {
    var date = dateDepuisCle(etat.dateChoisie);

    elements.paiementPrestation.textContent = etat.nom;
    elements.paiementDate.textContent = date ? majusculeInitiale(dateEnToutesLettres(date)) : '—';
    elements.paiementHeure.textContent = etat.heureChoisie.replace(':', 'h');
    elements.paiementNom.textContent = etat.nomCliente || '—';

    elements.acompteMontant.textContent = acompteAffiche();

    preparerPaypalMe();
    preparerWero();

    afficherEtape(4);
  }


  /* ------------------------------------------------------
     2.14 Branchement des événements
     ------------------------------------------------------ */

  // Ouverture depuis les boutons « Choisir » de la grille tarifaire.
  document.addEventListener('click', function (evenement) {
    if (!(evenement.target instanceof Element)) {
      return;
    }
    var bouton = evenement.target.closest('.btn-choisir');
    if (bouton) {
      ouvrirModale(bouton);
    }
  });

  // Fermeture : croix, fond, boutons « Fermer ».
  modale.addEventListener('click', function (evenement) {
    if (!(evenement.target instanceof Element)) {
      return;
    }
    if (evenement.target.closest('[data-fermer-modale]')) {
      fermerModale();
    }
  });

  document.addEventListener('keydown', function (evenement) {
    if (evenement.key === 'Escape' && !modale.hidden) {
      fermerModale();
    }
  });

  // Étape 1 → 2.
  elements.boutonContinuer.addEventListener('click', function () {
    afficherEtape(2);
  });

  // Boutons « Retour ».
  modale.addEventListener('click', function (evenement) {
    if (!(evenement.target instanceof Element)) {
      return;
    }
    var retour = evenement.target.closest('[data-retour]');
    if (retour) {
      afficherEtape(Number(retour.getAttribute('data-retour')));
    }
  });

  // Navigation entre les mois.
  elements.moisPrecedent.addEventListener('click', function () {
    if (estPremierMois()) {
      return;
    }
    etat.moisAffiche = new Date(
      etat.moisAffiche.getFullYear(), etat.moisAffiche.getMonth() - 1, 1
    );
    dessinerCalendrier();
  });

  elements.moisSuivant.addEventListener('click', function () {
    etat.moisAffiche = new Date(
      etat.moisAffiche.getFullYear(), etat.moisAffiche.getMonth() + 1, 1
    );
    dessinerCalendrier();
  });

  // Sélection d'un jour.
  elements.grille.addEventListener('click', function (evenement) {
    if (!(evenement.target instanceof Element)) {
      return;
    }
    var jour = evenement.target.closest('[data-jour]');
    if (!jour) {
      return;
    }

    etat.dateChoisie = jour.getAttribute('data-jour');
    etat.heureChoisie = null;

    elements.grille.querySelectorAll('.jour--choisi').forEach(function (autre) {
      autre.classList.remove('jour--choisi');
      autre.removeAttribute('aria-pressed');
    });
    jour.classList.add('jour--choisi');
    jour.setAttribute('aria-pressed', 'true');

    afficherCreneaux(etat.dateChoisie);
  });

  // Sélection d'un créneau.
  elements.zoneCreneaux.addEventListener('click', function (evenement) {
    if (!(evenement.target instanceof Element)) {
      return;
    }
    var creneau = evenement.target.closest('[data-creneau]');
    if (!creneau) {
      return;
    }

    etat.heureChoisie = creneau.getAttribute('data-creneau');
    allerAuFormulaire();
  });

  // Effacement des erreurs à la saisie.
  elements.champNom.addEventListener('input', function () {
    masquerErreur(elements.erreurNom, elements.champNom);
  });

  elements.champTelephone.addEventListener('input', function () {
    masquerErreur(elements.erreurTelephone, elements.champTelephone);
  });

  elements.formulaire.addEventListener('submit', soumettreFormulaire);

  // Notifications e-mail : actives seulement si config.js est renseigné.
  if (!initialiserEmailjs()) {
    console.warn(
      'MaderoShape — EmailJS non configuré : les notifications e-mail sont ' +
      'désactivées. Renseignez le bloc emailjs dans js/config.js pour être ' +
      'prévenu de chaque nouvelle demande de rendez-vous.'
    );
  }

  // Connexion à Supabase au chargement.
  if (!initialiserSupabase()) {
    console.warn(
      'MaderoShape — Supabase n\'est pas configuré. ' +
      'Renseignez supabaseUrl et supabaseAnonKey dans js/config.js : ' +
      'les créneaux s\'afficheront mais aucun rendez-vous ne pourra être enregistré.'
    );
  }
})();
