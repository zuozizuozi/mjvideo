// 场景「8-bit 像素」—— 来自《一行代码，怎么变成一段视频？》STYLE 03（像素）
// 矢量图逐步像素化 + 扫描线逐格上色 + RGB 读数。适合讲像素、图像、数字化。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("pixel", {
  "title": "8-bit 像素",
  "desc": "矢量图逐步像素化 + 扫描线逐格上色 + RGB 读数。适合讲像素、图像、数字化。",
  "dark": true,
  "music": "pixel",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cPix": "像素",
      "cColor": "决定每个像素"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cPix = cue(CUES.cPix), cColor = cue(CUES.cColor);
      sfx(cPix, "blip", 0.7); sfx(cColor, "blip", 0.7);
      const art = canvas(720, 720), a = art.getContext("2d");
      { // 用矢量画一只“麻酱风”小猫头，后面再像素化
        a.fillStyle = "#29366f"; a.fillRect(0, 0, 720, 720);
        a.fillStyle = "#c98a4b"; a.beginPath(); a.moveTo(150, 300); a.lineTo(210, 90); a.lineTo(320, 230); a.fill();
        a.beginPath(); a.moveTo(570, 300); a.lineTo(510, 90); a.lineTo(400, 230); a.fill();
        a.fillStyle = "#f2b3a0"; a.beginPath(); a.moveTo(195, 260); a.lineTo(220, 150); a.lineTo(275, 230); a.fill(); a.beginPath(); a.moveTo(525, 260); a.lineTo(500, 150); a.lineTo(445, 230); a.fill();
        a.fillStyle = "#d4954f"; a.beginPath(); a.ellipse(360, 400, 250, 220, 0, 0, 7); a.fill();
        a.fillStyle = "#6b4a2b"; [[-90, 0.6], [0, 0.9], [90, 0.6]].forEach(([dx]) => { a.fillRect(345 + dx * 0.5, 190, 26, 90); });
        a.fillStyle = "#f6dfc6"; a.beginPath(); a.ellipse(360, 500, 140, 100, 0, 0, 7); a.fill();
        a.fillStyle = "#9be15d"; a.beginPath(); a.ellipse(275, 380, 46, 40, 0, 0, 7); a.fill(); a.beginPath(); a.ellipse(445, 380, 46, 40, 0, 0, 7); a.fill();
        a.fillStyle = "#1a1c2c"; a.fillRect(268, 352, 14, 56); a.fillRect(438, 352, 14, 56);
        a.fillStyle = "rgba(65,166,246,0.85)"; a.fillRect(205, 335, 145, 90); a.fillStyle = "#73eff7"; a.fillRect(215, 345, 40, 18);
        a.fillStyle = "#b13e53"; a.beginPath(); a.moveTo(340, 470); a.lineTo(380, 470); a.lineTo(360, 495); a.fill();
        a.fillStyle = "#3b5dc9"; a.fillRect(160, 600, 400, 40); a.fillStyle = "#73eff7"; a.beginPath(); a.arc(360, 650, 28, 0, 7); a.fill();
      }
      const small = canvas(720, 720), s = small.getContext("2d");
      const draw = (c, u) => {
        c.fillStyle = "#1a1c2c"; c.fillRect(0, 0, W, H);
        // 像素字标题（小画布放大，不做平滑）
        s.clearRect(0, 0, 720, 720); s.font = "bold 22px Consolas"; s.fillStyle = "#ffcd75"; s.textBaseline = "top"; s.fillText("PIXEL", 0, 0);
        c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, 80, 26, 90, 250, 480, 156);
        text(c, "x 2,073,600", 590, 360, MONO(44, 700), "#73eff7");
        text(c, "1080 × 1920 个像素", 590, 405, YH(30, 600), "#94b0c2");
        // 像素化程度：说到“像素”时从清晰变成方块
        const k = pr(u, cPix - 0.3, 1.6, E.inOut);
        const N = Math.round(mix(720, 18, k));
        s.imageSmoothingEnabled = true; s.clearRect(0, 0, 720, 720); s.drawImage(art, 0, 0, N, N);
        const X = 180, Y = 470, S = 720;
        c.imageSmoothingEnabled = false; c.drawImage(small, 0, 0, N, N, X, Y, S, S); c.imageSmoothingEnabled = true;
        // 网格线
        if (k > 0.85) {
          const cell = S / N; c.strokeStyle = `rgba(26,28,44,${0.6 * pr(u, cPix + 1.2, 0.4)})`; c.lineWidth = 2;
          for (let i = 0; i <= N; i++) { c.beginPath(); c.moveTo(X + i * cell, Y); c.lineTo(X + i * cell, Y + S); c.stroke(); c.beginPath(); c.moveTo(X, Y + i * cell); c.lineTo(X + S, Y + i * cell); c.stroke(); }
        }
        // 逐个像素上色（扫描线）
        const kc = pr(u, cColor - 0.2, 2.2, E.lin);
        if (kc > 0) {
          const cell = S / N, total = N * N, done = Math.floor(kc * total);
          c.fillStyle = "#1a1c2c";
          for (let i = done; i < total; i++) { const cx = i % N, cy = Math.floor(i / N); c.fillRect(X + cx * cell, Y + cy * cell, cell + 1, cell + 1); }
          if (done < total) { const cx = done % N, cy = Math.floor(done / N); c.strokeStyle = "#ffcd75"; c.lineWidth = 6; c.strokeRect(X + cx * cell, Y + cy * cell, cell, cell);
            const px = s.getImageData(cx, cy, 1, 1).data;
            rr(c, 240, 1235, 600, 88, 14); c.fillStyle = "#333c57"; c.fill();
            c.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`; c.fillRect(262, 1255, 48, 48);
            text(c, `RGB(${px[0]}, ${px[1]}, ${px[2]})`, 336, 1295, MONO(42, 700), "#f4f4f4"); }
        }
      };
      for (let i = 0; i < 10; i++) sfx(cColor + i * 0.22, "blip", 0.25);
    return draw;
  },
});
