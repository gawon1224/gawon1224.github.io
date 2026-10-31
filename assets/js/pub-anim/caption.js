/* Teaser for "Generating Accurate and Detailed Captions for High-Resolution Images" (scene "caption"):
   the caption as an edit diff, each change linked to an image region.
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
    var CYCLE = 9, HOLD = 6.6;
    var ITEMS = {
      ball: { kind: 'del', at: 1.4, box: [82, 98, 11, 11] },
      fris: { kind: 'ins', at: 3.0, box: [45, 51, 14, 10] },
      kite: { kind: 'ins', at: 4.6, box: [69, 7, 18, 22] }
    };
    var ORDER = ['ball', 'fris', 'kite'];
    var LINES = [
      [{ s: 'A man throws a' }],
      [{ s: 'green ', id: 'fris', grow: true }, { s: 'frisbee to a dog' }],
      [{ s: 'with a ball', id: 'ball' }, { s: ' in a park.' }],
      [{ s: 'A blue kite flies', id: 'kite', from: 0.4, to: 1.3 }],
      [{ s: 'overhead.', id: 'kite', from: 1.3, to: 1.8 }]
    ];

    function paint(g) {
      var sky = g.createLinearGradient(0, 0, 0, 72);
      sky.addColorStop(0, '#e4ebf3'); sky.addColorStop(1, '#f3f5f7');
      g.fillStyle = sky; g.fillRect(0, 0, IMG.w, 73);
      g.fillStyle = '#e1e8d5'; g.fillRect(0, 72, IMG.w, IMG.h - 72);
      g.fillStyle = '#d3dcc4'; g.fillRect(0, 72, IMG.w, 1.5);
      // kite and string
      g.strokeStyle = '#9aa1ad'; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(78, 26); g.quadraticCurveTo(90, 46, IMG.w, 62); g.stroke();
      g.fillStyle = '#3f6fb0';
      g.beginPath(); g.moveTo(78, 10); g.lineTo(84, 18); g.lineTo(78, 26); g.lineTo(72, 18); g.closePath(); g.fill();
      // man throwing
      g.strokeStyle = '#3d4250'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(24, 96); g.lineTo(21, 110); g.moveTo(28, 96); g.lineTo(32, 110); g.stroke();
      g.fillStyle = '#5a6b8c'; rrect(g, 21, 76, 10, 21, 3); g.fill();
      g.beginPath(); g.moveTo(30, 79); g.lineTo(41, 67); g.moveTo(22, 79); g.lineTo(16, 89); g.stroke();
      dot(g, 26, 70, 4.6, '#3d4250');
      // frisbee in flight
      g.strokeStyle = '#c3c8d2'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(40, 60); g.lineTo(46, 57.5); g.stroke();
      g.fillStyle = '#5e9a6e';
      g.beginPath(); g.ellipse(52, 56, 5, 2, -0.2, 0, Math.PI * 2); g.fill();
      // dog
      g.fillStyle = '#a07b5a';
      g.beginPath(); g.ellipse(70, 104, 9, 4.5, 0, 0, Math.PI * 2); g.fill();
      dot(g, 79, 99, 3.6, '#a07b5a');
      g.strokeStyle = '#a07b5a'; g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(64, 107); g.lineTo(63, 113); g.moveTo(76, 107); g.lineTo(77, 113);
      g.moveTo(61, 102); g.lineTo(57, 98); g.stroke();
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
        'model first wrote. A hallucinated "with a ball" is struck out because the detector finds no ball ' +
        '(dashed box, not found), and verified details are inserted in color: the frisbee is green, and a ' +
        'small blue kite flies overhead. Each edit is linked to its image region. Hover a phrase or a box to ' +
        'highlight its partner; click to switch between the original and the corrected caption.',
      init: function (s) { s.manual = false; s.vu = 0; s.goal = 0; s.touch = 0; s.segs = []; s.anchor = {}; s.uNow = 0; },
      click: function (s, t) {
        if (!s.manual) { s.manual = true; s.vu = Math.min(s.uNow, HOLD); s.goal = s.vu > 3.3 ? 0 : HOLD; }
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
            var lx = IMG.x + IMG.w - 4, ly = r.y + r.h + 10;
            g.fillStyle = 'rgba(255,255,255,0.85)';
            rrect(g, lx - 40, ly - 7.5, 41, 10, 2); g.fill();
            text(g, 'not found', lx, ly, { size: 7.5, color: on ? C.fg : C.muted, align: 'right' });
          } else {
            g.strokeStyle = C.accent;
            g.lineWidth = on ? 1.8 : 1.1;
            g.strokeRect(r.x, r.y, r.w, r.h);
          }
          g.restore();
        });

        // Caption, laid out line by line; insertions push the rest of their line to the right.
        var head = vu < ITEMS.ball.at ? 'VLM caption' : vu < HOLD - 0.2 ? 'verifying' : 'verified caption';
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
