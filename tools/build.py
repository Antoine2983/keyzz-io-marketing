"""Rebuild index.html / pricing.html / simulator.html from the pen.dev "html-css" exports.

Usage:
    python3 tools/build.py [export-dir]

Expects `css-home.html`, `css-tarifs.html` and `css-simulateur.html` in the
export directory (default: ./design-export). Produce them from KEYZZ TEST.pen
with:

    Export(["AOXrP"], "html-css", "design-export/css-home.html")        # home
    Export(["ASriL"], "html-css", "design-export/css-tarifs.html")      # pricing
    Export([...],     "html-css", "design-export/css-simulateur.html")  # simulateur

assets/site.css and assets/site.js are rewritten from the CSS and JS constants
below on every run: edit them here, never only in assets/.
"""

import re, os, sys, base64, shutil, hashlib

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, "design-export")
ASSETS = os.path.join(OUT, "assets")
IMAGE_SOURCE = os.path.expanduser("~/Downloads/images")
os.makedirs(ASSETS, exist_ok=True)

EXT = {"webp": "webp", "png": "png", "jpeg": "jpg", "jpg": "jpg", "gif": "gif", "svg+xml": "svg"}

def extract_body(html):
    i = html.find("<body")
    i = html.index(">", i) + 1
    j = html.rindex("</body>")
    return html[i:j]

def extract_images(html):
    """Replace data: URIs with files in assets/, dedup by content hash."""
    def repl(m):
        mime, b64 = m.group(1), m.group(2)
        raw = base64.b64decode(b64)
        h = hashlib.sha1(raw).hexdigest()[:12]
        name = "img-%s.%s" % (h, EXT.get(mime, "bin"))
        path = os.path.join(ASSETS, name)
        if not os.path.exists(path):
            open(path, "wb").write(raw)
        return "assets/" + name
    return re.sub(r"data:image/([a-z+]+);base64,([A-Za-z0-9+/=]+)", repl, html)

def copy_local_images(html):
    """Copy images/*.png referenced by the export into assets/."""
    def repl(m):
        fname = m.group(1)
        src = os.path.join(IMAGE_SOURCE, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(ASSETS, fname))
            return "assets/" + fname
        return m.group(0)
    return re.sub(r"images/([A-Za-z0-9._-]+\.(?:png|jpg|jpeg|webp))", repl, html)

def find_close(html, start):
    """Given index of '<div' opening tag, return index just past its matching </div>."""
    i = html.index(">", start)
    if html[i - 1] == "/":
        return i + 1
    depth, pos = 1, i + 1
    while depth:
        m = re.compile(r"</?div\b").search(html, pos)
        if not m:
            return None
        if html[m.start() + 1] == "/":
            depth -= 1
            pos = html.index(">", m.start()) + 1
        else:
            k = html.index(">", m.start())
            depth += 0 if html[k - 1] == "/" else 1
            pos = k + 1
    return pos

def linkify(html, text, href, limit=None):
    """Wrap each <div ...>TEXT</div> whose own text is exactly TEXT in an <a href>."""
    out, pos, done = [], 0, 0
    pat = re.compile(r"<div\b[^>]*>\s*" + re.escape(text) + r"\s*</div>")
    while True:
        if limit is not None and done >= limit:
            break
        m = pat.search(html, pos)
        if not m:
            break
        out.append(html[pos:m.start()])
        out.append('<a class="kz-link" href="%s">%s</a>' % (href, m.group(0)))
        pos = m.end()
        done += 1
    out.append(html[pos:])
    return "".join(out)

def linkify_block(html, pencil_name, href, limit=1):
    """Wrap the whole <div data-pencil-name="NAME"> ... </div> block in an <a href>."""
    out, pos, done = [], 0, 0
    needle = 'data-pencil-name="%s"' % pencil_name
    while done < limit:
        k = html.find(needle, pos)
        if k < 0:
            break
        start = html.rindex("<div", 0, k)
        end = find_close(html, start)
        if end is None:
            break
        out.append(html[pos:start])
        out.append('<a class="kz-link" href="%s">%s</a>' % (href, html[start:end]))
        pos = end
        done += 1
    out.append(html[pos:])
    return "".join(out)

