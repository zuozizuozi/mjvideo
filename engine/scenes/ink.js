// 场景「水墨分层」—— 来自《一行代码，怎么变成一段视频？》STYLE 07（水墨 · 分层）
// 宣纸 + 三层远中近山视差 + 雾 + 小舟 + 竖排楷书 + 印章。适合讲层次、纵深、东方文化。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("ink", {
  "title": "水墨分层",
  "desc": "宣纸 + 三层远中近山视差 + 雾 + 小舟 + 竖排楷书 + 印章。适合讲层次、纵深、东方文化。",
  "dark": false,
  "music": "ink",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cFar": "远山",
      "cMid": "中景",
      "cNear": "近景",
      "cDepth": "纵深"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cFar = cue(CUES.cFar), cMid = cue(CUES.cMid), cNear = cue(CUES.cNear), cDepth = cue(CUES.cDepth);
      [cFar, cMid, cNear].forEach((t0) => sfx(t0, "pluck", 0.5));
      const paperC = canvas(W, H), pc = paperC.getContext("2d"); {
        pc.fillStyle = "#efe7d6"; pc.fillRect(0, 0, W, H); const R = rng(7); const img = pc.getImageData(0, 0, W, H);
        for (let i = 0; i < img.data.length; i += 4) { const n = (R() - 0.5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
        pc.putImageData(img, 0, 0);
      }
      function ridge(seed, base, amp, len = 2400) { const R = rng(seed); const pts = []; let y = base; for (let x = 0; x <= len; x += 30) { y += (R() - 0.5) * amp; y = mix(y, base, 0.08); pts.push([x, y]); } return pts; }
      const layers = [
        { pts: ridge(3, 760, 70), speed: 6, col: [70, 80, 90], a: 0.32, label: "远山", lx: 860, ly: 700, cu: cFar },
        { pts: ridge(9, 980, 90), speed: 20, col: [40, 45, 55], a: 0.55, label: "中景", lx: 120, ly: 930, cu: cMid },
        { pts: ridge(21, 1200, 110), speed: 55, col: [15, 18, 22], a: 0.88, label: "近景", lx: 860, ly: 1150, cu: cNear },
      ];
      const draw = (c, u) => {
        c.drawImage(paperC, 0, 0);
        c.fillStyle = "rgba(196,48,43,0.85)"; c.beginPath(); c.arc(820, 420, 70, 0, 7); c.fill();
        layers.forEach((L, i) => {
          const ox = -((u + 4) * L.speed) % 1200;
          const grd = c.createLinearGradient(0, L.pts[0][1] - 150, 0, L.pts[0][1] + 420);
          grd.addColorStop(0, `rgba(${L.col},${L.a})`); grd.addColorStop(1, `rgba(${L.col},0)`);
          c.fillStyle = grd; c.beginPath(); c.moveTo(ox, H);
          L.pts.forEach(([x, y]) => c.lineTo(ox + x, y)); c.lineTo(ox + 2400, H); c.fill();
          c.strokeStyle = `rgba(${L.col},${Math.min(1, L.a + 0.15)})`; c.lineWidth = 2 + i * 1.5; c.beginPath(); L.pts.forEach(([x, y], j) => (j ? c.lineTo(ox + x, y) : c.moveTo(ox + x, y))); c.stroke();
          const mist = c.createLinearGradient(0, L.pts[0][1] + 60, 0, L.pts[0][1] + 260); mist.addColorStop(0, "rgba(239,231,214,0)"); mist.addColorStop(1, "rgba(239,231,214,0.9)");
          c.fillStyle = mist; c.fillRect(0, L.pts[0][1] + 60, W, 200);
          const k = pr(u, L.cu - 0.15, 0.5);
          if (k > 0) { c.globalAlpha = k; c.font = KAI(64); c.fillStyle = "#1a1a1a"; c.textAlign = "center";
            [...L.label].forEach((ch, j) => c.fillText(ch, L.lx, L.ly + j * 72));
            text(c, `×${(L.speed / 6).toFixed(0)}`, L.lx, L.ly + 170, MONO(30, 600), "#c4302b", "center"); c.globalAlpha = 1; }
        });
        // 小舟
        const bx = 200 + ((u * 30) % 900), by = 1320;
        c.strokeStyle = "#1a1a1a"; c.lineWidth = 5; c.beginPath(); c.moveTo(bx - 60, by); c.quadraticCurveTo(bx, by + 26, bx + 60, by); c.stroke();
        c.beginPath(); c.moveTo(bx + 10, by); c.lineTo(bx + 10, by - 50); c.stroke();
        c.strokeStyle = "rgba(26,26,26,0.25)"; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 120, by + 20); c.lineTo(bx + 120, by + 20); c.stroke();
        // 竖排标题 + 印章
        c.font = `bold ${KAI(110)}`; c.fillStyle = "#1a1a1a"; c.textAlign = "center"; ["纵", "深"].forEach((ch, j) => c.fillText(ch, 150, 330 + j * 120));
        const ks = pr(u, cDepth - 0.1, 0.35, E.back);
        if (ks > 0) { c.save(); c.translate(150, 600); c.rotate(-0.06); c.scale(mix(1.6, 1, ks), mix(1.6, 1, ks)); c.globalAlpha = clamp(ks);
          c.fillStyle = "#c4302b"; c.fillRect(-55, -55, 110, 110); c.font = `bold ${KAI(44)}`; c.fillStyle = "#efe7d6"; c.fillText("麻", -2, -6); c.fillText("酱", -2, 42); c.restore(); }
      };
      sfx(cDepth, "thud", 0.6);
    return draw;
  },
});
