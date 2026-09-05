/* =========================================================
   MaderoShape — page confirmer.html
   ---------------------------------------------------------
   Traite un rendez-vous depuis les liens de l'e-mail de
   notification : ?id=<UUID>&action=confirmer|annuler

   La page ne lit jamais la table reservations. Elle appelle la
   fonction confirmer_reservation, qui fait la modification côté
   serveur et ne renvoie qu'un mot d'état — aucun nom, aucun
   numéro de téléphone ne transite par le navigateur.
   ========================================================= */

(function () {
  'use strict';

  /* ------------------------------------------------------
     1. Configuration
     ------------------------------------------------------ */

  var MARQUEUR_NON_RENSEIGNE = 'REMPLACER';

  /**
   * Récupère l'objet CONFIG défini par js/config.js.
   * `const CONFIG` n'étant pas une propriété de window, on passe
   * par typeof plutôt que par window.CONFIG.
   * @returns {Object} configuration, ou objet vide
   */
  function configuration() {
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG) {
        return CONFIG;
      }
    } catch (erreur) {
      // config.js absent : une erreur lisible est affichée plus bas.
    }
    return window.CONFIG || {};
  }

  var config = configuration();


  /* ------------------------------------------------------
     2. Affichage
     ------------------------------------------------------ */

  var elements = {
    fiche: document.querySelector('.fiche-etat'),
    icone: document.getElementById('etat-icone'),
    titre: document.getElementById('etat-titre'),
    texte: document.getElementById('etat-texte'),
    detail: document.getElementById('etat-detail'),
    retour: document.querySelector('.fiche-etat__retour')
  };

  // Les cinq réponses possibles de confirmer_reservation, plus le
  // cas d'une base injoignable.
  var ETATS = {
    confirme: {
      icone: '✅',
      titre: 'Rendez-vous confirmé !',
      texte: 'La cliente sera contactée.',
      style: 'succes'
    },
    annule: {
      icone: '❌',
      titre: 'Rendez-vous annulé.',
      texte: 'Le créneau est de nouveau disponible.',
      style: 'annule'
    },
    deja_traite: {
      icone: '⚠️',
      titre: 'Ce rendez-vous a déjà été traité.',
      texte: 'Son statut avait déjà changé : aucune modification n\'a été faite. ' +
        'Vous pouvez le vérifier dans le tableau de bord Supabase.',
      style: 'neutre'
    },
    introuvable: {
      icone: '⚠️',
      titre: 'Ce rendez-vous n\'existe pas.',
      texte: 'Le lien est peut-être incomplet, ou la réservation a été ' +
        'supprimée du tableau de bord.',
      style: 'neutre'
    },
    action_invalide: {
      icone: '⚠️',
      titre: 'Lien incorrect.',
      texte: 'Ce lien ne correspond ni à une confirmation ni à une annulation. ' +
        'Ouvrez-le depuis l\'e-mail de notification.',
      style: 'neutre'
    },
    erreur: {
      icone: '⚠️',
      titre: 'Le rendez-vous n\'a pas pu être traité.',
      texte: 'Vérifiez votre connexion et réessayez. Vous pouvez aussi changer ' +
        'le statut à la main dans le tableau de bord Supabase.',
      style: 'erreur'
    }
  };

  /**
   * Affiche l'un des états de la page.
   * @param {string} cle clé dans ETATS
   * @param {string} [detail] précision technique optionnelle
   */
  function afficher(cle, detail) {
    var etat = ETATS[cle] || ETATS.erreur;

    elements.icone.textContent = etat.icone;
    elements.titre.textContent = etat.titre;
    elements.texte.textContent = etat.texte;
    elements.fiche.className = 'fiche-etat fiche-etat--' + etat.style;

    if (detail) {
      elements.detail.textContent = detail;
      elements.detail.hidden = false;
    } else {
      elements.detail.hidden = true;
    }
  }


  /* ------------------------------------------------------
     3. Lien « Retour au site »
     ------------------------------------------------------ */

  var adresseSite = String(config.siteUrl || '').trim().replace(/\/+$/, '');

  if (elements.retour && adresseSite && adresseSite.indexOf('http') === 0) {
    elements.retour.href = adresseSite + '/index.html';
  }
  // Sinon on garde le lien relatif "index.html" écrit dans le HTML,
  // qui fonctionne aussi bien en local.


  /* ------------------------------------------------------
     4. Lecture des paramètres de l'URL
     ------------------------------------------------------ */

  var parametres = new URLSearchParams(window.location.search);
  var identifiant = (parametres.get('id') || '').trim();
  var action = (parametres.get('action') || '').trim();

  var FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (action !== 'confirmer' && action !== 'annuler') {
    afficher('action_invalide');
    return;
  }

  if (!FORMAT_UUID.test(identifiant)) {
    // Lien tronqué ou recopié à la main. Inutile d'appeler la base :
    // un identifiant mal formé y provoquerait une erreur de conversion.
    afficher('introuvable');
    return;
  }


  /* ------------------------------------------------------
     5. Appel de la base
     ------------------------------------------------------ */

  var url = String(config.supabaseUrl || '').trim();
  var cle = String(config.supabaseAnonKey || '').trim();

  var configure = url.indexOf('http') === 0 &&
    url.indexOf(MARQUEUR_NON_RENSEIGNE) === -1 &&
    cle.length > 20 &&
    cle.indexOf(MARQUEUR_NON_RENSEIGNE) !== 0;

  if (!configure || !window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error(
      'MaderoShape — connexion à la base impossible : vérifiez supabaseUrl ' +
      'et supabaseAnonKey dans js/config.js.'
    );
    afficher('erreur', 'La connexion à la base de réservations n\'est pas configurée.');
    return;
  }

  window.supabase
    .createClient(url, cle)
    .rpc('confirmer_reservation', { p_id: identifiant, p_action: action })
    .then(function (reponse) {
      if (reponse.error) {
        throw reponse.error;
      }

      // Réponses attendues : confirme, annule, deja_traite,
      // introuvable, action_invalide.
      afficher(ETATS[reponse.data] ? reponse.data : 'erreur');
    })
    .catch(function (erreur) {
      console.error('MaderoShape — traitement du rendez-vous impossible :', erreur);
      afficher('erreur');
    });
})();