def drop_block(html, pencil_name):
    """Remove a whole <div data-pencil-name="NAME"> ... </div> block."""
    k = html.find('data-pencil-name="%s"' % pencil_name)
    if k < 0:
        return html
    start = html.rindex("<div", 0, k)
    end = find_close(html, start)
    if end is None:
        return html
    pre, post = html[:start].rstrip(" \t"), html[end:]
    if pre.endswith("\n") and post.startswith("\n"):
        post = post[1:]
    return pre + post

def swap_bandeau(body):
    """Replace the exported "Bandeau logos" block with design-export/bandeau-logos.html.

    The logo strip was redesigned outside the two page frames; its own export
    is kept as the source of truth and grafted onto every page here.
    """
    path = os.path.join(SRC, "bandeau-logos.html")
    if not os.path.exists(path):
        return body
    new = extract_body(open(path, encoding="utf-8").read())
    k = new.find('data-pencil-name="Bandeau logos"')
    start = new.rindex("<div", 0, k)
    new = new[start:find_close(new, start)]
    new = extract_images(new)
    k = body.find('data-pencil-name="Bandeau logos"')
    if k < 0:
        return body
    start = body.rindex("<div", 0, k)
    end = find_close(body, start)
    return body[:start] + new + body[end:]

def swap_dashboard(body):
    """Replace the "Dashboard (copie)" inside the home mockup with
    design-export/mockup-pilotage.html (the dashboard, exported on its own,
    now in light mode). The 1440px frame is scaled down into the 1120px window
    of the mockup: its content has fixed widths, so it cannot reflow."""
    path = os.path.join(SRC, "mockup-pilotage.html")
    if not os.path.exists(path):
        return body
    new = extract_body(open(path, encoding="utf-8").read())
    k = new.find('data-pencil-name="B2B')
    start = new.rindex("<div", 0, k)
    new = new[start:find_close(new, start)]
    new = extract_images(new)
    k = body.find('data-pencil-name="Dashboard (copie)"')
    if k < 0:
        return body
    old_start = body.rindex("<div", 0, k)
    old_end = find_close(body, old_start)
    frame = body[old_start:body.index(">", old_start) + 1]
    # keep the exported window placement, swap the name and width onto the new root
    new = re.sub(r'data-pencil-name="[^"]*"', 'data-pencil-name="Dashboard (copie)"', new, count=1)
    new = re.sub(r'style="[^"]*"',
                 'style="align-items: flex-start; background-color: #0B0B0D; box-sizing: border-box; display: flex; '
                 'flex-direction: row; gap: 0px; height: fit-content; justify-content: flex-start; left: 0px; '
                 'overflow: hidden; position: absolute; top: 0px; width: 1440px; z-index: 0; '
                 'transform: scale(0.77778); transform-origin: top left"', new, count=1)
    return body[:old_start] + new + body[old_end:]

HEAD = """<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content="{desc}" />
    <meta name="theme-color" content="#0B0B0D" />
    <link rel="canonical" href="https://keyzz.io/{canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="KEYZz Pro" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{desc}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono%3Awght%40100..800&family=Space+Grotesk%3Awght%40300..700&family=Urbanist%3Awght%40100..900&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="assets/site.css" />
    <link rel="stylesheet" href="assets/mobile.css" />
    <link rel="stylesheet" href="assets/motion.css" />
    <script>document.documentElement.classList.add("kz-js");</script>
  </head>
  <body>
    <div id="stage">
"""

TAIL = """    </div>
    <script src="assets/site.js"></script>
    <script src="assets/glass.js"></script>
    <script src="assets/motion.js"></script>
{extra}  </body>
</html>
"""

