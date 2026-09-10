/**
 * KEYZz — moteur du simulateur.
 *
 * La page est un export pen.dev : tout le rendu est déjà là, en dur, aux
 * valeurs de la maquette. Ce fichier ne crée aucun élément de mise en page, il
 * réécrit ceux qui existent. Chaque nœud est retrouvé par son `data-name`, et
 * les états visuels (option choisie, formule recommandée) sont relevés dans le
 * DOM au chargement plutôt qu'écrits ici : si la maquette change de couleurs,
 * le script suit sans être touché.
 *
 * Le modèle est celui de la maquette, retrouvé à partir de ses propres
 * chiffres : 2 000 × 6 = 12 000 participants, 33 % de scan, 95 % de landing,
 * 80 % de claim = 3 010 KEYZz réclamées ; 3 KEYZz émises par événement, soit
 * 18 sur la saison, d'où Pro à 6 900 + 3 × 550 = 8 550 € et 2,84 € le contact,
 * 17 fois moins que les 48,15 € du média payant.
 */
(function () {
  'use strict';

  var card = document.querySelector('[data-name="Carte calculateur"]');
  var list = document.querySelector('[data-name="Classement formules"]');
  if (!card || !list) return;

  /* ------------------------------------------------------------------ */
  /* Grille S2 2026 — mêmes chiffres que pricing.html                    */
  /* ------------------------------------------------------------------ */
  var EXTRA = 550; /* la KEYZz émise au-delà du quota */
  var PLANS = [
    { key: 'Starter', node: 'Formule Starter', base: 390, included: 0 },
    { key: 'Pro', node: 'Formule Pro', base: 6900, included: 15 },
    { key: 'Business', node: 'Formule Business', base: 12900, included: 80 }
  ];

  /* Une campagne ouvre trois KEYZz : le lancement, la relance, le prolongement.
     C'est ce que compte la maquette (6 événements → 18 KEYZz émises). */
  var KEYZZ_PAR_EVENEMENT = 3;

  /* Coût d'acquisition d'un nouveau client, médiane lifestyle 2025
     (Triple Whale) : c'est le « média payant » de l'indicateur. */
  var MEDIA_PAYANT = 48.15;

  /* Ce qui vous est reversé sur une KEYZz payante, avant TVA. */
  var REVERSEMENT = 0.8;
  var TVA = 1.2;

  /* Taux par profil de public et par niveau d'engagement. « Réaliste » reprend
     les planchers documentés (billetterie 33/95/80, ouvert 6/90/66) ; les deux
     autres colonnes sont des paliers de part et d'autre. */
  var TAUX = {
    billetterie: {
      prudent: { scan: 20, landing: 92, claim: 70 },
      realiste: { scan: 33, landing: 95, claim: 80 },
      ambitieux: { scan: 50, landing: 97, claim: 88 }
    },
    ouvert: {
      prudent: { scan: 4, landing: 88, claim: 55 },
      realiste: { scan: 6, landing: 90, claim: 66 },
      ambitieux: { scan: 12, landing: 95, claim: 78 }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Accès au DOM exporté                                                */
  /* ------------------------------------------------------------------ */
  function q(name, ctx) {
    return (ctx || document).querySelector('[data-name="' + name + '"]');
  }
  function qq(name, ctx) {
    return [].slice.call((ctx || document).querySelectorAll('[data-name="' + name + '"]'));
  }
  function kids(el, name) {
    return [].slice.call(el.children).filter(function (c) {
      return c.getAttribute('data-name') === name;
    });
  }
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  /* ------------------------------------------------------------------ */
  /* Formats                                                             */
  /* ------------------------------------------------------------------ */
  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Intl sépare les milliers par une espace fine, presque invisible en Space
     Grotesk : on la remplace par une insécable normale. */
  function sp(s) {
    return String(s).replace(/ /g, ' ');
  }
  function num(n) {
    return sp(nf.format(Math.round(n)));
  }
  function eur(n) {
    return num(n) + ' €';
  }
  /* sous 100 €, deux décimales : 2,84 € ne peut pas s'arrondir à 3 € */
  function eurFin(n) {
    return sp(Math.abs(n) < 100 ? nf2.format(n) : nf.format(Math.round(n))) + ' €';
  }
  function pct(n) {
    return Math.round(n) + ' %';
  }

  /* ------------------------------------------------------------------ */
  /* État                                                                */
  /* ------------------------------------------------------------------ */
  var state = {
    audience: 2000,
    events: 6,
    profil: 'billetterie',
    engagement: 'realiste',
    scan: 33,
    landing: 95,
    claim: 80,
    prixKeyzz: 15
  };

  function applyTaux() {
    var t = TAUX[state.profil][state.engagement];
    state.scan = t.scan;
    state.landing = t.landing;
    state.claim = t.claim;
  }

  function compute() {
    var participants = state.audience * state.events;
    var scans = participants * (state.scan / 100);
    var pages = scans * (state.landing / 100);
    var contacts = Math.round(pages * (state.claim / 100));
    var keyzz = state.events * KEYZZ_PAR_EVENEMENT;

    var ranked = PLANS.map(function (p) {
      var cost = p.base + EXTRA * Math.max(0, keyzz - p.included);
      return { plan: p, cost: cost, perContact: contacts > 0 ? cost / contacts : null };
    }).sort(function (a, b) {
      return a.cost - b.cost;
    });

    var revenu = (contacts * state.prixKeyzz * REVERSEMENT) / TVA;

    return {
      participants: participants,
      scans: scans,
      pages: pages,
      contacts: contacts,
      part: participants > 0 ? (contacts / participants) * 100 : 0,
      keyzz: keyzz,
      ranked: ranked,
      best: ranked[0],
      revenu: revenu
    };
  }

  /* ------------------------------------------------------------------ */
  /* Champs modifiables — l'élément exporté devient éditable sur place,   */
  /* sans qu'aucun pixel ne bouge tant qu'on n'y touche pas.             */
  /* ------------------------------------------------------------------ */
  function editable(el, opts) {
    if (!el) return;
    /* plaintext-only évite qu'un collage amène du balisage ; les navigateurs
       qui ne le connaissent pas retombent sur l'édition normale, et le champ
       est de toute façon réécrit en texte pur au premier rendu qui suit. */
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('role', 'textbox');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', opts.label);
    el.style.cursor = 'text';
    el.style.outline = 'none';

    function commit() {
      var raw = el.textContent.replace(/[^\d]/g, '');
      var v = parseInt(raw, 10);
      if (isNaN(v)) v = opts.fallback;
      v = Math.max(opts.min, Math.min(opts.max, v));
      opts.set(v);
      render();
    }

    /* pendant la frappe on ne repeint pas le champ lui-même : le curseur
       sauterait à chaque caractère. Le reste de la page suit en direct. */
    el.addEventListener('input', function () {
      var raw = el.textContent.replace(/[^\d]/g, '');
      if (raw === '') return;
      var v = Math.max(opts.min, Math.min(opts.max, parseInt(raw, 10)));
      opts.set(v);
      render(el);
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text') || '';
      document.execCommand('insertText', false, text.replace(/[^\d]/g, ''));
    });
    el.addEventListener('blur', commit);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        el.blur();
      }
    });
    el.addEventListener('focus', function () {
      var r = document.createRange();
      r.selectNodeContents(el);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sélecteurs segmentés : on relève dans l'export le style de l'option  */
  /* choisie et celui des autres, puis on ne fait que les échanger.       */
  /* ------------------------------------------------------------------ */
  function wireSelector(rootEl, map, get, set) {
    if (!rootEl) return function () {};
    var options = [].slice.call(rootEl.children);
    var on = null,
      off = null;
    options.forEach(function (o) {
      var bg = o.style.backgroundColor.replace(/\s/g, '');
      var txt = q('Texte', o);
      var style = { bg: o.style.backgroundColor, color: txt ? txt.style.color : '' };
      if (bg === 'rgb(255,255,255)' || bg === '#fff' || bg === '#ffffff') on = on || style;
      else off = off || style;
      o.style.cursor = 'pointer';
      o.setAttribute('role', 'radio');
      o.setAttribute('tabindex', '0');
      o.addEventListener('click', function () {
        set(map[o.getAttribute('data-name')]);
        render();
      });
      o.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          o.click();
        }
      });
    });
    rootEl.setAttribute('role', 'radiogroup');

    return function paint() {
      options.forEach(function (o) {
        var chosen = map[o.getAttribute('data-name')] === get();
        var style = chosen ? on : off;
        if (!style) return;
        o.style.backgroundColor = style.bg;
        var txt = q('Texte', o);
        if (txt) txt.style.color = style.color;
        o.setAttribute('aria-checked', chosen ? 'true' : 'false');
      });
    };
  }

  /* ------------------------------------------------------------------ */
  /* Repérage des nœuds                                                  */
  /* ------------------------------------------------------------------ */
  var entrees = q('Entrées', card);
  var jauge = q('Valeur', q('Champ', q('Jauge', entrees)));
  var rythme = q('Valeur', q('Champ', q('Rythme', entrees)));

  var recu = q('Reçu du calcul', card);
  var lignes = {
    participants: q('Ligne Participants sur la saison', recu),
    scan: q('Ligne Taux de scan', recu),
    landing: q('Ligne Taux de landing', recu),
    claim: q('Ligne Taux de claim', recu)
  };

  var resultat = q('Résultat', card);
  var chipPart = q('Texte', q('Chip part', q('Haut', resultat)));
  var grosChiffre = q('Valeur', q('Ligne chiffre', resultat));

  var indics = q('Indicateurs', card);
  var indicContact = q('Indicateur par contact identifié', indics);
  var indicFormule = q('Indicateur Formule Pro, par an', indics);
  var indicRevenu = q('Indicateur de revenu net, KEYZz à 15 €', indics);

  var titreReco = q('Titre', q('En-tête', q('Section comparaison')));
  var piedListe = q('Pied de liste', list);

  /* ------------------------------------------------------------------ */
  /* Lignes du classement : chaque formule reçoit les mêmes emplacements  */
  /* que la mieux dotée de l'export, pour pouvoir prendre sa place.       */
  /* ------------------------------------------------------------------ */
  var proRow = q('Formule Pro', list);
  var starterRow = q('Formule Starter', list);
  var businessRow = q('Formule Business', list);

  var WIN = {
    row: { bg: proRow.style.backgroundColor, outline: proRow.style.outline },
    rang: q('Rang', proRow).style.backgroundColor,
    numero: q('Numéro', q('Rang', proRow)).style.color,
    palier: q('Palier', proRow).style.backgroundColor,
    palierTexte: q('Texte', q('Palier', proRow)).style.color,
    cout: q('Coût', q('Valeur', proRow)).style.color
  };
  var LOSE = {
    row: { bg: starterRow.style.backgroundColor, outline: starterRow.style.outline },
    rang: q('Rang', starterRow).style.backgroundColor,
    numero: q('Numéro', q('Rang', starterRow)).style.color,
    palier: q('Palier', starterRow).style.backgroundColor,
    palierTexte: q('Texte', q('Palier', starterRow)).style.color,
    cout: q('Coût', q('Valeur', starterRow)).style.color
  };

  var chipChoisi = q('Chip', q('Nom', q('Identité', proRow)));
  var chipEco = q('Chip économie', q('Identité', proRow));
  var alerteModele = q('Alerte', q('Composition', businessRow));

  var rows = {};
  PLANS.forEach(function (p) {
    var row = q(p.node, list);
    var identite = q('Identité', row);
    var nomBloc = q('Nom', identite);
    var comp = q('Composition', row);

    /* chaque ligne reçoit sa propre copie des deux pastilles et de l'alerte */
    var chip = kids(nomBloc, 'Chip')[0];
    if (!chip) {
      chip = chipChoisi.cloneNode(true);
      nomBloc.appendChild(chip);
    }
    var eco = kids(identite, 'Chip économie')[0];
    if (!eco) {
      eco = chipEco.cloneNode(true);
      identite.appendChild(eco);
    }
    var segs = kids(comp, 'Segment');
    var alerte = kids(comp, 'Alerte')[0];
    if (!alerte) {
      alerte = alerteModele.cloneNode(true);
      comp.appendChild(alerte);
    }
    /* Business n'a que deux segments simples : le troisième est reconstruit
       depuis le deuxième pour que toutes les lignes aient la même charpente */
    if (segs.length < 3) {
      var extra = segs[segs.length - 1].cloneNode(true);
      comp.insertBefore(extra, alerte);
      segs.push(extra);
    }

    rows[p.key] = {
      plan: p,
      el: row,
      rang: q('Rang', row),
      numero: q('Numéro', q('Rang', row)),
      nom: kids(nomBloc, 'Nom')[0],
      palier: q('Palier', row),
      palierTexte: q('Texte', q('Palier', row)),
      chip: chip,
      eco: eco,
      ecoTexte: q('Texte', eco),
      segs: segs,
      alerte: alerte,
      alerteTexte: q('Segment', alerte),
      cout: q('Coût', q('Valeur', row)),
      total: q('Total', q('Valeur', row))
    };
  });

  /* ------------------------------------------------------------------ */
  /* Câblage                                                             */
  /* ------------------------------------------------------------------ */
  editable(jauge, {
    label: 'Participants par événement',
    min: 0,
    max: 500000,
    fallback: 2000,
    set: function (v) {
      state.audience = v;
    }
  });
  editable(rythme, {
    label: 'Événements sur douze mois',
    min: 1,
    max: 365,
    fallback: 6,
    set: function (v) {
      state.events = v;
    }
  });

  var taux = {};
  ['scan', 'landing', 'claim'].forEach(function (k) {
    var ligne = lignes[k];
    var chip = q('Taux', q('Libellé', ligne));
    var valeur = q('Valeur', chip);
    chip.style.cursor = 'text';
    chip.addEventListener('click', function () {
      valeur.focus();
    });
    editable(valeur, {
      label: 'Taux de ' + k,
      min: 0,
      max: 100,
      fallback: state[k],
      set: function (v) {
        state[k] = v;
      }
    });
    taux[k] = valeur;
  });

  /* le prix de la KEYZz vit dans la phrase de l'indicateur : on isole le
     nombre dans son propre nœud pour le rendre modifiable sans rien déplacer */
  var libRevenu = q('Libellé', indicRevenu);
  var prixSpan = document.createElement('span');
  prixSpan.textContent = String(state.prixKeyzz);
  libRevenu.textContent = '';
  libRevenu.appendChild(document.createTextNode('de revenu net, KEYZz à '));
  libRevenu.appendChild(prixSpan);
  libRevenu.appendChild(document.createTextNode(' €'));
  editable(prixSpan, {
    label: 'Prix de la KEYZz payante',
    min: 0,
    max: 100000,
    fallback: 15,
    set: function (v) {
      state.prixKeyzz = v;
    }
  });

  var paintPublic = wireSelector(
    q('Sélecteur', q('Public', q('Profils', entrees))),
    { 'Option Billetterie': 'billetterie', 'Option Ouvert': 'ouvert' },
    function () {
      return state.profil;
    },
    function (v) {
      state.profil = v;
      applyTaux();
    }
  );

  var paintEngagement = wireSelector(
    q('Sélecteur', q('Engagement', q('Profils', entrees))),
    { 'Option Prudent': 'prudent', 'Option Réaliste': 'realiste', 'Option Ambitieux': 'ambitieux' },
    function () {
      return state.engagement;
    },
    function (v) {
      state.engagement = v;
      applyTaux();
    }
  );

  /* Le bouton de la carte descend vers la prise de rendez-vous, en bas de
     page ; le lien du classement renvoie à la grille complète. */
  var cta = q('CTA démo', q('Pied de carte', card));
  var sectionDemo = q('Section CTA démo');
  if (cta && sectionDemo) {
    cta.style.cursor = 'pointer';
    cta.setAttribute('role', 'button');
    cta.setAttribute('tabindex', '0');
    var goDemo = function () {
      sectionDemo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    cta.addEventListener('click', goDemo);
    cta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goDemo();
      }
    });
  }
  var lienGrille = q('Lien', piedListe);
  if (lienGrille && lienGrille.parentNode) {
    var a = document.createElement('a');
    a.className = 'kz-link';
    a.href = 'pricing.html';
    lienGrille.parentNode.insertBefore(a, lienGrille);
    a.appendChild(lienGrille);
    lienGrille.style.cursor = 'pointer';
  }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                               */
  /* ------------------------------------------------------------------ */
  /* la colonne de droite, pas la pastille de taux : les deux portent le nom
     « Valeur » et la pastille vient en premier dans le document */
  function renderLigne(ligne, valeur, unite) {
    var v = kids(ligne, 'Valeur')[0];
    if (!v) return;
    setText(q('Chiffre', v), num(valeur));
    setText(q('Unité', v), unite);
  }

  function render(skip) {
    var r = compute();

    /* — entrées — */
    if (jauge !== skip) setText(jauge, num(state.audience));
    if (rythme !== skip) setText(rythme, num(state.events));
    ['scan', 'landing', 'claim'].forEach(function (k) {
      if (taux[k] !== skip) setText(taux[k], pct(state[k]));
    });
    if (prixSpan !== skip) setText(prixSpan, num(state.prixKeyzz));
    paintPublic();
    paintEngagement();

    /* — reçu — */
    setText(q('Détail', q('Libellé', lignes.participants)), num(state.audience) + ' × ' + num(state.events));
    renderLigne(lignes.participants, r.participants, 'participants');
    renderLigne(lignes.scan, r.scans, 'scans');
    renderLigne(lignes.landing, r.pages, 'pages chargées');
    renderLigne(lignes.claim, r.contacts, 'KEYZz réclamées');

    /* — résultat — */
    setText(chipPart, pct(r.part) + ' de votre public');
    setText(grosChiffre, num(r.contacts));

    /* — indicateurs — */
    var best = r.best;
    setText(q('Valeur', indicContact), best.perContact === null ? '—' : eurFin(best.perContact));
    var fois = best.perContact ? MEDIA_PAYANT / best.perContact : 0;
    setText(
      q('Détail', indicContact),
      best.perContact === null
        ? 'aucun contact identifié à ce réglage'
        : fois >= 1.5
          ? Math.round(fois) + '× moins qu’en média payant'
          : fois > 1
            ? 'moins cher qu’en média payant'
            : 'au-dessus du coût du média payant'
    );

    setText(q('Valeur', indicFormule), eur(best.cost) + ' HT');
    setText(q('Libellé', indicFormule), 'Formule ' + best.plan.key + ', par an');
    var reste = r.keyzz - best.plan.included;
    setText(
      q('Détail', indicFormule),
      best.plan.included === 0
        ? num(r.keyzz) + ' KEYZz à l’unité'
        : reste > 0
          ? num(best.plan.included) + ' KEYZz incluses, ' + num(reste) + ' au-delà'
          : num(best.plan.included) + ' KEYZz incluses, ' + num(-reste) + ' non utilisées'
    );

    setText(q('Valeur', indicRevenu), eur(r.revenu));

    /* — classement — */
    setText(titreReco, 'Nous vous recommandons la formule ' + best.plan.key);

    r.ranked.forEach(function (entry, i) {
      var row = rows[entry.plan.key];
      var winner = i === 0;
      var s = winner ? WIN : LOSE;

      list.insertBefore(row.el, piedListe);
      row.el.style.backgroundColor = s.row.bg;
      row.el.style.outline = s.row.outline;
      row.rang.style.backgroundColor = s.rang;
      row.numero.style.color = s.numero;
      setText(row.numero, '0' + (i + 1));
      row.palier.style.backgroundColor = s.palier;
      row.palierTexte.style.color = s.palierTexte;
      row.cout.style.color = s.cout;
      row.chip.style.display = winner ? '' : 'none';

      /* composition : abonnement · quota · dépassement ou reliquat */
      var inclus = entry.plan.included;
      var over = r.keyzz - inclus;
      setText(row.segs[0], eur(entry.plan.base) + ' d’abonnement');
      setText(row.segs[1], inclus === 0 ? num(r.keyzz) + ' KEYZz à l’unité' : num(inclus) + ' KEYZz incluses');
      if (inclus === 0) {
        setText(row.segs[2], eur(EXTRA) + ' chacune');
        row.segs[2].style.display = '';
        row.alerte.style.display = 'none';
      } else if (over > 0) {
        setText(row.segs[2], num(over) + ' KEYZz à ' + eur(EXTRA));
        row.segs[2].style.display = '';
        row.alerte.style.display = 'none';
      } else {
        setText(row.alerteTexte, num(-over) + ' non utilisée' + (-over > 1 ? 's' : ''));
        row.segs[2].style.display = 'none';
        row.alerte.style.display = '';
      }

      /* économie : uniquement sur la gagnante, face à la deuxième */
      if (winner && r.ranked.length > 1) {
        var second = r.ranked[1];
        var ecart = second.cost - entry.cost;
        row.eco.style.display = ecart > 0 ? '' : 'none';
        if (ecart > 0) setText(row.ecoTexte, 'Économisez ' + eur(ecart) + ' par rapport à ' + second.plan.key);
      } else {
        row.eco.style.display = 'none';
      }

      setText(row.cout, entry.perContact === null ? '—' : eurFin(entry.perContact));
      setText(row.total, eur(entry.cost) + ' HT / an');
    });
  }

  render();
})();
