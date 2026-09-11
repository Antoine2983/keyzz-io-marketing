/**
 * KEYZz — les champs e-mail deviennent de vrais formulaires.
 *
 * L'export pen.dev dessine le champ : une pilule contenant une icône et un
 * texte « Votre e-mail professionnel ». Ce fichier remplace ce texte par un
 * véritable <input type="email"> qui hérite de sa typographie, et câble le
 * bouton voisin : validation, états d'erreur et de succès, touche Entrée.
 *
 * Faute de serveur, l'envoi passe par le client mail du visiteur, pré-rempli
 * (son adresse, la page d'origine, et son estimation s'il vient du
 * simulateur). Pour poster vers un service de formulaire à la place, il n'y a
 * qu'ENDPOINT à renseigner ci-dessous.
 */
(function () {
  'use strict';

  var DESTINATAIRE = 'richard@recallby.com';
  var ENDPOINT = null; /* ex. 'https://formspree.io/f/xxxx' — sinon client mail */

  var captures = [].slice.call(document.querySelectorAll('[data-name="Capture démo"]'));
  if (!captures.length) return;

  function q(name, ctx) {
    return ctx.querySelector('[data-name="' + name + '"]');
  }

  /* Assez souple pour ne pas rejeter une adresse valable, assez strict pour
     attraper les fautes de frappe courantes. */
  function valide(v) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
  }

  function contexte() {
    var recap = document.getElementById('sim-recap');
    var lignes = ['Page : ' + location.pathname];
    /* le simulateur, s'il tourne sur cette page, joint son estimation */
    var reco = document.querySelector('[data-name="Section comparaison"] [data-name="En-tête"] [data-name="Titre"]');
    var contacts = document.querySelector('[data-name="Résultat"] [data-name="Ligne chiffre"] [data-name="Valeur"]');
    if (contacts) lignes.push('Contacts identifiés estimés : ' + contacts.textContent.trim());
    if (reco) lignes.push(reco.textContent.trim());
    if (recap && recap.textContent.trim()) lignes.push(recap.textContent.trim());
    return lignes.join('\n');
  }

  captures.forEach(function (cap) {
    var champ = q('Champ e-mail', cap);
    var bouton = q('Bouton', cap);
    var placeholder = champ && q('Placeholder', champ);
    if (!champ || !bouton || !placeholder) return;

    /* l'input reprend la typographie du texte qu'il remplace */
    var cs = getComputedStyle(placeholder);
    var input = document.createElement('input');
    input.type = 'email';
    input.className = 'kz-input';
    input.name = 'email';
    input.autocomplete = 'email';
    input.placeholder = placeholder.textContent.trim();
    input.setAttribute('aria-label', placeholder.textContent.trim());
    input.style.fontFamily = cs.fontFamily;
    input.style.fontSize = cs.fontSize;
    input.style.fontWeight = cs.fontWeight;
    input.style.letterSpacing = cs.letterSpacing;
    placeholder.parentNode.replaceChild(input, placeholder);

    /* le message vit sous la pilule, sans en changer la géométrie */
    var msg = document.createElement('p');
    msg.className = 'kz-form-msg';
    msg.setAttribute('role', 'status');
    msg.hidden = true;
    cap.parentNode.insertBefore(msg, cap.nextSibling);

    var envoye = false;

    function dire(texte, type) {
      msg.textContent = texte;
      msg.className = 'kz-form-msg is-' + type;
      msg.hidden = false;
      cap.classList.toggle('kz-form-error', type === 'error');
    }

    function envoyer() {
      var v = input.value.trim();
      if (!valide(v)) {
        dire(v ? 'Cette adresse ne semble pas valide.' : 'Indiquez votre e-mail professionnel.', 'error');
        input.focus();
        return;
      }
      cap.classList.remove('kz-form-error');

      if (ENDPOINT) {
        dire('Envoi…', 'pending');
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email: v, contexte: contexte() })
        }).then(
          function () {
            dire('Merci. Richard vous répond sous 24 h ouvrées.', 'ok');
            input.value = '';
          },
          function () {
            dire('L’envoi a échoué. Écrivez-nous à ' + DESTINATAIRE + '.', 'error');
          }
        );
        return;
      }

      /* pas de serveur : on ouvre le client mail, pré-rempli */
      var sujet = 'Demande de démo KEYZz';
      var corps = 'Bonjour,\n\nJe souhaite une démo de KEYZz.\n\nMon e-mail : ' + v + '\n' + contexte() + '\n';
      window.location.href =
        'mailto:' + DESTINATAIRE + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
      envoye = true;
      dire('Votre message est prêt dans votre application mail : envoyez-le et Richard vous répond sous 24 h ouvrées.', 'ok');
    }

    bouton.style.cursor = 'pointer';
    bouton.setAttribute('role', 'button');
    bouton.setAttribute('tabindex', '0');
    bouton.addEventListener('click', envoyer);
    bouton.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        envoyer();
      }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        envoyer();
      }
    });
    input.addEventListener('input', function () {
      if (!envoye && !msg.hidden) {
        msg.hidden = true;
        cap.classList.remove('kz-form-error');
      }
    });

    /* toute la pilule donne le focus au champ */
    champ.style.cursor = 'text';
    champ.addEventListener('click', function (e) {
      if (e.target !== input) input.focus();
    });
  });
})();
