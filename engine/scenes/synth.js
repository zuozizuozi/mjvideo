// 场景「合成波透视」—— 来自《一行代码，怎么变成一段视频？》STYLE 06（合成波 · 透视）
// 霓虹透视网格地面 + 条纹太阳 + 远小近大的灯柱 + 霓虹公式。适合讲透视、3D、空间。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("synth", {
  "title": "合成波透视",
  "desc": "霓虹透视网格地面 + 条纹太阳 + 远小近大的灯柱 + 霓虹公式。适合讲透视、3D、空间。",
  "dark": true,
  "music": "synth",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cFar": "离得越远",
      "cDiv": "除法",
      "cRoad": "公路"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cFar = cue(CUES.cFar), cDiv = cue(CUES.cDiv), cRoad = cue(CUES.cRoad);
      sfx(cDiv, "zap", 0.7);
      const draw = (c, u) => {
        const hz = 980;
        const sky = c.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#12002b"); sky.addColorStop(0.55, "#5a0f6e"); sky.addColorStop(1, "#ff4f8b");
        c.fillStyle = sky; c.fillRect(0, 0, W, hz);
        const R = rng(66); c.fillStyle = "#fff"; for (let i = 0; i < 90; i++) { const x = R() * W, y = R() * 700; c.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(u * 2 + i)); c.fillRect(x, y, 3, 3); } c.globalAlpha = 1;
        // 太阳
        c.save(); c.beginPath(); c.arc(540, hz - 40, 260, Math.PI, 0); c.clip();
        const sg = c.createLinearGradient(0, hz - 300, 0, hz); sg.addColorStop(0, "#ffe66d"); sg.addColorStop(1, "#ff2e88"); c.fillStyle = sg; c.fillRect(280, hz - 300, 520, 300);
        c.fillStyle = "#5a0f6e"; for (let i = 0; i < 7; i++) { const yy = hz - 150 + i * 22 + ((u * 20) % 22); c.fillRect(280, yy, 520, 4 + i * 2); }
        c.restore();
        // 山
        c.fillStyle = "#2b0a3d"; c.beginPath(); c.moveTo(0, hz); [[0, 870], [160, 800], [300, 900], [430, 830], [560, 940], [700, 820], [860, 900], [1080, 780], [1080, hz]].forEach(([x, y]) => c.lineTo(x, y)); c.fill();
        // 地面网格（透视投影：屏幕 = 位置 ÷ 距离）
        c.fillStyle = "#0b0016"; c.fillRect(0, hz, W, H - hz);
        c.save(); c.shadowColor = "#ff2e88"; c.shadowBlur = 16; c.strokeStyle = "#ff3cac"; c.lineWidth = 3;
        const f = 520, camH = 1.0;
        for (let i = -14; i <= 14; i++) { c.beginPath(); c.moveTo(540, hz); c.lineTo(540 + i * 900, H + 400); c.stroke(); }
        const off = (u * 2.5) % 1;
        for (let k = 0; k < 40; k++) { const z = 1 + k - off; if (z <= 0.3) continue; const y = hz + (f * camH) / z; if (y > H) continue; c.globalAlpha = clamp(1 - z / 30); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        c.globalAlpha = 1; c.restore();
        // 路边灯柱：同样高的柱子，远处更小
        const kp = pr(u, cFar - 0.2, 0.5);
        if (kp > 0) {
          for (let k = 0; k < 6; k++) {
            const z = 1.2 + k * 1.6 - (((u * 2.5) % 1.6) + 1.6) % 1.6; if (z < 1.3) continue; const sc = f / z;
            const x = 540 - 0.9 * sc, base = hz + (f * camH) / z, hgt = 1.4 * sc;
            c.globalAlpha = kp * clamp(1.5 - z / 8) * clamp((z - 1.3) / 0.6);
            c.fillStyle = "#54f0ff"; c.fillRect(x - sc * 0.03, base - hgt, sc * 0.06, hgt);
            c.beginPath(); c.arc(x, base - hgt, sc * 0.08, 0, 7); c.fill();
          }
          c.globalAlpha = 1;
        }
        // 公式
        const kd = pr(u, cDiv - 0.2, 0.5, E.back);
        if (kd > 0) {
          c.save(); c.globalAlpha = clamp(kd); c.shadowColor = "#54f0ff"; c.shadowBlur = 30;
          text(c, "屏幕 = 位置 ÷ 距离", 540, 520, HEAVY(78 * mix(0.7, 1, kd)), "#e8fdff", "center"); c.restore();
        }
        c.save(); const tg = c.createLinearGradient(0, 260, 0, 400); tg.addColorStop(0, "#9ef0ff"); tg.addColorStop(0.5, "#ffffff"); tg.addColorStop(0.52, "#ff7ad9"); tg.addColorStop(1, "#ffd36e");
        c.font = `italic ${HEAVY(150)}`; c.fillStyle = tg; c.textAlign = "center"; c.shadowColor = "#ff2e88"; c.shadowBlur = 24; c.fillText("透 视", 540, 390); c.restore();
        if (u > cRoad - 0.2) text(c, "SPEED 088 km/h", 540, 1360, MONO(34, 700), "rgba(84,240,255,0.85)", "center");
      };
    return draw;
  },
});
