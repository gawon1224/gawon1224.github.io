/* Interactive teasers for the publication list.
   Every <canvas class="pub-anim" data-anim="name"> is driven by the scene of that name below.
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

  /* ---------- ACID: cycle action consistency rejects unrealizable plans ---------- */

  (function () {
    var S = { x: 26, y: 100 };
    var WALL = { x: 114, w: 8, y1: 88 };
    var N = 10;
    var CYCLE = 6.8, HOLD = 6.2;

    function blocked(a, b) {
      if (!(a.x < WALL.x + WALL.w && b.x > WALL.x)) return false;
      var f = clamp((WALL.x - a.x) / ((b.x - a.x) || 1), 0, 1);
      return lerp(a.y, b.y, f) < WALL.y1;
    }

    // Execute a plan's actions (its step deltas) in the real environment, where the wall stops you.
    function rollout(plan) {
      var p = { x: plan[0].x, y: plan[0].y }, out = [{ x: p.x, y: p.y }];
      for (var i = 1; i < plan.length; i++) {
        var n = { x: p.x + plan[i].x - plan[i - 1].x, y: p.y + plan[i].y - plan[i - 1].y };
        if (p.x <= WALL.x && blocked(p, n)) n.x = WALL.x - 3;
        p = n;
        out.push({ x: p.x, y: p.y });
      }
      return out;
    }

    function plans(s) {
      var G = s.G, i;
      var straight = [];
      for (i = 0; i <= N; i++) straight.push({ x: lerp(S.x, G.x, i / N), y: lerp(S.y, G.y, i / N) });

      // A quadratic curve forced through a point under the wall, resampled at equal arc length.
      var M = { x: 118, y: 114 };
      var cx = 2 * M.x - (S.x + G.x) / 2, cy = 2 * M.y - (S.y + G.y) / 2;
      var pts = [], len = [0];
      for (i = 0; i <= 120; i++) {
        var q = i / 120, a = (1 - q) * (1 - q), b = 2 * q * (1 - q), c = q * q;
        pts.push({ x: a * S.x + b * cx + c * G.x, y: a * S.y + b * cy + c * G.y });
        if (i) len.push(len[i - 1] + dist(pts[i], pts[i - 1]));
      }
      var around = [], j = 0;
      for (i = 0; i <= N; i++) {
        var target = len[120] * i / N;
        while (j < 119 && len[j + 1] < target) j++;
        var f = (target - len[j]) / ((len[j + 1] - len[j]) || 1);
        around.push({ x: lerp(pts[j].x, pts[j + 1].x, f), y: lerp(pts[j].y, pts[j + 1].y, f) });
      }

      s.straight = straight;
      s.around = around;
      s.straightReal = rollout(straight);
      s.aroundReal = rollout(around);
      s.cross = 1;
      for (i = 1; i <= N; i++) if (blocked(straight[i - 1], straight[i])) { s.cross = i; break; }
    }

    scenes.acid = {
      label: 'ACID: a world model imagines two plans to the goal. The straight one passes through a wall; ' +
        'the inverse dynamics model recovers an action that disagrees with the planned one, so ACID rejects it ' +
        'and executes the plan around the wall. Click to switch between the baseline cost and ACID, drag the goal to move it.',
      init: function (s) {
        s.mode = 'base';
        s.auto = true;
        s.G = { x: 206, y: 36 };
        plans(s);
      },
      click: function (s, t) {
        s.auto = false;
        s.mode = s.mode === 'base' ? 'acid' : 'base';
        s.start = t;
      },
      press: function (s) {
        s.dragGoal = dist(s.p, s.G) < 16;
      },
      drag: function (s, t) {
        if (!s.dragGoal) return;
        s.G.x = clamp(s.p.x, 160, 226);
        s.G.y = clamp(s.p.y, 16, 66);
        plans(s);
        s.start = t - 2.9;
      },
      release: function (s) { s.dragGoal = false; },
      draw: function (g, s, t) {
        var u = s.reduce ? HOLD : cycle(s, t, CYCLE, function () {
          if (s.auto) s.mode = s.mode === 'base' ? 'acid' : 'base';
        });
        var isAcid = s.mode === 'acid';
        var G = s.G;

        g.fillStyle = '#d7dbe3';
        g.fillRect(WALL.x, 0, WALL.w, WALL.y1);

        var k = span(u, 0.3, 1.8) * N;
        var decide = span(u, 2.0, 2.9);
        var chosen = isAcid ? s.around : s.straight;
        var other = isAcid ? s.straight : s.around;
        var real = isAcid ? s.aroundReal : s.straightReal;
        var tone = isAcid ? C.accent : C.fg;

        // Both candidates are imagined; the cost decides which one survives.
        path(g, other, k, C.faint, 1.2, [3, 3], 1 - 0.75 * decide);
        path(g, chosen, k, decide > 0 ? tone : C.faint, 1.2, [3, 3], 1 - 0.45 * span(u, 3.0, 3.6));
        for (var i = 1; i <= Math.min(Math.floor(k), N); i++) {
          dot(g, chosen[i].x, chosen[i].y, 1.3, decide > 0 ? tone : C.faint);
        }

        // ACID: the action recovered by inverse dynamics (a-hat) disagrees with the conditioned one (a).
        if (isAcid && u > 1.8) {
          var a = s.straight[s.cross - 1], b = s.straight[s.cross];
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          var pop = ease(span(u, 1.8, 2.2));
          g.save();
          g.globalAlpha = pop * (1 - 0.6 * span(u, 3.0, 3.6));
          ring(g, mx, my, 6, C.fg, 1.1);
          g.strokeStyle = C.fg;
          g.lineWidth = 1.1;
          g.beginPath();
          g.moveTo(mx - 2.6, my - 2.6); g.lineTo(mx + 2.6, my + 2.6);
          g.moveTo(mx + 2.6, my - 2.6); g.lineTo(mx - 2.6, my + 2.6);
          g.stroke();
          text(g, 'a ≠ â', mx - 22, my - 9, { size: 8.5, weight: 500 });
          g.restore();
        }

        dot(g, S.x, S.y, 3, C.fg);
        ring(g, G.x, G.y, 5, C.accent, 1.3);
        dot(g, G.x, G.y, 1.4, C.accent);

        // Real execution of the chosen plan's actions.
        var e = span(u, 3.0, 5.0) * N;
        if (e > 0) {
          path(g, real, e, tone, 1.8, null, 1);
          var p = along(real, e);
          dot(g, p.x, p.y, 3.2, tone);
        }

        var end = real[N];
        var reached = dist(end, G) < 8;
        if (u > 5.0) {
          var r = ease(span(u, 5.0, 5.4));
          if (reached) {
            ring(g, G.x, G.y, 5 + 5 * r, C.accent, 1.2);
          } else {
            g.save();
            g.globalAlpha = r;
            g.setLineDash([2, 2]);
            g.strokeStyle = C.muted;
            g.lineWidth = 1;
            g.beginPath(); g.moveTo(end.x, end.y); g.lineTo(G.x, G.y); g.stroke();
            g.restore();
          }
        }

        text(g, isAcid ? 'ACID cost' : 'baseline cost', 6, 12,
          { size: 9, weight: isAcid ? 600 : 500, color: isAcid ? C.accent : C.muted });
        var status = u < 1.8 ? 'imagine' :
          u < 3.0 ? (isAcid ? 'check a vs â' : 'pick by goal distance') :
          u < 5.0 ? 'execute' : reached ? 'reached the goal' : 'drifted off the plan';
        text(g, status, 6, 129, { size: 8.5, color: C.fg });
        text(g, 'click · drag goal', 236, 129, { size: 7.5, color: C.muted, align: 'right' });
      }
    };
  })();

  /* ---------- CompACT (8 tokens): fewer tokens per frame, far more imagined rollouts ---------- */

  (function () {
    var F = { x: 8, y: 22, s: 64 };
    var START = { x: 116, y: 100 }, GOAL = { x: 224, y: 34 };
    var NEED = 24, CYCLE = 5.4, HOLD = 3.6;

    var rollouts = [];
    (function () {
      for (var i = 0; i < NEED; i++) {
        var r = rng(i * 7919 + 13), p = { x: START.x, y: START.y }, pts = [{ x: p.x, y: p.y }];
        var bias = (r() - 0.5) * 1.6;
        for (var j = 0; j < 7; j++) {
          var h = Math.atan2(GOAL.y - p.y, GOAL.x - p.x) + bias + (r() - 0.5) * 0.6;
          var step = 14 + r() * 3;
          p = { x: p.x + step * Math.cos(h), y: Math.max(26, p.y + step * Math.sin(h)) };
          pts.push({ x: p.x, y: p.y });
        }
        rollouts.push({ pts: pts, d: dist(p, GOAL) });
      }
    })();
    var best = 0;
    rollouts.forEach(function (r, i) { if (r.d < rollouts[best].d) best = i; });

    function frame(g, few, u) {
      g.save();
      rrect(g, F.x, F.y, F.s, F.s, 3);
      g.fillStyle = '#f2efe9'; g.fill();
      g.clip();
      g.fillStyle = '#e4ddd0'; g.fillRect(F.x, F.y + 44, F.s, 20);
      g.fillStyle = '#5b606b'; g.fillRect(F.x + 12, F.y + 14, 14, 6);
      g.fillRect(F.x + 24, F.y + 12, 3, 10);
      g.fillStyle = C.accent; g.fillRect(F.x + 36, F.y + 30, 11, 11);
      ring(g, F.x + 50, F.y + 52, 4, C.muted, 1);
      if (!few) {
        // One token per 4x4 patch: 16 x 16 = 256.
        var c = F.s / 16, scan = Math.floor((u * 60) % 256);
        g.fillStyle = 'rgba(176, 21, 79, 0.18)';
        g.fillRect(F.x + (scan % 16) * c, F.y + Math.floor(scan / 16) * c, c, c);
        g.strokeStyle = 'rgba(32, 35, 42, 0.16)';
        g.lineWidth = 0.5;
        g.beginPath();
        for (var i = 1; i < 16; i++) {
          g.moveTo(F.x + i * c, F.y); g.lineTo(F.x + i * c, F.y + F.s);
          g.moveTo(F.x, F.y + i * c); g.lineTo(F.x + F.s, F.y + i * c);
        }
        g.stroke();
      }
      g.restore();
      g.strokeStyle = C.line; g.lineWidth = 1;
      rrect(g, F.x, F.y, F.s, F.s, 3); g.stroke();
    }

    scenes.compact8 = {
      label: 'CompACT: each observation is encoded into 8 discrete tokens instead of 256, so a planner can ' +
        'imagine many more rollouts with the world model and reach the goal in time. Click to switch between 256 and 8 tokens.',
      init: function (s) { s.few = false; s.auto = true; },
      click: function (s, t) { s.auto = false; s.few = !s.few; s.start = t; },
      draw: function (g, s, t) {
        var u = s.reduce ? HOLD : cycle(s, t, CYCLE, function () { if (s.auto) s.few = !s.few; });
        var few = s.few;
        var rate = few ? 24 : 1.3;
        var done = Math.min(NEED, Math.max(0, (u - 0.4) * rate));
        var tPlan = 0.4 + NEED / rate;
        var planned = done >= NEED;

        text(g, 'observation', F.x, 14, { size: 8, color: C.muted });
        frame(g, few, u);

        // The token column: 8 chips, or a column that cannot hold 256.
        var cx = 80, cw = 14;
        if (few) {
          for (var i = 0; i < 8; i++) {
            var pop = ease(span(u, 0.05 * i, 0.05 * i + 0.25));
            g.globalAlpha = pop;
            rrect(g, cx, F.y + i * 8.1, cw, 6.5, 1.5);
            g.fillStyle = i === 3 ? C.accent : ['#4a4f5a', '#9aa1ad', '#6d7380', '#c3c8d2'][i % 4];
            g.fill();
            g.globalAlpha = 1;
          }
        } else {
          g.fillStyle = '#9aa1ad';
          for (var j = 0; j < 32; j++) g.fillRect(cx, F.y + j * 2, cw, 1.1);
        }
        text(g, few ? '8 tokens' : '256 tokens', F.x, 106, { size: 9, weight: 600, color: few ? C.accent : C.fg });
        text(g, 'per frame', F.x, 116, { size: 8, color: C.muted });
        text(g, 'click: 256 ⇄ 8', F.x, 129, { size: 7.5, color: C.muted });

        text(g, 'imagined rollouts', 106, 14, { size: 8, color: C.muted });
        for (var r = 0; r < Math.floor(done); r++) {
          if (planned && r === best) continue;
          path(g, rollouts[r].pts, 7, C.faint, 0.8, null, planned ? 0.6 : 1);
        }
        if (!planned && done > 0) {
          var cur = rollouts[Math.floor(done) % NEED];
          path(g, cur.pts, (done % 1) * 7, C.muted, 0.9, null, 1);
        }
        if (planned) {
          path(g, rollouts[best].pts, 7, C.accent, 1.6, null, 1);
          var p = along(rollouts[best].pts, span(u, tPlan + 0.1, tPlan + 1.3) * 7);
          dot(g, p.x, p.y, 3.2, C.accent);
        }
        dot(g, START.x, START.y, 3, C.fg);
        ring(g, GOAL.x, GOAL.y, 5, C.accent, 1.3);
        dot(g, GOAL.x, GOAL.y, 1.4, C.accent);

        var bx = 106, bw = 130;
        g.fillStyle = C.line; g.fillRect(bx, 113, bw, 3);
        g.fillStyle = planned ? C.accent : C.muted; g.fillRect(bx, 113, bw * done / NEED, 3);
        text(g, planned ? 'plan ready' : 'planning… ' + Math.floor(done) + '/' + NEED, bx, 127,
          { size: 8.5, color: planned ? C.accent : C.fg });
      }
    };
  })();

  /* ---------- CompACT (16 tokens): only the tokens that matter for planning change ---------- */

  (function () {
    var OBS = { x: 6, y: 24, s: 76 }, DEC = { x: 158, y: 24, s: 76 };
    var TOK = { x: 97, y: 39, c: 11, gap: 1.3 };
    var GOAL = { x: 0.78, y: 0.24 };
    var BG = [];
    (function () { var r = rng(42); for (var i = 0; i < 16; i++) BG.push(Math.floor(r() * 256)); })();
    var SPECKS = [];
    (function () { var r = rng(7); for (var i = 0; i < 46; i++) SPECKS.push([r(), r(), 0.4 + r() * 0.8]); })();
    // Which token slots carry the block and the gripper.
    var BLOCK = [5, 6], GRIP = [9, 10];

    function q(v) { return Math.round(clamp(v, 0, 1) * 7); }

    function codes(s) {
      var out = BG.slice();
      out[BLOCK[0]] = (BG[BLOCK[0]] + q(s.block.x) * 37) & 255;
      out[BLOCK[1]] = (BG[BLOCK[1]] + q(s.block.y) * 53) & 255;
      out[GRIP[0]] = (BG[GRIP[0]] + q(s.grip.x) * 41) & 255;
      out[GRIP[1]] = (BG[GRIP[1]] + q(s.grip.y) * 29) & 255;
      return out;
    }

    function scene(g, box, block, grip, textured) {
      var x = box.x, y = box.y, n = box.s;
      g.save();
      rrect(g, x, y, n, n, 3);
      g.fillStyle = textured ? '#efe6d6' : '#f4f5f8';
      g.fill();
      g.clip();
      if (textured) {
        g.strokeStyle = '#e3d6bf'; g.lineWidth = 0.8;
        for (var i = 0; i < 9; i++) {
          g.beginPath();
          for (var k = 0; k <= 8; k++) {
            var px = x + k * n / 8, py = y + 5 + i * 8.6 + Math.sin(k * 1.3 + i) * 1.4;
            if (k) g.lineTo(px, py); else g.moveTo(px, py);
          }
          g.stroke();
        }
        g.fillStyle = '#d6c6a8';
        SPECKS.forEach(function (p) { g.fillRect(x + p[0] * n, y + p[1] * n, p[2], p[2]); });
      }
      g.setLineDash([2, 2]);
      g.strokeStyle = C.muted; g.lineWidth = 0.9;
      g.strokeRect(x + GOAL.x * n - 7, y + GOAL.y * n - 7, 14, 14);
      g.setLineDash([]);

      var b = 11, bx = x + block.x * n, by = y + block.y * n;
      if (textured) { g.fillStyle = 'rgba(0, 0, 0, 0.12)'; g.fillRect(bx - b / 2 + 1.5, by - b / 2 + 1.5, b, b); }
      g.fillStyle = C.accent; g.fillRect(bx - b / 2, by - b / 2, b, b);
      if (textured) { g.fillStyle = 'rgba(255, 255, 255, 0.28)'; g.fillRect(bx - b / 2, by - b / 2, b, 2.5); }

      var gx = x + grip.x * n, gy = y + grip.y * n;
      g.fillStyle = textured ? '#4a4f5a' : '#8a909c';
      g.fillRect(gx - 7, gy - 2.5, 7, 5);
      g.fillRect(gx - 1, gy - 6, 2, 12);
      g.fillRect(gx - 1, gy - 6, 5, 2);
      g.fillRect(gx - 1, gy + 4, 5, 2);
      g.restore();
      g.strokeStyle = C.line; g.lineWidth = 1;
      rrect(g, x, y, n, n, 3); g.stroke();
    }

    scenes.compact16 = {
      label: 'CompACT with 16 tokens: an observation of a gripper and a block is encoded into 16 discrete tokens ' +
        'and decoded back. Moving the block changes only the few tokens that encode it, and the decoded scene keeps ' +
        'the layout while dropping the texture. Move the pointer over the observation to move the block.',
      init: function (s) {
        s.block = { x: 0.55, y: 0.55 };
        s.grip = { x: 0.35, y: 0.55 };
        s.prev = null;
        s.flash = [];
      },
      click: function () {},
      draw: function (g, s, t) {
        var dt = Math.min(0.05, s.dt || 0.016);
        var tt = s.reduce ? 2.0 : t;
        var p = s.p, over = p.in && p.x > OBS.x && p.x < OBS.x + OBS.s && p.y > OBS.y && p.y < OBS.y + OBS.s;
        var target = over
          ? { x: (p.x - OBS.x) / OBS.s, y: (p.y - OBS.y) / OBS.s }
          : { x: 0.52 + 0.26 * Math.cos(tt * 0.7), y: 0.55 + 0.24 * Math.sin(tt * 1.1) };
        target.x = clamp(target.x, 0.22, 0.9);
        target.y = clamp(target.y, 0.12, 0.88);
        var kb = s.reduce ? 1 : 1 - Math.exp(-dt * 9), kg = s.reduce ? 1 : 1 - Math.exp(-dt * 3);
        s.block.x += (target.x - s.block.x) * kb;
        s.block.y += (target.y - s.block.y) * kb;
        s.grip.x += (s.block.x - 0.15 - s.grip.x) * kg;
        s.grip.y += (s.block.y - s.grip.y) * kg;

        var now = codes(s);
        if (s.prev) for (var i = 0; i < 16; i++) if (now[i] !== s.prev[i]) s.flash[i] = t;
        s.prev = now;

        text(g, 'observation', OBS.x + OBS.s / 2, 16, { size: 8, color: C.muted, align: 'center' });
        text(g, '16 tokens', TOK.x + 24, 16, { size: 8, color: C.muted, align: 'center' });
        text(g, 'decoded', DEC.x + DEC.s / 2, 16, { size: 8, color: C.muted, align: 'center' });

        scene(g, OBS, s.block, s.grip, true);
        // The decoder only sees the discrete codes, so it places things on the quantized grid.
        scene(g, DEC, { x: q(s.block.x) / 7, y: q(s.block.y) / 7 }, { x: q(s.grip.x) / 7, y: q(s.grip.y) / 7 }, false);

        arrow(g, OBS.x + OBS.s + 3, 62, TOK.x - 3, 62, C.muted);
        arrow(g, TOK.x + 4 * TOK.c + 3 * TOK.gap + 3, 62, DEC.x - 3, 62, C.muted);

        var changed = 0;
        for (var j = 0; j < 16; j++) {
          var cx = TOK.x + (j % 4) * (TOK.c + TOK.gap), cy = TOK.y + Math.floor(j / 4) * (TOK.c + TOK.gap);
          var v = now[j];
          rrect(g, cx, cy, TOK.c, TOK.c, 1.5);
          g.fillStyle = 'hsl(222, 9%, ' + (34 + (v % 58)) + '%)';
          g.fill();
          g.fillStyle = 'rgba(255, 255, 255, 0.55)';
          if (v & 1) g.fillRect(cx + 2, cy + 2, 3, 3);
          if (v & 2) g.fillRect(cx + 6, cy + 2, 3, 3);
          if (v & 4) g.fillRect(cx + 2, cy + 6, 3, 3);
          if (v & 8) g.fillRect(cx + 6, cy + 6, 3, 3);
          var age = s.flash[j] == null ? 9 : t - s.flash[j];
          if (age < 0.8) {
            changed++;
            g.globalAlpha = 1 - age / 0.8;
            g.strokeStyle = C.accent; g.lineWidth = 1.6;
            rrect(g, cx - 0.8, cy - 0.8, TOK.c + 1.6, TOK.c + 1.6, 2); g.stroke();
            g.globalAlpha = 1;
          }
        }

        text(g, changed + ' of 16 tokens changed', W / 2, 116,
          { size: 8.5, color: changed ? C.accent : C.fg, align: 'center', weight: 500 });
        text(g, over ? 'texture dropped, layout kept' : 'hover the observation to move the block', W / 2, 129,
          { size: 7.5, color: C.muted, align: 'center' });
      }
    };
  })();

  /* ---------- Detailed captions: predict co-occurring objects, verify with a detector ---------- */

  (function () {
    var IMG = { x: 6, y: 6, w: 136, h: 123 };
    var STAGES = [
      { at: 0.0, name: 'VLM at 336px' },
      { at: 1.8, name: 'LLM guesses' },
      { at: 3.4, name: 'detector checks' },
      { at: 5.2, name: 'region captions' },
      { at: 7.0, name: 'final caption' }
    ];
    var CYCLE = 8.6, HOLD = 7.6;
    var ITEMS = [
      { w: 'person', kind: 'keep', at: 0.2 },
      { w: 'dog', kind: 'keep', at: 0.45 },
      { w: 'tree', kind: 'keep', at: 0.7 },
      { w: 'bench', kind: 'keep', at: 0.95 },
      { w: 'ball', kind: 'drop', at: 1.2 },
      { w: 'frisbee', kind: 'add', at: 2.0, final: 'red frisbee', box: [99, 47, 14, 10], lens: 5.2 },
      { w: 'leash', kind: 'reject', at: 2.3 },
      { w: 'kite', kind: 'add', at: 2.6, final: 'blue kite', box: [104, 8, 16, 17], lens: 6.1 }
    ];

    function paint(g) {
      var sky = g.createLinearGradient(0, 0, 0, 80);
      sky.addColorStop(0, '#e4ebf3'); sky.addColorStop(1, '#f3f5f7');
      g.fillStyle = sky; g.fillRect(0, 0, IMG.w, 80);
      g.fillStyle = '#e1e8d5'; g.fillRect(0, 78, IMG.w, IMG.h - 78);
      g.fillStyle = '#d3dcc4'; g.fillRect(0, 78, IMG.w, 1.5);
      // tree
      g.fillStyle = '#8b7b6b'; g.fillRect(17, 48, 6, 34);
      dot(g, 20, 40, 15, '#9fb39a'); dot(g, 10, 51, 10, '#93a98e'); dot(g, 31, 51, 10, '#a9bca4');
      // bench
      g.fillStyle = '#7d6e60';
      g.fillRect(34, 88, 28, 3); g.fillRect(34, 81, 28, 2.5);
      g.fillRect(36, 91, 2, 7); g.fillRect(58, 91, 2, 7);
      // person throwing
      g.strokeStyle = '#3d4250'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(72, 88); g.lineTo(69, 101); g.moveTo(76, 88); g.lineTo(80, 101); g.stroke();
      g.fillStyle = '#5a6b8c'; rrect(g, 69, 69, 10, 20, 3); g.fill();
      g.beginPath(); g.moveTo(78, 72); g.lineTo(90, 62); g.moveTo(70, 72); g.lineTo(64, 82); g.stroke();
      dot(g, 74, 63, 4.4, '#3d4250');
      // dog
      g.fillStyle = '#a07b5a';
      g.beginPath(); g.ellipse(103, 99, 9, 4.5, 0, 0, Math.PI * 2); g.fill();
      dot(g, 112, 94, 3.6, '#a07b5a');
      g.strokeStyle = '#a07b5a'; g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(97, 102); g.lineTo(96, 108); g.moveTo(109, 102); g.lineTo(110, 108);
      g.moveTo(94, 97); g.lineTo(90, 93); g.stroke();
      // frisbee: small enough to vanish when downscaled
      g.fillStyle = C.accent;
      g.beginPath(); g.ellipse(106, 52, 4.5, 1.8, -0.2, 0, Math.PI * 2); g.fill();
      // kite and string
      g.strokeStyle = '#9aa1ad'; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(112, 24); g.quadraticCurveTo(128, 50, IMG.w, 70); g.stroke();
      g.fillStyle = '#3f6fb0';
      g.beginPath(); g.moveTo(112, 9); g.lineTo(118, 16); g.lineTo(112, 24); g.lineTo(106, 16); g.closePath(); g.fill();
    }

    function buffers(s) {
      if (s.bufK === s.k) return;
      s.bufK = s.k;
      var hi = document.createElement('canvas');
      hi.width = Math.ceil(IMG.w * s.k); hi.height = Math.ceil(IMG.h * s.k);
      var hg = hi.getContext('2d');
      hg.scale(s.k, s.k); paint(hg);
      var lo = document.createElement('canvas');
      lo.width = 30; lo.height = 27;
      var lg = lo.getContext('2d');
      lg.scale(lo.width / IMG.w, lo.height / IMG.h); paint(lg);
      s.hi = hi; s.lo = lo;
    }

    function stageAt(u) {
      var i = 0;
      while (i + 1 < STAGES.length && u >= STAGES[i + 1].at) i++;
      return i;
    }

    // A magnifier at (cx, cy) showing the full-resolution image around (fx, fy).
    function lens(g, s, cx, cy, r, zoom, fx, fy) {
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      g.translate(cx, cy); g.scale(zoom, zoom); g.translate(-fx, -fy);
      g.drawImage(s.hi, IMG.x, IMG.y, IMG.w, IMG.h);
      g.restore();
      ring(g, cx, cy, r, C.fg, 1.2);
    }

    scenes.caption = {
      label: 'Detailed captions for high-resolution images: a VLM sees a downscaled image and misses small objects. ' +
        'An LLM predicts objects that likely co-occur, an object detector verifies them, verified objects get ' +
        'region captions, and undetected mentions are removed. Click to step through the stages, hover to see full resolution.',
      init: function () {},
      click: function (s, t) {
        var u = t - s.start, i = stageAt(u);
        s.start = i + 1 < STAGES.length ? t - STAGES[i + 1].at : t;
      },
      draw: function (g, s, t) {
        buffers(s);
        var u = s.reduce ? HOLD : cycle(s, t, CYCLE);
        var st = stageAt(u);
        var sharp = ease(span(u, 3.4, 4.0));

        g.save();
        rrect(g, IMG.x, IMG.y, IMG.w, IMG.h, 3); g.clip();
        g.imageSmoothingEnabled = false;
        g.drawImage(s.lo, IMG.x, IMG.y, IMG.w, IMG.h);
        g.imageSmoothingEnabled = true;
        if (sharp > 0) { g.globalAlpha = sharp; g.drawImage(s.hi, IMG.x, IMG.y, IMG.w, IMG.h); g.globalAlpha = 1; }

        ITEMS.forEach(function (it) {
          if (!it.box) return;
          var a = ease(span(u, 3.8, 4.3));
          if (a <= 0) return;
          g.globalAlpha = a;
          g.strokeStyle = C.accent; g.lineWidth = 1;
          g.strokeRect(IMG.x + it.box[0], IMG.y + it.box[1], it.box[2], it.box[3]);
          g.globalAlpha = 1;
        });
        g.restore();
        g.strokeStyle = C.line; g.lineWidth = 1;
        rrect(g, IMG.x, IMG.y, IMG.w, IMG.h, 3); g.stroke();

        // Region captioning zooms into each newly verified object.
        ITEMS.forEach(function (it) {
          if (!it.lens) return;
          var a = span(u, it.lens, it.lens + 0.9);
          if (a <= 0 || a >= 1) return;
          var cx = IMG.x + it.box[0] + it.box[2] / 2, cy = IMG.y + it.box[1] + it.box[3] / 2;
          g.globalAlpha = Math.min(1, Math.min(a, 1 - a) * 6);
          lens(g, s, clamp(cx, IMG.x + 24, IMG.x + IMG.w - 24), clamp(cy, IMG.y + 24, IMG.y + IMG.h - 24), 21, 2.4, cx, cy);
          g.globalAlpha = 1;
        });

        var p = s.p;
        if (p.in && p.x > IMG.x && p.x < IMG.x + IMG.w && p.y > IMG.y && p.y < IMG.y + IMG.h) {
          lens(g, s, p.x, p.y, 19, 1.9, p.x, p.y);
        }

        var x = 150;
        text(g, STAGES[st].name, x, 14, { size: 8, weight: 600, color: C.accent });
        ITEMS.forEach(function (it, i) {
          var a = ease(span(u, it.at, it.at + 0.25));
          if (a <= 0) return;
          var y = 30 + i * 12.2, o = { size: 9, alpha: a, color: C.fg };
          var label = it.w;
          if (it.kind === 'add') {
            if (u < 3.9) { label = it.w + '?'; o.color = C.muted; }
            else if (u < it.lens + 0.5) { label = it.w + ' ✓'; }
            else { label = '+ ' + it.final; o.color = C.accent; o.weight = 500; }
          } else if (it.kind === 'reject') {
            label = it.w + '?';
            o.color = C.muted;
            if (u >= 3.9) { label = it.w + ' ✗'; o.strike = true; }
          } else if (it.kind === 'drop' && u >= 3.9) {
            label = it.w + ' ✗';
            o.color = C.muted;
            o.strike = true;
          }
          text(g, label, x, y, o);
        });
        text(g, 'click · hover', 236, 129, { size: 7.5, color: C.muted, align: 'right' });
      }
    };
  })();

  /* ---------- Comparative descriptors: separate a class from its look-alikes ---------- */

  (function () {
    var EMB = { x: 6, y: 6, w: 128, h: 106 };
    var IMGPT = { x: 70, y: 62 };
    var CLASSES = [
      { name: 'raven', gen: { x: 48, y: 42 }, cmp: { x: 74, y: 50 }, true: true },
      { name: 'crow', gen: { x: 86, y: 74 }, cmp: { x: 104, y: 88 } },
      { name: 'rook', gen: { x: 36, y: 90 }, cmp: { x: 34, y: 94 } },
      { name: 'gull', gen: { x: 116, y: 30 }, cmp: { x: 116, y: 30 } }
    ];
    var GENERIC = [
      { x: 62, y: 56, s: '"a black bird with a beak"' },
      { x: 79, y: 66, s: '"black feathers"' }
    ];
    var COMPARATIVE = [
      { x: 66, y: 44, s: 'raven vs crow: "wedge-shaped tail"' },
      { x: 60, y: 52, s: 'raven vs crow: "shaggy throat feathers"' },
      { x: 116, y: 62, s: 'filtered, far from the image: "lives in cities"', filtered: true }
    ];
    var CYCLE = 9.0, HOLD = 3.6;

    function pos(c, m) { return { x: lerp(c.gen.x, c.cmp.x, m), y: lerp(c.gen.y, c.cmp.y, m) }; }

    function scores(m) {
      var e = CLASSES.map(function (c) { return Math.exp(-dist(pos(c, m), IMGPT) / 9); });
      var sum = e.reduce(function (a, b) { return a + b; }, 0);
      return e.map(function (v) { return v / sum; });
    }

    scenes.comparative = {
      label: 'Comparative descriptors: in CLIP space a raven photo sits closer to "crow" than to "raven" with generic ' +
        'descriptors. Comparative descriptors describe what sets a raven apart from a crow, pull the raven text ' +
        'embedding toward the image and fix the top-1 prediction; descriptors far from the image are filtered out. Click to compare.',
      init: function (s) { s.cmp = false; s.auto = true; s.mix = 0; },
      click: function (s, t) { s.auto = false; s.cmp = !s.cmp; s.start = t; },
      draw: function (g, s, t) {
        var u = s.reduce ? HOLD : cycle(s, t, CYCLE / 2, function () { if (s.auto) s.cmp = !s.cmp; });
        var dt = Math.min(0.05, s.dt || 0.016);
        var goal = s.cmp ? 1 : 0;
        s.mix = s.reduce ? goal : s.mix + (goal - s.mix) * (1 - Math.exp(-dt * 4));
        var m = ease(s.mix);

        g.strokeStyle = C.line; g.lineWidth = 1;
        rrect(g, EMB.x, EMB.y, EMB.w, EMB.h, 3); g.stroke();
        text(g, s.cmp ? 'comparative descriptors' : 'generic descriptors', EMB.x + 5, EMB.y + 10,
          { size: 8, weight: 600, color: s.cmp ? C.accent : C.muted });

        // Descriptor points: generic ones fade out, comparative ones appear one by one.
        var shown = [], p = s.p, hover = null;
        GENERIC.forEach(function (d) {
          var a = 1 - m;
          if (a < 0.05) return;
          dot(g, d.x, d.y, 2.2, 'rgba(99, 106, 120, ' + (0.7 * a) + ')');
          shown.push({ d: d, color: C.muted });
        });
        var raven = pos(CLASSES[0], m);
        COMPARATIVE.forEach(function (d, i) {
          var a = s.cmp ? ease(span(u, 0.4 + 0.5 * i, 0.8 + 0.5 * i)) : m;
          if (a < 0.05) return;
          var gone = d.filtered && s.cmp ? span(u, 2.2, 2.8) : 0;
          g.save();
          g.globalAlpha = a * (1 - 0.7 * gone);
          if (!d.filtered) {
            g.strokeStyle = C.accent; g.lineWidth = 0.6; g.setLineDash([1.5, 1.5]);
            g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(raven.x, raven.y); g.stroke();
          }
          dot(g, d.x, d.y, 2.3, C.accent);
          if (gone > 0) {
            g.strokeStyle = C.fg; g.lineWidth = 1; g.setLineDash([]);
            g.beginPath();
            g.moveTo(d.x - 4, d.y - 4); g.lineTo(d.x + 4, d.y + 4);
            g.moveTo(d.x + 4, d.y - 4); g.lineTo(d.x - 4, d.y + 4);
            g.stroke();
          }
          g.restore();
          shown.push({ d: d, color: d.filtered ? C.muted : C.accent });
        });

        CLASSES.forEach(function (c) {
          var q = pos(c, m);
          g.fillStyle = C.fg;
          g.beginPath();
          g.moveTo(q.x, q.y - 3.2); g.lineTo(q.x + 3.2, q.y); g.lineTo(q.x, q.y + 3.2); g.lineTo(q.x - 3.2, q.y);
          g.closePath(); g.fill();
          text(g, c.name, q.x + (q.x > 100 ? -5 : 5), q.y + 3, { size: 8.5, align: q.x > 100 ? 'right' : 'left' });
        });

        // The photo, drawn as a tiny image icon.
        g.fillStyle = C.accent;
        rrect(g, IMGPT.x - 5, IMGPT.y - 4, 10, 8, 1.5); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(IMGPT.x - 3.5, IMGPT.y + 2.5); g.lineTo(IMGPT.x - 0.5, IMGPT.y - 1);
        g.lineTo(IMGPT.x + 3.5, IMGPT.y + 2.5); g.closePath(); g.fill();

        // Bars: CLIP similarity of the photo to each class.
        var sc = scores(m), top = 0;
        sc.forEach(function (v, i) { if (v > sc[top]) top = i; });
        var right = top === 0;
        text(g, 'top-1', 142, 14, { size: 8, color: C.muted });
        text(g, CLASSES[top].name + (right ? ' ✓' : ' ✗'), 236, 14,
          { size: 9, weight: 600, align: 'right', color: right ? C.accent : C.fg });
        CLASSES.forEach(function (c, i) {
          var y = 34 + i * 20;
          var w = text(g, c.name, 142, y, { size: 8.5, weight: i === top ? 600 : 400 });
          if (c.true) text(g, 'true', 146 + w, y, { size: 7, color: C.muted });
          g.fillStyle = C.line; g.fillRect(142, y + 4, 94, 4);
          g.fillStyle = i === top ? (right ? C.accent : C.fg) : '#9aa1ad';
          g.fillRect(142, y + 4, 94 * sc[i], 4);
        });

        // Caption strip: the descriptor under the pointer, or each one in turn.
        if (p.in) {
          shown.forEach(function (it) { if (dist(p, it.d) < 8) hover = it; });
        }
        var line = hover;
        if (!line && shown.length) line = shown[Math.floor(Math.max(0, u - 0.4) / 1.1) % shown.length];
        if (line) {
          text(g, line.d.s, 6, 128, { size: 8, color: line.color, strike: !!line.d.filtered && s.cmp && u > 2.2 });
        }
        text(g, 'click to compare', 236, 112, { size: 7.5, color: C.muted, align: 'right' });
      }
    };
  })();

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
      if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
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

  Array.prototype.forEach.call(document.querySelectorAll('canvas.pub-anim'), mount);
})();
