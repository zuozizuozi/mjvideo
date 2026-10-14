// 场景「注意力连线」：一句话在中央排开（第 0 句，本身就是画面，不再当字幕画）；
// 第 1 句"它"发光，向每个词伸出弧线；第 2 句权重定下来：连"小猫"的最粗最亮，连"桌子"的很淡，词上方标权重（示意）；
// 第 3 句所有字互相连线，下方织成一张网。
MJ.scene("vibe_attention_lines", {
  title: "注意力连线",
  desc: "一句话里某个词向其他词连出粗细不同的弧线（注意力权重），最后全句互连成网。适合讲注意力机制、指代消解、词与词的关系、上下文。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_arp",
  design: [1920, 1080],
  params: {
    tokens: ["小猫", "没有", "跳上", "桌子", "，", "因为", "它", "太", "累", "了", "。"],
    query: 6,
    weights: [0.62, 0.04, 0.06, 0.12, 0, 0.05, 0, 0.03, 0.06, 0.02, 0],
    note: "示意",
    fontSize: 84, y: 520,
    captionY: 960,
  },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, text, SONG, captions, glowText, bgVibe, glowDot, dot, GOLD, PAPER } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines;
    const T = (i) => (L[i] ? L[i].t0 : 0);
    const R = rng(17), toks = P.tokens, Q = P.query, N = toks.length;
    const tSent = T(0), tLook = T(1) + 0.2, tWho = T(2) + 0.2, tAll = T(3) + 0.3;
    sfx(tLook, "glow", 0.5); sfx(tWho + 0.4, "chime", 0.45); sfx(tAll, "shimmer", 0.6);
    const pairs = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (/\S/.test(toks[i].replace(/[，。]/, "")) && /\S/.test(toks[j].replace(/[，。]/, ""))) pairs.push({ i, j, w: R() ** 2, dl: R() * 1.2 });
    const spQ = glowDot(GOLD, 70);
    let lay = null;                                     // 词的位置：要等字体加载完才能量宽度
    const layout = (c) => {
      c.save(); c.font = SONG(P.fontSize);
      const ws = toks.map((t) => c.measureText(t).width), gap = 14, total = ws.reduce((a, b) => a + b, 0) + gap * (N - 1);
      let x = W / 2 - total / 2; const out = ws.map((w) => { const o = { x, cx: x + w / 2, w }; x += w + gap; return o; });
      c.restore(); return out;
    };
    const arc = (c, x0, x1, y, h) => { c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y - h, x1, y); };

    return (c, u) => {
      if (!lay) lay = layout(c);
      bgVibe(c, u);
      const Y = P.y, topY = Y - P.fontSize * 0.95, botY = Y + 26;
      // 全句互连（下方的网）
      const allK = pr(u, tAll, 1.4);
      if (allK > 0) {
        c.save(); c.globalCompositeOperation = "lighter";
        for (const p of pairs) {
          const k = clamp((u - tAll - p.dl) / 0.8); if (k <= 0) continue;
          const x0 = lay[p.i].cx, x1 = lay[p.j].cx, h = -Math.abs(x1 - x0) * 0.45;
          c.strokeStyle = `rgba(243,196,107,${0.08 + 0.4 * p.w})`; c.lineWidth = 1 + p.w * 4;
          c.globalAlpha = k * (0.7 + 0.3 * Math.sin(u * 2 + p.dl * 5));
          arc(c, x0, mix(x0, x1, k), botY, h * k); c.stroke();
        }
        c.restore();
      }
      // "它"向各词的弧线
      const look = pr(u, tLook, 1.0, E.out), who = pr(u, tWho, 1.2, E.inOut);
      if (look > 0) {
        c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
        for (let j = 0; j < N; j++) {
          if (j === Q || !P.weights[j]) continue;
          const w = mix(0.3, P.weights[j], who) * (1 - allK * 0.4);
          const x0 = lay[Q].cx, x1 = lay[j].cx, h = 90 + Math.abs(x1 - x0) * 0.35;
          const k = clamp(look * 1.4 - Math.abs(j - Q) * 0.06);
          c.strokeStyle = `rgba(243,196,107,${0.15 + 0.85 * w})`; c.lineWidth = 1.5 + w * 16;
          c.shadowColor = "rgba(255,190,90,0.8)"; c.shadowBlur = w > 0.4 ? 18 : 0;
          c.beginPath(); c.moveTo(x0, topY);
          const steps = 30;
          for (let s = 1; s <= steps * k; s++) { const t = s / steps, xm = (x0 + x1) / 2, ym = topY - h; c.lineTo((1 - t) ** 2 * x0 + 2 * (1 - t) * t * xm + t * t * x1, (1 - t) ** 2 * topY + 2 * (1 - t) * t * ym + t * t * topY); }
          c.stroke();
        }
        c.restore();
        // 权重标注
        const nk = pr(u, tWho + 0.9, 0.6) * (1 - allK * 0.6);
        if (nk > 0) {
          c.save(); c.globalAlpha = nk;
          for (let j = 0; j < N; j++) if (j !== Q && P.weights[j]) text(c, P.weights[j].toFixed(2), lay[j].cx, topY - 22, `600 ${P.weights[j] > 0.3 ? 36 : 24}px Georgia, serif`, P.weights[j] > 0.3 ? "#f3c46b" : "#9f9a8a", "center");
          c.globalAlpha = nk * 0.55; text(c, P.note, W - 70, H - 30, SONG(24), "#cfc7b0", "right");
          c.restore();
        }
      }
      // 句子
      for (let j = 0; j < N; j++) {
        const a = pr(u, tSent + j * 0.08, 0.5);
        if (a <= 0) continue;
        const isQ = j === Q, isAns = j === 0;
        const q = isQ ? look : 0, ans = isAns ? who : 0;
        if (q > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = q * 0.6; dot(c, spQ, lay[j].cx, Y - P.fontSize * 0.35, 1.3); c.restore(); }
        c.save(); c.globalAlpha = a; c.textAlign = "left";
        const col = q > 0.3 || ans > 0.3 ? "#f3c46b" : "#f2efe6";
        glowText(c, toks[j], lay[j].x, Y + (1 - a) * 10, SONG(P.fontSize), col, q + ans > 0.3 ? 26 : 8, q + ans > 0.3 ? "rgba(255,190,90,0.9)" : "rgba(255,255,255,0.3)");
        c.restore();
      }
      captions(c, L, u, { skip: [0], y: P.captionY, size: 50 });
    };
  },
});
