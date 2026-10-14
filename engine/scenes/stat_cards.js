// 场景「数据卡」：几个大数字依次弹出并滚动计数（代码行数、文件大小、开发天数、外部美术图片 0 张……）。竖屏，颜色跟随主题。
// items: [{ value, unit, label, decimals, at }]；at 可以写秒数或解说词里的词，不写就依次出场。
MJ.scene("stat_cards", {
  title: "数据卡（大数字滚动计数）",
  desc: "标题 + 2–4 张数据卡，数字从 0 滚到目标值，依次弹出。适合制作过程的硬数据：代码量、文件大小、开发用时、零外部素材、版本数。竖屏，颜色跟随主题。",
  dark: true,
  music: "default",
  design: [1080, 1920],
  params: { title: "它是怎么做出来的", items: [{ value: 8510, unit: "行", label: "代码" }], note: "" },
  create(ctx) {
    const TH = MJ.theme;
    const { W, H, clamp, mix, E, pr, rr, text, SONG, SONGH, YH, bgVibe, stagger } = MJ.lib;
    const { cue, sfx } = ctx, P = ctx.params, N = P.items.length;
    const t0 = 0.5, at = (v, i) => (v == null ? t0 + 0.5 + i * 0.7 : typeof v === "number" ? v : cue(v));
    const items = P.items.map((it, i) => ({ ...it, t: at(it.at, i) }));
    items.forEach((it) => sfx(it.t, "pop", 0.5));
    const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    return (c, u) => {
      bgVibe(c, u);
      const tk = pr(u, 0.1, 0.6, E.out);
      c.save(); c.globalAlpha = tk; text(c, P.title, W / 2, 330 + (1 - tk) * 20, SONGH(78), TH.text, "center"); c.restore();
      const top = 470, gap = 36, ch = Math.min(300, (900 - gap * (N - 1)) / N);      // 卡片区 470–1370，避开底部字幕
      items.forEach((it, i) => {
        const k = pr(u, it.t, 0.5, E.back), cnt = pr(u, it.t, 1.2, E.out);
        if (k <= 0) return;
        const y = top + i * (ch + gap), x = 90, w = W - 180;
        c.save(); c.globalAlpha = clamp(k); c.translate(W / 2, y + ch / 2); c.scale(mix(0.9, 1, clamp(k)), mix(0.9, 1, clamp(k))); c.translate(-W / 2, -(y + ch / 2));
        rr(c, x, y, w, ch, 26); c.fillStyle = `rgba(${TH.rgb.card},0.92)`; c.fill(); c.strokeStyle = `rgba(${TH.rgb.accent},0.35)`; c.lineWidth = 2; c.stroke();
        const v = it.value * cnt, s = fmt(v, it.decimals || 0);
        c.font = SONGH(Math.min(150, ch * 0.5)); const vw = c.measureText(s).width;
        text(c, s, x + 60, y + ch * 0.66, SONGH(Math.min(150, ch * 0.5)), TH.accent);
        text(c, it.unit || "", x + 76 + vw, y + ch * 0.66, SONG(Math.min(56, ch * 0.2)), TH.text);
        text(c, it.label || "", x + w - 60, y + ch * 0.62, SONG(Math.min(52, ch * 0.18)), TH.muted, "right");
        c.restore();
      });
      if (P.note) { const k = pr(u, items[N - 1].t + 1, 0.5); c.save(); c.globalAlpha = k * 0.7; text(c, P.note, W / 2, top + N * (ch + gap) + 40, SONG(30), TH.muted, "center"); c.restore(); }
    };
  },
});
