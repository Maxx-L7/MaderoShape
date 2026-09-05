/* FICHIER TEMPORAIRE DE TEST — à supprimer.
   confirmer.html : ?etat=confirme|annule|deja_traite|introuvable|erreur */
(function () {
  window.__stub = { rpc: [], envois: [], occupes: {} };

  CONFIG.supabaseUrl = 'https://stub.supabase.test';
  CONFIG.supabaseAnonKey = 'cle-anon-factice-pour-les-tests-locaux-000';
  CONFIG.siteUrl = 'https://maxx-l7.github.io/MaderoShape';
  CONFIG.emailjs = {
    serviceId: 'service_factice',
    templateId: 'template_factice',
    publicKey: 'cle_publique_factice'
  };

  var force = new URLSearchParams(location.search).get('etat');

  window.emailjs = {
    init: function () {},
    send: function (serviceId, templateId, parametres) {
      window.__stub.envois.push({ parametres: parametres });
      return Promise.resolve({ status: 200 });
    }
  };

  window.supabase = {
    createClient: function () {
      return {
        rpc: function (nom, params) {
          window.__stub.rpc.push({ nom: nom, params: params });

          if (nom === 'creneaux_occupes') {
            return Promise.resolve({ data: window.__stub.occupes[params.jour] || [], error: null });
          }

          if (nom === 'inserer_reservation') {
            return Promise.resolve({ data: '7b1e4c2a-9f30-4d61-b8a5-2c6e01f4ad93', error: null });
          }

          if (nom === 'confirmer_reservation') {
            if (force === 'erreur') {
              return Promise.resolve({ data: null, error: new Error('rpc indisponible (simulé)') });
            }
            return Promise.resolve({ data: force || 'deja_traite', error: null });
          }

          return Promise.resolve({ data: null, error: new Error('fonction inconnue') });
        }
      };
    }
  };
})();
