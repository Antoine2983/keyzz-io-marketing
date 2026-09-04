/**
 * Animated glass film on the KEYZz cards.
 *
 * The design applies `keyzz-glass.glsl` as a shader fill on the "Film de verre"
 * nodes. pen.dev's HTML export cannot carry a WebGL shader, so it bakes a still
 * frame into a WebP — the effect is there, but frozen. This replays the shader
 * live on a canvas.
 *
 * The original shader reads the content behind the node (`@backdrop`) and
 * returns an opaque colour. Here the layers behind the film are real DOM
 * elements, so the canvas renders only the shader's additive terms — the sweep,
 * the prism, the bevel and the edge, which are the whole of the motion — and
 * composites them over the untouched layers with `mix-blend-mode: plus-lighter`.
 * Two subtle static terms of the original are therefore dropped: the <=3px edge
 * refraction and the 6% corner vignette.
 *
 * `@sdf` is the signed distance field of the node's own shape — a plain
 * rectangle here — so it is computed analytically. The 22px rounded corners
 * come from the parent's border-radius clip, exactly as in the design.
 */
(function () {
  'use strict';

  var VERT =
    'attribute vec2 a_pos;' +
    'void main(){gl_Position=vec4(a_pos,0.0,1.0);}';

  var FRAG =
    'precision highp float;' +
    'uniform vec2 u_resolution;' +
    'uniform float u_time;' +
    'uniform float u_intensity;' +
    'uniform float u_speed;' +
    'uniform float u_bevel;' +
    'uniform vec3 u_tint;' +
    'vec3 hue(float h){' +
    '  vec3 c=abs(fract(h+vec3(0.0,1.0/3.0,2.0/3.0))*6.0-3.0)-1.0;' +
    '  return clamp(c,0.0,1.0);' +
    '}' +
    'void main(){' +
    '  vec2 uv=gl_FragCoord.xy/u_resolution;' +
    '  vec2 half_=u_resolution*0.5;' +
    '  vec2 p=gl_FragCoord.xy-half_;' +
    /* signed distance to the rectangle, positive inside, in pixels */
    '  float dx=half_.x-abs(p.x);' +
    '  float dy=half_.y-abs(p.y);' +
    '  float dist=min(dx,dy);' +
    /* direction of increasing distance: perpendicular to the nearest edge */
    '  vec2 grad=dx<dy?vec2(-sign(p.x),0.0):vec2(0.0,-sign(p.y));' +
    '  float bevel=1.0-smoothstep(0.0,u_bevel,dist);' +
    '  float t=u_time*u_speed;' +
    '  float d=uv.x*0.8+uv.y*0.6;' +
    '  float sweep=fract(t)*2.4-0.7;' +
    '  float b1=(d-sweep)*5.0; float band=exp(-b1*b1);' +
    '  float b2=(d-sweep-0.12)*14.0; float band2=exp(-b2*b2)*0.6;' +
    '  float prism=smoothstep(0.35,0.0,abs(uv.x*0.6-uv.y*0.4+0.15-fract(t*0.5)*0.9+0.3));' +
    '  vec3 rainbow=hue(d*1.5+t)*0.35+u_tint*0.25;' +
    '  vec3 col=vec3(0.0);' +
    '  col+=(band+band2)*u_intensity*vec3(1.0);' +
    '  col+=prism*rainbow*u_intensity;' +
    '  col+=bevel*0.25*(0.5+0.5*grad.y)*vec3(1.0);' +
    '  float edge=1.0-smoothstep(0.0,1.5,dist);' +
    '  col+=edge*0.35;' +
    /* keep the additive terms inside the node's own shape */
    '  col*=step(0.0,dist);' +
    '  col=clamp(col,0.0,1.0);' +
    /* Premultiplied alpha, with alpha set to the brightest channel: rgb never
       exceeds alpha (which the spec requires), the film is fully transparent
       where it adds nothing, and under plus-lighter the composite is exactly
       the shader's `col + backdrop`. */
    '  float a=max(max(col.r,col.g),col.b);' +
    '  gl_FragColor=vec4(col,a);' +
    '}';

  function hexToRgb(hex) {
    var h = String(hex || '#6E3BFF').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function setup(host) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none';

    var attrs = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false
    };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) return null;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {
      resolution: gl.getUniformLocation(prog, 'u_resolution'),
      time: gl.getUniformLocation(prog, 'u_time'),
      intensity: gl.getUniformLocation(prog, 'u_intensity'),
      speed: gl.getUniformLocation(prog, 'u_speed'),
      bevel: gl.getUniformLocation(prog, 'u_bevel'),
      tint: gl.getUniformLocation(prog, 'u_tint')
    };

    gl.uniform1f(u.intensity, parseFloat(host.dataset.glassIntensity || '0.55'));
    gl.uniform1f(u.speed, parseFloat(host.dataset.glassSpeed || '0.18'));
    gl.uniform1f(u.bevel, parseFloat(host.dataset.glassBevel || '10'));
    gl.uniform3fv(u.tint, hexToRgb(host.dataset.glassTint));

    /* The still frame baked by the exporter would double the effect. Keep it
       aside: if the GL context is ever lost, it is the right thing to fall
       back to — it is exactly what the page showed before this script ran. */
    var baked = host.style.backgroundImage;
    host.style.backgroundImage = 'none';
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      canvas.style.display = 'none';
      host.style.mixBlendMode = '';
      host.style.backgroundImage = baked;
    });

    /* The blend has to sit on the host, not on the canvas: the host carries a
       z-index and so opens its own stacking context, which the canvas would
       otherwise be the only thing to blend against. On the host, the group is
       the card — the visual, scrim and prism layers the shader reads as its
       backdrop. Without plus-lighter the canvas simply composites source-over,
       which is still correct, only slightly less bright under the sweep. */
    if (window.CSS && CSS.supports && CSS.supports('mix-blend-mode', 'plus-lighter')) {
      host.style.mixBlendMode = 'plus-lighter';
    }
    host.appendChild(canvas);

    var w = 0, h = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      /* The page canvas is scaled below 1440px; offsetWidth/Height ignore that
         transform, so the shader's pixel-space terms (bevel, edge) stay true to
         the design at every viewport size. */
      var cw = Math.max(1, Math.round(host.offsetWidth * dpr));
      var ch = Math.max(1, Math.round(host.offsetHeight * dpr));
      if (cw === w && ch === h) return;
      w = cw;
      h = ch;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      /* u_bevel and the edge term are expressed in design pixels */
      gl.uniform2f(u.resolution, w, h);
      gl.uniform1f(u.bevel, parseFloat(host.dataset.glassBevel || '10') * dpr);
    }

    function draw(seconds) {
      resize();
      gl.uniform1f(u.time, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return { host: host, draw: draw, lost: function () { return gl.isContextLost(); } };
  }

  function start() {
    var hosts = [].slice.call(document.querySelectorAll('[data-glass]'));
    if (!hosts.length) return;

    var items = [];
    for (var i = 0; i < hosts.length; i++) {
      var it = setup(hosts[i]);
      if (it) items.push(it);
    }
    if (!items.length) return;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      /* Honour the preference: draw one representative frame, never animate.
         Resizing the canvas clears it, so redraw when the page is resized. */
      var still = function () { items.forEach(function (it) { it.draw(1.4); }); };
      still();
      window.addEventListener('resize', still);
      return;
    }

    /* Only the cards on screen are worth drawing. */
    var active = items.slice();

    if (window.IntersectionObserver) {
      active = [];
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var it = items.filter(function (x) { return x.host === e.target; })[0];
          if (!it) return;
          var at = active.indexOf(it);
          if (e.isIntersecting && at === -1) active.push(it);
          else if (!e.isIntersecting && at !== -1) active.splice(at, 1);
        });
      }, { rootMargin: '120px' });
      items.forEach(function (it) { io.observe(it.host); });
    }

    var t0 = performance.now();
    (function frame(now) {
      var seconds = (now - t0) / 1000;
      for (var i = 0; i < active.length; i++) {
        if (!active[i].lost()) active[i].draw(seconds);
      }
      requestAnimationFrame(frame);
    })(t0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
