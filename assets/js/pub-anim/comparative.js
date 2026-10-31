/* Teaser for "Enhancing visual classification using comparative descriptors" (scene "comparative"):
   descriptors point at the parts that tell a husky from a malamute.
   Registered on window.PubAnim from assets/js/pub-anim.js. */
(function (A) {
  'use strict';

  var C = A.C, text = A.text, rrect = A.rrect, dot = A.dot, ring = A.ring;
  var clamp = A.clamp, lerp = A.lerp, ease = A.ease, span = A.span, dist = A.dist, cycle = A.cycle;

  /* ---------- descriptors point at the parts that tell a husky from a malamute ---------- */

  (function () {
    // k blends the drawing from husky (0) to malamute (1); y puts both paws on the same ground line.
    var GROUND = 94;
    var HUSKY = { x: 66, sc: 0.92, k: 0, eye: '#3d8fe0', name: 'husky' };
    var MAL = { x: 174, sc: 1.08, k: 1, eye: '#6b3f1d', name: 'malamute' };
    var DOGS = [HUSKY, MAL];
    DOGS.forEach(function (b) { b.y = GROUND - 26 * b.sc; });
    var GREY = '#7b838f', DARK = '#5a616c', LIGHT = '#f1f2f5', SHADE = '#dcdfe5', EDGE = '#a3a9b4';

    // Parts in dog-local coordinates as [husky, malamute]; m is where the ✓ / ✗ mark sits.
    var PARTS = {
      tail: { c: [{ x: -35, y: -13 }, { x: -21, y: -20 }], r: 10, m: [{ x: -35, y: -30 }, { x: -21, y: -35 }] },
      body: { c: [{ x: -3, y: 0 }, { x: -3, y: 0 }], r: 21, m: [{ x: -3, y: 19 }, { x: -3, y: 19 }] },
      eyes: { c: [{ x: 30.5, y: -19.5 }, { x: 30.5, y: -19.5 }], r: 4.5, m: [{ x: 41, y: -27 }, { x: 41, y: -27 }] },
      ears: { c: [{ x: 26, y: -28 }, { x: 24, y: -26.5 }], r: 6.5, m: [{ x: 16, y: -35 }, { x: 15, y: -34 }] },
      face: { c: [{ x: 35, y: -15 }, { x: 35, y: -15 }], r: 8, m: [{ x: 46, y: -24 }, { x: 46, y: -24 }] }
    };
    var GENERIC = [
      { part: 'body', s: '"thick grey-and-white double coat"' },
      { part: 'ears', s: '"pointed upright ears"' },
      { part: 'face', s: '"white facial mask"' }
    ];
    var COMPARATIVE = [
      { part: 'tail', s: '"sickle tail, not curled over back"' },
      { part: 'body', s: '"lighter, more compact build"' },
      { part: 'eyes', s: '"often blue eyes, not brown"' },
      { part: 'ears', s: '"ears set closer and higher"' }
    ];
    var SLOT = 1.6;

    function pick(pair, k) { return { x: lerp(pair[0].x, pair[1].x, k), y: lerp(pair[0].y, pair[1].y, k) }; }
    function at(b, pair) { var q = pick(pair, b.k); return { x: b.x + q.x * b.sc, y: b.y + q.y * b.sc }; }

    function shape(g, pts, fill, edge) {
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.closePath();
      g.fillStyle = fill; g.fill();
      if (edge) { g.strokeStyle = edge; g.lineWidth = 0.6; g.stroke(); }
    }

    // A leg as an outlined tube; hind legs bend at the stifle and hock.
    function leg(g, x, w, fill, hind) {
      var pts = hind ? [x + 2, 2, x + 4, 11, x - 3.5, 18, x - 2.5, 25.4, x + 0.5, 25.4]
        : [x, 2, x, 14, x + 1, 25.4, x + 3.2, 25.4];
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.strokeStyle = EDGE; g.lineWidth = w + 1.2; g.stroke();
      g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    }

    function ear(g, bx, tx, ty, fill) {
      shape(g, [bx - 2.6, -23, tx, ty, bx + 2.8, -22.5], fill);
      shape(g, [bx - 1, -23.5, lerp(bx, tx, 0.75), lerp(-23, ty, 0.75), bx + 1.4, -23.3], '#d9c9c9');
    }

    function dog(g, b) {
      var k = b.k, bh = lerp(9, 12, k), lw = lerp(4, 6.2, k);
      g.save();
      g.translate(b.x, b.y);
      g.scale(b.sc, b.sc);
      g.lineJoin = g.lineCap = 'round';

      // Far legs, then the tail behind the body: a sickle (husky) or a plume curled over the back (malamute).
      leg(g, -20, lw, SHADE, true);
      leg(g, 11.5, lw, SHADE);
      g.strokeStyle = GREY; g.lineWidth = lerp(4.2, 7.5, k);
      g.beginPath();
      g.moveTo(-23, -4);
      g.bezierCurveTo(lerp(-33, -33, k), lerp(-4, -22, k), lerp(-39, -15, k), lerp(-14, -30, k),
        lerp(-36, -11, k), lerp(-23, -15, k));
      g.stroke();
      dot(g, -36, -23, 2 * (1 - k), LIGHT);

      // Body and neck in grey with a white belly and chest.
      g.beginPath();
      g.ellipse(-3, 0, 24, bh, 0, 0, Math.PI * 2);
      g.moveTo(10, -bh + 3); g.lineTo(21, -21); g.lineTo(31, -13); g.lineTo(24, 6); g.closePath();
      g.fillStyle = GREY; g.fill();
      g.save();
      g.clip();
      g.fillStyle = LIGHT;
      g.beginPath(); g.ellipse(0, bh + 2, 22, bh * 0.62, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(23, -3, 6.5, 11, -0.35, 0, Math.PI * 2); g.fill();
      g.restore();

      leg(g, -16, lw, LIGHT, true);
      leg(g, 14.5, lw, LIGHT);
      // Grey hind thigh over the top of the near hind leg.
      g.fillStyle = GREY;
      g.beginPath(); g.ellipse(-15, 0, lerp(7, 8.5, k), bh - 0.5, 0.25, 0, Math.PI * 2); g.fill();

      // Ears: close-set and high (husky), wider-set and lower (malamute).
      ear(g, lerp(23.5, 20.5, k), lerp(23.5, 18.5, k), lerp(-33, -30.5, k), DARK);
      g.beginPath(); g.arc(27, -18, 7.5, 0, Math.PI * 2); g.fillStyle = GREY; g.fill();
      ear(g, lerp(26.5, 28, k), lerp(27, 30, k), lerp(-33.5, -30.5, k), GREY);

      // Facial mask: white muzzle and cheeks, grey cap, white brow spot.
      shape(g, [28, -21.5, 37, -18.5, 41.5, -15.5, 41, -12, 33, -11, 25, -12.5], LIGHT);
      g.beginPath(); g.ellipse(27.5, -14.5, 5.5, 3.6, 0, 0, Math.PI * 2); g.fillStyle = LIGHT; g.fill();
      dot(g, 29.5, -23, 1.1, LIGHT);
      dot(g, 41.2, -15.2, 1.5, '#2a2d33');
      g.strokeStyle = EDGE; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(34, -12.2); g.lineTo(40.5, -12.5); g.stroke();

      // Eye: blue for the husky, brown for the malamute.
      dot(g, 30.5, -19.5, 1.7, '#2a2d33');
      dot(g, 30.6, -19.5, 1.25, b.eye);
      g.restore();

      g.strokeStyle = C.faint; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(b.x - 36 * b.sc, GROUND + 0.8); g.lineTo(b.x + 40 * b.sc, GROUND + 0.8); g.stroke();
      text(g, b.name, b.x + 2 * b.sc, 106, { size: 8.5, align: 'center' });
    }

    function halo(g, b, part, style, a, front) {
      var q = PARTS[part], c = at(b, q.c), r = q.r * b.sc;
      g.save();
      g.globalAlpha *= a;
      if (style === 'yes') {
        if (front) ring(g, c.x, c.y, r, C.accent, 1.1);
        else dot(g, c.x, c.y, r + 1, C.soft);
      } else if (style === 'no') {
        if (front) { g.setLineDash([2, 2]); ring(g, c.x, c.y, r, C.muted, 0.9); }
      } else {
        if (front) ring(g, c.x, c.y, r, C.muted, 0.9);
        else dot(g, c.x, c.y, r + 1, '#eef0f4');
      }
      g.restore();
    }

    function mark(g, b, part, ok, color, a) {
      var m = at(b, PARTS[part].m);
      text(g, ok ? '✓' : '✗', m.x, m.y + 3, { size: 9, weight: 600, align: 'center', color: color, alpha: a });
    }

    A.scenes['comparative'] = {
      label: 'Comparative descriptors on the dog itself: a Siberian husky and an Alaskan malamute side by side. Generic ' +
        'descriptors such as "thick grey-and-white double coat" fit both breeds, so the photo of a husky is classified ' +
        'as a malamute. Comparative descriptors name what sets a husky apart from a malamute (a sickle tail rather than ' +
        'one curled over the back, a lighter build, blue eyes, closer-set ears) and fix the top-1 prediction. Hover a ' +
        'part to see its descriptor; click to switch between generic and comparative.',
      init: function (s) { s.cmp = !!s.reduce; s.auto = true; },
      click: function (s, t) { s.auto = false; s.cmp = !s.cmp; s.start = t; },
      draw: function (g, s, t) {
        var set = s.cmp ? COMPARATIVE : GENERIC;
        var u = s.reduce ? 0.6 : cycle(s, t, SLOT * set.length, function () { if (s.auto) s.cmp = !s.cmp; });
        set = s.cmp ? COMPARATIVE : GENERIC;
        var idx = clamp(Math.floor(u / SLOT), 0, set.length - 1);
        var a = s.reduce ? 1 : ease(span(u - idx * SLOT, 0, 0.3));

        // Hovering a part picks its descriptor (the smallest part under the pointer wins).
        var p = s.p, best = 1e9;
        if (p.in) {
          set.forEach(function (d, i) {
            DOGS.forEach(function (b) {
              var q = PARTS[d.part], r = q.r * b.sc;
              if (dist(p, at(b, q.c)) < r + 2 && r < best) { best = r; idx = i; a = 1; }
            });
          });
        }
        var d = set[idx];
        var sh = s.cmp ? 'yes' : 'both', sm = s.cmp ? 'no' : 'both';

        halo(g, HUSKY, d.part, sh, a, false); halo(g, MAL, d.part, sm, a, false);
        dog(g, HUSKY);
        dog(g, MAL);
        halo(g, HUSKY, d.part, sh, a, true); halo(g, MAL, d.part, sm, a, true);
        if (s.cmp) { mark(g, HUSKY, d.part, true, C.accent, a); mark(g, MAL, d.part, false, C.muted, a); }
        else { mark(g, HUSKY, d.part, true, C.muted, a); mark(g, MAL, d.part, true, C.muted, a); }

        text(g, s.cmp ? 'comparative descriptors' : 'generic descriptors', 6, 12,
          { size: 8, weight: 600, color: s.cmp ? C.accent : C.muted });
        var w = text(g, s.cmp ? 'husky ✓' : 'malamute ✗', 236, 12,
          { size: 9, weight: 600, align: 'right', color: s.cmp ? C.accent : C.fg });
        text(g, 'top-1', 232 - w, 12, { size: 8, color: C.muted, align: 'right' });

        // Caption: the active descriptor.
        if (s.cmp) {
          var pw = text(g, 'vs malamute:', 6, 119, { size: 8, color: C.muted, alpha: a });
          text(g, d.s, 11 + pw, 119, { size: 8, weight: 600, color: C.accent, alpha: a });
        } else {
          var qw = text(g, d.s, 6, 119, { size: 8, color: C.fg, alpha: a });
          text(g, 'fits both', 11 + qw, 119, { size: 8, color: C.muted, alpha: a });
        }
        text(g, 'click · hover', 236, 129, { size: 7.5, color: C.muted, align: 'right' });
      }
    };
  })();
})(window.PubAnim);
