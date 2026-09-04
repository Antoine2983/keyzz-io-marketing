/**
 * KEYZz — motion engine.
 *
 * Everything that moves on the site and is not a plain CSS hover lives here:
 *   - the page veil (curtain out on link click, curtain up on arrival),
 *   - the hero intro (nav, word-masked title, staggered CTAs),
 *   - scroll reveals for every section, grouped and staggered,
 *   - animated counters on the figures,
 *   - the KEYZz fan (float + pointer tilt), the exploded stack (deal-out
 *     reveal + depth parallax) and the dashboard mockup (3D tilt-in + scroll),
 *   - magnetic primary buttons, scroll progress hairline.
 *
 * The export applies every design property inline, so reveals are written as
 * inline styles too: the hidden state is stored on the element, the original
 * inline values are restored when it comes into view, and the transition is
 * removed afterwards so the CSS hover transitions in motion.css take over.
 *
 * Honors prefers-reduced-motion: nothing moves on its own, hover classes only.
 */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var stage = doc.getElementById('stage');
  if (!stage) return;

  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var t0 = performance.now();

  function $(sel, ctx) {
    return [].slice.call((ctx || doc).querySelectorAll(sel));
  }
  function N(name) {
    return '[data-name="' + name + '"]';
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  /* `.kz-link` anchors are display:contents — they have no box to animate. */
  function solid(el) {
    return el.tagName === 'A' && el.classList.contains('kz-link') ? el.firstElementChild || el : el;
  }
  function inDashboard(el) {
    return !!el.closest(N('Mockup dashboard'));
  }

  /* ------------------------------------------------------------------ */
  /* Hover classes — pure classification, no motion                      */
  /* ------------------------------------------------------------------ */
  function classify() {
    $('[data-name^="Bouton"], [data-name^="CTA "]').forEach(function (el) {
      var name = el.getAttribute('data-name');
      if (name === 'Boutons' || inDashboard(el)) return;
      var bg = (el.style.backgroundColor || '').replace(/\s/g, '').toLowerCase();
      var kind =
        bg === 'rgb(110,59,255)' || bg === '#6e3bff'
          ? 'kz-btn-primary'
          : bg === 'rgb(255,255,255)' || bg === '#fff' || bg === '#ffffff'
            ? 'kz-btn-light'
            : 'kz-btn-ghost';
      el.classList.add('kz-btn', kind);
    });

    $(N('Nav') + ' ' + N('Produit') + ', ' + N('Nav') + ' ' + N('FAQ') + ', ' + N('Nav') + ' ' + N('Connexion')).forEach(function (el) {
      el.classList.add('kz-nav-link');
    });
    $(N('Colonnes') + ' > * > *:not(' + N('Titre') + ')').forEach(function (el) {
      el.classList.add('kz-nav-link');
    });

    var dark = [
      '[data-name^="Témoignage"]',
      N('Mosaïque') + ' > [data-name]:not(' + N('Colonne') + ')',
      N('Mosaïque') + ' ' + N('Colonne') + ' > [data-name]',
      '[data-name^="Plan "]',
      N('Bandeau Enterprise'),
      N('Encart estimation')
    ];
    $(dark.join(', ')).forEach(function (el) {
      el.classList.add('kz-card', 'kz-card--dark');
    });
    $(N('FAQ tarifs') + ' ' + N('Rangée') + ' > *').forEach(function (el) {
      el.classList.add('kz-card', 'kz-card--light');
    });
    $(N('Carte pack')).forEach(function (el) {
      el.classList.add('kz-card', 'kz-card--violet');
    });

    markCurrent();
  }

  /* The nav link pointing at the page we are on stays white. */
  function markCurrent() {
    var nav = doc.querySelector(N('Nav'));
    if (!nav) return;
    var here = location.pathname.replace(/\/(index\.html)?$/, '/index.html');
    $('a[href]', nav).forEach(function (a) {
      var link = a.querySelector('.kz-nav-link');
      if (!link || a.host !== location.host) return;
      if (a.pathname.replace(/\/(index\.html)?$/, '/index.html') === here) link.classList.add('is-current');
    });
  }

  classify();

  /* ------------------------------------------------------------------ */
  /* Nav bar: opaque, painted with the colour of the section under it    */
  /* ------------------------------------------------------------------ */
  function rgb(color) {
    var m = String(color).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(parseFloat);
    if (p.length > 3 && p[3] < 0.9) return null; /* see-through: keep looking */
    return [p[0], p[1], p[2]];
  }

  function navTheme() {
    var bar = doc.getElementById('kz-nav');
    var canvas = stage.firstElementChild;
    if (!bar || !canvas) return;

    var page = rgb(getComputedStyle(canvas).backgroundColor) || [11, 11, 13];
    var zones = [].slice.call(canvas.children).map(function (el) {
      return { el: el, color: rgb(getComputedStyle(el).backgroundColor) || page };
    });

    var painted = '';
    function paint() {
      var edge = bar.getBoundingClientRect().height + 1;
      var c = page;
      for (var i = 0; i < zones.length; i++) {
        var r = zones[i].el.getBoundingClientRect();
        if (r.top <= edge && r.bottom > edge) {
          c = zones[i].color;
          break;
        }
      }
      var css = 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
      if (css === painted) return;
      painted = css;
      bar.style.backgroundColor = css;
      /* relative luminance decides which way the contents flip */
      bar.classList.toggle('is-light', (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.55);
    }

    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        paint();
      });
    }
    paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(schedule);
  }

  navTheme();

  if (reduced) {
    root.classList.add('kz-ready');
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Reveal primitives                                                   */
  /* ------------------------------------------------------------------ */
  function hide(el, o) {
    if (el.dataset.kzHidden) return;
    o = o || {};
    el.dataset.kzHidden = '1';
    el.dataset.kzOp = el.style.opacity || '';
    el.dataset.kzTf = el.style.transform || '';
    el.dataset.kzOrigin = el.style.transformOrigin || '';
    var t = 'translate3d(' + (o.x || 0) + 'px, ' + (o.y == null ? 36 : o.y) + 'px, 0)';
    if (o.rot) t += ' rotate(' + o.rot + 'deg)';
    if (o.rx) t += ' rotateX(' + o.rx + 'deg)';
    if (o.s != null) t += ' scale(' + o.s + ')';
    if (o.sx != null) t += ' scaleX(' + o.sx + ')';
    if (o.sy != null) t += ' scaleY(' + o.sy + ')';
    if (el.dataset.kzTf) t += ' ' + el.dataset.kzTf;
    if (o.origin) el.style.transformOrigin = o.origin;
    el.style.opacity = o.keepOpacity ? el.dataset.kzOp : '0';
    el.style.transform = t;
    el.style.willChange = 'transform, opacity';
  }

  function show(el, delay, dur, done) {
    dur = dur || 1000;
    delay = delay || 0;
    el.style.transition =
      'opacity ' + dur + 'ms ' + EASE + ' ' + delay + 'ms, transform ' + dur + 'ms ' + EASE + ' ' + delay + 'ms';
    el.style.opacity = el.dataset.kzOp;
    el.style.transform = el.dataset.kzTf;
    setTimeout(function () {
      el.style.transition = '';
      el.style.willChange = '';
      el.style.transformOrigin = el.dataset.kzOrigin;
      delete el.dataset.kzHidden;
      if (done) done(el);
    }, dur + delay + 80);
  }

  /* Word masks for the big titles. */
  function splitWords(el) {
    if (el.dataset.kzSplit) return $('.kz-w', el);
    var frag = doc.createDocumentFragment();
    [].slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType !== 3) {
        frag.appendChild(n);
        return;
      }
      n.nodeValue.split(/(\s+)/).forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) {
          frag.appendChild(doc.createTextNode(' '));
          return;
        }
        var w = doc.createElement('span');
        w.className = 'kz-w';
        var i = doc.createElement('span');
        i.textContent = p;
        w.appendChild(i);
        frag.appendChild(w);
      });
    });
    el.textContent = '';
    el.appendChild(frag);
    el.dataset.kzSplit = '1';
    return $('.kz-w', el);
  }

  function showWords(words, delay, step) {
    words.forEach(function (w, i) {
      w.firstElementChild.style.transitionDelay = delay + i * (step || 60) + 'ms';
      w.classList.add('is-in');
    });
    return delay + words.length * (step || 60) + 1150;
  }

  function isTitle(el) {
    return el.getAttribute('data-name') === 'Titre';
  }

  /* ------------------------------------------------------------------ */
  /* Intersection plumbing                                               */
  /* ------------------------------------------------------------------ */
  var pending = [];
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        fire(e.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0 }
  );

  function fire(trigger) {
    for (var i = pending.length - 1; i >= 0; i--) {
      if (pending[i].trigger === trigger) {
        var g = pending.splice(i, 1)[0];
        g.run();
      }
    }
  }

  function watch(trigger, run) {
    pending.push({ trigger: trigger, run: run });
    io.observe(trigger);
  }

  /* Nothing may stay hidden at the bottom of the page. */
  function flushAtBottom() {
    if (window.scrollY + window.innerHeight < doc.body.scrollHeight - 4) return;
    pending.slice().forEach(function (g) {
      io.unobserve(g.trigger);
      fire(g.trigger);
    });
  }

  /* Groups that come into view during the first second wait for the veil. */
  function loadOffset() {
    return Math.max(0, 900 - (performance.now() - t0));
  }

  /**
   * Register a staggered reveal. Elements are bucketed by parent; each bucket
   * fires when its parent (or `opts.trigger`) scrolls into view.
   */
  function group(sel, opts) {
    opts = opts || {};
    var els = $(sel).map(solid).filter(function (el) {
      return !el.dataset.kzHidden && !el.dataset.kzIntro && !inDashboard(el);
    });
    if (!els.length) return;

    var buckets = [];
    els.forEach(function (el) {
      var key = opts.trigger ? el.closest(opts.trigger) || el.parentElement : el.parentElement;
      var b = buckets.filter(function (x) {
        return x.key === key;
      })[0];
      if (!b) buckets.push((b = { key: key, els: [] }));
      b.els.push(el);
    });

    buckets.forEach(function (b) {
      var words = [];
      b.els.forEach(function (el, i) {
        if (opts.words && isTitle(el)) {
          words[i] = splitWords(el);
          return;
        }
        var o = opts.each ? opts.each(el, i, b.els) : opts;
        hide(el, o);
      });
      watch(b.key, function () {
        var base = (opts.delay || 0) + loadOffset();
        var stagger = opts.stagger || 0;
        var dur = opts.dur || 1000;
        var remaining = b.els.length;
        b.els.forEach(function (el, i) {
          var d = base + i * stagger;
          if (words[i]) {
            showWords(words[i], d, 55);
            if (--remaining === 0 && opts.done) setTimeout(opts.done, d + dur + 100);
            return;
          }
          show(el, d, dur, function () {
            if (--remaining === 0 && opts.done) opts.done(b.els);
          });
        });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Counters                                                            */
  /* ------------------------------------------------------------------ */
  function parseFigure(text) {
    var m = text.match(/^(\s*[^\d]*?)(\d[\d\s  ]*(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    var num = m[2];
    var sepM = num.match(/\d([\s  ])\d/);
    var sep = sepM ? sepM[1] : '';
    var decM = num.match(/([.,])(\d+)$/);
    var decimals = decM ? decM[2].length : 0;
    var decSep = decM ? decM[1] : ',';
    var value = parseFloat(num.replace(/[\s  ]/g, '').replace(',', '.'));
    if (isNaN(value)) return null;
    return {
      prefix: m[1],
      suffix: m[3],
      value: value,
      format: function (v) {
        var s = v.toFixed(decimals);
        var parts = s.split('.');
        if (sep) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
        return parts.length > 1 ? parts[0] + decSep + parts[1] : parts[0];
      }
    };
  }

  function counter(el, dur) {
    var raw = el.textContent;
    var f = parseFigure(raw.trim());
    if (!f || f.value === 0) return;
    /* the pricing switch rewrites this while the digits roll */
    el.dataset.kzRaw = raw;
    var start = null;
    /* lock the width so the row does not breathe while digits roll */
    el.style.minWidth = el.offsetWidth + 'px';
    el.style.display = el.style.display || 'inline-block';
    var lead = raw.match(/^\s*/)[0];
    var tail = raw.match(/\s*$/)[0];
    function frame(now) {
      if (start === null) start = now;
      var t = clamp((now - start) / (dur || 1600), 0, 1);
      var e = 1 - Math.pow(2, -10 * t);
      if (t >= 1) {
        el.textContent = el.dataset.kzRaw;
        el.style.minWidth = '';
        return;
      }
      var cur = el.dataset.kzRaw === raw ? f : parseFigure(el.dataset.kzRaw.trim()) || f;
      el.textContent = lead + cur.prefix + cur.format(cur.value * e) + cur.suffix + tail;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var counterIO = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        counterIO.unobserve(e.target);
        setTimeout(function () {
          counter(e.target, 1700);
        }, loadOffset() + 350);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 }
  );

  function counters() {
    var sel = [
      N('Gains') + ' ' + N('Valeur'),
      N('Chiffres') + ' ' + N('Valeur'),
      N('Chiffres clés') + ' ' + N('Valeur'),
      N('Stat latérale') + ' ' + N('Valeur'),
      '[data-name^="Témoignage"] ' + N('Valeur'),
      N('Montant')
    ].join(', ');
    $(sel).forEach(function (el) {
      if (inDashboard(el)) return;
      counterIO.observe(el);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Shared frame loop                                                   */
  /* ------------------------------------------------------------------ */
  var tickers = [];
  var visible = new Map();
  var visIO = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        visible.set(e.target, e.isIntersecting);
      });
    },
    { rootMargin: '120px' }
  );
  function onFrame(fn) {
    tickers.push(fn);
  }
  (function loop(now) {
    for (var i = 0; i < tickers.length; i++) tickers[i](now);
    requestAnimationFrame(loop);
  })(performance.now());

  /* ------------------------------------------------------------------ */
  /* Scroll progress                                                     */
  /* ------------------------------------------------------------------ */
  var progress = doc.createElement('div');
  progress.className = 'kz-progress';
  doc.body.appendChild(progress);
  var scrollDirty = true;
  window.addEventListener(
    'scroll',
    function () {
      scrollDirty = true;
    },
    { passive: true }
  );
  onFrame(function () {
    if (!scrollDirty) return;
    scrollDirty = false;
    var max = doc.body.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0) + ')';
    flushAtBottom();
  });

  /* ------------------------------------------------------------------ */
  /* Magnetic primary buttons                                            */
  /* ------------------------------------------------------------------ */
  if (fine) {
    $('.kz-btn-primary, .kz-btn-light').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        btn.style.setProperty('--mx', (dx * 10).toFixed(2) + 'px');
        btn.style.setProperty('--my', (dy * 8).toFixed(2) + 'px');
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.setProperty('--mx', '0px');
        btn.style.setProperty('--my', '0px');
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Audience selector: the white pill slides under the hovered tab      */
  /* ------------------------------------------------------------------ */
  function segmented(wrap, opts) {
    if (!wrap) return;
    opts = opts || {};
    var tabs = $(':scope > [data-name^="Onglet"]', wrap);
    if (tabs.length < 2) return;

    /* the export paints the selected tab white inline; the pill takes over */
    var home =
      opts.start ||
      tabs.filter(function (t) {
        var bg = (t.style.backgroundColor || '').replace(/\s/g, '').toLowerCase();
        return bg === 'rgb(255,255,255)' || bg === '#fff' || bg === '#ffffff';
      })[0] ||
      tabs[0];
    tabs.forEach(function (t) {
      t.style.backgroundColor = 'transparent';
    });

    var pill = doc.createElement('div');
    pill.className = 'kz-pill';
    wrap.insertBefore(pill, wrap.firstChild);
    wrap.classList.add('kz-seg');

    var current = home;
    function place(t, animate) {
      current = t;
      if (!animate) pill.style.transition = 'none';
      pill.style.width = t.offsetWidth + 'px';
      pill.style.height = t.offsetHeight + 'px';
      pill.style.transform = 'translate3d(' + t.offsetLeft + 'px,' + t.offsetTop + 'px,0)';
      if (!animate) {
        void pill.offsetWidth; /* flush, so the next move animates */
        pill.style.transition = '';
      }
      tabs.forEach(function (x) {
        x.classList.toggle('is-on', x === t);
      });
    }
    place(home, false);

    if (fine) {
      tabs.forEach(function (t) {
        t.addEventListener('mouseenter', function () {
          place(t, true);
        });
      });
      wrap.addEventListener('mouseleave', function () {
        place(home, true);
      });
    }
    /* a switch that drives something keeps the tab you click */
    if (opts.onSelect) {
      tabs.forEach(function (t) {
        t.addEventListener('click', function () {
          if (t === home) return;
          home = t;
          place(t, true);
          opts.onSelect(t);
        });
      });
    }
    window.addEventListener('resize', function () {
      place(current, false);
    });
    /* web fonts land after first paint and change the tab widths */
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () {
        place(current, false);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pricing: the monthly / yearly switch                                */
  /* ------------------------------------------------------------------ */
  /* Grille S2 2026 : l'annualisé vaut 10 mensualités (2 mois offerts),
     l'équivalent mensuel est l'annualisé ÷ 12. */
  var PRICES = {
    'Plan Starter': { month: '39 €', year: '390 €', perMonth: '32,50 €' },
    'Plan Pro': { month: '690 €', year: '6 900 €', perMonth: '575 €' },
    'Plan Business': { month: '1 290 €', year: '12 900 €', perMonth: '1 075 €' }
  };
  var ENTERPRISE = { month: '3 490 € HT/mois', year: '34 900 € HT/an' };

  function billing() {
    var wrap = doc.querySelector(N('Bascule période'));
    if (!wrap) return;
    var monthly = doc.querySelector(N('Onglet mensuel'));
    var yearly = doc.querySelector(N('Onglet annuel'));
    if (!monthly || !yearly) return;

    var plans = $('[data-name^="Plan "]').filter(function (p) {
      return PRICES[p.getAttribute('data-name')];
    });
    var lead = doc.querySelector(N('Bandeau Enterprise') + ' ' + N('Description'));
    var tail = lead ? lead.textContent.replace(/^[^.]*\.\s*/, '') : '';

    function write(el, text) {
      if (!el) return;
      el.textContent = text;
      /* a counter mid-roll reads this, so it lands on the new figure */
      if (el.dataset.kzRaw != null) el.dataset.kzRaw = text;
    }

    function apply(year, animate) {
      plans.forEach(function (plan) {
        var p = PRICES[plan.getAttribute('data-name')];
        write(plan.querySelector(N('Montant')), year ? p.year : p.month);
        write(plan.querySelector(N('Cale')), year ? 'HT / an' : 'HT / mois');
        write(
          plan.querySelector(N('Annuel')),
          year ? 'soit ' + p.perMonth + ' HT/mois — 2 mois offerts' : p.year + ' HT/an — 2 mois offerts'
        );
        if (!animate) return;
        var price = plan.querySelector(N('Prix'));
        if (!price) return;
        price.classList.remove('is-swap');
        void price.offsetWidth;
        price.classList.add('is-swap');
      });
      if (lead) lead.textContent = 'À partir de ' + (year ? ENTERPRISE.year : ENTERPRISE.month) + '. ' + tail;
    }

    /* the export ships the monthly figures, so that is where we start */
    apply(false, false);
    segmented(wrap, {
      start: monthly,
      onSelect: function (tab) {
        apply(tab === yearly, true);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Logos strip: one track, cloned, scrolling forever                   */
  /* ------------------------------------------------------------------ */
  var marquees = [];

  /* Runs before intro()/reveals() so their selectors see the final DOM. */
  function marqueeInit() {
    $(N('Bandeau logos')).forEach(function (band) {
      var items = [].slice.call(band.children).filter(function (el) {
        return (el.getAttribute('data-name') || '').indexOf('Fondu') !== 0;
      });
      if (items.length < 2) return;
      var view = doc.createElement('div');
      view.className = 'kz-marquee-view';
      var track = doc.createElement('div');
      track.className = 'kz-marquee-track';
      items.forEach(function (el) {
        track.appendChild(el);
      });
      view.appendChild(track);
      band.insertBefore(view, band.firstChild);
      band.classList.add('kz-marquee');
      marquees.push({ band: band, view: view, track: track });
    });
  }

  /* Clone and start, but only once the entrance reveal has let go. */
  function marqueeStart() {
    marquees.forEach(function (m) {
      watch(m.band, function () {
        (function run() {
          var busy = [].slice.call(m.track.children).some(function (el) {
            return el.dataset.kzHidden;
          });
          if (busy) return setTimeout(run, 200);
          fill(m);
          m.view.classList.add('is-running');
          window.addEventListener('resize', function () {
            if (!fill(m)) return;
            /* a new copy would start out of phase: restart the whole row */
            m.view.classList.remove('is-running');
            void m.view.offsetWidth;
            m.view.classList.add('is-running');
          });
        })();
      });
    });
  }

  /* Enough copies to cover the strip plus the one that is sliding out. */
  function fill(m) {
    var trackW = m.track.getBoundingClientRect().width;
    if (!trackW) return false;
    var need = Math.ceil(m.view.getBoundingClientRect().width / trackW) + 1;
    var added = false;
    while (m.view.children.length < need) {
      var c = m.track.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      m.view.appendChild(c);
      added = true;
    }
    /* constant speed whatever the strip is worth in pixels */
    var d = Math.max(12, trackW / 55).toFixed(2) + 's';
    [].slice.call(m.view.children).forEach(function (t) {
      t.style.animationDuration = d;
    });
    return added;
  }

  /* ------------------------------------------------------------------ */
  /* The KEYZz fan: deal-out reveal, then float + pointer tilt           */
  /* ------------------------------------------------------------------ */
  function fan() {
    var frame = doc.querySelector(N('Frame 2147223764'));
    if (!frame) return;
    var cards = $(':scope > [data-name^="KEYZz"]', frame);
    if (!cards.length) return;
    var last = cards[cards.length - 1];
    var lx = parseFloat(last.style.left) || 0, ly = parseFloat(last.style.top) || 0;
    var ready = false;

    cards.forEach(function (c, i) {
      c.dataset.kzIntro = '1';
      hide(c, {
        x: lx - (parseFloat(c.style.left) || 0) + 40,
        y: ly - (parseFloat(c.style.top) || 0) + 60,
        rot: 10 - i * 4,
        s: 0.92,
        origin: '50% 100%'
      });
    });
    watch(frame, function () {
      var base = loadOffset() + 120;
      var left = cards.length;
      cards.forEach(function (c, i) {
        show(c, base + i * 130, 1400, function () {
          if (--left === 0) ready = true;
        });
      });
    });

    visIO.observe(frame);

    /* the cards only breathe: no pointer parallax, no hover */
    onFrame(function (now) {
      if (!ready || visible.get(frame) === false) return;
      var t = now / 1000;
      cards.forEach(function (c, i) {
        var depth = (i + 1) / cards.length;
        var float = Math.sin(t * 0.8 + i * 1.9) * 5 * depth;
        c.style.transform = 'translate3d(0,' + float.toFixed(2) + 'px,0)';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* The exploded stack: layers deal out from the middle, then parallax  */
  /* ------------------------------------------------------------------ */
  function pile() {
    var frame = doc.querySelector(N('Pile éclatée'));
    if (!frame) return;
    var layers = $(':scope > [data-name^="Couche"]', frame);
    if (!layers.length) return;
    var n = layers.length;
    var cxl = 0, cyl = 0;
    layers.forEach(function (l) {
      cxl += (parseFloat(l.style.left) || 0) / n;
      cyl += (parseFloat(l.style.top) || 0) / n;
    });
    var ready = false;

    layers.forEach(function (l, i) {
      l.dataset.kzIntro = '1';
      hide(l, {
        x: cxl - (parseFloat(l.style.left) || 0),
        y: cyl - (parseFloat(l.style.top) || 0) + 40,
        s: 0.96,
        rot: (i - (n - 1) / 2) * 1.5
      });
    });
    watch(frame, function () {
      var base = loadOffset() + 100;
      var left = n;
      layers.forEach(function (l, i) {
        show(l, base + i * 110, 1500, function () {
          if (--left === 0) ready = true;
        });
      });
    });

    visIO.observe(frame);

    onFrame(function () {
      if (!ready || visible.get(frame) === false) return;
      var r = frame.getBoundingClientRect();
      var vh = window.innerHeight;
      /* -1 when the stack enters from below, +1 when it leaves at the top */
      var sp = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
      layers.forEach(function (l, i) {
        var d = i - (n - 1) / 2; /* -2.5 .. 2.5 */
        l.style.transform = 'translate3d(0,' + (-sp * d * 16).toFixed(2) + 'px,0)';
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard mockup: tilts in, and then stays put                      */
  /* ------------------------------------------------------------------ */
  function dashboard() {
    var mock = doc.querySelector(N('Mockup dashboard'));
    if (!mock) return;
    mock.dataset.kzIntro = '1';
    hide(mock, { y: 80, rx: 12, s: 0.95, origin: '50% 100%' });
    var bars = $(N('Progression'), mock);
    bars.forEach(function (b) {
      hide(b, { y: 0, sx: 0, origin: '0 50%', keepOpacity: true });
    });
    watch(mock, function () {
      var base = loadOffset();
      show(mock, base, 1500);
      bars.forEach(function (b, i) {
        show(b, base + 500 + i * 70, 1300);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Hero intro                                                          */
  /* ------------------------------------------------------------------ */
  function intro() {
    var nav = doc.querySelector(N('Nav'));
    var seq = [];

    if (nav) {
      var items = [];
      var brand = nav.querySelector(N('Marque'));
      if (brand) items.push(brand);
      $(':scope > ' + N('Liens') + ' > *, :scope > ' + N('Actions') + ' > *', nav).forEach(function (el) {
        items.push(solid(el));
      });
      items.forEach(function (el, i) {
        seq.push({ el: el, at: 260 + i * 60, o: { y: -14 }, dur: 900 });
      });
    }

    var hero = doc.querySelector(N('Hero'));
    var pricing = doc.querySelector(N('En-tête tarifs'));
    var t = 420;

    if (hero && hero.querySelector(N('Sélecteur audience'))) {
      var sel = hero.querySelector(N('Sélecteur audience'));
      var title = hero.querySelector(N('Titre'));
      var sub = hero.querySelector(N('Sous-titre'));
      var micro = hero.querySelector(N('Micro-preuve'));
      seq.push({ el: sel, at: t, o: { y: 20, s: 0.96 }, dur: 1000 });
      if (title) seq.push({ el: title, words: true, at: t + 80 });
      if (sub) seq.push({ el: sub, at: t + 520, o: { y: 26 }, dur: 1100 });
      $(N('Boutons') + ' > *', hero).forEach(function (b, i) {
        seq.push({ el: b, at: t + 680 + i * 90, o: { y: 26, s: 0.96 }, dur: 1000 });
      });
      if (micro) seq.push({ el: micro, at: t + 900, o: { y: 14 }, dur: 900 });
    } else if (pricing) {
      var eyebrow = pricing.querySelector(N('Eyebrow'));
      var ptitle = pricing.querySelector(N('Titre'));
      var psub = pricing.querySelector(N('Sous-titre'));
      if (eyebrow) seq.push({ el: eyebrow, at: t, o: { y: 16 }, dur: 900 });
      if (ptitle) seq.push({ el: ptitle, words: true, at: t + 80 });
      if (psub) seq.push({ el: psub, at: t + 500, o: { y: 26 }, dur: 1100 });
      $(N('Bandeau logos') + ' .kz-marquee-track > [data-name]', pricing).forEach(function (l, i) {
        seq.push({ el: l, at: t + 720 + i * 70, o: { y: 16 }, dur: 1000 });
      });
      $(N('Bandeau logos') + ' .kz-marquee-track > div:not([data-name])', pricing).forEach(function (l, i) {
        seq.push({ el: l, at: t + 820 + i * 70, o: { y: 0, sy: 0 }, dur: 1100 });
      });
    }

    seq.forEach(function (s) {
      s.el.dataset.kzIntro = '1';
      if (s.words) s.words = splitWords(s.el);
      else hide(s.el, s.o);
    });

    return function play() {
      seq.forEach(function (s) {
        if (s.words) showWords(s.words, s.at, 70);
        else show(s.el, s.at, s.dur);
      });
    };
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                      */
  /* ------------------------------------------------------------------ */
  function reveals() {
    /* logos strip (index; on pricing it is part of the intro): logos rise,
       the hairline separators between them grow from the centre */
    group(N('Bandeau logos') + ' .kz-marquee-track > [data-name]', { y: 16, stagger: 90, dur: 1000 });
    group(N('Bandeau logos') + ' .kz-marquee-track > div:not([data-name])', { y: 0, sy: 0, stagger: 90, delay: 120, dur: 1100 });

    /* brand pitch next to the fan */
    group(N('Hero — Pitch marque') + ' > ' + N('Titre'), { words: true });
    group(N('Hero — Pitch marque') + ' > ' + N('Description'), { y: 28, delay: 300, dur: 1100 });
    group(N('Chiffres clés') + ' > *', { y: 24, stagger: 110, delay: 450 });

    /* section headers: eyebrow, word-masked title, subtitle */
    group(N('En-tête section') + ' > *', { words: true, y: 28, stagger: 120, dur: 1100 });
    group(N('Entête + stat') + ' > ' + N('Stat latérale'), { y: 24, delay: 380 });

    /* gains */
    group(N('Gains') + ' > [data-name^="Gain"]', { y: 44, stagger: 120, dur: 1100 });
    group(N('Gains') + ' > ' + N('Filet'), { y: 0, sy: 0, origin: '50% 0', stagger: 120, delay: 250, dur: 1300 });
    group(N('Encart estimation'), { y: 44, s: 0.98, dur: 1200 });

    /* exploded stack copy */
    group(N('Colonne explication') + ' > *', { x: 28, y: 24, stagger: 150, dur: 1100 });

    /* steps */
    group(N('Étapes') + ' > *', { y: 44, stagger: 140, dur: 1100 });

    /* events mosaic */
    group(N('Mosaïque') + ' > ' + N('Concert'), { y: 56, s: 0.97, dur: 1300 });
    group(N('Mosaïque') + ' ' + N('Colonne') + ' > *', { y: 56, s: 0.97, stagger: 140, delay: 140, dur: 1300, trigger: N('Mosaïque') });

    /* testimonials, figures band */
    group(N('Témoignages') + ' > *', { y: 56, s: 0.98, stagger: 130, dur: 1200 });
    group(N('Chiffres') + ' > *', { y: 28, stagger: 90, dur: 1000 });

    /* CTA */
    group(N('Section CTA démo') + ' > *:not(' + N('Halo violet') + ')', { words: true, y: 34, stagger: 130, dur: 1100 });

    /* footer */
    group(N('Pied de page') + ' > ' + N('Haut') + ' > *', { y: 26, stagger: 120, dur: 1000 });
    group(N('Colonnes') + ' > *', { y: 22, stagger: 100, delay: 150, dur: 1000, trigger: N('Pied de page') });
    group(N('Pied de page') + ' > ' + N('Bas') + ' > *', { y: 12, stagger: 80, delay: 350, dur: 900, trigger: N('Pied de page') });

    /* pricing */
    group(N('Rangée bascule') + ' > *', { y: 22, s: 0.96, dur: 1000 });
    group(N('Grille plans') + ' > *', { y: 56, s: 0.98, stagger: 130, dur: 1300 });
    group(N('Carte pack'), { y: 44, dur: 1200 });
    group(N('Bandeau Enterprise'), { y: 44, dur: 1200 });
    group(N('Ligne Partner'), { y: 14, delay: 200, dur: 900, trigger: N('Enterprise') });
    group(N('FAQ tarifs') + ' > ' + N('Titre'), { words: true });
    group(N('FAQ tarifs') + ' ' + N('Rangée') + ' > *', { y: 36, stagger: 110, dur: 1100, trigger: N('Grille') });
  }

  /* ------------------------------------------------------------------ */
  /* Page veil & navigation                                              */
  /* ------------------------------------------------------------------ */
  var veil = doc.createElement('div');
  veil.className = 'kz-veil';
  doc.body.appendChild(veil);
  var leaving = false;

  function veilDone() {
    if (veil.classList.contains('is-open')) veil.style.display = 'none';
  }
  veil.addEventListener('transitionend', veilDone);

  function leave(href) {
    if (leaving) return;
    leaving = true;
    veil.style.display = '';
    veil.className = 'kz-veil is-closing';
    root.classList.add('kz-leaving');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        veil.classList.add('is-closed');
      });
    });
    setTimeout(function () {
      location.href = href;
    }, 700);
  }

  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.kz-link[href]');
    if (!a || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var url;
    try {
      url = new URL(a.getAttribute('href'), location.href);
    } catch (err) {
      return;
    }
    if (url.origin !== location.origin || a.target) return;
    e.preventDefault();
    var here = location.pathname.replace(/\/index\.html$/, '/');
    var there = url.pathname.replace(/\/index\.html$/, '/');
    if (here === there) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    leave(url.href);
  });

  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    /* back/forward cache: the page comes back mid-exit — reset */
    leaving = false;
    root.classList.remove('kz-leaving');
    veil.className = 'kz-veil is-open';
    veil.style.display = 'none';
  });

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  function boot() {
    var play;
    try {
      marqueeInit();
      play = intro();
      segmented(doc.querySelector(N('Sélecteur audience')));
      billing();
      fan();
      pile();
      dashboard();
      reveals();
      counters();
      marqueeStart();
    } catch (err) {
      /* never leave the page hidden because of a motion bug */
      $('[data-kz-hidden]').forEach(function (el) {
        el.style.opacity = el.dataset.kzOp || '';
        el.style.transform = el.dataset.kzTf || '';
      });
      $('.kz-w').forEach(function (w) {
        w.classList.add('is-in');
      });
      play = null;
      if (window.console) console.error('[keyzz motion]', err);
    }

    root.classList.add('kz-ready');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        veil.classList.add('is-open');
        /* background tabs pause transitions: never leave the curtain up */
        setTimeout(veilDone, 1600);
        if (play) play();
      });
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