# Uniforms of the `keyzz-glass.glsl` shader fill, identical on all four active
# "Film de verre" nodes in the .pen. The HTML export drops the shader and bakes
# a still frame instead, so they are re-declared here for assets/glass.js.
GLASS_ATTRS = (
    'data-glass data-glass-intensity="0.55" data-glass-speed="0.18" '
    'data-glass-bevel="10" data-glass-tint="#6E3BFF"'
)

CSS = """*,
::before,
::after {
  box-sizing: border-box;
}

html {
  background-color: #0b0b0d;
}

body {
  margin: 0;
  background-color: #0b0b0d;
  color: #ffffff;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* The design is authored on a fixed 1440px canvas. Above 1440px the page is
   centred and rendered 1:1; below it, the whole canvas scales down
   proportionally so the layout never breaks. */
#stage {
  width: 1440px;
  transform-origin: top left;
}

/* The nav, lifted out of #stage by site.js: a full-bleed opaque bar pinned to
   the viewport, holding the canvas-scaled nav. motion.js paints it with the
   background colour of the section running under it. */
#kz-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5000;
  background-color: #0b0b0d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  transition: background-color 0.35s ease, border-color 0.35s ease;
}
#kz-nav.is-light {
  border-bottom-color: rgba(11, 11, 13, 0.08);
}
#kz-nav-canvas {
  width: 1440px;
  transform-origin: top left;
}

.kz-link {
  color: inherit;
  text-decoration: none;
  display: contents;
}

[data-name="Lien Produit"],
[data-name="FAQ"],
[data-name="Marque"],
[data-name="Bouton"],
[data-name="Bouton primaire"],
[data-name="Bouton secondaire"] {
  cursor: pointer;
}
"""

JS = """(function () {
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
  /* focus : sur mobile, plutôt que de rétrécir tout le bloc jusqu'à
     l'illisible, on cadre une tranche (w naturels à partir de x) et on coupe
     la hauteur — le mockup du dashboard montre sa colonne principale. */
  var FIT = [
    { name: 'Frame 2147223764' },
    { name: 'Pile éclatée' },
    { name: 'Mockup dashboard', focus: { w: 684, x: 212, maxH: 380 } }
  ];
  var fitted = [];
  FIT.forEach(function (spec) {
    var el = stage.querySelector('[data-name="' + spec.name + '"]');
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
      focus: spec.focus || null,
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
      var w = f.focus ? f.focus.w : f.w;
      var x = f.bx + (f.focus ? f.focus.x : 0);
      var s = Math.min(1, avail / w);
      var h = f.h * s;
      if (f.focus && f.focus.maxH) h = Math.min(h, f.focus.maxH);
      f.wrap.style.display = 'block';
      f.wrap.style.width = w * s + 'px';
      f.wrap.style.height = h + 'px';
      f.wrap.style.margin = '0 auto';
      f.wrap.style.flexShrink = '0';
      f.wrap.style.overflow = f.focus ? 'hidden' : '';
      f.wrap.style.borderRadius = f.focus ? '16px' : '';
      f.el.style.transform = 'scale(' + s + ') translate(' + -x + 'px, ' + -f.by + 'px)';
      f.el.style.transformOrigin = 'top left';
    });
  }

  function resetBlocks() {
    fitted.forEach(function (f) {
      f.wrap.style.cssText = 'display: contents';
      f.wrap.style.overflow = '';
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
"""

