// MJ 引擎公共库：场景注册表 + 绘图/缓动/随机数工具。
// 场景文件里通过 `const { ... } = MJ.lib;` 取用。所有函数都是确定性的（同样的输入永远得到同样的画面）。
(() => {
const MJ = (window.MJ = window.MJ || {});
MJ.registry = MJ.registry || {};

// 注册场景：MJ.scene(name, { title, desc, dark, music, design, params, create(ctx) => draw(c, u) })
MJ.scene = (name, def) => { MJ.registry[name] = { name, ...def }; };

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, k) => a + (b - a) * k;
const E = {
  lin: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  elastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
const pr = (u, u0, d, e = E.out) => e(clamp((u - u0) / d));          // 从 u0 开始、持续 d 秒的 0→1 进度
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w || MJ.lib.W; c.height = h || MJ.lib.H; return c; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function text(c, s, x, y, font, color, align = "left", base = "alphabetic") { c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function typed(s, u, u0, cps = 14) { return s.slice(0, Math.max(0, Math.floor((u - u0) * cps))); }
const HEAVY = (n) => `${n}px Heavy, "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
const YH = (n, w = 700) => `${w} ${n}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
const MONO = (n, w = 600) => `${w} ${n}px Consolas, Menlo, "DejaVu Sans Mono", "Microsoft YaHei", monospace`;
const KAI = (n) => `${n}px Kai, KaiTi, serif`;
const SERIF = (n, w = 700) => `${w} ${n}px Georgia, SimSun, serif`;
// ---------- 主题 ----------
// 场景里的颜色、字体、背景都从主题取，不要写死。主题来自 project.json 的 "theme"（风格包 styles/<名>/style.json 会在新建项目时写进去）。
// 没写的字段用下面的默认值（= EP09 的"暗金星尘"）。mode 为 light 时发光叠加改成普通叠加（浅底上 lighter 会看不见）。
const THEME_DEFAULT = {
  name: "dark-gold", mode: "dark",
  bg: { center: "#12172c", edge: "#04050c" }, texture: "none", dust: { color: "#e6d3a3", count: 90 },
  text: "#f2efe6", dim: "#d8d2c2", muted: "#bdb5a0", accent: "#f3c46b", cold: "#8fc4ff", highlight: "#fff1cc", warn: "#ff786e",
  glow: "#ffbe5a", shine: "#ffffff", halo: "#fff0d2", coldDot: "#78b4ff", coldLine: "#96aadc", bar: "#a0aac8",
  panel: "#060812", card: "#14182c", panelSolid: "#0b0f20", terrainLow: "#3c2e1e", terrainHigh: "#0a1028",
  fonts: { title: "SongH, SongB, SimSun, serif", body: "SongB, SimSun, serif", mono: "Consolas, Menlo, \"DejaVu Sans Mono\", monospace" },
};
const hexRGB = (h) => { const m = String(h).replace("#", ""); const x = m.length === 3 ? m.split("").map((c) => c + c).join("") : m; return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const THEME = (() => {
  const P = (window.PROJECT && window.PROJECT.theme) || {};
  const t = { ...THEME_DEFAULT, ...P, bg: { ...THEME_DEFAULT.bg, ...(P.bg || {}) }, dust: { ...THEME_DEFAULT.dust, ...(P.dust || {}) }, fonts: { ...THEME_DEFAULT.fonts, ...(P.fonts || {}) } };
  const rgbKeys = ["text", "dim", "muted", "accent", "cold", "highlight", "warn", "glow", "shine", "halo", "coldDot", "coldLine", "bar", "panel", "card", "terrainLow", "terrainHigh"];
  t.rgb = Object.fromEntries(rgbKeys.map((k) => [k, hexRGB(t[k])]));                 // 数组形式，给 mixRGB / glowDot 用
  t.a = Object.fromEntries(rgbKeys.map((k) => [k, (al) => `rgba(${t.rgb[k].join(",")},${al})`]));   // t.a.accent(0.5) → "rgba(…,0.5)"
  t.blend = t.mode === "light" ? "source-over" : "lighter";                          // 发光叠加方式
  return t;
})();
MJ.theme = THEME;
// 字体：title 标题字、body 正文 / 字幕（默认是思源宋体 SongH / SongB，项目 fonts 里登记）
// fonts.bodyWeight / titleWeight：无衬线字体要加粗时写 "700"（思源宋体本身就是粗体，不用写）
const SONG = (n) => (THEME.fonts.bodyWeight ? THEME.fonts.bodyWeight + " " : "") + `${n}px ${THEME.fonts.body}`;
const SONGH = (n) => (THEME.fonts.titleWeight ? THEME.fonts.titleWeight + " " : "") + `${n}px ${THEME.fonts.title}`;

// ---------- 无口播字幕（场景自己画） ----------
// line 来自 ctx.lines[i]：{ text: 带 **高亮** 标记的原文, plain, t0, t1 }（镜头内秒数）
const parseMarks = (raw) => raw.split("**").map((s, i) => ({ s, hi: i % 2 === 1 })).filter((x) => x.s);
// 这句在 u 时刻的透明度和入场进度。stay：不淡出（留到镜头结束）；dim：下一句出现后降到的透明度（配合 until）
function lineAlpha(line, u, o = {}) {
  if (!line) return { a: 0, k: 0 };
  const fi = o.fadeIn ?? 0.55, fo = o.fadeOut ?? 0.45;
  const k = pr(u, line.t0, fi, E.out);
  let out = o.stay ? 1 : 1 - pr(u, line.t1 - fo, fo, E.inOut);
  if (o.until != null) out = Math.min(out, mix(1, o.dim ?? 0, pr(u, o.until, 0.5, E.inOut)));
  return { a: clamp(k * out), k };
}
function glowText(c, s, x, y, font, color, blur = 0, glowColor = color) {
  c.font = font; c.fillStyle = color; blur *= THEME.glowScale ?? 1;          // 主题的 glowScale：浅色风格调小，霓虹调大
  if (blur > 0) { c.save(); c.shadowColor = glowColor; c.shadowBlur = blur; c.fillText(s, x, y); c.restore(); }
  c.fillText(s, x, y);
}
// 画一句字幕：高亮词金色发光；入场时轻微上移。返回当前透明度。
// opts：x y size font(n→字体串) color hi align(center|left|right) glow hiGlow rise fadeIn fadeOut stay until dim alpha maxW
function caption(c, line, u, o = {}) {
  const { a, k } = lineAlpha(line, u, o); const alpha = a * (o.alpha ?? 1);
  if (alpha <= 0.002) return 0;
  const W = MJ.lib.W, H = MJ.lib.H;
  let size = o.size || THEME.captionSize || 54; const font = o.font || SONG, maxW = o.maxW || W - 240;
  const segs = parseMarks(line.text);
  const widthAt = (n) => { c.font = font(n); return segs.reduce((w, sg) => w + c.measureText(sg.s).width, 0); };
  let w = widthAt(size); if (w > maxW) { size = Math.floor(size * maxW / w); w = widthAt(size); }
  const align = o.align || "center", x0 = o.x ?? W / 2, y = (o.y ?? H * 0.82) + (1 - k) * (o.rise ?? 14);
  let x = align === "center" ? x0 - w / 2 : align === "right" ? x0 - w : x0;
  c.save(); c.globalAlpha = alpha; c.textAlign = "left"; c.textBaseline = "alphabetic";
  for (const sg of segs) {
    const col = sg.hi ? (o.hi || THEME.accent) : (o.color || THEME.text);
    glowText(c, sg.s, x, y, font(size), col, sg.hi ? (o.hiGlow ?? THEME.hiGlow ?? 22) : (o.glow ?? THEME.textGlow ?? 8), sg.hi ? THEME.a.glow(0.85) : THEME.a.shine(0.35));
    c.font = font(size); x += c.measureText(sg.s).width;
  }
  c.restore();
  return alpha;
}

// 一组字幕。mode "replace"：同一位置依次替换，最后一句留到镜头结束；"stack"：依次往下排（行距 lh），旧句变暗到 dim。
// skip：不画的句子序号（场景自己用大字画的那几句）；per：{ 序号: 覆盖参数 }
function captions(c, lines, u, o = {}) {
  const skip = o.skip || [], mode = o.mode || "replace";
  const L = lines.map((l, i) => [l, i]).filter(([, i]) => !skip.includes(i));
  L.forEach(([ln, i], j) => {
    const oo = { ...o, ...((o.per || {})[i] || {}) };
    if (mode === "replace") caption(c, ln, u, { ...oo, stay: j === L.length - 1 || oo.stay });
    else caption(c, ln, u, { ...oo, y: (oo.y ?? MJ.lib.H * 0.8) + j * (o.lh ?? 80), stay: true, until: L[j + 1] ? L[j + 1][0].t0 : null, dim: o.dim ?? 0.4 });
  });
}

// ---------- Vibe 工具：暗底、发光点、把文字 / 图形采样成粒子 ----------
const _vc = {};
// 深蓝黑径向渐变底 + 缓慢上浮的微尘。o：center edge（渐变色）dust（微尘数量，0 关掉）dustAlpha seed
// 主题的 texture：none / paper（纸纹颗粒 + 纤维）/ scanline（扫描线）/ grid（细网格）/ halftone（网点）
function bgVibe(c, u, o = {}) {
  const W = MJ.lib.W, H = MJ.lib.H, tex = o.texture || THEME.texture, key = `bg${W}x${H}${o.center || ""}${o.edge || ""}${tex}`;
  let b = _vc[key];
  if (!b) {
    b = _vc[key] = canvas(W, H); const x = b.getContext("2d");
    const gr = x.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
    gr.addColorStop(0, o.center || THEME.bg.center); gr.addColorStop(1, o.edge || THEME.bg.edge); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    const R = rng(91), ink = THEME.rgb.text.join(",");
    if (tex === "paper") {
      for (let i = 0; i < W * H / 90; i++) { x.fillStyle = `rgba(${ink},${0.02 + R() * 0.05})`; x.fillRect(R() * W, R() * H, 1 + R() * 1.5, 1 + R() * 1.5); }
      x.strokeStyle = `rgba(${ink},0.035)`; x.lineWidth = 1;
      for (let i = 0; i < 260; i++) { const x0 = R() * W, y0 = R() * H, a = R() * 6.28, l = 20 + R() * 60; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + Math.cos(a) * l / 2 + R() * 10, y0 + Math.sin(a) * l / 2, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); x.stroke(); }
    } else if (tex === "scanline") {
      x.fillStyle = "rgba(0,0,0,0.22)"; for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 2);
    } else if (tex === "grid") {
      x.strokeStyle = `rgba(${ink},0.06)`; x.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 60) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, H); x.stroke(); }
      for (let gy = 0; gy < H; gy += 60) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(W, gy + 0.5); x.stroke(); }
    } else if (tex === "halftone") {
      x.fillStyle = `rgba(${ink},0.07)`;
      for (let gy = 0; gy < H; gy += 14) for (let gx = (gy / 14) % 2 ? 7 : 0; gx < W; gx += 14) { const r = 1.6 * (gy / H); x.beginPath(); x.arc(gx, gy, r, 0, 7); x.fill(); }
    }
    if (THEME.vignette) { const v = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${THEME.vignette})`); x.fillStyle = v; x.fillRect(0, 0, W, H); }
  }
  c.drawImage(b, 0, 0);
  const n = o.dust ?? THEME.dust.count; if (!n) return;
  const dk = `dust${n}x${W}x${o.seed || 7}`;
  const d = _vc[dk] || (_vc[dk] = (() => { const R = rng(o.seed || 7); return Array.from({ length: n }, () => ({ x: R() * W, y: R() * H, r: 0.8 + R() * 1.8, s: 4 + R() * 14, p: R() * 6.28, a: 0.12 + R() * 0.35 })); })());
  c.save(); c.fillStyle = o.dustColor || THEME.dust.color;
  for (const p of d) {
    const y = (((p.y - u * p.s) % H) + H) % H, x = p.x + Math.sin(u * 0.3 + p.p) * 12;
    c.globalAlpha = p.a * (0.55 + 0.45 * Math.sin(u * 0.9 + p.p)) * (o.dustAlpha ?? 1);
    c.fillRect(x, y, p.r, p.r);
  }
  c.restore();
}
// 预渲染的发光圆点（径向渐变精灵），用 c.globalCompositeOperation = "lighter" 叠加最好看。rgb = [r, g, b]
function glowDot(rgb, r) {
  const key = `gd${rgb}|${r}`; if (_vc[key]) return _vc[key];
  const s = Math.ceil(r * 2), cv = canvas(s, s), x = cv.getContext("2d"), [R, G, B] = rgb;
  const gr = x.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${Math.min(255, R + 90)},${Math.min(255, G + 90)},${Math.min(255, B + 90)},1)`);
  gr.addColorStop(0.12, `rgba(${R},${G},${B},0.85)`); gr.addColorStop(0.4, `rgba(${R},${G},${B},0.22)`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, s, s); return (_vc[key] = cv);
}
const dot = (c, sprite, x, y, scale = 1) => { const s = sprite.width * scale; c.drawImage(sprite, x - s / 2, y - s / 2, s, s); };
// 把 paint(ctx, w, h) 画出来的白色图形采样成点阵：返回 [[x, y], ...]（相对画布左上角），step 是采样间距
function samplePoints(paint, w, h, step = 4, thr = 120) {
  const cv = canvas(w, h), x = cv.getContext("2d"); paint(x, w, h);
  const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) if (d[(yy * w + xx) * 4 + 3] > thr) pts.push([xx, yy]);
  return pts;
}
// 文字采样成点阵，点的坐标以 (cx, cy) 为文字中心（基线居中）
function textPoints(s, font, cx, cy, step = 4) {
  const W = MJ.lib.W, H = MJ.lib.H;
  return samplePoints((x) => { x.font = font; x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, cx, cy); }, W, H, step);
}
// 颜色插值：a、b 是 [r, g, b]
const mixRGB = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
// 常用颜色（数组），来自主题：GOLD = 强调色，ICE = 冷色光点，PAPER = 正文色
const GOLD = THEME.rgb.accent, ICE = THEME.rgb.coldDot, PAPER = THEME.rgb.text;

