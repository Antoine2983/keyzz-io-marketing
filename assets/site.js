(function () {
  var stage = document.getElementById('stage');
  if (!stage) return;
  var BASE = 1440;
  var MOBILE = 768;
  var last = -1;

  /* The nav is lifted out of the canvas so it can hang off the viewport:
     `position: fixed` inside #stage would be trapped by its scale transform,
     and `sticky` never fires either — every scroll container above the nav is
     clipped. A spacer holds its place so the canvas layout is untouched. The
     lifted bar is scaled by fit() exactly like the canvas it came from. */
  var bar = null, canvas = null, spacer = null;
  (function liftNav() {
    var nav = stage.querySelector('[data-name="Nav"]');
    if (!nav) return;
    bar = document.createElement('div');
    bar.id = 'kz-nav';
    canvas = document.createElement('div');
    canvas.id = 'kz-nav-canvas';
    spacer = document.createElement('div');
    spacer.id = 'kz-nav-space';
    nav.parentNode.insertBefore(spacer, nav);
    canvas.appendChild(nav);
    bar.appendChild(canvas);
    document.body.insertBefore(bar, stage);

    /* Mobile menu: a burger that unfolds the existing nav links. Hidden on
       desktop by mobile.css; it never exists as far as the canvas layout is
       concerned. */
    var burger = document.createElement('button');
    burger.id = 'kz-burger';
    burger.setAttribute('aria-label', 'Menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(burger);
    burger.addEventListener('click', function () {
      var open = bar.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    bar.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a.kz-link')) bar.classList.remove('is-open');
    });
  })();

  /* --------------------------------------------------------------------
     Fixed compositions (the card fan, the exploded stack, the dashboard
     mockup) cannot reflow: their children are placed in absolute pixels.
     On mobile each one is wrapped in a plain div — invisible to motion.js,
     which selects by data-name — and scaled to the width it is given.
     -------------------------------------------------------------------- */
  var FIT = ['Frame 2147223764', 'Pile éclatée', 'Mockup dashboard'];
  var fitted = [];
  FIT.forEach(function (name) {
    var el = stage.querySelector('[data-name="' + name + '"]');
    if (!el) return;
    var wrap = document.createElement('div');
    wrap.className = 'kz-fit';
    wrap.style.display = 'contents';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    /* la boîte visuelle réelle : les cartes de l'éventail débordent de leur
       cadre, c'est elle qu'on met à l'échelle, pas le cadre. Mesurée avant
       toute transformation (site.js passe avant motion.js). Les halos et
       fondus, décoratifs et immenses, n'entrent pas dans la mesure. */
    var base = el.getBoundingClientRect();
    var b = { x0: 0, y0: 0, x1: base.width, y1: base.height };
    if (getComputedStyle(el).overflow !== 'hidden') {
      [].slice.call(el.children).forEach(function (c) {
        var n = c.getAttribute('data-name') || '';
        if (n.indexOf('Halo') === 0 || n.indexOf('Fondu') === 0) return;
        var r = c.getBoundingClientRect();
        if (!r.width || !r.height) return;
        b.x0 = Math.min(b.x0, r.left - base.left);
        b.y0 = Math.min(b.y0, r.top - base.top);
        b.x1 = Math.max(b.x1, r.right - base.left);
        b.y1 = Math.max(b.y1, r.bottom - base.top);
      });
    }
    fitted.push({
      wrap: wrap,
      el: el,
      bx: b.x0,
      by: b.y0,
      w: b.x1 - b.x0,
      h: b.y1 - b.y0
    });
  });

  function fitBlocks() {
    fitted.forEach(function (f) {
      /* mesuré depuis la section, pas le parent direct : un parent en
         fit-content prendrait la taille du bloc qu'on est en train de poser */
      var section = f.wrap;
      while (section.parentElement && section.parentElement.parentElement !== stage) {
        section = section.parentElement;
      }
      var cs = getComputedStyle(section);
      var avail = section.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!(avail > 100)) avail = document.documentElement.clientWidth - 40;
      var s = Math.min(1, avail / f.w);
      f.wrap.style.display = 'block';
      f.wrap.style.width = f.w * s + 'px';
      f.wrap.style.height = f.h * s + 'px';
      f.wrap.style.margin = '0 auto';
      f.wrap.style.flexShrink = '0';
      f.el.style.transform = 'scale(' + s + ') translate(' + -f.bx + 'px, ' + -f.by + 'px)';
      f.el.style.transformOrigin = 'top left';
    });
  }

  function resetBlocks() {
    fitted.forEach(function (f) {
      f.wrap.style.cssText = 'display: contents';
      f.el.style.transform = '';
      f.el.style.transformOrigin = '';
    });
  }

  function fit() {
    var w = document.documentElement.clientWidth;
    if (w === last) return;
    last = w;
    var mobile = w < MOBILE;
    document.documentElement.classList.toggle('kz-mobile', mobile);

    if (mobile) {
      /* real reflow: no canvas scale, mobile.css takes over */
      stage.style.transform = '';
      stage.style.marginLeft = '';
      document.body.style.height = '';
      if (bar) {
        canvas.style.transform = '';
        canvas.style.marginLeft = '';
        bar.style.height = '';
        spacer.style.height = bar.offsetHeight + 'px';
      }
      fitBlocks();
      return;
    }

    resetBlocks();
    if (bar) bar.classList.remove('is-open');
    var s = Math.min(1, w / BASE);
    stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
    stage.style.marginLeft = s === 1 ? Math.max(0, (w - BASE) / 2) + 'px' : '0px';
    if (bar) {
      canvas.style.transform = stage.style.transform;
      canvas.style.marginLeft = stage.style.marginLeft;
      var h = canvas.getBoundingClientRect().height;
      /* the spacer lives in the canvas, so it takes the unscaled height */
      spacer.style.height = h / s + 'px';
      /* the bar does not: a transform never changes layout height */
      bar.style.height = h + 'px';
    }
    /* Only write the height when it actually moves: reassigning it on every
       measure can nudge the scroll position while fonts and images settle. */
    var page = stage.getBoundingClientRect().height + 'px';
    if (page !== document.body.style.height) document.body.style.height = page;
  }

  function remeasure() {
    last = -1;
    fit();
  }

  fit();
  window.addEventListener('resize', remeasure);
  window.addEventListener('orientationchange', remeasure);
  window.addEventListener('load', remeasure);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
})();
