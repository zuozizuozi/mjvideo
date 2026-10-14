// 场景「文档 / 提示词摘录」：一张卡片上逐字打出一段文字（提示词、设计文档、提交说明），关键词高亮，底部标来源。竖屏，颜色跟随主题。
// text 里用 **词** 标高亮；style: "prompt"（对话气泡 + 光标，像在给 AI 下指令）/ "doc"（文档卡片，带行号感）。
MJ.scene("doc_quote", {
  title: "提示词 / 设计文档摘录（逐字打出）",
  desc: "卡片上逐字打出一段原文，关键词高亮并带下划线，底部标来源（例如 DESIGN.md、给 AI 的提示词）。prompt 样式像聊天输入框，doc 样式像文档。适合讲 AI 收到了什么指令、设计文档怎么写的。竖屏，颜色跟随主题。",
  dark: true,
  music: "default",
  design: [1080, 1920],
  params: { style: "prompt", label: "给 AI 的一句话", text: "做一个**治愈**的浮岛建造游戏，点一下就长出一层房子。", source: "", cps: 14, at: 0.6 },
  create(ctx) {
    const TH = MJ.theme;
    const { W, H, clamp, mix, E, pr, rr, text, SONG, SONGH, YH, MONO, bgVibe, parseMarks } = MJ.lib;
    const { cue, sfx } = ctx, P = ctx.params;
    const t0 = typeof P.at === "number" ? P.at : cue(P.at);
    const segs = parseMarks(P.text), plain = segs.map((s) => s.s).join("");
    const doneT = t0 + plain.length / P.cps;
    for (let k = 0; k < plain.length; k += 3) sfx(t0 + k / P.cps, "type", 0.12);
    let lay = null;
    const layout = (c) => {                    // 逐字排版（自动换行），记下每个字的位置和是否高亮
      const font = SONG(50), maxW = W - 260, out = []; let x = 0, y = 0; c.font = font;
      for (const sg of segs) for (const ch of sg.s) { const w = c.measureText(ch).width; if (ch === "\n" || x + w > maxW) { x = 0; y += 78; if (ch === "\n") continue; } out.push({ ch, x, y, w, hi: sg.hi }); x += w; }
      return { chars: out, h: y + 78 };
    };
    return (c, u) => {
      if (!lay) lay = layout(c);
      bgVibe(c, u);
      const k = pr(u, 0.1, 0.5, E.out), boxH = lay.h + 160, bx = 90, by = H / 2 - boxH / 2 - 80, bw = W - 180;
      c.save(); c.globalAlpha = k;
      text(c, P.label, bx + 10, by - 40, SONG(38), TH.muted);
      rr(c, bx, by, bw, boxH, P.style === "prompt" ? 36 : 14); c.fillStyle = `rgba(${TH.rgb.card},0.95)`; c.fill(); c.strokeStyle = `rgba(${TH.rgb.accent},${P.style === "prompt" ? 0.6 : 0.25})`; c.lineWidth = 3; c.stroke();
      if (P.style === "doc") { c.fillStyle = `rgba(${TH.rgb.accent},0.8)`; c.fillRect(bx, by + 30, 8, boxH - 60); }
      const n = Math.floor((u - t0) * P.cps), ox = bx + 80, oy = by + 110;
      lay.chars.forEach((q, i) => {
        if (i >= n) return;
        if (q.hi) { const hk = pr(u, doneT + 0.2, 0.5); c.fillStyle = `rgba(${TH.rgb.accent},${0.22 * hk})`; c.fillRect(ox + q.x - 1, oy + q.y - 44, q.w + 2, 60); }
        text(c, q.ch, ox + q.x, oy + q.y, SONG(50), q.hi ? TH.accent : TH.text);
      });
      const last = lay.chars[Math.min(n, lay.chars.length) - 1];
      if (P.style === "prompt" && Math.floor(u * 2.5) % 2 === 0) { const cx = last ? ox + last.x + last.w + 4 : ox, cy = last ? oy + last.y : oy; c.fillStyle = TH.accent; c.fillRect(cx, cy - 44, 5, 56); }
      if (P.source) { const sk = pr(u, doneT + 0.4, 0.5); c.globalAlpha = k * sk; text(c, "—— " + P.source, bx + bw - 30, by + boxH + 60, SONG(32), TH.muted, "right"); }
      c.restore();
    };
  },
});
