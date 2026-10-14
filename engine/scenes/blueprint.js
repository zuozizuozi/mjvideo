// 场景「工程蓝图」—— 来自《一行代码，怎么变成一段视频？》STYLE 04（蓝图）
// 蓝图网格 + 轨道小球 + 同步绘制 x-t 函数图和实时读数。适合讲函数、物理量随时间变化。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("blueprint", {
  "title": "工程蓝图",
  "desc": "蓝图网格 + 轨道小球 + 同步绘制 x-t 函数图和实时读数。适合讲函数、物理量随时间变化。",
  "dark": true,
  "music": "blueprint",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cFn": "时间的函数",
      "cGo": "时间每往前走",
      "cBall": "小球"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cFn = cue(CUES.cFn), cGo = cue(CUES.cGo), cBall = cue(CUES.cBall);
      sfx(cFn, "ding", 0.5);
      const draw = (c, u) => {
        c.fillStyle = "#0d4a8f"; c.fillRect(0, 0, W, H);
        c.lineWidth = 1; c.strokeStyle = "rgba(255,255,255,0.08)";
        for (let x = 0; x < W; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        for (let y = 0; y < H; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        c.strokeStyle = "rgba(255,255,255,0.18)";
        for (let x = 0; x < W; x += 150) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        for (let y = 0; y < H; y += 150) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        text(c, "DWG-04 · MOTION", 80, 250, MONO(28, 600), "rgba(255,255,255,0.6)");
        const kf = pr(u, cFn - 0.2, 0.6);
        c.globalAlpha = kf; text(c, "x = f(t)", 80, 380, MONO(110, 700), "#ffffff"); c.globalAlpha = 1;
        text(c, "位置，是时间的函数", 84, 450, YH(40, 700), "#9fd3ff");
        // 轨道
        const x0 = 140, x1 = 940, ty = 600;
        c.strokeStyle = "#ffffff"; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, ty); c.lineTo(x1, ty); c.stroke();
        for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(x0 + i * 100, ty - 12); c.lineTo(x0 + i * 100, ty + 12); c.stroke(); }
        const T = clamp((u - cGo) / 4.0) * 4.0;            // 0..4 秒
        const bx = x0 + T * 200;
        c.fillStyle = "#ffcf3f"; c.beginPath(); c.arc(bx, ty - 50, 34, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 4; c.stroke();
        // 图表
        const gx = 140, gy = 1260, gw = 800, gh = 520;
        c.strokeStyle = "#ffffff"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(gx, gy - gh - 20); c.lineTo(gx, gy); c.lineTo(gx + gw + 20, gy); c.stroke();
        text(c, "t (秒)", gx + gw + 10, gy + 50, YH(30, 600), "#9fd3ff", "right");
        text(c, "x", gx - 40, gy - gh, MONO(36, 700), "#9fd3ff");
        for (let i = 1; i <= 4; i++) text(c, String(i), gx + i * 200, gy + 40, MONO(28, 600), "rgba(255,255,255,0.7)", "center");
        c.strokeStyle = "#ffcf3f"; c.lineWidth = 6; c.beginPath(); c.moveTo(gx, gy);
        c.lineTo(gx + T * 200, gy - T * (gh / 4)); c.stroke();
        if (T > 0) {
          c.setLineDash([12, 10]); c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2;
          c.beginPath(); c.moveTo(bx, ty - 16); c.lineTo(bx, gy - T * (gh / 4)); c.stroke(); c.setLineDash([]);
          c.fillStyle = "#ffcf3f"; c.beginPath(); c.arc(gx + T * 200, gy - T * (gh / 4), 12, 0, 7); c.fill();
        }
        text(c, `t = ${T.toFixed(2)} s`, 140, 1350, MONO(46, 700), "#ffffff");
        text(c, `x = ${Math.round(T * 200)} px`, 600, 1350, MONO(46, 700), "#ffcf3f");
      };
    return draw;
  },
});
