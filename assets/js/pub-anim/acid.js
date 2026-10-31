/* ACID teaser (scene "acid"): the a -> world model -> s-hat -> inverse dynamics -> a-hat cycle on a robot arm.
   Registered on window.PubAnim from assets/js/pub-anim.js. */
(function (A) {
  'use strict';

  var W = A.W, H = A.H, C = A.C;
  var clamp = A.clamp, lerp = A.lerp, ease = A.ease, span = A.span, dist = A.dist;
  var text = A.text, rrect = A.rrect, dot = A.dot, ring = A.ring, arrow = A.arrow, path = A.path, along = A.along;
  var cycle = A.cycle;

  var BLUE = '#3f6fb0', DARK = '#4a4f5a', BAR = '#9aa1ad', FLOOR = '#f3f4f7';

  /* ---------- the cycle itself, s_t --a--> world model --> ŝ --> inverse dynamics --> â ---------- */

  (function () {
    // Two side-view manipulation frames (84x66) joined by small model boxes.
    var F0 = { x: 6, y: 17, w: 84, h: 66 }, F1 = { x: 150, y: 17, w: 84, h: 66 };
    var WM = { x: 103, y: 39, w: 34, h: 22 }, ID = { x: 100, y: 92, w: 40, h: 22 };
    // Frame-local geometry: table top, shoulder, link lengths, block size.
    var TY = 52, SH = { x: 15, y: 24 }, LK = 24, BS = 10, WRIST = 8;
    // The gripper holds the block; a lifts it up and to the right.
    var B0 = { x: 46, y: TY - BS / 2 }, ACT = { x: 8, y: -14 }, SHOW = 1.4;
    var GOOD = { x: B0.x + ACT.x, y: B0.y + ACT.y }, WRONG = { x: B0.x + 15, y: B0.y + 6 };
    var OUT = [{ x: 90, y: 50 }, { x: 150, y: 50 }];
    var BACK = [{ x: 192, y: 83 }, { x: 192, y: 103 }, { x: 48, y: 103 }, { x: 48, y: 83 }];
    var HALF = 4, IDLE = 6;

    function box(g, r, l1, l2) {
      rrect(g, r.x, r.y, r.w, r.h, 3);
      g.fillStyle = '#ffffff'; g.fill();
      g.strokeStyle = C.fg; g.lineWidth = 1; g.stroke();
      var cx = r.x + r.w / 2;
      text(g, l1, cx, r.y + 9.5, { size: 7.5, align: 'center' });
      text(g, l2, cx, r.y + 18, { size: 7.5, align: 'center' });
    }

    // Table, floor and pedestal of one frame (contents are clipped to it).
    function stage(g, F) {
      rrect(g, F.x, F.y, F.w, F.h, 3);
      g.fillStyle = '#ffffff'; g.fill();
      g.save();
      rrect(g, F.x, F.y, F.w, F.h, 3); g.clip();
      g.fillStyle = FLOOR;
      g.fillRect(F.x, F.y + TY, F.w, F.h - TY);
      g.fillStyle = '#d7dbe3';
      rrect(g, F.x + SH.x - 5, F.y + SH.y + 3, 10, TY - SH.y - 3, 1.5); g.fill();
      g.restore();
    }

    function surface(g, F) {
      g.strokeStyle = '#c9ced8'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(F.x, F.y + TY); g.lineTo(F.x + F.w, F.y + TY); g.stroke();
    }

    function border(g, F) {
      rrect(g, F.x, F.y, F.w, F.h, 3);
      g.strokeStyle = C.line; g.lineWidth = 1; g.stroke();
    }

    function block(g, F, b, alpha) {
      g.save();
      g.globalAlpha *= alpha;
      g.fillStyle = C.accent;
      g.fillRect(F.x + b.x - BS / 2, F.y + b.y - BS / 2, BS, BS);
      g.restore();
    }

    // Anything drawn below the table top shows through a translucent table front.
    function sunk(g, F, b) {
      if (b.y + BS / 2 <= TY) return;
      g.save();
      g.globalAlpha = 0.72;
      g.fillStyle = FLOOR;
      var y0 = Math.max(TY, b.y - BS / 2);
      g.fillRect(F.x + b.x - BS / 2 - 0.5, F.y + y0, BS + 1, b.y + BS / 2 - y0 + 0.5);
      g.restore();
    }

    // Side-view arm in the family style of the main ACID scene: two IK links and a parallel gripper.
    // e is the point between the fingertips; the fingers close to the block's width when holding it.
    function arm(g, F, e, holding, alpha, col) {
      var sx = F.x + SH.x, sy = F.y + SH.y;
      var wx = F.x + e.x, wy = F.y + e.y - WRIST;
      var dx = wx - sx, dy = wy - sy, d = clamp(Math.hypot(dx, dy), 1, 2 * LK - 0.5);
      var a = Math.atan2(dy, dx), k = Math.acos(clamp(d / (2 * LK), -1, 1));
      var el = { x: sx + LK * Math.cos(a - k), y: sy + LK * Math.sin(a - k) };
      var w = (holding ? BS + 1 : 3) / 2;
      g.save();
      g.globalAlpha *= alpha;
      g.strokeStyle = col;
      g.lineCap = 'round';
      g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(el.x, el.y); g.lineTo(wx, wy); g.stroke();
      dot(g, sx, sy, 2.8, col);
      dot(g, el.x, el.y, 2.2, col);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(wx, wy); g.lineTo(wx, wy + 3);
      g.moveTo(wx - w - 1, wy + 3); g.lineTo(wx + w + 1, wy + 3);
      g.moveTo(wx - w, wy + 3); g.lineTo(wx - w, F.y + e.y + 4);
      g.moveTo(wx + w, wy + 3); g.lineTo(wx + w, F.y + e.y + 4);
      g.stroke();
      g.restore();
    }

    // Action vector from the wrist, with a white halo so it reads over the arm and block.
    function vec(g, x, y, dx, dy, color, dashed) {
      var n = Math.hypot(dx, dy);
      if (n < 0.5) { dot(g, x, y, 1.6, color); return; }
      var ux = dx / n, uy = dy / n, x2 = x + dx, y2 = y + dy;
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255, 255, 255, 0.85)'; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = color; g.lineWidth = 1.4;
      g.setLineDash(dashed ? [2.5, 2] : []);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2 - ux * 3, y2 - uy * 3); g.stroke();
      g.setLineDash([]);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - 5 * ux + 2.6 * uy, y2 - 5 * uy - 2.6 * ux);
      g.lineTo(x2 - 5 * ux - 2.6 * uy, y2 - 5 * uy + 2.6 * ux);
      g.closePath(); g.fill();
      g.restore();
    }

    // Symbol with a subscript, e.g. s_t.
    function sub(g, base, low, x, y, color) {
      var w = text(g, base, x, y, { size: 9, weight: 600, color: color });
      text(g, low, x + w + 0.5, y + 2, { size: 7.5, color: color });
    }

    function blockAt(s) { return s.cur || GOOD; }

    A.scenes['acid'] = {
      label: 'The ACID consistency cycle on a manipulation step. In the current frame a robot arm holds a block, and the ' +
        'planned action a lifts the gripper up and to the right. The world model predicts the next frame; an inverse ' +
        'dynamics model then infers the action back from that predicted transition. When the block rises with the ' +
        'gripper that holds it, the inferred action matches a and the residual is small; when the prediction lets the ' +
        'block slide off or sink into the table, the inferred action diverges and the residual grows. Drag the block in ' +
        'the predicted frame to try it; click to resume the loop.',
      init: function (s) { s.manual = false; s.cur = { x: GOOD.x, y: GOOD.y }; s.touch = 0; },
      click: function (s, t) {
        var u = t - s.start;
        if (s.manual) { s.manual = false; s.start = t; }
        else s.start = u < HALF ? t - HALF : t;
      },
      press: function (s) {
        var b = blockAt(s);
        s.grab = dist(s.p, { x: F1.x + b.x, y: F1.y + b.y }) < 10 ? { x: b.x - (s.p.x - F1.x), y: b.y - (s.p.y - F1.y) } : null;
      },
      drag: function (s, t) {
        if (!s.grab) return;
        s.manual = true;
        s.touch = t;
        s.user = {
          x: clamp(s.p.x - F1.x + s.grab.x, BS / 2 + 1, F1.w - BS / 2 - 1),
          y: clamp(s.p.y - F1.y + s.grab.y, BS / 2 + 1, TY + BS / 2 - 2)
        };
      },
      release: function (s) { s.grab = null; },
      draw: function (g, s, t) {
        if (s.manual && !s.p.down && t - s.touch > IDLE) { s.manual = false; s.start = t; }
        var u = s.reduce ? HALF + 3.5 : cycle(s, t, 2 * HALF);
        if (s.manual) s.start = t;
        var half = u < HALF ? 0 : 1, uh = u - half * HALF;
        var target = half ? WRONG : GOOD;
        var f = s.manual ? 1 : ease(span(uh, 0.6, 1.4));
        var shown = s.manual ? 1 : span(uh, 0.6, 0.8);
        var b = s.manual && s.user ? s.user : { x: lerp(B0.x, target.x, f), y: lerp(B0.y, target.y, f) };
        s.cur = b;
        // The inverse model reads the end-effector motion off the held block's motion.
        var d = { x: b.x - B0.x, y: b.y - B0.y };
        var res = Math.hypot(d.x - ACT.x, d.y - ACT.y) / Math.hypot(ACT.x, ACT.y);
        var ok = res < 0.35;
        var vis = s.manual ? 1 : ease(span(uh, 2.2, 2.6));
        var hatCol = ok ? C.accent : C.fg;

        // Loop wiring.
        g.strokeStyle = C.faint; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(BACK[0].x, BACK[0].y); g.lineTo(BACK[1].x, BACK[1].y); g.lineTo(ID.x + ID.w + 4, BACK[1].y);
        g.stroke();
        arrow(g, OUT[0].x, OUT[0].y, WM.x, OUT[0].y, C.fg);
        arrow(g, WM.x + WM.w, OUT[1].y, OUT[1].x, OUT[1].y, C.fg);
        arrow(g, ID.x + ID.w + 4, BACK[1].y, ID.x + ID.w, BACK[1].y, C.faint);
        g.save();
        g.globalAlpha = 0.35 + 0.65 * vis;
        g.strokeStyle = vis > 0.5 ? hatCol : C.faint; g.lineWidth = 1;
        g.beginPath(); g.moveTo(ID.x, BACK[2].y); g.lineTo(BACK[2].x, BACK[2].y); g.lineTo(BACK[3].x, BACK[3].y + 4); g.stroke();
        arrow(g, BACK[3].x, BACK[3].y + 4, BACK[3].x, BACK[3].y, vis > 0.5 ? hatCol : C.faint);
        g.restore();
        text(g, 'a', 96.5, 46, { size: 8.5, weight: 600, align: 'center' });
        text(g, 'â', 74, 100, { size: 8.5, weight: 600, align: 'center', color: vis > 0.5 ? hatCol : C.muted });
        box(g, WM, 'world', 'model');
        box(g, ID, 'inverse', 'dynamics');

        // Signal pulses travelling around the loop.
        if (!s.manual && !s.reduce) {
          var po = span(uh, 0, 0.6), pb = span(uh, 1.4, 2.2);
          if (po > 0 && po < 1) { var q = along(OUT, po); dot(g, q.x, q.y, 2.2, C.accent); }
          if (pb > 0 && pb < 1) { q = along(BACK, pb * (BACK.length - 1)); dot(g, q.x, q.y, 2.2, C.accent); }
        }

        // Current frame s_t: the gripper holds the block; a (solid) and the inferred â (dashed) at the wrist.
        sub(g, 's', 't', F0.x, 12, C.fg);
        stage(g, F0);
        surface(g, F0);
        block(g, F0, B0, 1);
        arm(g, F0, B0, true, 1, DARK);
        border(g, F0);
        var px0 = F0.x + B0.x, py0 = F0.y + B0.y - WRIST;
        vec(g, px0, py0, ACT.x * SHOW, ACT.y * SHOW, C.fg, false);
        var tipA = { x: px0 + ACT.x * SHOW, y: py0 + ACT.y * SHOW };
        text(g, 'a', tipA.x + 3, tipA.y + 3, { size: 8.5, weight: 600 });
        if (vis > 0) {
          var hx = d.x * SHOW, hy = d.y * SHOW, hn = Math.hypot(hx, hy);
          if (hn > 30) { hx *= 30 / hn; hy *= 30 / hn; }
          var tip = {
            x: clamp(px0 + hx, F0.x + 4, F0.x + F0.w - 4),
            y: clamp(py0 + hy, F0.y + 4, F0.y + F0.h - 4)
          };
          g.save();
          g.globalAlpha = vis;
          vec(g, px0, py0, tip.x - px0, tip.y - py0, hatCol, true);
          // Label just past the arrow tip, pushed down when it would sit on the 'a' label.
          var tn = Math.hypot(tip.x - px0, tip.y - py0) || 1;
          var lab = { x: tip.x + (tip.x - px0) / tn * 7, y: tip.y + (tip.y - py0) / tn * 7 + 3 };
          if (Math.abs(lab.x - (tipA.x + 5)) < 9 && Math.abs(lab.y - (tipA.y + 3)) < 9) lab.y = tipA.y + 13;
          lab.x = clamp(lab.x, F0.x + 5, F0.x + F0.w - 5);
          lab.y = clamp(lab.y, F0.y + 9, F0.y + F0.h - 3);
          text(g, 'â', lab.x, lab.y, { size: 8.5, weight: 600, color: hatCol, align: 'center' });
          g.restore();
        }

        // Predicted frame ŝ_t+1: faint s_t pose, then the arm moved by a and the predicted block.
        sub(g, 'ŝ', 't+1', F1.x, 12, C.fg);
        stage(g, F1);
        g.save();
        rrect(g, F1.x, F1.y, F1.w, F1.h, 3); g.clip();
        surface(g, F1);
        arm(g, F1, B0, true, 0.3, C.faint);
        g.strokeStyle = C.faint; g.lineWidth = 1; g.setLineDash([2, 1.5]);
        g.strokeRect(F1.x + B0.x - BS / 2 + 0.5, F1.y + B0.y - BS / 2 + 0.5, BS - 1, BS - 1);
        g.setLineDash([]);
        if (shown > 0) {
          g.globalAlpha = shown;
          var bx = F1.x + b.x, by = F1.y + b.y;
          var e = { x: B0.x + ACT.x * f, y: B0.y + ACT.y * f };
          var inHand = Math.abs(b.x - e.x) < 3 && Math.abs(b.y - e.y) < 3;
          path(g, [{ x: F1.x + B0.x, y: F1.y + B0.y }, { x: bx, y: by }], 1, C.muted, 0.8, [1.5, 1.5], 1);
          block(g, F1, b, 1);
          sunk(g, F1, b);
          arm(g, F1, e, inHand, 1, DARK);
          var near = s.p.in && dist(s.p, { x: bx, y: by }) < 10;
          if (near || s.grab) {
            g.strokeStyle = C.accent; g.lineWidth = 1.2;
            g.strokeRect(bx - BS / 2 - 2, by - BS / 2 - 2, BS + 4, BS + 4);
          }
        }
        g.restore();
        border(g, F1);

        // Residual meter.
        text(g, '‖a−â‖', 8, 125, { size: 8.5, color: C.fg });
        g.fillStyle = C.line; g.fillRect(38, 120, 60, 5);
        g.fillStyle = ok ? C.accent : DARK;
        g.fillRect(38, 120, 60 * clamp(res / 1.5, 0.03, 1) * vis, 5);
        if (vis > 0) {
          text(g, ok ? 'a ≈ â' : 'a ≠ â', 104, 125,
            { size: 8.5, weight: 600, color: ok ? C.accent : C.fg, alpha: vis });
        }
        text(g, 'drag block · click', 236, 129, { size: 7.5, color: C.muted, align: 'right' });
      }
    };
  })();
})(window.PubAnim);
