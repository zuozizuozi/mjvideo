// 场景「纸艺缓动」—— 来自《一行代码，怎么变成一段视频？》STYLE 05（纸艺 · 缓动）
// 粉色纸艺 + 匀速/缓动双跑道残影 + 缓动曲线卡片 + 落地挤压。适合讲速度、加速度、对比。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("easing", {
  "title": "纸艺缓动",
  "desc": "粉色纸艺 + 匀速/缓动双跑道残影 + 缓动曲线卡片 + 落地挤压。适合讲速度、加速度、对比。",
  "dark": false,
  "music": "easing",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cLin": "匀速",
      "cCurve": "缓动曲线",
      "cFast": "先快后慢",
      "cWeight": "重量"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cLin = cue(CUES.cLin), cCurve = cue(CUES.cCurve), cFast = cue(CUES.cFast), cWeight = cue(CUES.cWeight);
      sfx(cCurve, "pop", 0.6); sfx(cWeight, "thud", 0.8);
      function paper(c, fn, col, sh = 18) { c.save(); c.shadowColor = "rgba(120,60,40,0.28)"; c.shadowBlur = sh; c.shadowOffsetY = 10; c.fillStyle = col; fn(); c.fill(); c.restore(); }
      const draw = (c, u) => {
        c.fillStyle = "#ffe0cf"; c.fillRect(0, 0, W, H);
        paper(c, () => { c.beginPath(); c.ellipse(120, 160, 420, 260, 0.3, 0, 7); }, "#ffb4a2");
        paper(c, () => { c.beginPath(); c.ellipse(1000, 1800, 520, 360, -0.3, 0, 7); }, "#ffcdb2");
        paper(c, () => { c.beginPath(); c.ellipse(980, 260, 200, 140, 0.6, 0, 7); }, "#b5e2d0");
        text(c, "缓动", 80, 420, HEAVY(150), "#6d2e46");
        text(c, "先快 · 后慢 · 有重量", 86, 490, YH(40, 700), "#a2565e");
        const period = 2.2, ph = ((u + 10) % period) / period, k = clamp(ph / 0.75);
        const lanes = [["匀速", (x) => x, cLin, "#f28482"], ["缓动", E.out, cFast, "#2a9d8f"]];
        lanes.forEach(([name, ease, cu, col], i) => {
          const y = 580 + i * 250, x0 = 120, x1 = 900;
          const hi = u > cu - 0.1 && u < cu + 2.0;
          paper(c, () => rr(c, 80, y, 920, 200, 30), hi ? "#fffaf2" : "#fff3e6", hi ? 26 : 14);
          text(c, name, 120, y + 60, YH(38, 800), "#6d2e46");
          for (let j = 1; j <= 6; j++) { // 残影：间距反映速度
            const kk = clamp(k - j * 0.06); const xx = mix(x0 + 60, x1, ease(kk));
            c.fillStyle = col; c.globalAlpha = 0.12 * (7 - j) / 6; c.beginPath(); c.arc(xx, y + 130, 34, 0, 7); c.fill(); c.globalAlpha = 1;
          }
          const xx = mix(x0 + 60, x1, ease(k));
          let sx = 1, sy = 1;
          if (i === 1 && u > cWeight - 0.3) { const land = ph > 0.75 ? clamp((ph - 0.75) / 0.12) : 0; const s = Math.sin(land * Math.PI) * 0.25; sx = 1 + s; sy = 1 - s; }
          paper(c, () => { c.beginPath(); c.ellipse(xx, y + 130 + (1 - sy) * 34, 40 * sx, 40 * sy, 0, 0, 7); }, col, 12);
        });
        // 曲线卡片
        const kc = pr(u, cCurve - 0.2, 0.5);
        c.globalAlpha = kc;
        paper(c, () => rr(c, 80, 1100, 920, 280, 30), "#fffaf2");
        const gx = 160, gy = 1340, gw = 380, gh = 200;
        c.strokeStyle = "#e6c9b8"; c.lineWidth = 3; c.beginPath(); c.moveTo(gx, gy - gh); c.lineTo(gx, gy); c.lineTo(gx + gw, gy); c.stroke();
        c.strokeStyle = "#f28482"; c.setLineDash([10, 10]); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + gw, gy - gh); c.stroke(); c.setLineDash([]);
        const dk = pr(u, cCurve, 1.0, E.inOut);
        c.strokeStyle = "#2a9d8f"; c.lineWidth = 7; c.beginPath();
        for (let i = 0; i <= 60 * dk; i++) { const x = i / 60; c.lineTo(gx + x * gw, gy - E.out(x) * gh); } c.stroke();
        text(c, "1 − (1 − t)³", 600, 1230, MONO(44, 700), "#2a9d8f");
        text(c, "一条曲线，决定快慢", 600, 1300, YH(34, 700), "#a2565e");
        c.globalAlpha = 1;
      };
    return draw;
  },
});
