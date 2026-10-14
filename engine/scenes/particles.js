// 场景「粒子聚字」—— 来自《一行代码，怎么变成一段视频？》STYLE 08（粒子）
// 1500 个粒子游走后聚成文字 + 标记单个粒子的目标。适合讲涌现、群体规则、数据点。
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("particles", {
  "title": "粒子聚字",
  "desc": "1500 个粒子游走后聚成文字 + 标记单个粒子的目标。适合讲涌现、群体规则、数据点。",
  "dark": true,
  "music": "particles",
  "design": [
    1080,
    1920
  ],
  "params": {
    "cues": {
      "cRule": "一条简单的规则",
      "cForm": "聚成字"
    }
  },
  create(ctx) {
    const { W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;
    const CUES = ctx.params.cues;
      const cRule = cue(CUES.cRule), cForm = cue(CUES.cForm);
      sfx(cForm - 0.2, "rise", 0.8);
      const N = 1500, R = rng(808);
      const tc = canvas(1080, 700), tx = tc.getContext("2d");
      tx.font = HEAVY(380); tx.fillStyle = "#fff"; tx.textAlign = "center"; tx.textBaseline = "middle";
      let targets = null;
      function ensureTargets() {
        if (targets) return; tx.clearRect(0, 0, 1080, 700); tx.fillText("代码", 540, 360);
        const d = tx.getImageData(0, 0, 1080, 700).data, pts = [];
        for (let y = 0; y < 700; y += 7) for (let x = 0; x < 1080; x += 7) if (d[(y * 1080 + x) * 4 + 3] > 128) pts.push([x, y + 460]);
        targets = Array.from({ length: N }, (_, i) => pts[Math.floor(R() * pts.length)]);
      }
      const ps = Array.from({ length: N }, () => ({ x: R() * W, y: 200 + R() * 1300, a: R() * 6.28, s: 0.6 + R() * 1.4, h: R() }));
      const draw = (c, u) => {
        ensureTargets();
        c.fillStyle = "#04040a"; c.fillRect(0, 0, W, H);
        const k = pr(u, cForm - 0.6, 1.6, E.inOut);
        c.globalCompositeOperation = "lighter";
        for (let i = 0; i < N; i++) {
          const p = ps[i], tt = u + 3;
          const wx = p.x + Math.sin(tt * 0.7 * p.s + p.a) * 140 + Math.cos(tt * 0.31 + p.a * 2) * 90;
          const wy = p.y + Math.cos(tt * 0.6 * p.s + p.a) * 140 + Math.sin(tt * 0.27 + p.a) * 80;
          const [gx, gy] = targets[i]; const kk = clamp(k * 1.25 - p.h * 0.25);
          const x = mix(wx, gx, E.inOut(kk)), y = mix(wy, gy, E.inOut(kk));
          const hue = 170 + (x / W) * 140;
          c.fillStyle = `hsla(${hue},100%,${60 + 10 * kk}%,${0.8 + 0.15 * kk})`;
          c.beginPath(); c.arc(x, y, 4.2 - kk * 0.4, 0, 7); c.fill();
        }
        c.globalCompositeOperation = "source-over";
        // 规则说明 + 一个被标记的粒子
        const kr = pr(u, cRule - 0.2, 0.5);
        if (kr > 0) {
          c.globalAlpha = kr * (1 - pr(u, cForm + 0.8, 0.5));
          rr(c, 140, 1270, 800, 110, 24); c.fillStyle = "rgba(255,255,255,0.08)"; c.fill(); c.strokeStyle = "rgba(120,255,240,0.5)"; c.lineWidth = 2; c.stroke();
          text(c, "规则：每一帧，朝目标挪近一点", 540, 1342, YH(44, 700), "#bffcf6", "center");
          const p = ps[7], [gx, gy] = targets[7];
          const x = mix(p.x + Math.sin((u + 3) * 0.7 * p.s + p.a) * 140, gx, E.inOut(clamp(k))), y = mix(p.y + Math.cos((u + 3) * 0.6 * p.s + p.a) * 140, gy, E.inOut(clamp(k)));
          c.strokeStyle = "#ffffff"; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 22, 0, 7); c.stroke();
          c.setLineDash([8, 8]); c.beginPath(); c.moveTo(x, y); c.lineTo(gx, gy); c.stroke(); c.setLineDash([]);
          c.globalAlpha = 1;
        }
        text(c, `${N} 个点`, 540, 330, MONO(56, 700), "rgba(190,255,250,0.85)", "center");
      };
    return draw;
  },
});