// ---------- 图片素材 ----------
// project.json 里登记："images": { "book": "assets/book.png" }；场景里 image("book") 拿到 <img>（渲染前已加载完）
const image = (key) => { const el = document.querySelector(`img.mjimg[data-key="${key}"]`); if (!el) throw new Error(`没有登记图片「${key}」（project.json 的 images）`); return el; };
// 按 cover / contain 把图片画进 (x, y, w, h)；s / ox / oy 是额外缩放和平移（做推拉摇移用）
function drawImageFit(c, img, x, y, w, h, fit = "cover", s = 1, ox = 0, oy = 0) {
  const iw = img.naturalWidth, ih = img.naturalHeight, k = (fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)) * s;
  c.drawImage(img, x + (w - iw * k) / 2 + ox, y + (h - ih * k) / 2 + oy, iw * k, ih * k);
}
// 把图片采样成带颜色的点：[[x, y, r, g, b, a], ...]，坐标在 (x, y, w, h) 框里
function imagePoints(img, x, y, w, h, step = 6, fit = "cover") {
  const cv = canvas(MJ.lib.W, MJ.lib.H), cx = cv.getContext("2d"); drawImageFit(cx, img, x, y, w, h, fit);
  const d = cx.getImageData(0, 0, cv.width, cv.height).data, pts = [];
  for (let yy = Math.max(0, y | 0); yy < Math.min(cv.height, y + h); yy += step) for (let xx = Math.max(0, x | 0); xx < Math.min(cv.width, x + w); xx += step) {
    const i = (yy * cv.width + xx) * 4; if (d[i + 3] > 40) pts.push([xx, yy, d[i], d[i + 1], d[i + 2], d[i + 3] / 255]);
  }
  return pts;
}

// W/H/FPS 在 boot 时按场景的设计尺寸设置（竖屏场景默认 1080×1920）
MJ.lib = { W: 1080, H: 1920, FPS: 30, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF,
           SONG, SONGH, parseMarks, lineAlpha, glowText, caption, captions,
           bgVibe, glowDot, dot, samplePoints, textPoints, mixRGB, GOLD, ICE, PAPER, hexRGB, T: THEME, image, drawImageFit, imagePoints };
})();
