// 场景「对话文字流」：对话框里提问 → 回答逐字流出 → 文字溢出铺满整屏 → 全部倒吸回中心，缩成一个闪烁的光标。
// 时间全部跟着字幕句子走（ctx.lines）：第 0 句出现提问，第 1 句开始回答，第 2 句溢出铺满，最后一句（或 cCollapse）倒吸成光标。
MJ.scene("vibe_chat_flow", {
  title: "对话文字流 → 光标",
  desc: "对话框提问、回答逐字流出、文字铺满全屏后倒吸成一个光标。适合讲 AI 对话、大模型回答、信息爆炸收束到一个点。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_pad",
  design: [1920, 1080],
  params: {
    question: "它到底是怎么学会说话的？",
    answer: ["好的，我们分三步来看。", "第一，先把问题拆开；", "第二，逐个验证假设；", "「床前明月光，疑是地上霜。」", "def solve(x):", "    return x * 2 + 1", "所以，结论是可以这样做。"],
    cues: { cCollapse: "一件事" },     // 说到这个词时文字倒吸成光标（也可以写秒数）
    captionY: 960,
  },
  create(ctx) {
    const TH = MJ.theme;                                 // 颜色、字体、叠加方式都从主题取（见 engine/lib.js 的 THEME_DEFAULT）
    const { W, H, clamp, mix, E, pr, rng, rr, text, MONO, SONG, captions, bgVibe, glowDot, dot, GOLD } = MJ.lib;
    const { cue, sfx } = ctx, P = ctx.params, L = ctx.lines;
    const T = (i) => (L[i] ? L[i].t0 : 0);
    const tQ = T(0), tA = T(1), tFlood = T(2), tCol = cue(P.cues.cCollapse) + 0.3;
    sfx(tQ + 0.2, "chime", 0.5); sfx(tFlood, "shimmer", 0.7); sfx(tCol, "swell", 0.6); sfx(tCol + 1.3, "chime", 0.6);

    // 回答逐字流出：按行累计字符，速度越来越快
    const ans = P.answer, total = ans.join("").length;
    const typedN = (u) => { const x = Math.max(0, u - tA + 0.1); return Math.min(total, Math.floor(9 * x + 9 * x * x)); };
    // 铺满整屏的文字墙：网格上每格一个字
    const R = rng(11), pool = ans.join("").replace(/\s/g, "") + P.question;
    const glyphs = [];
    for (let gy = 60; gy < H - 40; gy += 46) for (let gx = 40; gx < W - 20; gx += 40) {
      const d = Math.hypot(gx - W / 2, gy - H / 2);
      glyphs.push({ x: gx + (R() - 0.5) * 8, y: gy, ch: pool[Math.floor(R() * pool.length)], d, a: 0.25 + R() * 0.6, dl: R() * 0.5, gold: R() < 0.08 });
    }
    const maxD = Math.hypot(W / 2, H / 2);
    const cursorSprite = glowDot(GOLD, 60);
    const PX = 510, PY = 120, PW = 900, PH = 560;     // 对话框

    return (c, u) => {
      bgVibe(c, u);
      const flood = pr(u, tFlood, 1.6, E.inOut);        // 0→1 文字墙出现
      const col = pr(u, tCol, 1.2, E.inOut);            // 0→1 倒吸
      // 对话框
      const panelA = pr(u, tQ - 0.3, 0.6) * (1 - flood * 0.85) * (1 - col);
      if (panelA > 0.01) {
        c.save(); c.globalAlpha = panelA;
        rr(c, PX, PY, PW, PH, 26); c.fillStyle = `rgba(${TH.rgb.card},0.75)`; c.fill(); c.strokeStyle = `rgba(${TH.rgb.accent},0.25)`; c.lineWidth = 2; c.stroke();
        // 提问气泡（右）
        c.font = SONG(30); const qw = c.measureText(P.question).width + 56;
        const qk = pr(u, tQ, 0.5, E.out);
        c.globalAlpha = panelA * qk;
        rr(c, PX + PW - 40 - qw, PY + 40 + (1 - qk) * 12, qw, 64, 20); c.fillStyle = `rgba(${TH.rgb.accent},0.18)`; c.fill();
        text(c, P.question, PX + PW - 40 - qw / 2, PY + 83 + (1 - qk) * 12, SONG(30), TH.text, "center");
        // 回答（左），逐字
        c.globalAlpha = panelA;
        let n = typedN(u), y = PY + 160;
        for (const line of ans) {
          if (n <= 0) break;
          const s = line.slice(0, n); n -= line.length;
          const code = /^(def |\s{4})/.test(line);
          text(c, s, PX + 60, y, code ? MONO(28) : SONG(30), code ? TH.cold : TH.dim);
          y += 52;
        }
        if (u > tA && typedN(u) < total && Math.floor(u * 3) % 2 === 0) { c.fillStyle = TH.accent; c.fillRect(PX + 60, y - 30, 14, 34); }
        c.restore();
      }
      // 文字墙：从中心往外扩散出现；倒吸时每个字飞向中心并变淡
      if (flood > 0 && col < 1) {
        c.save(); c.textAlign = "center"; c.textBaseline = "middle"; c.font = SONG(28);
        for (const g of glyphs) {
          const appear = clamp((flood * 1.3 - g.d / maxD) * 3);
          if (appear <= 0) continue;
          const k = clamp((col - g.dl * (1 - g.d / maxD) * 0.6) / 0.7);   // 越外圈越晚开始倒吸
          const kk = E.inOut(k);
          const x = mix(g.x, W / 2, kk), yy = mix(g.y + Math.sin(u * 0.8 + g.x) * 3, H / 2, kk);
          const band = clamp(Math.abs(yy - P.captionY + 18) / 90);          // 字幕带附近的字压暗，保证字幕看得清
          c.globalAlpha = g.a * appear * (1 - kk) * (1 - pr(u, tCol - 0.2, 0.2) * 0.3) * mix(0.12, 1, band);
          c.fillStyle = g.gold ? TH.accent : TH.dim;
          c.fillText(g.ch, x, yy);
        }
        c.restore();
      }
      // 光标：倒吸完成后出现在中心，闪烁
      const cur = pr(u, tCol + 0.9, 0.5);
      if (cur > 0) {
        const blink = 0.55 + 0.45 * Math.cos((u - tCol) * 4.2);
        c.save(); c.globalCompositeOperation = TH.blend; c.globalAlpha = cur * blink;
        dot(c, cursorSprite, W / 2, H / 2, 1.6);
        c.globalCompositeOperation = "source-over"; c.fillStyle = TH.highlight; c.fillRect(W / 2 - 7, H / 2 - 34, 14, 68);
        c.restore();
      }
      captions(c, L, u, { y: P.captionY });
    };
  },
});
