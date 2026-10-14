// 场景「图片展示」：一张图片（project.json 的 images 里登记）+ 出场方式 + 缓慢推拉摇移 + 可选调色和边框 + 字幕。
// 出场 reveal：fade 淡入 / wipe 从左擦出 / circle 圆形展开 / particles 图片的像素点从四周飞来聚成图 / blur 从模糊到清晰
// 退场 exit（可选，在 exitAt 秒或第几句字幕时）：none / shatter 碎成粒子散开 / fade
// 调色 tint：none / duotone（主题的文字色 + 强调色双色调）/ mono（灰度）/ warm / cold
// 版式 layout：full 铺满 / card 卡片（带阴影和边距）/ left / right（图片占一半，另一半留给字幕或标注）
MJ.scene("image_reveal", {
  title: "图片展示（出场 + 推拉 + 调色）",
  desc: "把一张图片（AI 生图、截图、照片）做成动态镜头：多种出场方式、缓慢推拉摇移、双色调 / 灰度调色、卡片或半屏版式、可碎成粒子退场。适合书封、产品、人物、历史照片、截图证据等任何需要真实图片的镜头。横屏，颜色跟随主题。",
  dark: true,
  music: "ambient_piano",
  design: [1920, 1080],
  params: {
    image: "",                 // project.json images 里的名字
    layout: "card",            // full / card / left / right
    fit: "cover",
    reveal: "fade", revealAt: 0, revealDur: 1.2,     // revealAt：第几句字幕出现时开始（数字 = 句序号；写 "0.5s" = 秒）
    exit: "none", exitAt: null,
    move: { from: [1.08, 0, 0], to: [1.0, 0, 0] },   // [缩放, x 偏移, y 偏移]，整个镜头时间内缓慢变化
    tint: "none", tintAmount: 1,
    label: "",                 // 图片角落的小标注，例如"示意：AI 生成"
    captionY: 960, captionX: null, captionAlign: "center",
  },
  create(ctx) {
    const TH = MJ.theme;
    const { W, H, clamp, mix, E, pr, rng, rr, text, SONG, captions, bgVibe, image, drawImageFit, imagePoints, canvas, mixRGB } = MJ.lib;
    const { sfx } = ctx, P = ctx.params, L = ctx.lines, DUR = ctx.shot.dur;
    const at = (v, def) => (v == null ? def : typeof v === "string" && v.endsWith("s") ? parseFloat(v) : L[v] ? L[v].t0 : def);
    const tIn = at(P.revealAt, 0), tOut = P.exit !== "none" ? at(P.exitAt, DUR - 1.2) : 1e9;
    sfx(tIn, P.reveal === "particles" ? "shimmer" : "swell", 0.45);
    if (P.exit === "shatter") sfx(tOut, "shimmer", 0.5);
    // 版式框
    const box = { full: [0, 0, W, H], card: [260, 90, W - 520, 720], left: [80, 120, 880, 760], right: [W - 960, 120, 880, 760] }[P.layout] || [0, 0, W, H];
    let img = null, tinted = null, pts = null;
    const prep = () => {                       // 图片在 create 时可能还没加载完，第一次绘制时再处理
      img = image(P.image);
      const [bx, by, bw, bh] = box;
      tinted = canvas(W, H); const x = tinted.getContext("2d");
      x.save(); rr(x, bx, by, bw, bh, P.layout === "full" ? 0 : 18); x.clip(); drawImageFit(x, img, bx, by, bw, bh, P.fit); x.restore();
      if (P.tint !== "none") {               // 逐像素调色
        const d = x.getImageData(0, 0, W, H), a = d.data, k = P.tintAmount;
        const dark = TH.rgb.text, light = TH.mode === "light" ? TH.rgb.panel : TH.rgb.accent;
        for (let i = 0; i < a.length; i += 4) {
          if (!a[i + 3]) continue;
          const l = (0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]) / 255;
          let t;
          if (P.tint === "duotone") t = TH.mode === "light" ? mixRGB(dark, light, l) : mixRGB(TH.rgb.panel, TH.rgb.accent, l);
          else if (P.tint === "mono") t = [l * 255, l * 255, l * 255];
          else if (P.tint === "warm") t = [a[i] * 1.08 + 12, a[i + 1] * 0.98, a[i + 2] * 0.82];
          else t = [a[i] * 0.85, a[i + 1] * 0.98, a[i + 2] * 1.1 + 12];
          for (let j = 0; j < 3; j++) a[i + j] = Math.min(255, a[i + j] * (1 - k) + t[j] * k);
        }
        x.putImageData(d, 0, 0);
      }
      if (P.reveal === "particles" || P.exit === "shatter") {
        const R = rng(7); pts = [];
        const d = x.getImageData(0, 0, W, H).data, step = 7;
        for (let yy = box[1]; yy < box[1] + box[3]; yy += step) for (let xx = box[0]; xx < box[0] + box[2]; xx += step) {
          const i = ((yy | 0) * W + (xx | 0)) * 4; if (d[i + 3] < 40) continue;
          const ang = R() * 6.28, rad = 600 + R() * 700;
          pts.push({ x: xx, y: yy, c: `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`, sx: W / 2 + Math.cos(ang) * rad, sy: H / 2 + Math.sin(ang) * rad * 0.7, dl: R() * 0.5, vx: (R() - 0.5) * 900, vy: (R() - 0.7) * 700 });
        }
      }
    };
    return (c, u) => {
      if (!img) prep();
      bgVibe(c, u);
      const [bx, by, bw, bh] = box;
      const mv = E.inOut(clamp(u / Math.max(1, DUR)));
      const s = mix(P.move.from[0], P.move.to[0], mv), ox = mix(P.move.from[1], P.move.to[1], mv), oy = mix(P.move.from[2], P.move.to[2], mv);
      const k = pr(u, tIn, P.revealDur, E.inOut), out = P.exit === "none" ? 0 : pr(u, tOut, 1.0, E.inOut);
      const showImg = P.reveal === "particles" ? pr(u, tIn + P.revealDur * 0.75, 0.5) : k;
      // 卡片阴影
      if (P.layout !== "full" && k > 0) { c.save(); c.globalAlpha = k * (1 - out) * (TH.mode === "light" ? 0.25 : 0.6); c.fillStyle = TH.mode === "light" ? "#000" : TH.panelSolid; c.filter = "blur(24px)"; c.fillRect(bx + 10, by + 24, bw, bh); c.restore(); }
      // 图片本体（带推拉）
      const alpha = showImg * (P.exit === "shatter" ? (out > 0 ? 0 : 1) : 1 - out);
      if (alpha > 0) {
        c.save(); c.globalAlpha = alpha;
        c.translate(W / 2 + ox, H / 2 + oy); c.scale(s, s); c.translate(-W / 2, -H / 2);
        if (P.reveal === "wipe") { c.beginPath(); c.rect(bx, by, bw * k, bh); c.clip(); }
        if (P.reveal === "circle") { c.beginPath(); c.arc(bx + bw / 2, by + bh / 2, Math.hypot(bw, bh) / 2 * k, 0, 7); c.clip(); }
        if (P.reveal === "blur" && k < 1) c.filter = `blur(${(1 - k) * 24}px)`;
        c.drawImage(tinted, 0, 0);
        c.restore();
      }
      // 粒子出场 / 碎裂退场
      if (pts && ((P.reveal === "particles" && u >= tIn && showImg < 1) || (P.exit === "shatter" && out > 0 && out < 1))) {
        c.save();
        for (const p of pts) {
          let x, y, a;
          if (out > 0) { const t = clamp(out * 1.3 - p.dl * 0.3); x = p.x + p.vx * t; y = p.y + p.vy * t + 300 * t * t; a = 1 - t; }
          else { const t = E.inOut(clamp((u - tIn - p.dl * 0.6) / (P.revealDur * 0.8))); x = mix(p.sx, p.x, t); y = mix(p.sy, p.y, t); a = clamp((u - tIn) * 3) * (1 - showImg); }
          if (a <= 0) continue;
          c.globalAlpha = a; c.fillStyle = p.c; c.fillRect(x - 3, y - 3, 6, 6);
        }
        c.restore();
      }
      if (P.label && k > 0) { c.save(); c.globalAlpha = k * (1 - out) * 0.7; text(c, P.label, bx + bw - 16, by + bh - 18, SONG(22), TH.layout === "full" ? TH.text : (TH.mode === "light" ? TH.text : TH.highlight), "right"); c.restore(); }
      captions(c, L, u, { y: P.captionY, x: P.captionX ?? undefined, align: P.captionAlign, size: 50 });
    };
  },
});
