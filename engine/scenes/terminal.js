// 场景「终端打字」—— 来自《一行代码，怎么变成一段视频？》STYLE 01（终端）
// 代码雨背景 + 终端逐行打字（帧号实时跳动）+ 打字机大标题。适合开场、讲程序/命令。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("terminal", {
  "title": "终端打字",
  "desc": "代码雨背景 + 终端逐行打字（帧号实时跳动）+ 打字机大标题。适合开场、讲程序/命令。",
  "dark": true,
  "music": "terminal",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cNo": "没有一个镜头",
      "cGen": "视频生成模型",
      "cEvery": "每一帧"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const R = rng(11);
      const cols = Array.from({ length: 30 }, (_, i) => ({ x: 18 + i * 36, sp: 80 + R() * 160, off: R() * 2000, len: 8 + Math.floor(R() * 14) }));
      const CHARS = "const t=frame/30;ctx.arc(x,y,r);draw(t)=>{}[]01ease";
      const cNo = cue(CUES.cNo), cGen = cue(CUES.cGen), cEvery = cue(CUES.cEvery);
      sfx(cNo, "type", 0.5); sfx(cGen, "error", 0.6); sfx(cEvery, "type", 0.6);
      const draw = (c, u) => {
        c.fillStyle = "#070b10"; c.fillRect(0, 0, W, H);
        c.font = MONO(28, 400); c.textAlign = "center";
        for (const col of cols) {             // 背景代码雨
          const head = ((u * col.sp + col.off) % (H + 600)) - 300;
          for (let k = 0; k < col.len; k++) {
            const y = head - k * 34; if (y < -40 || y > H + 40) continue;
            c.fillStyle = k === 0 ? "rgba(180,255,220,0.55)" : `rgba(40,220,160,${0.22 * (1 - k / col.len)})`;
            c.fillText(CHARS[(Math.floor(col.off) + k * 7 + Math.floor(u * 6)) % CHARS.length], col.x, y);
          }
        }
        // 终端窗口
        const x = 70, y = 330, w = 940, h = 700;
        c.save(); c.shadowColor = "rgba(0,255,170,0.25)"; c.shadowBlur = 40;
        rr(c, x, y, w, h, 24); c.fillStyle = "rgba(10,16,22,0.94)"; c.fill(); c.restore();
        c.strokeStyle = "rgba(80,255,190,0.35)"; c.lineWidth = 2; rr(c, x, y, w, h, 24); c.stroke();
        ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x + 40 + i * 34, y + 38, 11, 0, 7); c.fill(); });
        text(c, "render.mjs", x + w / 2, y + 48, MONO(26, 400), "#7f8c99", "center");
        const frameNo = String(Math.max(1, Math.floor((shot.start + u) * FPS) + 1)).padStart(4, "0");
        const lines = [
          [0.2, "$ node render.mjs", "#e6edf3"],
          [1.0, "> 载入场景 ×11", "#7ee787"],
          [1.8, `> 正在绘制第 ${frameNo} 帧…`, "#7ee787"],
          [cNo, "> 实拍镜头 ············ 0", "#ffa657"],
          [cGen, "> 视频生成模型 ········ 0", "#ff7b72"],
        ];
        lines.forEach(([u0, s, col], i) => {
          if (u < u0) return;
          const str = i === 2 ? s : typed(s, u, u0, 22);
          text(c, str, x + 44, y + 140 + i * 74, MONO(38), col);
        });
        // 大标题，打字机出现
        if (u > cEvery - 0.1) {
          const s = typed("每一帧，都是代码画的", u, cEvery - 0.1, 9);
          c.save(); c.shadowColor = "rgba(84,255,200,0.6)"; c.shadowBlur = 24;
          text(c, s, 540, 1230, HEAVY(84), "#ffffff", "center"); c.restore();
          if (Math.floor(u * 2.5) % 2 === 0) { c.font = HEAVY(84); const wv = c.measureText(s).width; c.fillStyle = "#54ffc8"; c.fillRect(540 + wv / 2 + 10, 1150, 18, 90); }
        }
      };
    return draw;
  },
});
