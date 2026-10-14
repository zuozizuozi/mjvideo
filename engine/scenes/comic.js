// 场景「漫画波普」—— 来自《一行代码，怎么变成一段视频？》STYLE 10（漫画波普）
// 网点背景 + 漫画分格 + 数值被划掉替换 + 爆炸框。适合讲对比、改动、强调。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("comic", {
  "title": "漫画波普",
  "desc": "网点背景 + 漫画分格 + 数值被划掉替换 + 爆炸框。适合讲对比、改动、强调。",
  "dark": false,
  "music": "comic",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cCtrl": "精确可控",
      "cNum": "改一个数字",
      "cOut": "重新出片"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cCtrl = cue(CUES.cCtrl), cNum = cue(CUES.cNum), cOut = cue(CUES.cOut);
      sfx(cNum, "pow", 0.9); sfx(cOut, "whoosh", 0.8);
      function burst(c, x, y, r, n, col, rot = 0) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, rr2 = i % 2 ? r * 0.62 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 8; c.strokeStyle = "#111"; c.stroke(); }
      function comicText(c, s, x, y, size, col, align = "center") { c.font = HEAVY(size); c.textAlign = align; c.lineJoin = "round"; c.lineWidth = size * 0.14; c.strokeStyle = "#111"; c.fillStyle = "#111"; c.fillText(s, x + size * 0.06, y + size * 0.06); c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y); }
      const draw = (c, u) => {
        c.fillStyle = "#ffd400"; c.fillRect(0, 0, W, H);
        c.fillStyle = "rgba(230,40,60,0.35)"; for (let y = 0; y < H; y += 26) for (let x = (y / 26) % 2 ? 13 : 0; x < W; x += 26) { const r = 4 + 3 * Math.sin(x * 0.004 + y * 0.003); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
        comicText(c, "精确可控！", 540, 380, 140, "#ffffff");
        const changed = u > cNum + 0.35;
        [["速度 = 120", 520, 0], ["速度 = 240", 980, 1]].forEach(([label, y, i]) => {
          if (i === 1 && !changed) return;
          const k = i === 1 ? pr(u, cNum + 0.35, 0.4, E.back) : 1;
          c.save(); c.translate(540, y + 180); c.rotate(i ? 0.02 : -0.015); c.scale(k, k);
          c.fillStyle = "#fff"; c.fillRect(-460, -180, 920, 380); c.lineWidth = 10; c.strokeStyle = "#111"; c.strokeRect(-460, -180, 920, 380);
          const sp = i ? 240 : 120, x = -380 + ((u * sp * 1.6) % 760);
          c.strokeStyle = "#111"; c.lineWidth = 6; for (let j = 1; j <= (i ? 6 : 3); j++) { c.beginPath(); c.moveTo(x - 60 - j * 40, 40 - j * 12 + 30); c.lineTo(x - 30 - j * 22, 40 - j * 12 + 30); c.stroke(); }
          c.fillStyle = i ? "#e6283c" : "#1f6fe5"; c.beginPath(); c.arc(x, 60, 56, 0, 7); c.fill(); c.lineWidth = 8; c.stroke();
          comicText(c, label, -420, -100, 64, "#ffffff", "left");
          c.restore();
        });
        if (u > cNum - 0.1 && !changed) { c.strokeStyle = "#e6283c"; c.lineWidth = 14; c.beginPath(); c.moveTo(270, 432); c.lineTo(620, 470); c.stroke(); }
        const kb = pr(u, cNum, 0.4, E.back);
        if (kb > 0) { c.save(); c.translate(800, 850); c.rotate(-0.12); c.scale(kb, kb); burst(c, 0, 0, 210, 14, "#ff3d5a", u * 0.3); comicText(c, "改个数!", 0, 30, 82, "#ffffff"); c.restore(); }
        const ko = pr(u, cOut - 0.1, 0.4, E.back);
        if (ko > 0) { c.save(); c.translate(300, 1390); c.rotate(0.08); c.scale(ko, ko); burst(c, 0, 0, 170, 12, "#1f6fe5"); comicText(c, "出片!", 0, 26, 76, "#ffffff"); c.restore(); }
      };
    return draw;
  },
});
