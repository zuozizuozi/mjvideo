// 场景「参数光点阵」：几千个光点组成的阵列，代表模型参数。phase 决定这一镜怎么演：
//   question —— 只有中心一个光点在呼吸（悬念）
//   reveal   —— 从一个光点往后拉，变成一排、一片、满屏星海；最后一句推近一个光点，它变成带刻度的旋钮
//   chaos    —— 满屏冷蓝光点随机乱闪，下方输出区不停吐乱码
//   dim      —— 星海 + 稀疏连线，镜头再拉远，整体慢慢变暗；字幕在画面中央
MJ.scene("vibe_dot_grid", {
  title: "参数光点阵",
  desc: "满屏光点阵列：单点悬念 / 拉远成星海再推近成旋钮 / 冷蓝随机乱闪配乱码 / 拉远变暗。适合讲模型参数、海量数据、随机初始化、数量级震撼。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_full",
  design: [1920, 1080],
  params: { phase: "reveal", spacing: 26, garbage: "锟斤拷烫烫烫屯屯屯ψЖ※≠∵¿Ω§ゑ囧", captionY: 960 },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, rr, text, SONG, MONO, captions, bgVibe, glowDot, dot, mixRGB, GOLD, ICE, PAPER } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines, PH = P.phase;
    const T = (i) => (L[i] ? L[i].t0 : 0), END = ctx.shot.dur;
    const R = rng(PH === "chaos" ? 9 : 4), SP = P.spacing;
    const dots = [];
    const over = PH === "dim" ? 1.35 : 1, NX = Math.ceil(W / 2 / SP * over) + 1, NY = Math.ceil(H / 2 / SP * over) + 1;
    for (let j = -NY; j <= NY; j++) for (let i = -NX; i <= NX; i++) {
      dots.push({ x: W / 2 + i * SP, y: H / 2 + j * SP, b: 0.25 + R() ** 1.5 * 0.75, ph: R() * 6.28, warm: R() < 0.55, seed: Math.floor(R() * 1e6) });
    }
    const links = [];                                    // dim：稀疏连线
    for (let k = 0; k < 260; k++) { const a = dots[Math.floor(R() * dots.length)]; links.push([a, a.x + (R() - 0.5) * 260, a.y + (R() - 0.5) * 200]); }
    const hash = (s, n) => { let h = (s * 2654435761 + n * 40503) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h % 1000) / 1000; };
    const spG = glowDot(GOLD, 12), spP = glowDot(PAPER, 12), spI = glowDot(ICE, 12), spBig = glowDot(GOLD, 70);

    if (PH === "question") sfx(T(0) - 0.4, "glow", 0.5);
    if (PH === "reveal") { sfx(T(0) + 0.3, "swell", 0.6); sfx(T(1), "shimmer", 0.6); sfx(T(3) + 0.9, "chime", 0.5); }
    if (PH === "chaos") { sfx(T(0), "shimmer", 0.4); for (let t = T(1); t < END - 0.5; t += 0.36) sfx(t, "tick", 0.1); }

    // 缩放（屏幕坐标 = 中心 + (点 - 中心) × s）
    const scaleAt = (u) => {
      if (PH === "question") return 60;
      if (PH === "reveal") {
        const out = pr(u, T(0) + 0.2, T(1) + 1.6 - T(0), E.inOut);
        const back = pr(u, T(3) + 0.1, 1.5, E.inOut);
        return Math.exp(mix(mix(Math.log(60), 0, out), Math.log(60), back));
      }
      if (PH === "dim") return mix(1.15, 0.8, pr(u, 0, END, E.inOut));
      return 1;
    };

    const knob = (c, u, a) => {
      const cx = W / 2, cy = H / 2 - 30, r = 170;
      c.save(); c.globalAlpha = a; c.strokeStyle = "#f3c46b"; c.shadowColor = "rgba(255,190,90,0.8)"; c.shadowBlur = 18;
      c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
      c.lineWidth = 2; c.globalAlpha = a * 0.5; c.beginPath(); c.arc(cx, cy, r * 0.72, 0, 7); c.stroke();
      c.globalAlpha = a;
      for (let k = 0; k < 40; k++) {
        const ang = -Math.PI * 1.25 + (k / 39) * Math.PI * 1.5, long = k % 5 === 0;
        c.lineWidth = long ? 3 : 1.5;
        c.beginPath(); c.moveTo(cx + Math.cos(ang) * (r + 14), cy + Math.sin(ang) * (r + 14)); c.lineTo(cx + Math.cos(ang) * (r + (long ? 40 : 26)), cy + Math.sin(ang) * (r + (long ? 40 : 26))); c.stroke();
      }
      const ang = -Math.PI / 2 + 0.55 * Math.sin((u - T(3)) * 1.1) - 0.3;
      c.lineWidth = 6; c.lineCap = "round"; c.strokeStyle = "#fff1cc";
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * r * 0.62, cy + Math.sin(ang) * r * 0.62); c.stroke();
      c.fillStyle = "#fff1cc"; c.beginPath(); c.arc(cx, cy, 10, 0, 7); c.fill();
      c.restore();
    };

    return (c, u) => {
      bgVibe(c, u, { dustAlpha: PH === "chaos" ? 0.3 : 1 });
      const s = scaleAt(u), r = 1.7 * Math.pow(s, 0.55);
      let gA = 1;
      if (PH === "dim") gA = mix(1, 0.22, pr(u, T(1) - 0.5, END - T(1) + 0.5, E.inOut));
      if (PH === "question") gA = pr(u, 0, 0.8);
      const knobA = PH === "reveal" ? pr(u, T(3) + 1.0, 0.7, E.inOut) : 0;
      // 连线（dim）
      if (PH === "dim") {
        c.save(); c.globalAlpha = 0.18 * gA; c.strokeStyle = "#f3c46b"; c.lineWidth = 1;
        c.beginPath();
        for (const [a, bx, by] of links) { c.moveTo(W / 2 + (a.x - W / 2) * s, H / 2 + (a.y - H / 2) * s); c.lineTo(W / 2 + (bx - W / 2) * s, H / 2 + (by - H / 2) * s); }
        c.stroke(); c.restore();
      }
      c.save(); c.globalCompositeOperation = "lighter";
      const big = s > 6, scaleSp = r / 2.2;
      for (const d of dots) {
        const x = W / 2 + (d.x - W / 2) * s, y = H / 2 + (d.y - H / 2) * s;
        if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
        let a = d.b * (0.7 + 0.3 * Math.sin(u * 1.6 + d.ph)), sp = d.warm ? spG : spP;
        if (PH === "chaos") { const h = hash(d.seed, Math.floor(u * 9 + d.ph)); a = h ** 3 * 1.6; sp = h > 0.93 ? spP : spI; }
        if (PH === "question" || (PH === "reveal" && big)) { a = 0.85 + 0.15 * Math.sin(u * 2.4); sp = spG; }
        c.globalAlpha = clamp(a) * gA * (1 - knobA);
        if (big) dot(c, spBig, x, y, r / 26);
        else dot(c, sp, x, y, scaleSp);
      }
      c.restore();
      if (knobA > 0) knob(c, u, knobA);
      // chaos：乱码输出区
      if (PH === "chaos") {
        const k = pr(u, T(1) - 0.2, 0.5);
        if (k > 0) {
          c.save(); c.globalAlpha = k;
          rr(c, 360, 690, 1200, 120, 18); c.fillStyle = "rgba(8,12,26,0.82)"; c.fill(); c.strokeStyle = "rgba(120,180,255,0.35)"; c.lineWidth = 2; c.stroke();
          text(c, "输出", 400, 765, SONG(30), "#8fb8ff");
          const n = Math.min(22, Math.floor((u - T(1) + 0.2) * 9));
          let str = ""; for (let i = 0; i < n; i++) str += P.garbage[Math.floor(hash(i * 7 + 3, Math.floor(u * 7) + i) * P.garbage.length)];
          const jx = (hash(5, Math.floor(u * 15)) - 0.5) * 6;
          text(c, str, 500 + jx, 768, MONO(44), "#cfe2ff");
          c.restore();
        }
      }
      if (PH === "dim") captions(c, L, u, { y: H / 2 + 20, size: 62 });
      else captions(c, L, u, { y: P.captionY });
    };
  },
});
