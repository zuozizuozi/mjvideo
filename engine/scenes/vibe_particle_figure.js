// 场景「粒子人形」：几千个光点和一个人形轮廓（头 + 肩）。phase：
//   converge —— 第 0 句光点散在全屏；第 1 句冷蓝乱闪（混乱）；第 2 句右下角误差曲线快速下降、光点开始被拉向人形；
//               第 3 句光点汇聚成发光的人形，冷蓝变暖金
//   neurons  —— 人形已成；内部一条条细连线依次亮起（像神经元），先冷蓝后暖金；最后一句一部分连线闪一下再变金（被纠正）
MJ.scene("vibe_particle_figure", {
  title: "粒子人形 · 汇聚与神经元",
  desc: "光点从混乱汇聚成发光人形，或人形内部神经元式连线逐条点亮。适合讲学习、成长、从混乱到有序、人与 AI 的类比、收尾升华。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_piano",
  design: [1920, 1080],
  params: { phase: "converge", note: "示意", captionY: 975 },
  create(ctx) {
    const TH = MJ.theme;                                 // 颜色、字体、叠加方式都从主题取（见 engine/lib.js 的 THEME_DEFAULT）
    const { W, H, clamp, mix, E, pr, rng, rr, text, SONG, captions, bgVibe, glowDot, dot, samplePoints, mixRGB, GOLD, ICE } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines, PH = P.phase;
    const T = (i) => (L[i] ? L[i].t0 : 0), END = ctx.shot.dur;
    const R = rng(23);
    const fig = samplePoints((x) => {
      x.fillStyle = "#fff"; x.beginPath(); x.arc(W / 2, 330, 105, 0, 7); x.fill();
      x.beginPath(); x.moveTo(W / 2 - 300, 860); x.bezierCurveTo(W / 2 - 290, 560, W / 2 - 150, 500, W / 2, 495);
      x.bezierCurveTo(W / 2 + 150, 500, W / 2 + 290, 560, W / 2 + 300, 860); x.closePath(); x.fill();
    }, W, H, 9);
    const pts = fig.map(([x, y]) => ({ x: x + (R() - 0.5) * 4, y: y + (R() - 0.5) * 4, sx: R() * W, sy: R() * (H - 120), ph: R() * 6.28, dl: R() * 0.8, sp: 0.3 + R() * 0.8 }));
    // 神经元连线：人形内部相近的两点
    const links = [];
    while (links.length < 340) {
      const a = pts[Math.floor(R() * pts.length)], b = pts[Math.floor(R() * pts.length)], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 30 && d < 120 && (a.y < 450) === (b.y < 450)) links.push({ a, b, t: R(), fix: R() < 0.35, ph: R() * 6.28 });
    }
    links.sort((p, q) => p.t - q.t);
    const spG = glowDot(GOLD, 9), spI = glowDot(ICE, 9), spBig = glowDot(GOLD, 220);
    if (PH === "converge") { sfx(T(1), "shimmer", 0.5); sfx(T(2), "swell", 0.45); sfx(T(3) + 0.2, "swell", 0.5); sfx(T(3) + 2.0, "chime", 0.5); }
    if (PH === "neurons") { sfx(T(0) + 0.5, "shimmer", 0.35); sfx(T(2) + 0.3, "chime", 0.35); sfx(T(2) + 1.1, "chime", 0.35); sfx(T(2) + 1.9, "glow", 0.45); }
    // 误差曲线（converge 第 2 句）
    const curve = Array.from({ length: 60 }, (_, i) => 0.08 + 0.92 * Math.exp(-i / 9) + (R() - 0.5) * 0.05 * Math.exp(-i / 20));

    return (c, u) => {
      bgVibe(c, u);
      let k = 1, warm = 1;
      if (PH === "converge") {
        k = 0.3 * pr(u, T(2) + 0.2, 2.5, E.inOut) + 0.7 * pr(u, T(3) + 0.1, 2.2, E.inOut);
        warm = pr(u, T(3) + 0.3, 2.2, E.inOut);
      }
      const chaos = PH === "converge" ? pr(u, T(1), 0.6) * (1 - k) : 0;
      const appear = PH === "converge" ? pr(u, 0, 1.0) : 1;
      // 汇聚完成后的柔光
      if (k > 0.8) { c.save(); c.globalCompositeOperation = TH.blend; c.globalAlpha = (k - 0.8) * 5 * 0.18 * (0.85 + 0.15 * Math.sin(u * 1.5)); dot(c, spBig, W / 2, 560, 2.2); c.restore(); }
      c.save(); c.globalCompositeOperation = TH.blend;
      const col = mixRGB(ICE, GOLD, warm);
      c.fillStyle = `rgb(${col})`;
      for (const p of pts) {
        const kk = clamp((k - p.dl * 0.15) / 0.85);
        const jx = Math.sin(u * 2.3 * p.sp + p.ph) * (8 + 30 * chaos), jy = Math.cos(u * 1.9 * p.sp + p.ph) * (8 + 30 * chaos);
        const x = mix(p.sx + jx, p.x + Math.sin(u + p.ph) * 1.2, kk), y = mix(p.sy + jy, p.y + Math.cos(u * 1.2 + p.ph) * 1.2, kk);
        let a = (0.6 + 0.25 * kk) * appear;
        if (chaos > 0) a *= 0.5 + 0.5 * Math.sin(u * 11 * p.sp + p.ph * 7);
        c.globalAlpha = clamp(a);
        if (p.dl < 0.05) dot(c, warm > 0.5 ? spG : spI, x, y, 1); else c.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
      }
      c.restore();
      // 神经元连线
      if (PH === "neurons") {
        const span = [T(0) + 0.3, T(2) + 0.2];
        c.save(); c.globalCompositeOperation = TH.blend; c.lineWidth = 1.6;
        for (const l of links) {
          const tl = mix(span[0], span[1], l.t), lk = pr(u, tl, 0.4);
          if (lk <= 0) continue;
          let cw = pr(u, tl + 0.6, 1.2);                   // 冷蓝 → 暖金
          let flash = 0;
          if (l.fix) { const tf = T(2) + 0.3 + l.t * 1.8; flash = Math.max(0, 1 - Math.abs(u - tf) * 3); cw = u < tf ? Math.min(cw, 0.2) : Math.max(cw, pr(u, tf, 0.5)); }
          const cc = mixRGB(mixRGB(ICE, GOLD, cw), TH.rgb.warn, flash * 0.8);
          c.strokeStyle = `rgba(${cc},${0.25 + 0.5 * lk + flash * 0.5})`;
          c.beginPath(); c.moveTo(l.a.x, l.a.y); c.lineTo(mix(l.a.x, l.b.x, lk), mix(l.a.y, l.b.y, lk)); c.stroke();
          if (lk >= 1 && Math.sin(u * 2 + l.ph) > 0.92) { const t = (u * 1.3 + l.ph) % 1; c.globalAlpha = 0.9; dot(c, spG, mix(l.a.x, l.b.x, t), mix(l.a.y, l.b.y, t), 1); c.globalAlpha = 1; }
        }
        c.restore();
      }
      // 误差曲线（converge）
      if (PH === "converge") {
        const gA = pr(u, T(2) - 0.1, 0.5) * (1 - pr(u, T(3) + 1.6, 0.8));
        if (gA > 0) {
          const X0 = 1460, Y0 = 640, GW = 360, GH = 170, n = Math.floor(curve.length * pr(u, T(2) + 0.2, 1.8, E.inOut));
          c.save(); c.globalAlpha = gA;
          rr(c, X0 - 30, Y0 - 56, GW + 60, GH + 90, 16); c.fillStyle = `rgba(${TH.rgb.panel},0.78)`; c.fill();
          text(c, "误差（" + P.note + "）", X0, Y0 - 16, SONG(24), TH.muted);
          c.strokeStyle = `rgba(${TH.rgb.shine},0.2)`; c.lineWidth = 1; c.beginPath(); c.moveTo(X0, Y0); c.lineTo(X0, Y0 + GH); c.lineTo(X0 + GW, Y0 + GH); c.stroke();
          c.strokeStyle = TH.accent; c.lineWidth = 3; c.beginPath();
          for (let i = 0; i < n; i++) { const x = X0 + (i / (curve.length - 1)) * GW, y = Y0 + GH - curve[i] * GH; i ? c.lineTo(x, y) : c.moveTo(x, y); }
          c.stroke(); c.restore();
        }
      }
      captions(c, L, u, { y: P.captionY, size: 52 });
    };
  },
});
