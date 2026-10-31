/* Interactive teasers for the publication list.
   Every <canvas class="pub-anim" data-anim="name"> is driven by the scene of that name, registered by
   a file in assets/js/pub-anim/.
   Scenes draw in a 240x135 logical space; the runner scales it to the canvas, pauses while
   the canvas is off screen, and holds a representative frame under prefers-reduced-motion. */
(function () {
  'use strict';

  var W = 240, H = 135;
  var rootStyle = getComputedStyle(document.documentElement);
  function token(name, fallback) { return rootStyle.getPropertyValue(name).trim() || fallback; }

  var C = {
    bg: '#ffffff',
    fg: token('--fg', '#20232a'),
    muted: token('--muted', '#636a78'),
    line: token('--line', '#e6e8ee'),
    accent: token('--accent', '#b0154f'),
    soft: token('--accent-soft', '#f7e8ee'),
    faint: '#c3c8d2'
  };
  var MONO = token('--font-mono', 'monospace');
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- helpers ---------- */

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function span(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function rng(seed) {
    return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function text(g, s, x, y, o) {
    o = o || {};
    g.save();
    g.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    g.font = (o.weight || 400) + ' ' + (o.size || 9) + 'px ' + MONO;
    g.fillStyle = o.color || C.fg;
    g.textAlign = o.align || 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(s, x, y);
    var w = g.measureText(s).width;
    if (o.strike) {
      var x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
      g.strokeStyle = o.color || C.fg;
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x0 - 1, y - 3); g.lineTo(x0 + w + 1, y - 3); g.stroke();
    }
    g.restore();
    return w;
  }

  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function dot(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  function ring(g, x, y, r, color, width) {
    g.strokeStyle = color;
    g.lineWidth = width || 1.2;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }

  function arrow(g, x1, y1, x2, y2, color) {
    var a = Math.atan2(y2 - y1, x2 - x1);
    g.strokeStyle = g.fillStyle = color;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - 4 * Math.cos(a - 0.45), y2 - 4 * Math.sin(a - 0.45));
    g.lineTo(x2 - 4 * Math.cos(a + 0.45), y2 - 4 * Math.sin(a + 0.45));
    g.closePath(); g.fill();
  }

  // Polyline through pts[0..k], where a fractional k draws part of the last segment.
  function path(g, pts, k, color, width, dash, alpha) {
    if (k <= 0 || alpha <= 0) return;
    g.save();
    g.globalAlpha *= alpha == null ? 1 : alpha;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineJoin = g.lineCap = 'round';
    g.setLineDash(dash || []);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    var n = Math.min(Math.floor(k), pts.length - 1);
    for (var i = 1; i <= n; i++) g.lineTo(pts[i].x, pts[i].y);
    var f = k - n;
    if (f > 0 && n + 1 < pts.length) {
      g.lineTo(lerp(pts[n].x, pts[n + 1].x, f), lerp(pts[n].y, pts[n + 1].y, f));
    }
    g.stroke();
    g.restore();
  }

  function along(pts, k) {
    k = clamp(k, 0, pts.length - 1);
    var n = Math.min(Math.floor(k), pts.length - 2), f = k - n;
    return { x: lerp(pts[n].x, pts[n + 1].x, f), y: lerp(pts[n].y, pts[n + 1].y, f) };
  }

  // Advance s.start past finished cycles; returns time into the current cycle.
  function cycle(s, t, length, onWrap) {
    var u = t - s.start;
    if (u > length) {
      s.start = t;
      u = 0;
      if (onWrap) onWrap();
    }
    return u;
  }

  var scenes = {};

  // Scenes live in assets/js/pub-anim/*.js and register themselves on window.PubAnim.

  /* ---------- runner ---------- */

  function mount(cv) {
    var scene = scenes[cv.getAttribute('data-anim')];
    if (!scene) return;
    var g = cv.getContext('2d');
    var s = { p: { x: 0, y: 0, in: false, down: false }, start: 0, reduce: REDUCE, k: 1, dt: 0 };
    scene.init(s);
    if (!cv.getAttribute('aria-label')) cv.setAttribute('aria-label', scene.label);

    var t0 = performance.now(), last = 0, raf = 0, visible = false;
    function now() { return (performance.now() - t0) / 1000; }

    function frame() {
      var t = now();
      s.dt = t - last;
      last = t;
      var scale = cv.width / W;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.fillStyle = C.bg;
      g.fillRect(0, 0, W, H);
      scene.draw(g, s, t);
    }

    function loop() {
      raf = 0;
      frame();
      if (visible && !REDUCE) raf = requestAnimationFrame(loop);
    }

    function kick() {
      if (REDUCE) frame();
      else if (visible && !raf) { last = now(); raf = requestAnimationFrame(loop); }
    }

    function resize() {
      var r = cv.getBoundingClientRect();
      if (!r.width) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.width * dpr * H / W);
      s.k = cv.width / W;
      frame();
    }

    function locate(e) {
      var r = cv.getBoundingClientRect();
      s.p.x = (e.clientX - r.left) / r.width * W;
      s.p.y = (e.clientY - r.top) / r.height * H;
    }

    cv.addEventListener('pointermove', function (e) {
      locate(e);
      s.p.in = true;
      if (s.p.down) {
        if (dist(s.p, s.p.from) > 3) s.p.moved = true;
        if (s.p.moved && scene.drag) scene.drag(s, now());
      }
      if (REDUCE) frame();
    });
    cv.addEventListener('pointerdown', function (e) {
      locate(e);
      s.p.in = true;
      s.p.down = true;
      s.p.moved = false;
      s.p.from = { x: s.p.x, y: s.p.y };
      if (scene.press) scene.press(s, now());
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or ended pointer */ }
    });
    cv.addEventListener('pointerup', function (e) {
      locate(e);
      if (s.p.down && !s.p.moved) scene.click(s, now());
      s.p.down = false;
      if (scene.release) scene.release(s);
      if (e.pointerType !== 'mouse') s.p.in = false;
      frame();
    });
    cv.addEventListener('pointercancel', function () {
      s.p.down = false;
      s.p.in = false;
      if (scene.release) scene.release(s);
    });
    cv.addEventListener('pointerleave', function () {
      if (!s.p.down) s.p.in = false;
      if (REDUCE) frame();
    });
    cv.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scene.click(s, now());
        frame();
      }
    });

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
    else window.addEventListener('resize', resize);
    resize();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
      }).observe(cv);
    } else {
      visible = true;
      kick();
    }
  }

  function mountAll() {
    Array.prototype.forEach.call(document.querySelectorAll('canvas.pub-anim'), function (cv) {
      if (cv.pubAnimMounted || !scenes[cv.getAttribute('data-anim')]) return;
      cv.pubAnimMounted = true;
      mount(cv);
    });
  }

  // Extra scenes (e.g. drafts on a comparison page) register here and call mountAll() again.
  window.PubAnim = {
    scenes: scenes, mountAll: mountAll, W: W, H: H, C: C, MONO: MONO,
    clamp: clamp, lerp: lerp, ease: ease, span: span, dist: dist, rng: rng,
    text: text, rrect: rrect, dot: dot, ring: ring, arrow: arrow, path: path, along: along, cycle: cycle
  };

  // Scene files load after this one, so mount once the document has parsed.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
})();
