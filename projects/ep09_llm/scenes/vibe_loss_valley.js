// 场景「训练：文字雨 + 误差山谷」：
//   前半（第 0、1 句）：人类写下的文字像雨一样落下，越来越密，右上角计数器飞涨（示意）。
//   后半（第 2 句起）：切到一片误差地形（等高线俯视图），小球停在高处；第 3 句沿最陡方向走一小步（带方向箭头）；
//   第 4 句一步步加速滚向谷底，右下角误差曲线同步下降。小球路径是真的用梯度下降算出来的，不是摆的关键帧。
MJ.scene("vibe_loss_valley", {
  title: "训练 · 文字雨 + 梯度下降",
  desc: "文字雨 + 计数器飞涨，再切到误差地形等高线，小球按真实梯度下降一步步滚到谷底，配误差曲线。适合讲模型训练、梯度下降、优化、一点点变好。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_full",
  design: [1920, 1080],
  params: {
    snippets: ["从前有座山，山里有座庙", "def train(model, data):", "今天你吃饭了吗？", "To be, or not to be", "床前明月光", "光速约为每秒三十万公里", "for i in range(10):", "我想你了", "一加一等于二", "春风又绿江南岸", "return loss", "谢谢你，晚安"],
    counterFrom: 1024, counterTo: 12e12, counterLabel: "已读文字", note: "示意",
    lr: 0.07, steps: 70,
    captionY: 990,
  },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, rr, text, SONG, MONO, captions, bgVibe, glowDot, dot, mixRGB, GOLD, ICE } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines;
    const T = (i) => (L[i] ? L[i].t0 : 0), END = ctx.shot.dur;
    const R = rng(8);
    // ---------- 误差地形 ----------
    const f = (x, y) => 0.6 * ((x - 0.38) ** 2 + 1.5 * (y + 0.12) ** 2) + 0.22 * Math.exp(-((x + 0.25) ** 2 + (y - 0.3) ** 2) / 0.06)
      - 0.14 * Math.exp(-((x - 0.38) ** 2 + (y + 0.12) ** 2) / 0.04) + 0.04 * Math.sin(4 * x) * Math.cos(3 * y) + 0.15;
    const toS = (x, y) => [W / 2 + x * W * 0.45, H / 2 - 40 + y * H * 0.62];
    // 梯度下降路径（数值梯度）
    const path = [[-0.82, 0.48]];
    for (let k = 0; k < P.steps; k++) {
      const [x, y] = path[path.length - 1], h = 1e-4;
      const gx = (f(x + h, y) - f(x - h, y)) / (2 * h), gy = (f(x, y + h) - f(x, y - h)) / (2 * h);
      path.push([x - P.lr * gx, y - P.lr * gy]);
    }
    const loss = path.map(([x, y]) => f(x, y)), lmax = loss[0], lmin = Math.min(...loss);
    // 地形预渲染（半分辨率，放大后自然柔和）
    const terr = MJ.lib.canvas(W / 2, H / 2), tx = terr.getContext("2d"), img = tx.createImageData(W / 2, H / 2);
    for (let py = 0; py < H / 2; py++) for (let px = 0; px < W / 2; px++) {
      const x = (px * 2 - W / 2) / (W * 0.45), y = (py * 2 - H / 2 + 40) / (H * 0.62), v = f(x, y);
      const k = clamp((v - lmin) / (lmax * 1.3 - lmin));
      const band = Math.abs(((v * 16) % 1) - 0.5) < 0.05 ? 1 : 0;                 // 等高线
      const base = mixRGB([60, 46, 30], [10, 16, 40], Math.sqrt(k));
      const line = mixRGB([243, 196, 107], [110, 150, 230], k);
      const a = band * (0.55 - 0.3 * k), i = (py * W / 2 + px) * 4;
      img.data[i] = base[0] * (1 - a) + line[0] * a; img.data[i + 1] = base[1] * (1 - a) + line[1] * a; img.data[i + 2] = base[2] * (1 - a) + line[2] * a; img.data[i + 3] = 255;
    }
    tx.putImageData(img, 0, 0);
    // ---------- 时间 ----------
    const tRain = T(0), tMore = T(1), tValley = T(2), tStep = T(3), tRun = T(4);
    const firstStep = tStep + 0.9;
    const stepT = path.map((_, k) => (k === 0 ? -1 : k === 1 ? firstStep : tRun + 0.3 + (END - tRun - 1.6) * Math.sqrt((k - 1) / (path.length - 2))));
    sfx(tRain, "shimmer", 0.4); sfx(tMore, "swell", 0.5); sfx(tValley, "glow", 0.5); sfx(firstStep, "chime", 0.4);
    for (let k = 2; k < path.length; k += 6) sfx(stepT[k], "tick", 0.12);
    sfx(stepT[path.length - 1] + 0.2, "chime", 0.5);
    // 文字雨：每列一段文字往下落
    const cols = Array.from({ length: 46 }, (_, i) => ({ x: 30 + i * 41 + R() * 10, sp: 90 + R() * 160, off: R() * H, s: P.snippets[Math.floor(R() * P.snippets.length)], on: R(), gold: R() < 0.12 }));
    const ball = glowDot(GOLD, 40), ballI = glowDot(ICE, 40), trail = glowDot(GOLD, 8);
    const posAt = (u) => {
      let k = 0; while (k + 1 < path.length && u >= stepT[k + 1]) k++;
      if (k + 1 >= path.length) return { p: path[k], k, prog: 1 };
      const st = stepT[k + 1], dur = k === 0 ? 0.6 : Math.min(0.5, (stepT[k + 1] - (stepT[k] || st)) * 0.9 + 0.05);
      const e = clamp((u - (st - dur)) / dur);
      const a = path[k], b = path[k + 1];
      return { p: [mix(a[0], b[0], E.inOut(e)), mix(a[1], b[1], E.inOut(e))], k, prog: k / (path.length - 1) };
    };
    const fmt = (n) => Math.round(n).toLocaleString("en-US");

    return (c, u) => {
      bgVibe(c, u);
      const vK = pr(u, tValley - 0.3, 1.2, E.inOut);
      // ---------- 文字雨 ----------
      if (vK < 1) {
        const dens = mix(0.25, 1, pr(u, tRain, tMore + 1.5 - tRain, E.inOut));
        c.save(); c.textAlign = "center"; c.font = SONG(26);
        for (const col of cols) {
          if (col.on > dens) continue;
          const y0 = ((col.off + u * col.sp) % (H + 600)) - 600;
          for (let i = 0; i < col.s.length; i++) {
            const y = y0 + i * 32; if (y < -30 || y > H + 30) continue;
            c.globalAlpha = (0.15 + 0.6 * (i / col.s.length)) * (1 - vK) * pr(u, tRain - 0.5, 0.8);
            c.fillStyle = col.gold ? "#f3c46b" : "#d9d4c4"; c.fillText(col.s[i], col.x, y);
          }
        }
        c.restore();
        // 计数器
        const ck = pr(u, tRain + 0.3, tMore + 1.6 - tRain, (x) => x * x * x);
        const n = Math.exp(mix(Math.log(P.counterFrom), Math.log(P.counterTo), ck));
        c.save(); c.globalAlpha = pr(u, tRain, 0.6) * (1 - vK);
        rr(c, W - 620, 60, 560, 120, 18); c.fillStyle = "rgba(6,8,18,0.8)"; c.fill(); c.strokeStyle = "rgba(243,196,107,0.35)"; c.lineWidth = 2; c.stroke();
        text(c, P.counterLabel + "（" + P.note + "）", W - 590, 104, SONG(26), "#bdb5a0");
        text(c, fmt(n), W - 90, 160, `700 46px Georgia, serif`, "#f3c46b", "right");
        c.restore();
      }
      // ---------- 误差山谷 ----------
      if (vK > 0) {
        c.save(); c.globalAlpha = vK; c.drawImage(terr, 0, 0, W, H);
        // 底部压暗给字幕
        const g = c.createLinearGradient(0, H - 260, 0, H); g.addColorStop(0, "rgba(4,5,12,0)"); g.addColorStop(1, "rgba(4,5,12,0.92)");
        c.fillStyle = g; c.fillRect(0, H - 260, W, 260);
        c.restore();
        const { p, k, prog } = posAt(u);
        const ballA = pr(u, tValley + 0.6, 0.6);
        // 轨迹
        c.save(); c.globalCompositeOperation = "lighter";
        for (let i = 0; i <= k; i++) { const [sx, sy] = toS(...path[i]); c.globalAlpha = ballA * 0.7; dot(c, trail, sx, sy, 1); }
        c.restore();
        // 方向箭头（第一步之前出现）
        const arA = pr(u, tStep + 0.1, 0.5) * (1 - pr(u, firstStep + 0.4, 0.4));
        if (arA > 0) {
          const [x0, y0] = toS(...path[0]), [x1, y1] = toS(...path[4]);
          const ang = Math.atan2(y1 - y0, x1 - x0), len = 150;
          c.save(); c.globalAlpha = arA; c.strokeStyle = "#f3c46b"; c.fillStyle = "#f3c46b"; c.lineWidth = 4; c.shadowColor = "rgba(255,190,90,0.9)"; c.shadowBlur = 12;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); c.stroke();
          c.beginPath(); c.moveTo(x0 + Math.cos(ang) * (len + 18), y0 + Math.sin(ang) * (len + 18));
          c.lineTo(x0 + Math.cos(ang + 2.6) * 22 + Math.cos(ang) * len, y0 + Math.sin(ang + 2.6) * 22 + Math.sin(ang) * len);
          c.lineTo(x0 + Math.cos(ang - 2.6) * 22 + Math.cos(ang) * len, y0 + Math.sin(ang - 2.6) * 22 + Math.sin(ang) * len); c.closePath(); c.fill();
          c.restore();
        }
        // 小球（冷蓝 → 暖金）
        const [bx, by] = toS(...p);
        c.save(); c.globalCompositeOperation = "lighter";
        c.globalAlpha = ballA * (1 - prog); dot(c, ballI, bx, by, 1);
        c.globalAlpha = ballA * prog; dot(c, ball, bx, by, 1);
        c.restore();
        c.save(); c.globalAlpha = ballA; c.fillStyle = "#fff6e0"; c.beginPath(); c.arc(bx, by, 9, 0, 7); c.fill(); c.restore();
        // 误差曲线
        const gA = pr(u, tStep, 0.6);
        if (gA > 0) {
          const X0 = 1440, Y0 = 600, GW = 400, GH = 200;
          c.save(); c.globalAlpha = gA;
          rr(c, X0 - 30, Y0 - 60, GW + 60, GH + 100, 16); c.fillStyle = "rgba(6,8,18,0.78)"; c.fill();
          text(c, "误差（" + P.note + "）", X0, Y0 - 18, SONG(24), "#bdb5a0");
          c.strokeStyle = "rgba(255,255,255,0.2)"; c.lineWidth = 1; c.beginPath(); c.moveTo(X0, Y0); c.lineTo(X0, Y0 + GH); c.lineTo(X0 + GW, Y0 + GH); c.stroke();
          c.strokeStyle = "#f3c46b"; c.lineWidth = 3; c.shadowColor = "rgba(255,190,90,0.7)"; c.shadowBlur = 8; c.beginPath();
          const lv = (l) => Y0 + GH - ((l - lmin) / (lmax - lmin)) * GH * 0.92;
          const cur = f(...p);
          for (let i = 0; i <= k; i++) { const x = X0 + (i / (path.length - 1)) * GW; i ? c.lineTo(x, lv(loss[i])) : c.moveTo(x, lv(loss[i])); }
          c.lineTo(X0 + ((k + (prog < 1 ? 0.5 : 0)) / (path.length - 1)) * GW, lv(cur)); c.stroke();
          c.restore();
        }
      }
      captions(c, L, u, { y: P.captionY, size: 50 });
    };
  },
});
