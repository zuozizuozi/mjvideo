// 场景「粒子聚字」：光粒子从四周（或从一个人形轮廓）飞来，聚成大字标题 / 金句，再清晰成实字。
// blocks：哪几句字幕用大字画（line 序号、字号、y、字重 H/B、颜色、stay 是否留到结尾）；其余句子按普通字幕画。
// extras：不属于字幕的装饰小字（如英文副标题），after 第几句之后 delay 秒出现。
// cursorUntil：在第几句出现前，画面中心先有一个闪烁光标（承接上一镜）。from："random" 四周飞来 / "figure" 从人形轮廓散开再聚合。
MJ.scene("vibe_particle_title", {
  title: "粒子聚字 · 标题金句",
  desc: "金色光粒子聚成大字标题或金句，可配英文小字、可从光标或人形轮廓过渡。适合片头标题、章节标题、结尾金句。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_pad",
  design: [1920, 1080],
  params: {
    blocks: [{ line: 0, size: 140, y: 470, font: "H", color: "#f2efe6" }],
    extras: [],
    cursorUntil: null,
    from: "random",
    captionY: 960, captionSize: 54, captionColor: null,
  },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, SONG, SONGH, captions, caption, glowText, bgVibe, glowDot, dot, textPoints, samplePoints, mixRGB, GOLD, PAPER } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines;
    const R = rng(5);
    const hex = (h) => { const m = h.match(/\w\w/g); return m ? m.slice(0, 3).map((x) => parseInt(x, 16)) : PAPER; };
    // 人形轮廓（和 vibe_particle_figure 一致），作为 from: "figure" 的起点
    const figure = samplePoints((x) => {
      x.fillStyle = "#fff"; x.beginPath(); x.arc(W / 2, 330, 105, 0, 7); x.fill();
      x.beginPath(); x.moveTo(W / 2 - 300, 860); x.bezierCurveTo(W / 2 - 290, 560, W / 2 - 150, 500, W / 2, 495);
      x.bezierCurveTo(W / 2 + 150, 500, W / 2 + 290, 560, W / 2 + 300, 860); x.closePath(); x.fill();
    }, W, H, 9);

    // 文字采样要等字体加载完（create 运行时字体还没就绪），所以放到第一次绘制时做
    P.blocks.forEach((b) => { const ln = L[b.line]; if (ln) { sfx(ln.t0, "swell", 0.55); sfx(ln.t0 + 1.5, "chime", 0.45); } });
    let blocks = null;
    const initBlocks = () => P.blocks.map((b) => {
      const ln = L[b.line]; if (!ln) return null;
      const txt = ln.plain;
      const font = (n) => (b.font === "B" ? SONG(n) : SONGH(n));
      const pts = textPoints(txt, font(b.size), W / 2, b.y - b.size * 0.35, Math.max(3, Math.round(b.size / 32)));
      const rgb = b.color ? hex(b.color) : PAPER;
      const parts = pts.map(([x, y], i) => {
        let sx, sy;
        if (P.from === "figure" && figure.length) { const f = figure[i % figure.length]; sx = f[0] + (R() - 0.5) * 30; sy = f[1] + (R() - 0.5) * 30; }
        else { const a = R() * 6.28, r = 700 + R() * 600; sx = W / 2 + Math.cos(a) * r; sy = H / 2 + Math.sin(a) * r * 0.7; }
        return { x, y, sx, sy, dl: R() * 0.6, ph: R() * 6.28, big: R() < 0.06 };
      });
      return { ...b, txt, font, parts, rgb, t0: ln.t0, t1: ln.t1 };
    }).filter(Boolean);
    const skip = P.blocks.map((b) => b.line);
    const sprite = glowDot(GOLD, 14), spriteW = glowDot([255, 240, 210], 10);
    const cursorSprite = glowDot(GOLD, 60);
    const figT = P.from === "figure" ? 0 : null;

    return (c, u) => {
      if (!blocks) blocks = initBlocks();
      bgVibe(c, u);
      // 承接上一镜的光标
      if (P.cursorUntil != null && L[P.cursorUntil]) {
        const k = 1 - pr(u, L[P.cursorUntil].t0, 0.5);
        if (k > 0) {
          const blink = 0.55 + 0.45 * Math.cos(u * 4.2);
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = k * blink; dot(c, cursorSprite, W / 2, H / 2, 1.6);
          c.globalCompositeOperation = "source-over"; c.fillStyle = "#fff4d8"; c.fillRect(W / 2 - 7, H / 2 - 34, 14, 68); c.restore();
        }
      }
      // 从人形散开的粒子（第一块大字开始聚合前，先在原地呼吸）
      if (figT != null && blocks[0] && u < blocks[0].t0 + 0.2) {
        c.save(); c.globalCompositeOperation = "lighter";
        for (const [x, y] of figure) { c.globalAlpha = 0.5 + 0.3 * Math.sin(u * 2 + x * 0.05); c.fillStyle = "#f3c46b"; c.fillRect(x, y, 2.4, 2.4); }
        c.restore();
      }
      for (const b of blocks) {
        const out = b.stay ? 1 : 1 - pr(u, b.t1 - 0.5, 0.5);
        if (u < b.t0 - 0.05 || out <= 0) continue;
        const solid = pr(u, b.t0 + 1.5, 0.8, E.inOut);           // 粒子聚好后，实字淡入、粒子淡出
        if (solid < 1) {
          c.save(); c.globalCompositeOperation = "lighter";
          for (const p of b.parts) {
            const k = E.inOut(clamp((u - b.t0 - p.dl) / 1.3));
            const x = mix(p.sx, p.x, k) + Math.sin(u * 3 + p.ph) * 2 * (1 - k), y = mix(p.sy, p.y, k) + Math.cos(u * 2.6 + p.ph) * 2 * (1 - k);
            const a = clamp((u - b.t0 - p.dl * 0.5) * 2) * (1 - solid) * out;
            if (a <= 0) continue;
            if (p.big) { c.globalAlpha = a * 0.8; dot(c, sprite, x, y, 1); }
            else { c.globalAlpha = a; const col = mixRGB(GOLD, b.rgb, k); c.fillStyle = `rgb(${col})`; c.fillRect(x - 1.3, y - 1.3, 2.6, 2.6); }
          }
          c.restore();
        }
        if (solid > 0) {
          c.save(); c.globalAlpha = solid * out; c.textAlign = "center"; c.textBaseline = "alphabetic";
          const isGold = b.rgb[0] > 230 && b.rgb[2] < 160;
          glowText(c, b.txt, W / 2, b.y, b.font(b.size), b.color || "#f2efe6", isGold ? 34 : 22, isGold ? "rgba(255,190,90,0.8)" : "rgba(255,240,210,0.45)");
          c.restore();
          // 聚好后零星的闪光
          c.save(); c.globalCompositeOperation = "lighter";
          for (let i = 0; i < b.parts.length; i += 23) {
            const p = b.parts[i], tw = Math.max(0, Math.sin(u * 1.7 + p.ph * 3)) ** 8;
            if (tw > 0.05) { c.globalAlpha = tw * solid * out * 0.8; dot(c, spriteW, p.x, p.y, 1); }
          }
          c.restore();
        }
      }
      for (const ex of P.extras || []) {
        const base = L[ex.after] ? L[ex.after].t0 : 0;
        const k = pr(u, base + (ex.delay || 0), 1.0, E.out);
        if (k <= 0) continue;
        c.save(); c.globalAlpha = k * 0.7; c.textAlign = "center";
        glowText(c, ex.text, W / 2, ex.y + (1 - k) * 10, `600 ${ex.size}px Georgia, "Times New Roman", serif`, "#d9cfb5", 6, "rgba(255,220,160,0.3)");
        c.restore();
      }
      captions(c, L, u, { skip, y: P.captionY, size: P.captionSize, color: P.captionColor || undefined, glow: P.captionColor ? 0 : undefined });
    };
  },
});
