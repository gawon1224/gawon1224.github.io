/* Teaser for "Generating Accurate and Detailed Captions for High-Resolution Images" (scene "caption"):
   the caption of a dense city street as an edit diff, each change linked to an image region.
   Registered on window.PubAnim from assets/js/pub-anim.js. */
(function (A) {
  'use strict';

  var C = A.C, MONO = A.MONO;
  var clamp = A.clamp, lerp = A.lerp, ease = A.ease, span = A.span;
  var text = A.text, rrect = A.rrect, dot = A.dot, ring = A.ring, cycle = A.cycle;

  function approach(v, goal, rate, dt) {
    return v + (goal - v) * (1 - Math.exp(-Math.min(dt || 0, 0.1) * rate));
  }

  /* ---------- caption diff linked to image regions ---------- */

  (function () {
    var IMG = { x: 6, y: 6, w: 98, h: 123 };
    var CX = 112, LY0 = 42, LH = 14, FS = 9;
    var CYCLE = 10.5, HOLD = 8.0;
    var ITEMS = {
      dog: { kind: 'del', at: 1.2, box: [37, 83, 11, 8] },
      bus: { kind: 'ins', at: 2.6, box: [49, 81, 33, 21] },
      cyc: { kind: 'ins', at: 4.0, box: [7, 104, 18, 17] },
      clock: { kind: 'ins', at: 5.4, box: [42, 12, 10, 10] }
    };
    var ORDER = ['dog', 'bus', 'cyc', 'clock'];
    var LINES = [
      [{ s: 'Cars and a ' }, { s: 'red ', id: 'bus', grow: true }, { s: 'bus' }],
      [{ s: 'wait at a crosswalk' }],
      [{ s: 'below towers' }, { s: ' and a dog', id: 'dog' }, { s: '.' }],
      [{ s: 'A cyclist rides by;', id: 'cyc', from: 0.4, to: 1.3 }],
      [{ s: 'a clock reads 10:10.', id: 'clock', from: 0.4, to: 1.4 }]
    ];

    // A building face with a grid of windows, some of them lit.
    function facade(g, x, y, w, h, color, seed, step) {
      var r = A.rng(seed);
      g.fillStyle = color; g.fillRect(x, y, w, h);
      for (var wy = y + 2.5; wy < h + y - 3; wy += step) {
        for (var wx = x + 2; wx < x + w - 2; wx += step * 0.8) {
          var v = r();
          g.fillStyle = v > 0.82 ? '#f2d98d' : v > 0.4 ? 'rgba(40, 52, 72, 0.32)' : 'rgba(40, 52, 72, 0.18)';
          g.fillRect(wx, wy, step * 0.45, step * 0.5);
        }
      }
    }

    function person(g, x, y, color) {
      g.strokeStyle = color; g.lineWidth = 1.1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y - 4.5); g.lineTo(x, y); g.stroke();
      dot(g, x, y - 5.8, 0.95, color);
    }

    function car(g, x, y, w, color) {
      g.fillStyle = color; rrect(g, x, y, w, 5, 1.6); g.fill();
      g.fillStyle = 'rgba(40, 52, 72, 0.45)'; g.fillRect(x + w * 0.25, y + 0.8, w * 0.5, 1.6);
      dot(g, x + 2.4, y + 5, 1.3, '#2f333b'); dot(g, x + w - 2.4, y + 5, 1.3, '#2f333b');
    }

    function paint(g) {
      var W0 = IMG.w, H0 = IMG.h, i;
      var sky = g.createLinearGradient(0, 0, 0, 40);
      sky.addColorStop(0, '#dbe4ef'); sky.addColorStop(1, '#eef2f6');
      g.fillStyle = sky; g.fillRect(0, 0, W0, H0);
      // far skyline
      var far = [[0, 24, 12], [10, 30, 10], [18, 18, 9], [56, 22, 10], [64, 28, 9], [86, 20, 12]];
      far.forEach(function (b) { g.fillStyle = '#cfd6e0'; g.fillRect(b[0], b[1], b[2], 70); });
      // clock tower
      g.fillStyle = '#b9ab98'; g.fillRect(41, 8, 12, 76);
      g.beginPath(); g.moveTo(40, 8); g.lineTo(47, 0.5); g.lineTo(54, 8); g.closePath(); g.fill();
      dot(g, 47, 17, 3.4, '#f7f4ee');
      g.strokeStyle = '#2f333b'; g.lineWidth = 0.55;
      g.beginPath(); g.arc(47, 17, 3.4, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(47, 17); g.lineTo(45.6, 15.4); g.moveTo(47, 17); g.lineTo(49.2, 15.8); g.stroke();
      facade(g, 42.5, 24, 9, 58, '#b9ab98', 5, 4.2);
      // mid buildings
      facade(g, 24, 34, 17, 50, '#d9dde4', 11, 3.6);
      facade(g, 53, 30, 17, 54, '#d3d8e0', 17, 3.6);
      // near buildings, left and right
      facade(g, 0, 16, 25, 70, '#c7b49e', 23, 4.6);
      facade(g, 69, 10, 29, 76, '#a9b3c2', 29, 4.6);
      g.fillStyle = '#7d6e60'; g.fillRect(3, 72, 12, 4);
      g.fillStyle = '#e8c547'; g.fillRect(73, 64, 14, 5);
      // sidewalk, road, crosswalk, lane marks
      g.fillStyle = '#e4e3df'; g.fillRect(0, 84, W0, 7);
      g.fillStyle = '#b8bdc6'; g.fillRect(0, 91, W0, H0 - 91);
      g.fillStyle = '#ffffff';
      for (i = 0; i < 9; i++) g.fillRect(28 + i * 5.6, 110, 3, 9);
      for (i = 0; i < 6; i++) g.fillRect(2 + i * 17, 103, 8, 0.9);
      g.fillStyle = '#9fc39a'; g.fillRect(0, 104, 26, 19);
      // traffic light
      g.fillStyle = '#4a4f5a'; g.fillRect(65, 68, 1.2, 23); g.fillRect(63.6, 66, 4, 8);
      dot(g, 65.6, 68, 0.9, '#d9534f'); dot(g, 65.6, 70.5, 0.9, '#6b6f78'); dot(g, 65.6, 73, 0.9, '#6b6f78');
      // pedestrians
      [[6, 90, '#3d4250'], [11, 89.5, '#5a6b8c'], [19, 90, '#8a4f5a'], [31, 90, '#3d4250'],
       [36, 89.5, '#6d7380'], [90, 90, '#3d4250'], [94, 89.5, '#7a6a52']].forEach(function (q) { person(g, q[0], q[1], q[2]); });
      // cars and a taxi
      car(g, 4, 95, 14, '#3f6fb0');
      car(g, 22, 96, 13, '#e9eaed');
      car(g, 84, 97, 13, '#e8c547');
      // red double-decker bus
      g.fillStyle = '#c2352f'; rrect(g, 50, 82, 31, 18, 2.4); g.fill();
      g.fillStyle = 'rgba(235, 240, 246, 0.9)';
      for (i = 0; i < 5; i++) { g.fillRect(52 + i * 5.8, 84, 4.2, 3.6); g.fillRect(52 + i * 5.8, 91, 4.2, 3.6); }
      dot(g, 55, 100, 2, '#2f333b'); dot(g, 76, 100, 2, '#2f333b');
      // cyclist in the bike lane
      g.strokeStyle = '#2f333b'; g.lineWidth = 0.8;
      g.beginPath(); g.arc(11, 117, 2.8, 0, Math.PI * 2); g.moveTo(23.8, 117); g.arc(21, 117, 2.8, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(11, 117); g.lineTo(15.5, 112.5); g.lineTo(21, 117); g.moveTo(15.5, 112.5); g.lineTo(16, 109); g.stroke();
      g.strokeStyle = '#5e9a6e'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(16, 115); g.lineTo(16.5, 109.5); g.lineTo(18.5, 108); g.stroke();
      dot(g, 17, 106.6, 1.3, '#3d4250');
    }

    function buffers(s) {
      if (s.bufK === s.k && s.hi) return;
      s.bufK = s.k;
      var hi = document.createElement('canvas');
      hi.width = Math.max(1, Math.ceil(IMG.w * s.k)); hi.height = Math.max(1, Math.ceil(IMG.h * s.k));
      var hg = hi.getContext('2d');
      hg.scale(hi.width / IMG.w, hi.height / IMG.h); paint(hg);
      s.hi = hi;
    }

    function boxRect(it) {
      var b = it.box;
      return { x: IMG.x + b[0], y: IMG.y + b[1], w: b[2], h: b[3] };
    }

    function inside(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

    // Which item the pointer is on: a phrase or a box (boxes get a 3px margin to be easy to hit).
    function hovered(s) {
      var p = s.p;
      if (!p.in) return null;
      var segs = s.segs || [];
      for (var i = 0; i < segs.length; i++) if (segs[i].w > 0 && inside(p, segs[i])) return segs[i].id;
      for (var k = 0; k < ORDER.length; k++) {
        var r = boxRect(ITEMS[ORDER[k]]);
        if (inside(p, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 })) return ORDER[k];
      }
      return null;
    }

    A.scenes['caption'] = {
      label: 'Detailed captions for high-resolution images, shown as an edit to the caption a vision-language ' +
        'model first wrote for a dense city street. A hallucinated "and a dog" is struck out because the detector ' +
        'finds no dog (dashed box, not found), and verified details are inserted in color: the bus is red, a ' +
        'cyclist rides in the bike lane, and a small clock on the tower reads 10:10. Each edit is linked to its ' +
        'image region. Hover a phrase or a box to highlight its partner; click to switch between the original ' +
        'and the corrected caption.',
      init: function (s) { s.manual = false; s.vu = 0; s.goal = 0; s.touch = 0; s.segs = []; s.anchor = {}; s.uNow = 0; },
      click: function (s, t) {
        if (!s.manual) { s.manual = true; s.vu = Math.min(s.uNow, HOLD); s.goal = s.vu > HOLD / 2 ? 0 : HOLD; }
        else s.goal = s.goal > 0 ? 0 : HOLD;
        s.touch = t;
      },
      draw: function (g, s, t) {
        buffers(s);
        var hov = hovered(s);
        if (hov) s.touch = Math.max(s.touch, t - 6);
        if (s.manual && t - s.touch > 8) { s.manual = false; s.start = t; }

        var vu;
        if (s.manual) {
          if (s.reduce) s.vu = s.goal;
          else {
            var step = Math.min(s.dt || 0, 0.1) * 3.5, d = s.goal - s.vu;
            s.vu += Math.abs(d) < step ? d : (d > 0 ? step : -step);
          }
          vu = s.vu;
        } else {
          vu = s.reduce ? HOLD : cycle(s, t, CYCLE);
          s.uNow = vu;
        }

        // Highlighted item: the hovered one, otherwise the edit currently playing.
        var hl = hov;
        if (!hl && !s.manual && !s.reduce) {
          ORDER.forEach(function (id) { var a = ITEMS[id].at; if (vu >= a && vu < a + 1.6) hl = id; });
        }

        g.drawImage(s.hi, IMG.x, IMG.y, IMG.w, IMG.h);
        g.strokeStyle = C.line; g.lineWidth = 1;
        rrect(g, IMG.x, IMG.y, IMG.w, IMG.h, 3); g.stroke();

        // Region boxes: accent for verified objects, dashed gray for a mention the detector cannot find.
        ORDER.forEach(function (id) {
          var it = ITEMS[id], r = boxRect(it), on = hl === id;
          var a = Math.max(ease(span(vu, it.at, it.at + 0.4)), on ? 1 : 0);
          if (a <= 0) return;
          g.save();
          g.globalAlpha = a;
          if (it.kind === 'del') {
            g.setLineDash([2, 2]);
            g.strokeStyle = on ? C.fg : C.muted;
            g.lineWidth = on ? 1.4 : 1;
            g.strokeRect(r.x, r.y, r.w, r.h);
            g.setLineDash([]);
            var lx = r.x + r.w / 2, ly = r.y - 3;
            g.fillStyle = 'rgba(255,255,255,0.88)';
            rrect(g, lx - 20.5, ly - 7.5, 41, 10, 2); g.fill();
            text(g, 'not found', lx, ly, { size: 7.5, color: on ? C.fg : C.muted, align: 'center' });
          } else {
            g.strokeStyle = C.accent;
            g.lineWidth = on ? 1.8 : 1.1;
            g.strokeRect(r.x, r.y, r.w, r.h);
          }
          g.restore();
        });

        // Caption, laid out line by line; insertions push the rest of their line to the right.
        var head = vu < ITEMS.dog.at ? 'VLM caption' : vu < HOLD - 0.2 ? 'verifying' : 'verified caption';
        text(g, head, CX, 22, { size: 8, weight: 600, color: head === 'VLM caption' ? C.muted : C.accent });
        g.font = '400 ' + FS + 'px ' + MONO;
        var segs = [], anchor = {};
        LINES.forEach(function (line, li) {
          var x = CX, y = LY0 + li * LH;
          line.forEach(function (sg) {
            var full = g.measureText(sg.s).width;
            if (!sg.id) { text(g, sg.s, x, y, { size: FS }); x += full; return; }
            var it = ITEMS[sg.id], on = hl === sg.id;
            if (it.kind === 'del') {
              var k = ease(span(vu, it.at + 0.4, it.at + 1.0));
              if (on) { g.fillStyle = '#eef0f4'; g.fillRect(x - 1.5, y - 8.5, full + 3, 11.5); }
              text(g, sg.s, x, y, { size: FS, color: k > 0 ? C.muted : C.fg });
              if (k > 0) {
                g.strokeStyle = C.muted; g.lineWidth = 1;
                g.beginPath(); g.moveTo(x - 1, y - 3); g.lineTo(x - 1 + (full + 2) * k, y - 3); g.stroke();
              }
              segs.push({ id: sg.id, x: x, y: y - 9, w: full, h: 12 });
              if (!anchor[sg.id]) anchor[sg.id] = { x: x, y: y - 3 };
              x += full;
              return;
            }
            var str = sg.s.replace(/\s+$/, ''), wText = g.measureText(str).width, shown, wShown, adv;
            if (sg.grow) {
              var a = ease(span(vu, it.at + 0.4, it.at + 1.0));
              shown = str; wShown = wText * a; adv = full * a;
            } else {
              var b = span(vu, it.at + sg.from, it.at + sg.to);
              shown = str.slice(0, Math.round(str.length * b));
              wShown = g.measureText(shown).width; adv = wShown;
            }
            if (wShown > 0.5) {
              g.fillStyle = C.soft;
              g.fillRect(x - 1.5, y - 8.5, wShown + 3, 11.5);
              if (on) { g.strokeStyle = C.accent; g.lineWidth = 0.8; g.strokeRect(x - 1.5, y - 8.5, wShown + 3, 11.5); }
              g.save();
              g.beginPath(); g.rect(x - 1, y - 10, wShown + 2, 14); g.clip();
              text(g, shown, x, y, { size: FS, color: C.accent, weight: 600 });
              g.restore();
              segs.push({ id: sg.id, x: x, y: y - 9, w: wShown, h: 12 });
              if (!anchor[sg.id]) anchor[sg.id] = { x: x, y: y - 3 };
            }
            x += adv;
          });
        });
        s.segs = segs;
        s.anchor = anchor;

        // Link the highlighted phrase to its box.
        if (hl && anchor[hl]) {
          var it = ITEMS[hl], r = boxRect(it), an = anchor[hl];
          g.save();
          g.setLineDash([2, 2]);
          g.strokeStyle = it.kind === 'del' ? C.muted : C.accent;
          g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(r.x + r.w + 1, r.y + r.h / 2); g.lineTo(an.x - 4, an.y); g.stroke();
          g.restore();
          dot(g, an.x - 4, an.y, 1.4, it.kind === 'del' ? C.muted : C.accent);
        }

        text(g, 'hover · click', 236, 129, { size: 7.5, color: C.muted, align: 'right' });
      }
    };
  })();
})(window.PubAnim);
