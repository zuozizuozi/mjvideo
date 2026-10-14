// 场景「手翻书」—— 来自《一行代码，怎么变成一段视频？》STYLE 02（手翻书）
// 笔记本纸 + 铅笔跑步小人逐页翻动 + 一排分帧小图。适合讲帧、动画原理、连续动作。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("flipbook", {
  "title": "手翻书",
  "desc": "笔记本纸 + 铅笔跑步小人逐页翻动 + 一排分帧小图。适合讲帧、动画原理、连续动作。",
  "dark": false,
  "music": "flipbook",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cBook": "手翻书",
      "c30": "三十张图",
      "cMove": "连成动作"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cBook = cue(CUES.cBook), c30 = cue(CUES.c30), cMove = cue(CUES.cMove);
      sfx(cBook, "page", 0.8);
      function stick(c, cx, cy, s, ph, col = "#2b2b2b", lw = 7) { // 跑步小人，ph=0..1 一个周期
        const a = Math.sin(ph * Math.PI * 2), b = Math.cos(ph * Math.PI * 2);
        c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.lineJoin = "round";
        const hip = [cx, cy + 40 * s], neck = [cx + 8 * s, cy - 60 * s];
        c.beginPath(); c.arc(cx + 14 * s, cy - 100 * s, 30 * s, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(...neck); c.lineTo(...hip); c.stroke();
        const leg = (k) => { const ang = k * 0.7; const knee = [hip[0] + Math.sin(ang) * 55 * s, hip[1] + Math.cos(ang) * 55 * s];
          const foot = [knee[0] + Math.sin(ang - 0.6 - Math.max(0, -k) * 0.8) * 55 * s, knee[1] + Math.cos(ang - 0.6) * 55 * s];
          c.beginPath(); c.moveTo(...hip); c.lineTo(...knee); c.lineTo(...foot); c.stroke(); };
        leg(a); leg(-a);
        const arm = (k) => { const ang = -k * 0.9; const el = [neck[0] + Math.sin(ang) * 45 * s, neck[1] + 20 * s + Math.cos(ang) * 40 * s];
          c.beginPath(); c.moveTo(neck[0], neck[1] + 15 * s); c.lineTo(...el); c.lineTo(el[0] + 30 * s, el[1] - 20 * s * b); c.stroke(); };
        arm(a); arm(-a);
      }
      const draw = (c, u) => {
        c.fillStyle = "#fbf6e9"; c.fillRect(0, 0, W, H);
        c.strokeStyle = "rgba(90,140,210,0.28)"; c.lineWidth = 2;
        for (let y = 180; y < H; y += 58) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        c.strokeStyle = "rgba(220,80,80,0.45)"; c.beginPath(); c.moveTo(110, 0); c.lineTo(110, H); c.stroke();
        // 标题 + 铅笔下划线
        text(c, "视频 = 一本手翻书", 150, 330, `bold ${KAI(96)}`, "#2b2b2b");
        const k = pr(u, cBook, 0.7, E.inOut);
        c.strokeStyle = "#e0533d"; c.lineWidth = 8; c.lineCap = "round"; c.beginPath();
        for (let i = 0; i <= 40 * k; i++) { const x = 150 + i * 18; c.lineTo(x, 362 + Math.sin(i * 1.3) * 4); } c.stroke();
        // 一叠纸
        const bx = 220, by = 450, bw = 640, bh = 520;
        for (let i = 6; i >= 1; i--) { c.fillStyle = i % 2 ? "#f3ecd8" : "#efe6cf"; c.fillRect(bx + i * 7, by + i * 7, bw, bh); c.strokeStyle = "#cfc3a5"; c.lineWidth = 2; c.strokeRect(bx + i * 7, by + i * 7, bw, bh); }
        c.fillStyle = "#fffdf6"; c.fillRect(bx, by, bw, bh); c.strokeStyle = "#bfb294"; c.strokeRect(bx, by, bw, bh);
        const page = Math.floor(u * 12);
        const ph = (page % 8) / 8;
        stick(c, bx + bw / 2, by + bh / 2 + 30, 1.25, ph);
        c.strokeStyle = "#2b2b2b"; c.lineWidth = 4; c.beginPath(); c.moveTo(bx + 60, by + bh - 70); c.lineTo(bx + bw - 60, by + bh - 70); c.stroke();
        text(c, `第 ${page % 30 + 1} 张`, bx + bw - 30, by + 60, KAI(44), "#9b8f74", "right");
        // 翻页：右下角卷起的纸角
        const f = (u * 12) % 1, curl = 140 * (1 - f);
        c.fillStyle = "rgba(0,0,0,0.12)"; c.beginPath(); c.moveTo(bx + bw, by + bh - curl); c.lineTo(bx + bw - curl, by + bh); c.lineTo(bx + bw, by + bh); c.fill();
        c.fillStyle = "#f6efdc"; c.beginPath(); c.moveTo(bx + bw, by + bh - curl); c.lineTo(bx + bw - curl, by + bh); c.lineTo(bx + bw - curl * 0.9, by + bh - curl * 0.9); c.closePath(); c.fill();
        // 三十张图 → 一条胶片
        const ks = pr(u, c30 - 0.2, 0.6), km = pr(u, cMove - 0.1, 0.8, E.inOut);
        if (ks > 0) {
          c.globalAlpha = ks * (1 - km * 0.6);
          for (let i = 0; i < 6; i++) {
            const x = 130 + i * 140, y = 1080;
            c.fillStyle = "#fffdf6"; c.fillRect(x, y, 120, 150); c.strokeStyle = "#bfb294"; c.lineWidth = 2; c.strokeRect(x, y, 120, 150);
            stick(c, x + 60, y + 92, 0.42, i / 6, "#2b2b2b", 4);
          }
          c.globalAlpha = 1;
          text(c, "1 秒 = 30 张", 540, 1300, `bold ${KAI(66)}`, "#e0533d", "center");
        }
        if (km > 0) { // 箭头：一张张 → 动作
          c.strokeStyle = "#e0533d"; c.lineWidth = 6; c.beginPath(); c.moveTo(140, 1250 - 20); c.lineTo(140 + 800 * km, 1250 - 20); c.stroke();
          c.beginPath(); c.moveTo(140 + 800 * km, 1215); c.lineTo(165 + 800 * km, 1230); c.lineTo(140 + 800 * km, 1245); c.stroke();
        }
      };
    return draw;
  },
});
