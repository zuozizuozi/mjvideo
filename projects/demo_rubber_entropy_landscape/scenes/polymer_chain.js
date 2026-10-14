// 场景「高分子链 · 熵力」：一条受热抖动的分子链，两端被拉开时被迫拉直（可能的形状变少），松手后回缩成团。
// 物理关系：链的轮廓长度固定为 Lc；两端距离 L 越接近 Lc，能弯曲的余量越少。
//   抖动幅度 ∝ √(1 − (L/Lc)²)，形状用若干个正弦模态叠加，每个模态随时间按自己的频率摆动（热运动）。
//   “可能形状数”用 exp(−k·L²) 的相对值示意（理想链熵 S ∝ −L²），只做定性展示。
MJ.scene("polymer_chain", {
  title: "高分子链 · 熵力",
  desc: "受热抖动的分子链被拉直再回缩，配“可能形状数”指示条和回缩力箭头。适合讲熵、熵力、橡皮筋、统计物理、无序与有序。",
  dark: true,
  music: "calm",
  design: [1080, 1920],
  params: {
    cues: { cStretch: "拉长", cStraight: "拉直", cFewer: "变少", cRelease: "松手", cBall: "揉成一团", cForce: "熵力" },
    beads: 46,           // 链上的珠子数
    title: "熵力",
  },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, rr, text, HEAVY, YH, MONO } = MJ.lib;
    const { cue, sfx } = ctx;
    const P = ctx.params, CUES = P.cues;
    const cStretch = cue(CUES.cStretch), cStraight = cue(CUES.cStraight), cFewer = cue(CUES.cFewer),
      cRelease = cue(CUES.cRelease), cBall = cue(CUES.cBall), cForce = cue(CUES.cForce);
    sfx(cStretch, "rise", 0.6); sfx(cRelease, "whoosh", 0.8); sfx(cForce, "ding", 0.6);

    const N = P.beads, Lc = 900, CY = 860;               // 轮廓长度（像素）、链的中线高度
    const R = rng(2024);
    const MODES = 7;                                     // 正弦模态：每个都有自己的振幅、频率、相位（热运动）
    const modes = Array.from({ length: MODES }, (_, k) => ({ ay: 1 / (k + 1), ax: 0.5 / (k + 1), w: 1.3 + R() * 2.2 + k * 0.4, py: R() * 6.28, px: R() * 6.28 }));
    const heat = Array.from({ length: 70 }, () => ({ x: R() * W, y: 420 + R() * 900, w: 3 + R() * 5, p: R() * 6.28 }));

    // 两端距离随时间变化：放松 → 拉长 → 保持 → 松手回缩（回缩略带过冲）
    function endDist(u) {
      const L0 = 260, L1 = 860;
      if (u < cRelease) return mix(L0, L1, pr(u, cStretch - 0.1, 1.1, E.inOut));
      return mix(L1, L0, pr(u, cRelease, 0.9, E.elastic));
    }
    function chain(u) {
      const L = endDist(u), slack = Math.sqrt(Math.max(0, 1 - (L / Lc) ** 2));
      const amp = 520 * slack;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        let dx = 0, dy = 0;
        modes.forEach((m, k) => {
          const shape = Math.sin((k + 1) * Math.PI * s);
          dy += m.ay * shape * Math.sin(u * m.w + m.py);
          dx += m.ax * Math.sin((k + 1) * Math.PI * s * 1.5) * Math.cos(u * m.w * 0.8 + m.px);
        });
        pts.push([W / 2 + (s - 0.5) * L + dx * amp * 0.35, CY + dy * amp * 0.55]);
      }
      return { pts, L, slack };
    }

    const draw = (c, u) => {
      // 背景：深蓝 + 细网格
      c.fillStyle = "#070d1a"; c.fillRect(0, 0, W, H);
      c.strokeStyle = "rgba(120,170,255,0.06)"; c.lineWidth = 1;
      for (let x = 0; x < W; x += 54) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 0; y < H; y += 54) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      // 标题
      text(c, P.title, 80, 330, HEAVY(140), "#ffffff");
      text(c, "为什么橡皮筋会自己缩回去？", 86, 410, YH(40, 700), "#8fb8ff");

      const { pts, L, slack } = chain(u);
      // 热运动小点（温度）
      heat.forEach((h) => { const x = h.x + Math.sin(u * 7 + h.p) * 14, y = h.y + Math.cos(u * 6 + h.p * 2) * 14;
        c.fillStyle = "rgba(255,120,80,0.22)"; c.beginPath(); c.arc(x, y, h.w, 0, 7); c.fill(); });
      // 两端的夹子（手）
      const ends = [pts[0], pts[N - 1]];
      ends.forEach(([x, y], i) => { rr(c, x - 34 + (i ? 10 : -10), y - 60, 48, 120, 14); c.fillStyle = "#3b4a6b"; c.fill(); c.strokeStyle = "#9db4e0"; c.lineWidth = 3; c.stroke(); });
      // 分子链：发光的键 + 珠子
      c.save(); c.shadowColor = "rgba(80,200,255,0.8)"; c.shadowBlur = 18;
      c.strokeStyle = "#5fd0ff"; c.lineWidth = 7; c.lineJoin = "round"; c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore();
      pts.forEach(([x, y], i) => { c.fillStyle = i % 2 ? "#bfeaff" : "#ffd36e"; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); });
      // 拉伸方向箭头
      const kS = pr(u, cStretch - 0.1, 0.4) * (1 - pr(u, cRelease - 0.2, 0.3));
      if (kS > 0) { c.globalAlpha = kS; c.strokeStyle = "#ffffff"; c.lineWidth = 6;
        [[pts[0][0] - 70, -1], [pts[N - 1][0] + 70, 1]].forEach(([x, d]) => { c.beginPath(); c.moveTo(x, CY); c.lineTo(x + d * 90, CY); c.stroke();
          c.beginPath(); c.moveTo(x + d * 90, CY - 18); c.lineTo(x + d * 116, CY); c.lineTo(x + d * 90, CY + 18); c.closePath(); c.fillStyle = "#fff"; c.fill(); });
        c.globalAlpha = 1; }
      // “可能的形状”指示条：熵 S ∝ −L²，示意值
      const ent = Math.exp(-3.2 * (L / Lc) ** 2) / Math.exp(-3.2 * (260 / Lc) ** 2);
      const kB = pr(u, cFewer - 0.6, 0.4);
      c.globalAlpha = clamp(0.35 + kB);
      text(c, "可能的形状", 80, 1180, YH(40, 700), "#cfe0ff");
      rr(c, 80, 1210, 920, 46, 23); c.fillStyle = "rgba(255,255,255,0.08)"; c.fill();
      rr(c, 80, 1210, Math.max(46, 920 * ent), 46, 23); c.fillStyle = ent > 0.5 ? "#2fd17a" : ent > 0.2 ? "#ffc43d" : "#ff5a5a"; c.fill();
      text(c, ent > 0.5 ? "多：乱成一团" : ent > 0.2 ? "变少" : "很少：被拉直", 1000, 1180, YH(36, 700), "#ffffff", "right");
      text(c, `端距 ${Math.round(L)} / 轮廓长 ${Lc}`, 80, 1310, MONO(30, 600), "rgba(200,220,255,0.7)");
      c.globalAlpha = 1;
      // 拉直提示
      const kT = pr(u, cStraight - 0.1, 0.4) * (1 - pr(u, cRelease - 0.2, 0.3));
      if (kT > 0) { c.globalAlpha = kT; rr(c, 300, 560, 480, 80, 40); c.fillStyle = "rgba(255,90,90,0.18)"; c.fill();
        text(c, "被拉直 · 姿势变少", 540, 614, YH(40, 800), "#ff8c8c", "center"); c.globalAlpha = 1; }
      // 熵力：回缩箭头 + 名称
      const kF = pr(u, cForce - 0.4, 0.5, E.back);
      if (kF > 0) {
        c.globalAlpha = clamp(kF);
        [[W / 2 - 330, 1], [W / 2 + 330, -1]].forEach(([x, d]) => { c.strokeStyle = "#ffc43d"; c.lineWidth = 10; c.beginPath(); c.moveTo(x, 1020); c.lineTo(x + d * 150 * kF, 1020); c.stroke();
          c.beginPath(); c.moveTo(x + d * 150 * kF, 1000); c.lineTo(x + d * (150 * kF + 30), 1020); c.lineTo(x + d * 150 * kF, 1040); c.closePath(); c.fillStyle = "#ffc43d"; c.fill(); });
        text(c, "熵力：系统往“更乱”的方向回缩", 540, 1100, YH(42, 800), "#ffc43d", "center");
        c.globalAlpha = 1;
      }
    };
    return draw;
  },
});
