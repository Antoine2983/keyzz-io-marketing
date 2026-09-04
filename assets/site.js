(function () {
  var stage = document.getElementById('stage');
  if (!stage) return;
  var BASE = 1440;
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
  })();

  function fit() {
    var w = document.documentElement.clientWidth;
    if (w === last) return;
    last = w;
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
