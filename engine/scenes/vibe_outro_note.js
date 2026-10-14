// 场景「片尾小字 + 账号名」：黑底中央一个呼吸的小光点，上方一行小字（彩蛋），再淡入账号名。
// 第 0 句：小字；第 1 句：账号名（金色大字）。两句都留到片尾，最后跟随全片淡出。
MJ.scene("vibe_outro_note", {
  title: "片尾彩蛋 + 账号名",
  desc: "黑底呼吸光点 + 一行彩蛋小字 + 金色账号名。适合任何 Vibe 风格视频的结尾。横屏无口播。",
  dark: true,
  allowDark: true,
  music: "ambient_outro",
  design: [1920, 1080],
  params: {},
  create(ctx) {
    const TH = MJ.theme;                                 // 颜色、字体、叠加方式都从主题取（见 engine/lib.js 的 THEME_DEFAULT）
    const { W, H, E, pr, captions, bgVibe, glowDot, dot, GOLD } = MJ.lib;
    const { sfx } = ctx, L = ctx.lines;
    const sp = glowDot(GOLD, 40);
    const R = MJ.lib.rng(3), sparks = Array.from({ length: 90 }, () => ({ x: (R() - 0.5) * 420, v: 0.15 + R() * 0.25, p: R() }));
    if (L[1]) sfx(L[1].t0, "chime", 0.4);
    return (c, u) => {
      bgVibe(c, u, { dust: 140 });
      const a = pr(u, 0, 1.2);
      // 光点缓慢上下浮动，周围有细小火星往上飘（避免片尾画面静止）
      const y0 = 700 + Math.sin(u * 0.9) * 24;
      c.save(); c.globalCompositeOperation = TH.blend; c.globalAlpha = a * (0.6 + 0.4 * Math.sin(u * 1.6)); dot(c, sp, W / 2, y0, 1.1 + 0.15 * Math.sin(u * 1.3));
      for (const s of sparks) {
        const k = ((u * s.v + s.p) % 1);
        c.globalAlpha = a * Math.sin(k * Math.PI) * 0.8; c.fillStyle = TH.accent;
        c.fillRect(W / 2 + s.x + Math.sin(u * 2 + s.p * 9) * 14, y0 + 60 - k * 320, 3, 3);
      }
      c.restore();
      captions(c, L, u, { mode: "stack", lh: 110, y: L.length > 1 ? 470 : 540, dim: 0.75,
        per: { 0: { size: 36, color: `rgba(${TH.rgb.text},0.8)`, glow: 0 }, 1: { size: 64, font: MJ.lib.SONGH, color: TH.accent, glow: 26 } } });
    };
  },
});