PAGES = [
    ("css-home.html", "index.html", "KEYZz Pro — Vos événements méritent mieux qu'un billet",
     "KEYZz transforme chaque billet en carte de collection numérique : activez vos publics, "
     "prolongez l'expérience et pilotez vos événements depuis une plateforme unique.", "", ""),
    ("css-tarifs.html", "pricing.html", "Tarifs — KEYZz Pro",
     "Des formules claires pour activer vos publics : découvrez les plans KEYZz Pro, "
     "le pack Lancement et les offres Enterprise.", "pricing", ""),
    ("css-simulateur.html", "simulator.html", "Simulateur — KEYZz Pro",
     "Estimez ce que vos événements vous laissent : contacts identifiés, coût par contact "
     "et formule la plus avantageuse pour votre saison.", "simulateur",
     '    <script src="assets/simulator.js"></script>\n'),
]

for page in PAGES:
    src, dst, title, desc, canonical = page[:5]
    extra = page[5] if len(page) > 5 else ""
    html = open(os.path.join(SRC, src), encoding="utf-8").read()
    body = extract_body(html)
    body = extract_images(body)
    body = copy_local_images(body)
    body = swap_bandeau(body)
    body = swap_dashboard(body)

    # 20px more air above the "Vous voyez tout" title (asked on 11/09/2026).
    body = body.replace(
        'data-pencil-name="Section Pilotage"\n        style="align-items: center; background-color: #141417; box-sizing: border-box; display: flex; flex-direction: column; flex-shrink: 0; gap: 82px; height: fit-content; justify-content: flex-start; overflow: hidden; padding: 110px 60px 0px 60px;',
        'data-pencil-name="Section Pilotage"\n        style="align-items: center; background-color: #141417; box-sizing: border-box; display: flex; flex-direction: column; flex-shrink: 0; gap: 82px; height: fit-content; justify-content: flex-start; overflow: hidden; padding: 130px 60px 0px 60px;',
        1)

    # The Marque / Agence / Artiste switch in the hero led nowhere: dropped
    # until the agency and artist pages exist.
    body = drop_block(body, "Sélecteur audience")
    # Hero: no secondary "Voir la plateforme" button, and the micro-proof
    # keeps only the set-up time (asked on 11/09/2026).
    body = drop_block(body, "CTA secondaire")
    body = body.replace("Mise en place en 48 h · Aucune app à installer", "Mise en place en 48 h", 1)

    # Cross-page navigation: header logo, footer logo, and the nav items only.
    # The "Marque" blocks inside the card mockups must stay non-interactive.
    body = linkify_block(body, "Marque", "index.html", limit=1)
    foot = body.find('data-pencil-name="Pied de page"')
    if foot > 0:
        head_part, foot_part = body[:foot], body[foot:]
        body = head_part + linkify_block(foot_part, "Marque", "index.html", limit=1)
    body = linkify(body, "Tarifs", "pricing.html")
    body = linkify(body, "Plateforme", "index.html")
    if dst != "simulator.html":
        body = linkify_block(body, "Bouton estimation", "simulator.html", limit=1)

    # The exporter emits `content-box` on the sections that carry a partial
    # border, which stacks their padding on top of the authored size and blows
    # them out to 1560px wide. Border-box puts every section back on the exact
    # dimensions of the .pen canvas.
    body = body.replace("box-sizing: content-box", "box-sizing: border-box")

    # Clean pencil metadata: keep a short, readable hook, drop the icon plumbing
    body = body.replace("data-pencil-name=", "data-name=")

    # Hand the frozen glass nodes to the WebGL replay in assets/glass.js
    body = body.replace('data-name="Film de verre"', 'data-name="Film de verre" ' + GLASS_ATTRS)
    body = re.sub(r'\s*data-icon-(?:name|set)="[^"]*"', "", body)

    out = HEAD.format(title=title, desc=desc, canonical=canonical) + body + TAIL.format(extra=extra)
    open(os.path.join(OUT, dst), "w", encoding="utf-8").write(out)
    print(dst, len(out) // 1024, "KB")

open(os.path.join(ASSETS, "site.css"), "w", encoding="utf-8").write(CSS)
open(os.path.join(ASSETS, "site.js"), "w", encoding="utf-8").write(JS)
print("assets:", sorted(os.listdir(ASSETS)))
