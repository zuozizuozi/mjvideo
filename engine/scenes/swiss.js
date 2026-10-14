// 场景「瑞士海报流水线」—— 来自《一行代码，怎么变成一段视频？》STYLE 09（瑞士海报 · 流水线）
// 红黑网格海报 + 大号计数器 + 五步流水线依次点亮。适合讲流程、步骤、计数。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("swiss", {
  "title": "瑞士海报流水线",
  "desc": "红黑网格海报 + 大号计数器 + 五步流水线依次点亮。适合讲流程、步骤、计数。",
  "dark": false,
  "music": "swiss",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cPush": "从零推到结尾",
      "cShot": "一帧一帧",
      "cEnc": "编码器",
      "cJoin": "拼成"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cPush = cue(CUES.cPush), cShot = cue(CUES.cShot), cEnc = cue(CUES.cEnc), cJoin = cue(CUES.cJoin);
      [cShot, cEnc, cJoin].forEach((t0) => sfx(t0, "click", 0.7));
      const steps = [["时间 t", 0], ["画这一帧", cShot], ["截图", cShot + 0.5], ["编码器", cEnc], ["视频.mp4", cJoin]];
      const draw = (c, u) => {
        c.fillStyle = "#f1eee6"; c.fillRect(0, 0, W, H);
        c.fillStyle = "#e3352b"; c.fillRect(0, 0, 140, H);
        c.strokeStyle = "#111"; c.lineWidth = 2; for (let x = 140; x < W; x += 188) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        c.save(); c.translate(100, 1500); c.rotate(-Math.PI / 2); text(c, "RENDER PIPELINE · 渲染流水线", 0, 0, YH(40, 800), "#f1eee6"); c.restore();
        const k = pr(u, cPush - 0.3, Math.max(1, cJoin - cPush), E.inOut);
        const n = Math.floor(k * ctx.totalFrames);
        text(c, String(n).padStart(4, "0"), 180, 560, HEAVY(300), "#111");
        text(c, `/ ${ctx.totalFrames} 帧`, 190, 650, YH(56, 800), "#e3352b");
        text(c, `${(n / FPS).toFixed(2)} 秒`, 1020, 650, MONO(48, 700), "#111", "right");
        c.fillStyle = "#111"; c.fillRect(180, 690, 840 * k, 16); c.strokeStyle = "#111"; c.lineWidth = 3; c.strokeRect(180, 690, 840, 16);
        steps.forEach(([name, t0], i) => {
          const y = 790 + i * 120, on = u > t0 - 0.05, kk = pr(u, t0 - 0.05, 0.3);
          c.fillStyle = on ? (i === steps.length - 1 ? "#e3352b" : "#111") : "#f1eee6";
          c.fillRect(180, y, 840, 96); c.strokeStyle = "#111"; c.lineWidth = 3; c.strokeRect(180, y, 840, 96);
          text(c, String(i + 1).padStart(2, "0"), 210, y + 66, MONO(44, 700), on ? "#f1eee6" : "#111");
          text(c, name, 310, y + 68, HEAVY(56), on ? "#f1eee6" : "#111");
          if (on && i < steps.length - 1) text(c, "↓", 960, y + 70, HEAVY(56), "#f1eee6", "center");
          if (kk > 0 && kk < 1) { c.fillStyle = "rgba(227,53,43,0.6)"; c.fillRect(180, y, 840 * kk, 96); }
        });
      };
    return draw;
  },
});
