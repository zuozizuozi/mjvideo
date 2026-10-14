// 场景「开发时间线」：竖向时间轴，里程碑一条条点亮（日期 + 标题 + 一句说明，可配一张截图）。竖屏，颜色跟随主题。
// items: [{ date, title, desc, image, at }]；image 是 project.json images 里的名字（可选）；at 不写就依次出场。
MJ.scene("milestone_timeline", {
  title: "开发时间线（里程碑依次点亮）",
  desc: "竖向时间轴，里程碑带日期、标题、一句说明和可选截图，依次点亮，最后一条高亮。适合讲 AI 用几天做完一个游戏、版本演进、项目历程。竖屏，颜色跟随主题。",
  dark: true,
  music: "default",
  design: [1080, 1920],
  params: { title: "两天，五个里程碑", items: [{ date: "10-11", title: "手感原型", desc: "点一下长一层房子" }] },
  create(ctx) {
    const TH = MJ.theme;
    const { W, H, clamp, mix, E, pr, rr, text, SONG, SONGH, YH, MONO, bgVibe, image, drawImageFit } = MJ.lib;
    const { cue, sfx } = ctx, P = ctx.params, N = P.items.length, DUR = ctx.shot.dur;
    const span = Math.max(1.5, DUR - 2.2), at = (v, i) => (v == null ? 0.8 + (i / Math.max(1, N - 1)) * span : typeof v === "number" ? v : cue(v));
    const items = P.items.map((it, i) => ({ ...it, t: at(it.at, i) }));
    items.forEach((it) => sfx(it.t, "tick", 0.4)); sfx(items[N - 1].t, "ding", 0.4);
    let imgs = null;
    return (c, u) => {
      if (!imgs) imgs = items.map((it) => (it.image ? image(it.image) : null));
      bgVibe(c, u);
      const tk = pr(u, 0.1, 0.6, E.out);
      c.save(); c.globalAlpha = tk; text(c, P.title, W / 2, 290 + (1 - tk) * 20, SONGH(74), TH.text, "center"); c.restore();
      const top = 400, bot = 1400, step = (bot - top) / N, lx = 170;          // 下沿 1400：配音模式底部字幕在 1450 左右
      const prog = clamp((u - items[0].t + 0.3) / (items[N - 1].t - items[0].t + 0.6));
      c.save(); c.strokeStyle = `rgba(${TH.rgb.muted},0.35)`; c.lineWidth = 4; c.beginPath(); c.moveTo(lx, top); c.lineTo(lx, bot - step / 2); c.stroke();
      c.strokeStyle = TH.accent; c.beginPath(); c.moveTo(lx, top); c.lineTo(lx, mix(top, bot - step / 2, E.inOut(prog))); c.stroke(); c.restore();
      items.forEach((it, i) => {
        const y = top + step * (i + 0.5) - step / 2 + 20, k = pr(u, it.t, 0.45, E.back), last = i === N - 1;
        c.save(); c.fillStyle = k > 0 ? TH.accent : `rgba(${TH.rgb.muted},0.5)`; c.beginPath(); c.arc(lx, y, mix(9, last ? 20 : 15, clamp(k)), 0, 7); c.fill(); c.restore();
        if (k <= 0) return;
        c.save(); c.globalAlpha = clamp(k); c.translate((1 - clamp(k)) * 40, 0);
        text(c, it.date || "", lx + 50, y - 22, MONO(30), TH.accent);
        text(c, it.title || "", lx + 50, y + 34, SONGH(last ? 56 : 48), last ? TH.highlight : TH.text);
        if (it.desc) text(c, it.desc, lx + 50, y + 84, SONG(32), TH.muted);
        if (imgs[i]) { const iw = 300, ih = Math.min(step - 30, 190); c.save(); rr(c, W - 70 - iw, y - ih / 2 + 10, iw, ih, 14); c.clip(); drawImageFit(c, imgs[i], W - 70 - iw, y - ih / 2 + 10, iw, ih, "cover"); c.restore(); }
        c.restore();
      });
    };
  },
});
