/* CompACT teaser (scenes "compact8" and "compact16"): a planning race between hundreds of patch tokens and
   one token per object mask, alternating robot manipulation and egocentric navigation.
   Registered on window.PubAnim from assets/js/pub-anim.js. */
(function (A) {
  'use strict';

  var C = A.C, text = A.text, rrect = A.rrect, dot = A.dot, ring = A.ring, path = A.path,
    along = A.along, cycle = A.cycle, clamp = A.clamp, lerp = A.lerp, ease = A.ease,
    span = A.span, dist = A.dist, rng = A.rng;

  var NAMES = { manipulation: 'robot manipulation', navigation: 'visual navigation' };
  // One colour per object, i.e. per token (or token pair).
  var PALETTE = {
    manipulation: ['#c9ced8', '#d9cbb2', '#9aa1ad', '#3f6fb0', '#5e9a6e', C.accent, '#6d7380', '#2f333b'],
    navigation: ['#ddd8cc', '#4a4f5a', '#a07b5a', '#7f93b5', '#b89a74', '#5e9a6e', C.accent, '#2f333b']
  };

  function other(d) { return d === 'manipulation' ? 'navigation' : 'manipulation'; }

  function hash(a, b) {
    var h = Math.imul(a * 73 + b * 151 + 41, 2654435761) >>> 0;
    return (h >>> 9) % 15 + 1;
  }

  function lum(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c || '');
    if (!m) return 0;
    var n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  // A discrete token: the object's colour plus a 2x2 bit pattern for its code.
  function chip(g, x, y, size, color, v, outline) {
    rrect(g, x, y, size, size, 1.5);
    g.fillStyle = color; g.fill();
    g.strokeStyle = 'rgba(32, 35, 42, 0.22)'; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = lum(color) > 0.7 ? 'rgba(32, 35, 42, 0.28)' : 'rgba(255, 255, 255, 0.6)';
    var c = size / 2 - 2;
    if (v & 1) g.fillRect(x + 1.5, y + 1.5, c, c);
    if (v & 2) g.fillRect(x + size / 2 + 0.5, y + 1.5, c, c);
    if (v & 4) g.fillRect(x + 1.5, y + size / 2 + 0.5, c, c);
    if (v & 8) g.fillRect(x + size / 2 + 0.5, y + size / 2 + 0.5, c, c);
    if (outline > 0) {
      g.save();
      g.globalAlpha *= outline;
      g.strokeStyle = C.accent; g.lineWidth = 1.3;
      rrect(g, x - 1.5, y - 1.5, size + 3, size + 3, 2); g.stroke();
      g.restore();
    }
  }

  /* ---------- planning race ---------- */

  // Object masks, one colour per object (i.e. per token or token pair), listed back to front.
  var MASKS = {
    manipulation: ['#8fb0dc', '#e2b35f', '#a084d6', '#f08a4b', '#d1c234', '#5fbf6a', '#e0507a', '#3fb3b0'],
    navigation: ['#8fb0dc', '#e2b35f', '#a084d6', '#3fb3b0', '#f08a4b', '#4d7fd0', '#5fbf6a', '#e0507a']
  };
  var GOAL0 = { manipulation: { u: 0.16, d: 0.45 }, navigation: { x: 0.7, z: 4 } };

  // Fill (or, for line parts, stroke) the current path in its natural colour, or in a mask colour.
  function paint(g, nat, m) {
    g.fillStyle = m ? m.c : nat; g.fill();
    if (m && m.edge) { g.strokeStyle = m.edge; g.lineWidth = 0.7; g.stroke(); }
  }
  function line(g, nat, width, m) {
    g.strokeStyle = m ? m.c : nat; g.lineWidth = width;
    g.lineCap = g.lineJoin = 'round'; g.stroke();
  }

  /* Robot manipulation, a front three-quarter view of a table. x runs over the scene width, y over the
     frame height (both 0..1); table spots are (u, d) with d the depth from the back edge to the front. */
  var TB0 = 0.5, TB1 = 0.88, CV = 3.5 / 52, RIM = 6.5 / 52, CS = 7;
  var M_BASE = { u: 0.9, d: 0.08 }, M_CUBE = { u: 0.62, d: 0.6 }, M_BALL = { u: 0.42, d: 0.18 },
    M_PLATE = { u: 0.42, d: 0.78 }, M_HOME = { x: 0.74, y: 0.4 };

  function tv(d) { return lerp(TB0, TB1, d); }
  function mFrame(F) {
    var sw = Math.min(F.w, 1.9 * F.h);
    return { x: F.x, y: F.y, w: F.w, h: F.h, k: F.h / 52, sw: sw, x0: F.x + (F.w - sw) / 2 };
  }
  function mPt(M, p) { return { x: M.x0 + p.x * M.sw, y: M.y + p.y * M.h }; }
  function mTab(M, p) { return mPt(M, { x: p.u, y: tv(p.d) }); }

  function mArm(M, st) {
    var k = M.k, b = mTab(M, M_BASE), S = { x: b.x, y: b.y - 13 * k };
    var ee = mPt(M, st.ee), palm = ee.y - 6 * k, W = { x: ee.x, y: palm - 3 * k };
    var f = 0.2 + 0.45 * Math.abs(S.x - W.x) / M.sw;
    var E = { x: lerp(S.x, W.x, f), y: Math.max(M.y + 4 * k, Math.min(S.y, W.y) - 8 * k) };
    return { b: b, S: S, E: E, W: W, ee: ee, palm: palm };
  }

  var MANIP = [
    { draw: function (g, M, st, m) {
        g.beginPath(); g.rect(M.x, M.y, M.w, TB0 * M.h + 0.5); paint(g, '#eef0f4', m);
      },
      tag: function (M) { return mPt(M, { x: 0.25, y: 0.14 }); } },
    { draw: function (g, M, st, m) {
        var y0 = M.y + TB0 * M.h, y1 = M.y + TB1 * M.h;
        if (m) { g.beginPath(); g.rect(M.x, y0, M.w, M.y + M.h - y0); paint(g, null, m); return; }
        g.fillStyle = '#e9dec9'; g.fillRect(M.x, y0, M.w, y1 - y0);
        g.fillStyle = '#d6c4a4'; g.fillRect(M.x, y1, M.w, M.y + M.h - y1);
        g.strokeStyle = '#c9b48f'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(M.x, y1); g.lineTo(M.x + M.w, y1); g.stroke();
      },
      tag: function (M) { return mPt(M, { x: 0.6, y: 0.94 }); } },
    { draw: function (g, M, st, m) {
        var a = mArm(M, st), k = M.k;
        rrect(g, a.b.x - 4 * k, a.S.y, 8 * k, a.b.y - a.S.y, 1.5 * k); paint(g, '#6d7380', m);
        g.beginPath(); g.ellipse(a.b.x, a.b.y, 7 * k, 2 * k, 0, 0, Math.PI * 2); paint(g, '#5b616d', m);
        g.beginPath(); g.moveTo(a.S.x, a.S.y); g.lineTo(a.E.x, a.E.y); g.lineTo(a.W.x, a.W.y);
        line(g, '#9aa1ad', 3.6 * k, m);
        g.beginPath(); g.arc(a.S.x, a.S.y, 2.6 * k, 0, Math.PI * 2); paint(g, '#5b616d', m);
        g.beginPath(); g.arc(a.E.x, a.E.y, 2.2 * k, 0, Math.PI * 2); paint(g, '#5b616d', m);
      },
      tag: function (M, st) { return mArm(M, st).E; } },
    { draw: function (g, M, st, m) {
        var p = mTab(M, M_PLATE), k = M.k;
        g.beginPath(); g.ellipse(p.x, p.y - k, 9.5 * k, 3 * k, 0, 0, Math.PI * 2); paint(g, '#ffffff', m);
        if (!m) { g.strokeStyle = '#b8bdc7'; g.lineWidth = 0.8; g.stroke(); }
      },
      tag: function (M) { var p = mTab(M, M_PLATE); return { x: p.x, y: p.y - M.k }; } },
    { draw: function (g, M, st, m) {
        var p = mTab(M, M_BALL), k = M.k;
        g.beginPath(); g.arc(p.x, p.y - 3.5 * k, 3.5 * k, 0, Math.PI * 2); paint(g, '#3f6fb0', m);
        if (!m) dot(g, p.x - 1.2 * k, p.y - 4.7 * k, 1.1 * k, 'rgba(255, 255, 255, 0.55)');
      },
      tag: function (M) { var p = mTab(M, M_BALL); return { x: p.x, y: p.y - 12 * M.k }; } },
    { draw: function (g, M, st, m) {
        var p = mTab(M, st.goal), k = M.k, rim = p.y - 5 * k;
        g.beginPath(); g.ellipse(p.x, rim, 9 * k, 6 * k, 0, 0, Math.PI); g.closePath(); paint(g, '#5e9a6e', m);
        g.beginPath(); g.ellipse(p.x, rim, 9 * k, 2.4 * k, 0, 0, Math.PI * 2); paint(g, '#8cc29a', m);
      },
      tag: function (M, st) { var p = mTab(M, st.goal); return { x: p.x, y: p.y - 2.5 * M.k }; } },
    { draw: function (g, M, st, m) {
        var c = mPt(M, st.cube), s = CS * M.k;
        g.beginPath(); g.rect(c.x - s / 2, c.y - s / 2, s, s); paint(g, C.accent, m);
        if (!m) { g.fillStyle = '#d65a86'; g.fillRect(c.x - s / 2, c.y - s / 2, s, 2 * M.k); }
      },
      tag: function (M, st) { var c = mPt(M, st.cube); return { x: c.x + 2 * M.k, y: c.y - 10 * M.k }; } },
    { draw: function (g, M, st, m) {
        var a = mArm(M, st), k = M.k, x = a.ee.x, o = lerp(5 * k, CS * k / 2 + 0.8 * k, st.grip), tip = a.ee.y + 2.5 * k;
        rrect(g, x - 2 * k, a.W.y, 4 * k, a.palm - a.W.y, 0.8 * k); paint(g, '#5b616d', m);
        g.beginPath();
        g.moveTo(x - o, a.palm); g.lineTo(x + o, a.palm);
        g.moveTo(x - o, a.palm); g.lineTo(x - o, tip); g.lineTo(x - o + 1.2 * k, tip);
        g.moveTo(x + o, a.palm); g.lineTo(x + o, tip); g.lineTo(x + o - 1.2 * k, tip);
        line(g, '#3a3f48', 1.6 * k, m);
      },
      tag: function (M, st) { var a = mArm(M, st); return { x: a.ee.x, y: a.palm - 1 }; } }
  ];

  /* Visual navigation, egocentric: a pinhole camera in a room (metres). The camera sits at (x, z) with
     heading yaw; points are (X, Y, Z) with Y up and Z ahead at the start. */
  var ROOM = { hw: 1.8, zb: 6, ch: 2.6, eye: 1.2, z0: -2 }, NEAR = 0.12;
  var N_DOOR = { x0: -1.3, x1: -0.45, h: 2.05 };
  var N_SOFA = { x0: -1.8, x1: -1.0, z0: 2.2, z1: 3.8, h: 0.45, bh: 0.9, bd: 0.25 };
  var N_PLANT = { x: 1.3, z: 3.4, r: 0.2, ph: 0.45, fy: 0.95, fr: 0.4 };
  var CAM0 = { x: 0, z: 0, yaw: 0 };

  function nFrame(F, cam) {
    return { x: F.x, y: F.y, w: F.w, h: F.h, f: 0.95 * F.h, cx: F.x + F.w / 2, hy: F.y + 0.42 * F.h, cam: cam };
  }
  function toCam(V, X, Y, Z) {
    var c = V.cam, dx = X - c.x, dz = Z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    return { x: dx * cs - dz * sn, y: ROOM.eye - Y, z: dx * sn + dz * cs };
  }
  function scr(V, p) { return { x: V.cx + V.f * p.x / p.z, y: V.hy + V.f * p.y / p.z }; }
  function proj(V, X, Y, Z, near) {
    var p = toCam(V, X, Y, Z);
    return p.z > (near || NEAR) ? scr(V, p) : null;
  }
  function cutNear(a, b) {
    var t = (NEAR - a.z) / (b.z - a.z);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: NEAR };
  }
  // Path of a world polygon clipped to the near plane; false when nothing is in front of the camera.
  function poly(g, V, pts) {
    var cp = pts.map(function (q) { return toCam(V, q[0], q[1], q[2]); }), out = [];
    for (var i = 0; i < cp.length; i++) {
      var a = cp[i], b = cp[(i + 1) % cp.length];
      if (a.z >= NEAR) out.push(a);
      if ((a.z >= NEAR) !== (b.z >= NEAR)) out.push(cutNear(a, b));
    }
    g.beginPath();
    if (out.length < 3) return false;
    out.forEach(function (p, j) { var q = scr(V, p); if (j) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
    g.closePath();
    return true;
  }
  function seg(g, V, a, b) {
    var p = toCam(V, a[0], a[1], a[2]), q = toCam(V, b[0], b[1], b[2]);
    if (p.z < NEAR && q.z < NEAR) return;
    if (p.z < NEAR) p = cutNear(p, q); else if (q.z < NEAR) q = cutNear(q, p);
    var s1 = scr(V, p), s2 = scr(V, q);
    g.moveTo(s1.x, s1.y); g.lineTo(s2.x, s2.y);
  }
  // An axis-aligned box: the faces the camera can see, as [top, front, side] colours.
  function box(g, V, x0, x1, y1, z0, z1, cols, m) {
    var cx = V.cam.x, sx = cx > x1 ? x1 : cx < x0 ? x0 : null;
    if (sx !== null && poly(g, V, [[sx, 0, z0], [sx, 0, z1], [sx, y1, z1], [sx, y1, z0]])) paint(g, cols[2], m);
    if (V.cam.z < z0 && poly(g, V, [[x0, 0, z0], [x1, 0, z0], [x1, y1, z0], [x0, y1, z0]])) paint(g, cols[1], m);
    if (poly(g, V, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])) paint(g, cols[0], m);
  }

  var R = ROOM;
  var NAV = [
    { draw: function (g, V, st, m) {
        if (poly(g, V, [[-R.hw, R.ch, R.z0], [R.hw, R.ch, R.z0], [R.hw, R.ch, R.zb], [-R.hw, R.ch, R.zb]])) paint(g, '#f3f1ec', m);
        if (!m && poly(g, V, [[-0.45, R.ch, 2.2], [0.45, R.ch, 2.2], [0.45, R.ch, 3], [-0.45, R.ch, 3]])) {
          paint(g, '#fffef8');
          g.strokeStyle = '#dedad0'; g.lineWidth = 0.6; g.stroke();
        }
      },
      tag: function (V) { return { x: V.cx + V.w * 0.2, y: V.y + 5 }; } },
    { draw: function (g, V, st, m) {
        if (poly(g, V, [[-R.hw, 0, R.z0], [R.hw, 0, R.z0], [R.hw, 0, R.zb], [-R.hw, 0, R.zb]])) paint(g, '#e3d8c4', m);
        if (m) return;
        g.beginPath();
        for (var x = -1.2; x < 1.3; x += 0.6) seg(g, V, [x, 0, R.z0], [x, 0, R.zb]);
        for (var z = 1; z < R.zb; z += 1) seg(g, V, [-R.hw, 0, z], [R.hw, 0, z]);
        g.strokeStyle = 'rgba(120, 100, 70, 0.2)'; g.lineWidth = 0.6; g.stroke();
      },
      tag: function (V) { return { x: V.cx - 4, y: V.y + V.h - 6 }; } },
    { draw: function (g, V, st, m) {
        if (poly(g, V, [[-R.hw, 0, R.z0], [-R.hw, 0, R.zb], [-R.hw, R.ch, R.zb], [-R.hw, R.ch, R.z0]])) paint(g, '#d6dae2', m);
      },
      tag: function (V) { return { x: V.x + 6, y: V.y + 15 }; } },
    { draw: function (g, V, st, m) {
        if (poly(g, V, [[R.hw, 0, R.z0], [R.hw, 0, R.zb], [R.hw, R.ch, R.zb], [R.hw, R.ch, R.z0]])) paint(g, '#c9cfd8', m);
      },
      tag: function (V) { return { x: V.x + V.w - 6, y: V.y + 15 }; } },
    { draw: function (g, V, st, m) {
        var D = N_DOOR, z = R.zb - 0.01;
        if (poly(g, V, [[-R.hw, 0, R.zb], [R.hw, 0, R.zb], [R.hw, R.ch, R.zb], [-R.hw, R.ch, R.zb]])) paint(g, '#e8eaee', m);
        if (!poly(g, V, [[D.x0, 0, z], [D.x1, 0, z], [D.x1, D.h, z], [D.x0, D.h, z]])) return;
        paint(g, '#5d6470', m);
        if (m) return;
        // A corridor beyond the doorway.
        g.save(); g.clip();
        if (poly(g, V, [[D.x0, 0, R.zb], [D.x1, 0, R.zb], [D.x1, 0, R.zb + 3], [D.x0, 0, R.zb + 3]])) paint(g, '#a99c86');
        g.restore();
        poly(g, V, [[D.x0, 0, z], [D.x1, 0, z], [D.x1, D.h, z], [D.x0, D.h, z]]);
        g.strokeStyle = '#a07b5a'; g.lineWidth = 1.1; g.stroke();
      },
      tag: function (V) { return proj(V, (N_DOOR.x0 + N_DOOR.x1) / 2, 1.8, R.zb); } },
    { draw: function (g, V, st, m) {
        var S = N_SOFA, cols = ['#9aabc8', '#7f93b5', '#6c7fa0'];
        box(g, V, S.x0, S.x0 + S.bd, S.bh, S.z0, S.z1, cols, m);
        box(g, V, S.x0, S.x1, S.h, S.z0, S.z1, cols, m);
      },
      tag: function (V) { return proj(V, (N_SOFA.x0 + N_SOFA.x1) / 2, N_SOFA.h, (N_SOFA.z0 + N_SOFA.z1) / 2); } },
    { draw: function (g, V, st, m) {
        var P = N_PLANT;
        box(g, V, P.x - P.r, P.x + P.r, P.ph, P.z - P.r, P.z + P.r, ['#9a6a49', '#b07a55', '#9a6a49'], m);
        [[0, 0, 1, '#5e9a6e'], [-0.2, 0.2, 0.6, '#6fae7d'], [0.18, 0.25, 0.55, '#4f8a5f']].forEach(function (l) {
          var c = toCam(V, P.x + l[0], P.fy + l[1], P.z);
          if (c.z < 0.5) return;
          var q = scr(V, c);
          g.beginPath(); g.arc(q.x, q.y, V.f * P.fr * l[2] / c.z, 0, Math.PI * 2); paint(g, l[3], m);
        });
      },
      tag: function (V) { return proj(V, N_PLANT.x, N_PLANT.fy, N_PLANT.z); } },
    { draw: function (g, V, st, m) {
        var G = st.goal, pts = [];
        for (var i = 0; i < 16; i++) {
          var a = i / 16 * Math.PI * 2;
          pts.push([G.x + 0.32 * Math.cos(a), 0, G.z + 0.32 * Math.sin(a)]);
        }
        if (poly(g, V, pts)) {
          paint(g, '#efc9d7', m);
          if (!m) { g.strokeStyle = C.accent; g.lineWidth = 0.8; g.stroke(); }
        }
        g.beginPath(); seg(g, V, [G.x, 0, G.z], [G.x, 1, G.z]); line(g, '#4a4f5a', 1.1, m);
        if (poly(g, V, [[G.x, 1, G.z], [G.x + 0.38, 0.86, G.z], [G.x, 0.72, G.z]])) paint(g, C.accent, m);
      },
      tag: function (V, st) { return proj(V, st.goal.x + 0.15, 0.86, st.goal.z); } }
  ];

  function view(dom, F, st) { return dom === 'manipulation' ? mFrame(F) : nFrame(F, st.cam); }

  // The observation: the natural image, optionally with its 8 object masks laid over it.
  function observe(g, dom, F, st, maskA) {
    var objs = dom === 'manipulation' ? MANIP : NAV, V = view(dom, F, st), cols = MASKS[dom];
    g.save();
    rrect(g, F.x, F.y, F.w, F.h, 2.5); g.clip();
    g.fillStyle = '#fafafa'; g.fillRect(F.x, F.y, F.w, F.h);
    objs.forEach(function (o, i) {
      o.draw(g, V, st, null);
      if (maskA > 0) {
        g.save();
        g.globalAlpha *= maskA;
        o.draw(g, V, st, { c: cols[i], edge: 'rgba(255, 255, 255, 0.95)' });
        g.restore();
      }
    });
    g.restore();
    g.strokeStyle = C.line; g.lineWidth = 1;
    rrect(g, F.x, F.y, F.w, F.h, 2.5); g.stroke();
    return V;
  }

  // Index tags for the tokens of each object mask, nudged apart so none overlap, kept inside F.
  function tagBoxes(dom, F, st, per) {
    var objs = dom === 'manipulation' ? MANIP : NAV, V = view(dom, F, st), out = [];
    objs.forEach(function (o, i) {
      var a = o.tag(V, st) || { x: F.x + F.w / 2, y: F.y + F.h / 2 }, labs = [], w = per - 1;
      for (var k = 0; k < per; k++) { var l = String(i * per + k + 1); labs.push(l); w += l.length * 4.2 + 3.4; }
      out.push({ x: a.x - w / 2, y: a.y - 4.5, w: w, h: 9, labs: labs, i: i });
    });
    for (var it = 0; it < 40; it++) {
      for (var a = 0; a < out.length; a++) {
        for (var b = a + 1; b < out.length; b++) {
          var p = out[a], q = out[b];
          var ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) + 1;
          var oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) + 1;
          if (ox <= 0 || oy <= 0) continue;
          if (ox < oy) {
            var dx = (p.x + p.w / 2 < q.x + q.w / 2 ? -1 : 1) * ox / 2;
            p.x += dx; q.x -= dx;
          } else {
            var dy = (p.y + p.h / 2 < q.y + q.h / 2 ? -1 : 1) * oy / 2;
            p.y += dy; q.y -= dy;
          }
        }
      }
      out.forEach(function (r) {
        r.x = clamp(r.x, F.x + 1.5, F.x + F.w - 1.5 - r.w);
        r.y = clamp(r.y, F.y + 1.5, F.y + F.h - 1.5 - r.h);
      });
    }
    return out;
  }

  function drawTags(g, dom, boxes, lit) {
    boxes.forEach(function (r) {
      var col = MASKS[dom][r.i], x = r.x, dark = lum(col) > 0.6;
      r.labs.forEach(function (l) {
        var w = l.length * 4.2 + 3.4;
        rrect(g, x, r.y, w, r.h, 1.8);
        g.fillStyle = col; g.fill();
        g.strokeStyle = r.i === lit ? C.fg : '#ffffff'; g.lineWidth = r.i === lit ? 1.1 : 0.8; g.stroke();
        text(g, l, x + w / 2, r.y + 7, { size: 7.5, weight: 600, color: dark ? C.fg : '#ffffff', align: 'center' });
        x += w + 1;
      });
    });
  }

  function pill(g, s, x, y, o, right) {
    g.save();
    g.font = (o.weight || 400) + ' ' + o.size + 'px ' + A.MONO;
    var w = g.measureText(s).width;
    g.restore();
    var x0 = right ? x - w : x;
    g.fillStyle = 'rgba(255, 255, 255, 0.86)';
    rrect(g, x0 - 2, y - o.size + 0.5, w + 4, o.size + 2.5, 2); g.fill();
    text(g, s, x0, y, o);
  }

  function raceScene(per) {
    var total = per * 8;
    var CYC = 9.4, PLAN0 = 1.0, PLAN1 = 6.0, EXEC1 = 7.8, FADE0 = 8.8;
    var N = 28, STEPS = 10, FAST = (PLAN1 - PLAN0) / N, SLOW = 2.1;
    var TH = { x: 6, w: 80, h: 52 }, BX = { x: 90, w: 144, h: 52 };
    var LANES = [{ top: 15, dense: true }, { top: 70, dense: false }];
    var COLS = 26, ROWS = 17;

    function other(d) { return d === 'manipulation' ? 'navigation' : 'manipulation'; }
    function copy(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
    function thumb(L) { return { x: TH.x, y: L.top, w: TH.w, h: TH.h }; }
    function panel(L) { return { x: BX.x, y: L.top, w: BX.w, h: BX.h }; }

    function state0(dom, goal) {
      if (dom === 'manipulation') return { ee: M_HOME, grip: 0, cube: { x: M_CUBE.u, y: tv(M_CUBE.d) - CV }, goal: goal };
      return { cam: CAM0, goal: goal };
    }

    // Rollout i of the sampling planner; later samples concentrate around the plan that works.
    // Manipulation: the imagined cube path (scene coordinates). Navigation: a floor path, {x: X, y: Z}.
    function rollout(dom, goal, i) {
      var r = rng(9173 + i * 7919 + (dom === 'navigation' ? 50021 : 0));
      var amp = Math.pow(1 - i / (N - 1), 1.4), pts = [], k, t;
      if (dom === 'manipulation') {
        var s0 = { x: M_CUBE.u, y: tv(M_CUBE.d) - CV };
        var ed = clamp(goal.d + (r() * 2 - 1) * 0.8 * amp, 0.05, 0.95);
        var e = { x: clamp(goal.u + (r() * 2 - 1) * 0.45 * amp, 0.04, 0.8), y: tv(ed) - (i === N - 1 ? RIM : CV) };
        var lift = 0.2 + r() * 0.1 + 0.08 * amp, wob = (r() * 2 - 1) * 0.12 * amp;
        for (k = 0; k <= STEPS; k++) {
          t = k / STEPS;
          pts.push({ x: lerp(s0.x, e.x, ease(t)) + wob * Math.sin(Math.PI * t), y: lerp(s0.y, e.y, t) - lift * Math.sin(Math.PI * t) });
        }
      } else {
        var n = { x: clamp(goal.x + (r() * 2 - 1) * 1.8 * amp, -1.5, 1.5), y: clamp(goal.z + (r() * 2 - 1) * 1.6 * amp, 1.4, 5.6) };
        var q = { x: n.x * 0.5 + (r() * 2 - 1) * 1.4 * amp, y: n.y * 0.5 };
        for (k = 0; k <= STEPS; k++) {
          t = k / STEPS;
          var a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
          pts.push({ x: b * q.x + c * n.x, y: b * q.y + c * n.y });
        }
      }
      return pts;
    }

    // The scene while the chosen plan executes (e in 0..1 over the execution window).
    function execState(dom, st0, best, e) {
      if (dom === 'navigation') {
        // Walk until the goal is a couple of metres ahead, so it stays in view.
        var len = 0;
        for (var i = 1; i <= STEPS; i++) len += dist(best[i], best[i - 1]);
        var kk = ease(e) * clamp(1 - 2.4 / len, 0, 0.6) * STEPS, c = along(best, kk), ah = along(best, Math.min(STEPS, kk + 0.6));
        var yaw = Math.atan2(ah.x - c.x, ah.y - c.y) * ease(span(e, 0, 0.25));
        return { cam: { x: c.x, z: c.y, yaw: yaw }, goal: st0.goal };
      }
      var c0 = st0.cube, above = { x: c0.x, y: c0.y - 0.2 }, end = best[STEPS];
      var st = { ee: c0, grip: 0, cube: c0, goal: st0.goal };
      if (e < 0.14) st.ee = { x: lerp(M_HOME.x, above.x, ease(e / 0.14)), y: lerp(M_HOME.y, above.y, ease(e / 0.14)) };
      else if (e < 0.24) st.ee = { x: c0.x, y: lerp(above.y, c0.y, ease((e - 0.14) / 0.1)) };
      else if (e < 0.32) st.grip = ease((e - 0.24) / 0.08);
      else if (e < 0.9) { st.ee = st.cube = along(best, ease(span(e, 0.32, 0.9)) * STEPS); st.grip = 1; }
      else {
        st.cube = end;
        st.grip = 1 - ease(span(e, 0.9, 0.95));
        st.ee = { x: end.x, y: end.y - 0.14 * ease(span(e, 0.94, 1)) };
      }
      return st;
    }

    // Draw a rollout up to step k: a cube path in the scene, or a path on the floor in perspective.
    function drawRoll(g, dom, V, pts, k, color, width, alpha) {
      if (k <= 0) return;
      if (dom === 'manipulation') {
        path(g, pts.map(function (p) { return mPt(V, p); }), k, color, width, null, alpha);
        return;
      }
      g.save();
      g.globalAlpha *= alpha;
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = g.lineCap = 'round';
      g.beginPath();
      var pen = false, n = Math.min(Math.floor(k), pts.length - 1);
      for (var i = 0; i <= n + 1 && i < pts.length; i++) {
        var p = i <= n ? pts[i] : along(pts, k), q = proj(V, p.x, 0, p.y, 0.3);
        if (!q) { pen = false; continue; }
        if (pen) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
        pen = true;
      }
      g.stroke();
      g.restore();
    }

    function rollEnd(g, dom, V, p, color, alpha, size) {
      g.save();
      g.globalAlpha *= alpha;
      if (dom === 'manipulation') {
        var q = mPt(V, p);
        g.fillStyle = color; g.fillRect(q.x - size, q.y - size, size * 2, size * 2);
      } else {
        var c = toCam(V, p.x, 0, p.y);
        if (c.z > 0.3) { var s = scr(V, c); dot(g, s.x, s.y, clamp(V.f * 0.06 * size / c.z, 0.8, 2.6), color); }
      }
      g.restore();
    }

    function goalPx(dom, V, goal) {
      if (dom === 'manipulation') { var p = mTab(V, goal); return { x: p.x, y: p.y - 3 * V.k }; }
      return proj(V, goal.x, 0, goal.z);
    }

    return {
      label: 'CompACT planning race with ' + total + ' tokens. Two lanes run the same sampling planner for the same ' +
        'wall-clock time. The top lane encodes the observation into hundreds of image patches, so its world model ' +
        'imagines only a few rollouts; the bottom lane splits the same image into 8 object masks, one per object, ' +
        'encoded as ' + total + ' tokens' + (per > 1 ? ' (two per object)' : '') + ', imagines many rollouts, ' +
        'converges and reaches the goal. Scenes alternate between a robot arm placing a cube in a bowl and ' +
        'first-person navigation to a goal flag in a room. Drag the goal to replan; click to switch scenes.',
      init: function (s) {
        s.dom = 'manipulation';
        s.goal = copy(GOAL0.manipulation);
        s.dragLane = -1;
        s.views = [];
        s.goalAt = [];
      },
      press: function (s) {
        s.dragLane = -1;
        s.goalAt.forEach(function (gp, li) { if (gp && dist(s.p, gp) < 10) s.dragLane = li; });
      },
      drag: function (s, t) {
        if (s.dragLane < 0) return;
        var L = LANES[s.dragLane], F = panel(L);
        if (s.dom === 'manipulation') {
          var M = mFrame(F);
          s.goal = {
            u: clamp((s.p.x - M.x0) / M.sw, 0.08, 0.26),
            d: clamp(((s.p.y + 3 * M.k - M.y) / M.h - TB0) / (TB1 - TB0), 0.2, 0.85)
          };
        } else {
          var V = nFrame(F, CAM0), z = V.f * ROOM.eye / Math.max(2, s.p.y - V.hy);
          s.goal = { x: clamp((s.p.x - V.cx) * z / V.f, -0.9, 1.3), z: clamp(z, 2.6, 5.2) };
        }
        s.start = t - PLAN0;
      },
      release: function (s) { s.dragLane = -1; },
      click: function (s, t) {
        if (s.dragLane >= 0) { s.start = t - PLAN0; return; }
        s.dom = other(s.dom);
        s.goal = copy(GOAL0[s.dom]);
        s.start = t;
      },
      draw: function (g, s, t) {
        var u = s.reduce ? 7.9 : cycle(s, t, CYC, function () {
          s.dom = other(s.dom);
          s.goal = copy(GOAL0[s.dom]);
        });
        var dom = s.dom, st0 = state0(dom, s.goal), rolls = [], near = false;
        for (var i = 0; i < N; i++) rolls.push(rollout(dom, s.goal, i));

        g.save();
        g.globalAlpha = s.reduce ? 1 : 1 - span(u, FADE0, CYC);

        text(g, NAMES[dom], 6, 10, { size: 8, color: C.muted });
        // Shared clock: both lanes get the same planning time.
        var clk = span(u, PLAN0, FADE0), ca = clk * Math.PI * 2;
        ring(g, 150, 7.5, 3, C.muted, 1);
        g.beginPath(); g.moveTo(150, 7.5); g.lineTo(150 + 2.2 * Math.sin(ca), 7.5 - 2.2 * Math.cos(ca)); g.stroke();
        g.fillStyle = C.line; g.fillRect(157, 6, 77, 3);
        g.fillStyle = C.muted; g.fillRect(157, 6, 77 * clk, 3);

        LANES.forEach(function (L, li) {
          var top = L.top, TF = thumb(L), PF = panel(L);
          var end = L.dense ? FADE0 : PLAN1;
          var prog = Math.max(0, Math.min(u, end) - PLAN0) / (L.dense ? SLOW : FAST);
          var done = Math.min(N, Math.floor(prog)), part = done < N ? prog - done : 0;
          var planning = u >= PLAN0 && (L.dense ? u < FADE0 : done < N);
          var show = s.reduce ? 1 : ease(span(u, 0.1, 0.8));

          // The observation, tokenised: a dense patch grid, or one mask per object.
          if (L.dense) {
            observe(g, dom, TF, st0, 0);
            g.save();
            g.globalAlpha *= show;
            var cw = TH.w / COLS, rh = TH.h / ROWS;
            if (planning) {
              var row = Math.floor(((part * 3) % 1) * ROWS);
              g.fillStyle = 'rgba(176, 21, 79, 0.2)';
              g.fillRect(TH.x, top + row * rh, TH.w, rh);
            }
            g.strokeStyle = 'rgba(32, 35, 42, 0.24)'; g.lineWidth = 0.5;
            g.beginPath();
            for (var c = 1; c < COLS; c++) { g.moveTo(TH.x + c * cw, top); g.lineTo(TH.x + c * cw, top + TH.h); }
            for (var r = 1; r < ROWS; r++) { g.moveTo(TH.x, top + r * rh); g.lineTo(TH.x + TH.w, top + r * rh); }
            g.stroke();
            g.restore();
          } else {
            observe(g, dom, TF, st0, 0.55 * show);
            g.save();
            g.globalAlpha *= show;
            drawTags(g, dom, tagBoxes(dom, TF, st0, per), planning ? Math.floor(prog * 8 * 3) % 8 : -1);
            g.restore();
          }

          // Imagined rollouts in the planner's view.
          var exec = !L.dense && done >= N, best = rolls[N - 1];
          var st = exec ? execState(dom, st0, best, span(u, PLAN1, EXEC1)) : st0;
          var V = observe(g, dom, PF, st, 0);
          g.save();
          rrect(g, PF.x, PF.y, PF.w, PF.h, 2.5); g.clip();
          var a0 = exec ? 1 - 0.6 * span(u, PLAN1, PLAN1 + 0.5) : 1;
          for (var j = 0; j < done; j++) {
            drawRoll(g, dom, V, rolls[j], STEPS, '#7d8390', 0.8, 0.5 * a0);
            rollEnd(g, dom, V, rolls[j][STEPS], '#7d8390', 0.45 * a0, 1.3);
          }
          if (planning && done < N && part > 0) {
            var pc = rolls[done], k = part * STEPS;
            drawRoll(g, dom, V, pc, k, C.muted, 1.1, 1);
            rollEnd(g, dom, V, along(pc, k), C.muted, 1, 1.8);
          }
          if (exec) drawRoll(g, dom, V, best, STEPS, C.accent, 1.5, 1);
          var gp = goalPx(dom, V, s.goal);
          s.goalAt[li] = gp;
          if (gp && !L.dense && u >= EXEC1) ring(g, gp.x, gp.y, 9, C.accent, 1.2);
          if (gp && ((s.p.in && dist(s.p, gp) < 10) || s.dragLane === li)) {
            near = true;
            g.save(); g.setLineDash([2, 2]); ring(g, gp.x, gp.y, 11, C.muted, 0.9); g.restore();
          }
          g.restore();

          // Lane label (top left) and status (bottom right) over the planner's view.
          var status, ly = top + 9, sy = top + PF.h - 3;
          if (L.dense) {
            pill(g, 'hundreds of patch tokens', PF.x + 3, ly, { size: 7.5, color: C.muted });
            status = u < PLAN0 ? 'encoding' : u < EXEC1 ? 'planning…' : 'still planning';
            pill(g, status, PF.x + PF.w - 3, sy, { size: 7.5, color: C.muted }, true);
          } else {
            pill(g, total + ' object tokens', PF.x + 3, ly, { size: 8, weight: 600, color: C.accent });
            var reached = u >= EXEC1;
            status = u < PLAN0 ? 'encoding' : done < N ? 'planning…' : !reached ? 'executing' : 'goal reached';
            pill(g, status, PF.x + PF.w - 3, sy, { size: 7.5, color: reached ? C.accent : C.muted, weight: reached ? 600 : 400 }, true);
          }
        });
        g.restore();

        text(g, 'drag the goal · click: switch', 6, 130, { size: 7.5, color: C.muted });
        try { g.canvas.style.cursor = near ? 'grab' : 'pointer'; } catch (err) { /* no canvas */ }
      }
    };
  }

  A.scenes['compact8'] = raceScene(1);
  A.scenes['compact16'] = raceScene(2);
})(window.PubAnim);
