// 场景「词向量星图」：词语是星星。一开始乱飘（第 0、1 句）；第 2 句意思相近的词自己聚成星团；
// 第 3 句镜头推近"人"这一团，画出两条平行箭头：男人→国王、女人→女王（国王 − 男人 + 女人 ≈ 女王），右下角标"经典示意"。
MJ.scene("vibe_embedding_stars", {
  title: "词向量星图",
  desc: "词语光点从乱飘到按意思聚成星团，再推近一团画出平行向量关系。适合讲词向量、语义空间、聚类、相似度、类比推理。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_arp",
  design: [1920, 1080],
  params: {
    groups: [
      { words: ["猫", "狗", "兔子", "老虎", "鸟"], at: [430, 300] },
      { words: ["红", "蓝", "绿", "黄", "紫"], at: [1490, 290] },
      { words: ["北京", "上海", "巴黎", "东京", "伦敦"], at: [420, 740] },
      { words: ["苹果", "香蕉", "葡萄", "西瓜"], at: [1500, 740] },
    ],
    analogy: { a: ["男人", 820, 640], b: ["国王", 990, 440], c: ["女人", 1030, 700], d: ["女王", 1200, 500] },
    focus: [1010, 570], zoom: 1.45,
    note: "经典示意：词向量",
    captionY: 990,
  },
  create(ctx) {
    const TH = MJ.theme;                                 // 颜色、字体、叠加方式都从主题取（见 engine/lib.js 的 THEME_DEFAULT）
    const { W, H, clamp, mix, E, pr, rng, text, SONG, captions, bgVibe, glowDot, dot, GOLD, PAPER, ICE } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines;
    const T = (i) => (L[i] ? L[i].t0 : 0);
    const R = rng(13);
    const stars = [];
    P.groups.forEach((g, gi) => g.words.forEach((w) => {
      const a = R() * 6.28, r = 50 + R() * 90;
      stars.push({ w, gi, tx: g.at[0] + Math.cos(a) * r * 1.3, ty: g.at[1] + Math.sin(a) * r * 0.8, sx: 160 + R() * (W - 320), sy: 120 + R() * (H - 340), ph: R() * 6.28, dl: R() * 0.8 });
    }));
    const A = P.analogy, people = ["a", "b", "c", "d"].map((k) => ({ w: A[k][0], tx: A[k][1], ty: A[k][2], sx: 160 + R() * (W - 320), sy: 120 + R() * (H - 340), ph: R() * 6.28, dl: R() * 0.8, gi: -1, key: k }));
    stars.push(...people);
    // 背景小星
    const tiny = Array.from({ length: 160 }, () => ({ x: R() * W, y: R() * H, a: 0.1 + R() * 0.4, ph: R() * 6.28 }));
    const tGroup = T(2) + 0.2, tFocus = T(3) + 0.1;
    sfx(T(0), "shimmer", 0.35); sfx(tGroup, "swell", 0.5); sfx(tGroup + 2.4, "chime", 0.4); sfx(tFocus + 0.8, "chime", 0.45); sfx(tFocus + 1.6, "chime", 0.45);
    const spG = glowDot(GOLD, 22), spP = glowDot(PAPER, 18), halo = glowDot(TH.rgb.halo, 180);

    return (c, u) => {
      bgVibe(c, u, { dust: 40 });
      // 镜头：fk 从 0 到 1，把 focus 点推到画面中央并放大 zoom 倍
      const fk = pr(u, tFocus, 1.6, E.inOut);
      const cam = (x, y) => [mix(x, W / 2 + (x - P.focus[0]) * P.zoom, fk), mix(y, H / 2 - 40 + (y - P.focus[1]) * P.zoom, fk)];
      c.save(); c.globalCompositeOperation = TH.blend;
      for (const t of tiny) { c.globalAlpha = t.a * (0.6 + 0.4 * Math.sin(u + t.ph)); c.fillStyle = TH.cold; c.fillRect(t.x, t.y, 1.5, 1.5); }
      // 星团光晕
      const gk = pr(u, tGroup + 1.6, 1.2);
      if (gk > 0) P.groups.forEach((g) => { const [x, y] = cam(...g.at); c.globalAlpha = gk * 0.22 * (1 - fk * 0.7); dot(c, halo, x, y, 1.2); });
      c.restore();
      // 星星
      const pos = stars.map((st) => {
        const k = E.inOut(clamp((u - tGroup - st.dl) / 2.4));
        const drift = 1 - k;
        const x = mix(st.sx + Math.sin(u * 0.35 + st.ph) * 60 * drift, st.tx, k), y = mix(st.sy + Math.cos(u * 0.3 + st.ph * 1.3) * 40 * drift, st.ty, k);
        return { st, k, xy: cam(x, y) };
      });
      // 类比箭头
      const arrK1 = pr(u, tFocus + 0.6, 0.9, E.inOut), arrK2 = pr(u, tFocus + 1.4, 0.9, E.inOut);
      const P_ = (key) => pos.find((p) => p.st.key === key).xy;
      const arrow = (p0, p1, k) => {
        if (k <= 0) return;
        const x1 = mix(p0[0], p1[0], k), y1 = mix(p0[1], p1[1], k), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        c.save(); c.strokeStyle = TH.accent; c.fillStyle = TH.accent; c.lineWidth = 3.5; c.shadowColor = `rgba(${TH.rgb.glow},0.9)`; c.shadowBlur = 14; c.setLineDash([14, 10]);
        c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
        if (k > 0.9) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(ang - 0.4) * 22, y1 - Math.sin(ang - 0.4) * 22); c.lineTo(x1 - Math.cos(ang + 0.4) * 22, y1 - Math.sin(ang + 0.4) * 22); c.closePath(); c.fill(); }
        c.restore();
      };
      const shrink = (p0, p1, m) => { const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const ux = (p1[0] - p0[0]) / d, uy = (p1[1] - p0[1]) / d; return [[p0[0] + ux * m, p0[1] + uy * m], [p1[0] - ux * m, p1[1] - uy * m]]; };
      arrow(...shrink(P_("a"), P_("b"), 30), arrK1); arrow(...shrink(P_("c"), P_("d"), 30), arrK2);
      for (const { st, k, xy: [x, y] } of pos) {
        const isP = st.gi === -1, dim = isP ? 1 : 1 - fk * 0.75;
        const hi = isP && st.key === "d" ? pr(u, tFocus + 2.2, 0.6) : 0;
        c.save(); c.globalCompositeOperation = TH.blend; c.globalAlpha = (0.75 + 0.25 * Math.sin(u * 1.8 + st.ph)) * dim * pr(u, 0, 0.6);
        dot(c, isP || k > 0.5 ? spG : spP, x, y, 1 + hi * 0.8); c.restore();
        c.save(); c.globalAlpha = dim * pr(u, 0, 0.6) * (0.55 + 0.45 * k);
        text(c, st.w, x + 20, y + 10, SONG(isP ? mix(30, 40, fk) : 28), hi > 0 ? TH.accent : TH.dim); c.restore();
      }
      const nk = pr(u, tFocus + 0.4, 0.6);
      if (nk > 0) { c.save(); c.globalAlpha = nk * 0.55; text(c, P.note, W - 70, H - 30, SONG(24), TH.muted, "right"); c.restore(); }
      captions(c, L, u, { y: P.captionY, size: 50 });
    };
  },
});
