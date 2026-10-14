// 场景「胶片收尾」—— 来自《一行代码，怎么变成一段视频？》STYLE 11（胶片 · 收尾）
// 暖色散景 + 滚动胶片（播放本片其他镜头的真实缩略图）+ 衬线标题 + 署名。适合结尾回顾。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("film", {
  "title": "胶片收尾",
  "desc": "暖色散景 + 滚动胶片（播放本片其他镜头的真实缩略图）+ 衬线标题 + 署名。适合结尾回顾。",
  "dark": true,
  "music": "film",
  "design": [
    1080,
    1920
  ],
  "needsThumbs": true,
  "noThumb": true,
  "params": {
    "cues": {
      "cCode": "会动的代码",
      "cMe": "我是麻酱"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cCode = cue(CUES.cCode), cMe = cue(CUES.cMe);
      sfx(cCode, "ding", 0.6);
      const R = rng(1111), bok = Array.from({ length: 26 }, () => ({ x: R() * W, y: R() * H, r: 40 + R() * 140, s: 0.2 + R() * 0.5, a: R() * 6 }));
      const draw = (c, u) => {
        c.fillStyle = "#1e140d"; c.fillRect(0, 0, W, H);
        bok.forEach((b) => { const y = (b.y - u * 20 * b.s + H) % H; const gr = c.createRadialGradient(b.x, y, 0, b.x, y, b.r);
          gr.addColorStop(0, `rgba(255,190,110,${0.18 + 0.08 * Math.sin(u + b.a)})`); gr.addColorStop(1, "rgba(255,190,110,0)"); c.fillStyle = gr; c.beginPath(); c.arc(b.x, y, b.r, 0, 7); c.fill(); });
        // 竖向胶片，滚动展示前面 10 种风格
        const fx = 330, fw = 420, fh = 747, gap = 40, sx = fx + 40;
        const scroll = (u * 140) % ((fh + gap) * ctx.thumbs.length);
        c.fillStyle = "#0c0806"; c.fillRect(fx - 10, 0, fw + 100, H);
        for (let y = -40 + ((u * 140) % 60); y < H; y += 60) { c.fillStyle = "#e9dcc7"; rr(c, fx + 4, y, 22, 32, 6); c.fill(); rr(c, fx + fw + 64, y, 22, 32, 6); c.fill(); }
        const fade = pr(u, cCode - 0.4, 0.8);
        for (let i = -1; i < 4; i++) {
          const idx = ((Math.floor(scroll / (fh + gap)) + i) % ctx.thumbs.length + ctx.thumbs.length) % ctx.thumbs.length;
          const y = i * (fh + gap) - (scroll % (fh + gap)) + 100;
          c.globalAlpha = 1 - fade * 0.75; c.drawImage(ctx.thumbs[idx], sx, y, fw, fh); c.globalAlpha = 1;
          c.fillStyle = "rgba(255,200,130,0.12)"; c.fillRect(sx, y, fw, fh);
        }
        const kt = pr(u, cCode - 0.4, 0.8);
        if (kt > 0) {
          c.globalAlpha = kt * (1 - pr(u, cMe - 0.3, 0.4));
          text(c, "一段会动的代码", 540, 820, SERIF(104, 700), "#fff3e0", "center");
          text(c, `11 种风格 · ${ctx.totalFrames} 帧 · 0 个视频生成模型`, 540, 910, YH(38, 600), "#e8b77d", "center");
          c.globalAlpha = 1;
        }
        const km = pr(u, cMe - 0.3, 0.7, E.inOut);
        if (km > 0) {
          c.globalAlpha = km;
          c.fillStyle = "rgba(30,20,13,0.75)"; c.fillRect(0, 0, W, H);
          text(c, "麻酱 AI 实验室", 540, 1040, SERIF(84, 700), "#fff3e0", "center");
          text(c, "大白话讲 AI · 动手用 AI", 540, 1120, YH(40, 600), "#e8b77d", "center");
          c.globalAlpha = 1;
        }
      };
    return draw;
  },
});
