// 新场景模板：复制成 <项目>/scenes/<场景名>.js，把 "my_new_scene" 改成文件名。
// 规则（详见 SKILL.md「场景编写规范」）：
//   1. draw(c, u) 只能依赖 u（镜头内秒数）和 create 里算好的常量 —— 同一个 u 永远画出同一帧。
//      不要用 Math.random()、Date.now()、requestAnimationFrame、CSS 动画；要随机就用 rng(种子)。
//   2. 动作要对上口播：用 cue("口播里的词") 拿到这个词开始的秒数，再用 pr(u, 开始, 时长, 缓动) 做 0→1 进度。
//   3. 每帧先铺满背景；字幕区（竖屏 y≈1440–1560）和左下角头像区（y>1580）不要放关键信息。
//   4. 音效在 create 里用 sfx(秒, 类型, 音量) 登记：pop blip ding thud pow whoosh rise zap pluck click type page glitch error
MJ.scene("my_new_scene", {
  title: "场景标题",
  desc: "一句话说明画什么、适合讲什么知识点",
  dark: true,                 // 背景是否偏暗（决定顶部文字用白色还是黑色）
  music: "calm",              // 配乐音色预设，见 tools/audio.py 的 PRESET
  design: [1080, 1920],       // 场景按这个尺寸设计；成片尺寸不同时自动等比放入
  params: { cues: { cStart: "口播里的词" } },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, canvas, rr, text, HEAVY, YH, MONO } = MJ.lib;
    const { cue, sfx } = ctx;
    const CUES = ctx.params.cues;
    const cStart = cue(CUES.cStart);
    sfx(cStart, "pop", 0.6);
    const R = rng(1);                                   // 需要随机布局时用固定种子
    const dots = Array.from({ length: 40 }, () => ({ x: R() * W, y: R() * H }));
    const draw = (c, u) => {
      c.fillStyle = "#0b1020"; c.fillRect(0, 0, W, H);  // 每帧先铺满背景
      const k = pr(u, cStart, 0.6, E.back);             // 说到 cStart 那个词时开始，0.6 秒弹入
      c.globalAlpha = clamp(k);
      text(c, "标题", W / 2, 500, HEAVY(120 * mix(0.8, 1, k)), "#ffffff", "center");
      c.globalAlpha = 1;
      for (const d of dots) { c.fillStyle = "rgba(120,200,255,0.5)"; c.beginPath(); c.arc(d.x, d.y + Math.sin(u + d.x) * 10, 4, 0, 7); c.fill(); }
    };
    return draw;
  },
});
