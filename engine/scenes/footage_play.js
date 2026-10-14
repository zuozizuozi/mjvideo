// 场景「录屏片段」：放一段录屏（mjv footage 导入的视频），配版式、推拉、慢放、定格和标注。字幕和配音由引擎画（配音模式的底部字幕）。
// 时间：镜头内 u 秒 → 录屏 in + u×speed 秒（slow 段按 rate 走，freezeAt 之后定格）。录屏不够长时停在最后一帧。
// 标注坐标用录屏画面的 0–1 比例：[x, y, w, h]（左上角 0,0），和 mjv footage 拼图上的 10% 网格对应。
// at / freezeAt / slow.at 可以写秒数，也可以写解说词里的一个词（说到这个词时发生）。
MJ.scene("footage_play", {
  title: "录屏片段（版式 + 推拉 + 慢放 + 定格 + 标注）",
  desc: "放一段游戏 / 软件录屏：横屏录屏放进竖屏有 fit（居中 + 模糊背景）、fill（裁满屏，跟随焦点）、card（卡片）三种版式；可以缓慢推近某处、慢放、定格；可以叠框、圈、箭头、标签、聚光、放大镜标注，跟着解说词出现。适合试玩解说、产品演示、开发日志。",
  dark: true,
  music: "default",
  design: [1080, 1920],
  params: {
    video: "", in: 0, speed: 1,
    layout: "fit",                       // fit / fill / card
    focus: [0.5, 0.5],                   // fill 版式裁切时对准的点（录屏的 0–1 坐标）
    zoom: null,                          // { from: [倍数, fx, fy], to: [倍数, fx, fy] }：镜头内从 from 缓慢推到 to（倍数 1 = 不放大）
    slow: [],                            // [{ at, dur, rate }]：从 at 开始的 dur 秒按 rate 倍速（0.3 = 慢放）
    freezeAt: null,                      // 定格：从这一刻起停在当前帧（会闪一下并轻推）
    title: null,                         // { text, sub }：画面上方的大标题（fit / card 版式）
    badge: "",                           // 录屏角上的小标签，例如"实机录屏"
    annotations: [],                     // [{ at, dur, type: box|circle|arrow|label|spot|magnify, rect: [x,y,w,h], text, from: [x,y] }]
  },
  create(ctx) {
    const TH = MJ.theme;
    const { W, H, clamp, mix, E, pr, rr, text, SONG, SONGH, YH, canvas, bgVibe } = MJ.lib;
    const { cue, sfx } = ctx, P = ctx.params, DUR = ctx.shot.dur;
    const at = (v) => (v == null ? null : typeof v === "number" ? v : cue(v));
    const speed = P.speed || 1, slow = (P.slow || []).map((s) => ({ a: at(s.at), d: s.dur || 1, r: s.rate ?? 0.35 }));
    const freeze = at(P.freezeAt);
    const srcAt = (u) => {                                  // 镜头时间 → 录屏时间
      const uu = Math.max(0, freeze != null ? Math.min(u, freeze) : u);
      let t = P.in + uu * speed;
      for (const s of slow) t += (s.r - speed) * clamp(uu - s.a, 0, s.d);
      return t;
    };
    const vid = ctx.useVideo(P.video, srcAt);
    if (freeze != null) sfx(freeze, "stamp", 0.5);
    const ann = (P.annotations || []).map((a) => ({ ...a, t0: at(a.at) ?? 0, d: a.dur ?? 2.2 }));
    ann.forEach((a) => sfx(a.t0, a.type === "magnify" ? "pop" : "blip", 0.35));
    const small = canvas(54, 96), sx = small.getContext("2d");          // 模糊背景：先画成很小的图再放大
    const T = (k) => E.inOut(clamp(k));

    return (c, u) => {
      const vw = vid.videoWidth || 1920, vh = vid.videoHeight || 1080;
      // 版式：视频在画面上的矩形
      let R;
      if (P.layout === "fill") { const s = Math.max(W / vw, H / vh), w = vw * s, h = vh * s;        // 铺满，裁掉的部分由 focus 决定
        R = { x: clamp(W / 2 - w * P.focus[0], W - w, 0), y: clamp(H / 2 - h * P.focus[1], H - h, 0), w, h }; }
      else if (P.layout === "card") { const m = 70, w = W - m * 2, h = w * vh / vw; R = { x: m, y: (H - h) / 2 - 40, w, h }; }
      else { const w = W, h = W * vh / vw; R = { x: 0, y: Math.max(360, (H - h) / 2 - 60), w, h }; if (vh > vw) { const s = Math.min(W / vw, H / vh); R = { x: (W - vw * s) / 2, y: (H - vh * s) / 2, w: vw * s, h: vh * s }; } }
      // 背景
      if (P.layout === "fit") { sx.drawImage(vid, 0, 0, 54, 96); c.save(); c.imageSmoothingQuality = "high"; c.filter = "blur(18px) brightness(0.45)"; c.drawImage(small, -40, -40, W + 80, H + 80); c.restore(); }
      else if (P.layout === "card") bgVibe(c, u);
      else { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); }
      // 推拉：围绕焦点放大（录屏坐标 → 屏幕坐标）
      const zk = T(u / Math.max(0.5, DUR));
      const z = P.zoom ? { s: mix(P.zoom.from[0], P.zoom.to[0], zk), fx: mix(P.zoom.from[1], P.zoom.to[1], zk), fy: mix(P.zoom.from[2], P.zoom.to[2], zk) } : { s: 1, fx: 0.5, fy: 0.5 };
      const fz = freeze != null ? pr(u, freeze, 0.6, E.out) : 0, S = z.s * (1 + 0.05 * fz);
      const px = R.x + R.w * z.fx, py = R.y + R.h * z.fy;
      const toS = (nx, ny) => [px + (R.x + R.w * nx - px) * S, py + (R.y + R.h * ny - py) * S];
      c.save();
      if (P.layout === "card") { c.shadowColor = "rgba(0,0,0,0.45)"; c.shadowBlur = 40; c.shadowOffsetY = 18; rr(c, R.x, R.y, R.w, R.h, 22); c.fillStyle = "#000"; c.fill(); c.shadowColor = "transparent"; }
      rr(c, R.x, R.y, R.w, R.h, P.layout === "card" ? 22 : 0); c.clip();
      c.translate(px, py); c.scale(S, S); c.translate(-px, -py);
      c.drawImage(vid, R.x, R.y, R.w, R.h);
      c.restore();
      if (fz > 0 && fz < 1) { c.save(); c.globalAlpha = 0.5 * (1 - fz); c.fillStyle = "#fff"; c.fillRect(R.x, R.y, R.w, R.h); c.restore(); }
      // 标注
      for (const a of ann) {
        const k = pr(u, a.t0, 0.35, E.back), out = 1 - pr(u, a.t0 + a.d - 0.3, 0.3);
        const al = clamp(Math.min(pr(u, a.t0, 0.25), out)); if (al <= 0.01) continue;
        const [x0, y0] = toS(a.rect ? a.rect[0] : 0.5, a.rect ? a.rect[1] : 0.5), [x1, y1] = toS(a.rect ? a.rect[0] + a.rect[2] : 0.5, a.rect ? a.rect[1] + a.rect[3] : 0.5);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, col = a.color || TH.accent;
        c.save(); c.globalAlpha = al; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 6; c.lineCap = "round"; c.lineJoin = "round"; c.shadowColor = "rgba(0,0,0,0.55)"; c.shadowBlur = 10;
        if (a.type === "spot") { c.shadowColor = "transparent"; c.fillStyle = "rgba(0,0,0,0.6)"; c.beginPath(); c.rect(0, 0, W, H); c.ellipse(cx, cy, (x1 - x0) / 2 * mix(1.6, 1, k) + 10, (y1 - y0) / 2 * mix(1.6, 1, k) + 10, 0, 0, 7, true); c.fill("evenodd"); }
        else if (a.type === "circle") { const s2 = mix(1.4, 1, k); c.beginPath(); c.ellipse(cx, cy, (x1 - x0) / 2 * s2 + 12, (y1 - y0) / 2 * s2 + 12, -0.08, 0, Math.PI * 2 * clamp(k * 1.2)); c.stroke(); }
        else if (a.type === "arrow") { const [fx, fy] = a.from ? toS(a.from[0], a.from[1]) : [cx + 220, cy - 260], ex = mix(fx, cx, k), ey = mix(fy, cy, k), ang = Math.atan2(cy - fy, cx - fx);
          c.beginPath(); c.moveTo(fx, fy); c.lineTo(ex, ey); c.stroke(); c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - Math.cos(ang - 0.5) * 34, ey - Math.sin(ang - 0.5) * 34); c.lineTo(ex - Math.cos(ang + 0.5) * 34, ey - Math.sin(ang + 0.5) * 34); c.closePath(); c.fill(); }
        else if (a.type === "magnify") {             // 放大镜：把 rect 区域放大 2.2 倍显示在旁边
          const m = 2.2, bw = (x1 - x0) * m, bh = (y1 - y0) * m, bx = clamp(cx - bw / 2, 30, W - bw - 30), by = y0 > H * 0.5 ? clamp(y0 - bh - 40, 40, H) : Math.min(H - bh - 40, y1 + 40);
          c.beginPath(); c.moveTo(cx, cy); c.lineTo(bx + bw / 2, by + bh / 2); c.globalAlpha = al * 0.6; c.lineWidth = 3; c.stroke(); c.globalAlpha = al;
          c.save(); rr(c, bx, by, bw, bh * k, 16); c.clip(); c.drawImage(vid, (a.rect[0]) * vw, a.rect[1] * vh, a.rect[2] * vw, a.rect[3] * vh, bx, by, bw, bh); c.restore();
          rr(c, bx, by, bw, bh * k, 16); c.stroke(); rr(c, x0, y0, x1 - x0, y1 - y0, 8); c.lineWidth = 4; c.stroke(); }
        else if (a.type !== "label") { const g2 = mix(18, 0, k); rr(c, x0 - g2, y0 - g2, x1 - x0 + g2 * 2, y1 - y0 + g2 * 2, 10); c.stroke(); }
        if (a.text) {                                    // 标签：贴在框的上方（放不下就放下方）
          c.shadowColor = "transparent"; c.font = YH(40); const tw = c.measureText(a.text).width + 36, th = 62;
          let lx = clamp(cx - tw / 2, 24, W - tw - 24), ly = y0 - th - 18; if (a.type === "label") ly = cy - th / 2; if (ly < 24) ly = y1 + 18;
          rr(c, lx, ly + (1 - k) * 12, tw, th, 12); c.fillStyle = col; c.fill();
          text(c, a.text, lx + tw / 2, ly + 44 + (1 - k) * 12, YH(40), TH.mode === "light" ? "#fff" : "#111", "center");
        }
        c.restore();
      }
      // 上方大标题（fit / card）
      if (P.title && P.layout !== "fill") {
        const k = pr(u, 0.1, 0.6, E.out), ty = Math.max(150, R.y - 150);
        c.save(); c.globalAlpha = k; c.textAlign = "center";
        text(c, P.title.text, W / 2, ty + (1 - k) * 16, SONGH(84), TH.text, "center");
        if (P.title.sub) text(c, P.title.sub, W / 2, ty + 70, SONG(40), TH.muted, "center");
        c.restore();
      }
      if (P.badge) { const k = pr(u, 0.2, 0.4); c.save(); c.globalAlpha = k * 0.9; c.font = YH(28); const bw2 = c.measureText(P.badge).width + 28; rr(c, R.x + 20, R.y + 20, bw2, 46, 23); c.fillStyle = "rgba(0,0,0,0.55)"; c.fill(); text(c, P.badge, R.x + 20 + bw2 / 2, R.y + 53, YH(28), "#fff", "center"); c.restore(); }
    };
  },
});
