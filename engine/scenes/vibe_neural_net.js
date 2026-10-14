// 场景「分层神经网络」：一个字从左边进来，碎成一列数字 → 信号脉冲穿过一层又一层（连线亮度 = 权重）→
// 每层的旋钮拧一下（连线闪动、小旋钮出现）→ 右端输出下一个字的概率条。
// 时间：第 0 句字进来并变成数字；第 1 句脉冲逐层穿过；第 2 句旋钮拧动；第 3 句输出概率。
MJ.scene("vibe_neural_net", {
  title: "分层神经网络",
  desc: "输入字 → 数字向量 → 多层节点和连线逐层点亮 → 输出概率条。适合讲神经网络、前向传播、信息逐层处理、模型内部结构。横屏无口播 Vibe 风格。",
  dark: true,
  music: "ambient_full",
  design: [1920, 1080],
  params: {
    input: "天",
    layers: [8, 12, 12, 12, 8],
    outputs: [["好", 62], ["不错", 21], ["冷", 9]],
    note: "示意",
    captionY: 990,
  },
  create(ctx) {
    const TH = MJ.theme;                                 // 颜色、字体、叠加方式都从主题取（见 engine/lib.js 的 THEME_DEFAULT）
    const { W, H, clamp, mix, E, pr, rng, rr, text, SONG, SONGH, MONO, captions, glowText, bgVibe, glowDot, dot, GOLD, ICE } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines;
    const T = (i) => (L[i] ? L[i].t0 : 0);
    const R = rng(31);
    const LX = [430, 690, 950, 1210, 1470], TOP = 150, BOT = 830;
    const nodes = P.layers.map((n, li) => Array.from({ length: n }, (_, k) => ({ x: LX[li], y: mix(TOP, BOT, n === 1 ? 0.5 : k / (n - 1)) + (li % 2 ? 0 : 0) })));
    const edges = [];
    for (let li = 0; li < nodes.length - 1; li++) for (const a of nodes[li]) for (const b of nodes[li + 1]) edges.push({ a, b, li, w: R() ** 2, ph: R() * 6.28 });
    const nums = Array.from({ length: P.layers[0] }, () => (R() * 2 - 1).toFixed(2));
    const tIn = T(0), tPass = T(1), tTwist = T(2), tOut = T(3);
    sfx(tIn + 0.2, "glow", 0.5); sfx(tIn + 1.4, "shimmer", 0.4); sfx(tPass, "swell", 0.45);
    for (let li = 0; li < 5; li++) sfx(tPass + 0.3 + li * 0.45, "chime", 0.18);
    sfx(tTwist + 0.2, "tick", 0.25); sfx(tTwist + 0.6, "tick", 0.25); sfx(tOut + 0.4, "chime", 0.45);
    // 静态底层连线预画到离屏画布
    const base = MJ.lib.canvas(W, H), bx = base.getContext("2d");
    for (const e of edges) { bx.strokeStyle = `rgba(${TH.rgb.coldLine},${0.04 + e.w * 0.1})`; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(e.a.x, e.a.y); bx.lineTo(e.b.x, e.b.y); bx.stroke(); }
    const spG = glowDot(GOLD, 26), spI = glowDot(ICE, 22), spS = glowDot(GOLD, 10);
    // 信号前沿：从输入层（x=430）走到输出层（x=1470）
    const frontX = (u) => mix(LX[0] - 60, LX[4] + 80, pr(u, tPass + 0.2, 2.6, E.inOut)) + Math.max(0, u - tPass - 2.8) * 0;
    const knobs = [0, 1, 2, 3].map((li) => edges.filter((e) => e.li === li)[Math.floor(R() * 40)]);

    return (c, u) => {
      bgVibe(c, u);
      const netA = pr(u, tIn + 0.8, 1.0);
      c.save(); c.globalAlpha = netA; c.drawImage(base, 0, 0); c.restore();
      const fx = frontX(u), passed = u > tPass;
      // 发亮的连线（只画权重大的，亮度跟信号前沿和旋钮拧动有关）
      c.save(); c.globalCompositeOperation = TH.blend; c.lineWidth = 1.6;
      const twist = pr(u, tTwist, 0.4) * (1 - pr(u, tTwist + 2.2, 0.8));
      for (const e of edges) {
        if (e.w < 0.35) continue;
        const lit = passed ? clamp((fx - e.a.x) / 260) : 0;
        const flick = twist * (0.5 + 0.5 * Math.sin(u * 9 + e.ph));
        const a = netA * e.w * (0.12 + 0.6 * lit + 0.5 * flick);
        if (a < 0.02) continue;
        c.strokeStyle = `rgba(${TH.rgb.accent},${clamp(a)})`;
        c.beginPath(); c.moveTo(e.a.x, e.a.y); c.lineTo(e.b.x, e.b.y); c.stroke();
      }
      // 脉冲：沿高权重连线跑的光点
      if (passed && fx < LX[4] + 60) {
        for (const e of edges) {
          if (e.w < 0.55 || fx < e.a.x || fx > e.b.x) continue;
          const k = (fx - e.a.x) / (e.b.x - e.a.x);
          c.globalAlpha = netA * e.w; dot(c, spS, mix(e.a.x, e.b.x, k), mix(e.a.y, e.b.y, k), 1);
        }
      }
      // 节点
      nodes.forEach((layer) => layer.forEach((n) => {
        const lit = passed ? clamp((fx - n.x + 40) / 120) : 0;
        c.globalAlpha = netA * (0.35 + 0.65 * lit) * (0.85 + 0.15 * Math.sin(u * 2 + n.y));
        dot(c, lit > 0.5 ? spG : spI, n.x, n.y, 0.75 + 0.25 * lit);
      }));
      c.restore();
      // 节点实心圈
      c.save(); c.globalAlpha = netA;
      nodes.forEach((layer) => layer.forEach((n) => { c.fillStyle = TH.panelSolid; c.beginPath(); c.arc(n.x, n.y, 7, 0, 7); c.fill(); c.strokeStyle = `rgba(${TH.rgb.accent},0.7)`; c.lineWidth = 2; c.stroke(); }));
      c.restore();
      // 小旋钮：拧一下
      if (twist > 0) {
        for (const e of knobs) {
          const x = mix(e.a.x, e.b.x, 0.5), y = mix(e.a.y, e.b.y, 0.5), ang = -1.2 + Math.sin((u - tTwist) * 3 + e.ph) * 1.1;
          c.save(); c.globalAlpha = twist; c.strokeStyle = TH.accent; c.lineWidth = 2.5; c.shadowColor = `rgba(${TH.rgb.glow},0.8)`; c.shadowBlur = 10;
          c.fillStyle = TH.panelSolid; c.beginPath(); c.arc(x, y, 22, 0, 7); c.fill(); c.stroke();
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16); c.stroke(); c.restore();
        }
      }
      // 输入：一个字 → 碎成一列数字 → 滑进第一层
      const inA = pr(u, tIn, 0.6), split = pr(u, tIn + 1.2, 0.9, E.inOut);
      if (inA > 0) {
        c.save(); c.globalAlpha = inA * (1 - split);
        glowText(c, P.input, 190, 540 + 40, SONGH(130), TH.text, 24, `rgba(${TH.rgb.halo},0.5)`); c.textAlign = "left";
        c.restore();
        c.save(); c.textAlign = "center";
        nums.forEach((s, k) => {
          const n = nodes[0][k], slide = pr(u, tIn + 2.2, 0.8, E.inOut);
          const x = mix(mix(250, 250, split), n.x - 95, slide), y = mix(540, n.y + 10, split);
          c.globalAlpha = split * (1 - pr(u, tPass + 0.6, 0.6) * 0.6);
          text(c, s, x, y, MONO(26), TH.cold, "center");
        });
        c.restore();
      }
      // 输出：概率条
      const outA = pr(u, tOut + 0.2, 0.6);
      if (outA > 0) {
        c.save(); c.globalAlpha = outA;
        P.outputs.forEach(([w, p], i) => {
          const y = 380 + i * 110, g = pr(u, tOut + 0.3 + i * 0.12, 0.8, E.out), top = i === 0;
          text(c, w, 1570, y + 40, SONG(44), top ? TH.accent : TH.dim);
          rr(c, 1680, y + 6, 180 * p / 100 * g + 2, 40, 8); c.fillStyle = top ? `rgba(${TH.rgb.accent},0.85)` : `rgba(${TH.rgb.bar},0.4)`; c.fill();
          text(c, `${Math.round(p * g)}%`, 1680, y + 84, `600 26px Georgia, serif`, top ? TH.accent : TH.muted);
        });
        c.globalAlpha = outA * 0.55; text(c, P.note, W - 70, H - 30, SONG(24), TH.muted, "right");
        c.restore();
      }
      captions(c, L, u, { y: P.captionY, size: 50 });
    };
  },
});
