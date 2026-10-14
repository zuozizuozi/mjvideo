// MJ 后期画风：整帧画完之后统一再过一遍，让同一套场景呈现完全不同的"画风"。
// 在 project.json 的 theme 里写：
//   "post": { "preset": "handdrawn" }   手绘：边缘勾出墨线、颜色淡成淡彩、线条抖动（boil）、每秒 12 帧、纸面
//   "post": { "preset": "film" }        电影：遮幅、青橙调色、高光光晕、颗粒、画面微晃、漏光、暗角
//   "post": { "preset": "oil" }         油画：细节并成笔触色块、厚涂浮雕光影、画布纹理、饱和
//   "post": { "preset": "watercolor" }  水彩：色彩分层成平涂、晕染、颜料边缘加深、水彩纸
// 预设里的任何参数都可以在 post 里覆盖，例如 { "preset": "film", "letterbox": 0, "grade": 0.5 }。
// 全部是确定性的：随机都由时间算出来，同一时刻永远得到同一帧。没有 post 字段时这个文件什么都不做。
(() => {
const PROJ = window.PROJECT, CFG = PROJ.theme && PROJ.theme.post;
if (!CFG) return;
const PRESETS = {
  handdrawn:  { look: "sketch", fps: 12, boil: 2.4, boilFreq: 0.02, boilFps: 8, ink: 1, wash: 0.5, paper: 0.18 },
  film:       { letterbox: 2.0, grade: 1, halation: 0.22, grain: 0.10, weave: 0.7, leak: 0.12, saturate: 0.88, contrast: 1.1, vignette: 0.45 },
  oil:        { look: "oil", boil: 5, boilFreq: 0.012, boilFps: 0, brush: 1.3, impasto: 3, canvas: 0.35, saturate: 1.3, contrast: 1.05 },
  watercolor: { look: "watercolor", fps: 15, boil: 3.5, boilFreq: 0.01, boilFps: 4, levels: 6, bleed: 2.2, edge: 0.7, wash: 0.25, paper: 0.25, saturate: 0.9 },
};
const P = { ...(PRESETS[CFG.preset] || {}), ...CFG };
const W = PROJ.format.width, H = PROJ.format.height;
const main = document.getElementById("c"), g = main.getContext("2d");
const mk = (w = W, h = H) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const buf = mk(), bx = buf.getContext("2d");
const R = (n) => { let s = (n * 2654435761) >>> 0; s ^= s >>> 13; s = Math.imul(s, 1274126177) >>> 0; return (s % 100000) / 100000; };

// ---------- SVG 滤镜（canvas 的 filter 可以引用页面里的 SVG 滤镜，Chrome 支持）----------
const NS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(NS, "svg"); svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute";
document.body.appendChild(svg);
function filter(id, inner) { const f = document.createElementNS(NS, "filter"); f.id = id; for (const [k, v] of Object.entries({ x: "0", y: "0", width: "100%", height: "100%", "color-interpolation-filters": "sRGB" })) f.setAttribute(k, v); f.innerHTML = inner; svg.appendChild(f); return f; }
const lin = (slope, icpt) => `<feFuncR type="linear" slope="${slope}" intercept="${icpt}"/><feFuncG type="linear" slope="${slope}" intercept="${icpt}"/><feFuncB type="linear" slope="${slope}" intercept="${icpt}"/>`;
const GRAY = `type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 0 1"`;
const LAPLACE = `order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true"`;
const boil = P.boil ? `<feTurbulence type="fractalNoise" baseFrequency="${P.boilFreq}" numOctaves="2" seed="1" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="${P.boil * 2}" xChannelSelector="R" yChannelSelector="G" result="d"/>` : `<feOffset in="SourceGraphic" result="d"/>`;
let look = null;
if (P.look === "sketch") look = filter("mj-look", `${boil}
  <feColorMatrix in="d" ${GRAY} result="gray"/>
  <feConvolveMatrix in="gray" ${LAPLACE} result="edge"/>
  <feComponentTransfer in="edge" result="lines">${lin(-3.2 * P.ink, 1)}</feComponentTransfer>
  <feMorphology in="lines" operator="erode" radius="0.7" result="thick"/>
  <feComponentTransfer in="d" result="wash">${lin(1 - P.wash, P.wash)}</feComponentTransfer>
  <feBlend in="thick" in2="wash" mode="multiply"/>`);
if (P.look === "watercolor") {
  const steps = Array.from({ length: P.levels }, (_, i) => (i / (P.levels - 1)).toFixed(3)).join(" ");
  look = filter("mj-look", `${boil}
  <feComponentTransfer in="d" result="poster"><feFuncR type="discrete" tableValues="${steps}"/><feFuncG type="discrete" tableValues="${steps}"/><feFuncB type="discrete" tableValues="${steps}"/></feComponentTransfer>
  <feGaussianBlur in="poster" stdDeviation="${P.bleed}" result="soft"/>
  <feColorMatrix in="soft" ${GRAY} result="gray"/>
  <feConvolveMatrix in="gray" ${LAPLACE} result="edge"/>
  <feComponentTransfer in="edge" result="rim">${lin(-6 * P.edge, 1)}</feComponentTransfer>
  <feComponentTransfer in="soft" result="wash">${lin(1 - P.wash, P.wash)}</feComponentTransfer>
  <feBlend in="rim" in2="wash" mode="multiply"/>`);
}
if (P.look === "oil") look = filter("mj-look", `${boil}
  <feMorphology in="d" operator="dilate" radius="${P.brush}" result="dil"/>
  <feMorphology in="dil" operator="erode" radius="${P.brush}" result="paint"/>
  <feColorMatrix in="paint" type="luminanceToAlpha" result="height"/>
  <feDiffuseLighting in="height" surfaceScale="${P.impasto}" diffuseConstant="1.15" lighting-color="#fff" result="light"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>
  <feBlend in="light" in2="paint" mode="multiply" result="lit"/>
  <feComponentTransfer in="lit">${lin(1.25, 0.02)}</feComponentTransfer>`);
const simpleBoil = !look && P.boil ? filter("mj-look", boil) : null;
const turb = (look || simpleBoil) && (look || simpleBoil).querySelector("feTurbulence");

// ---------- 静态纹理（只画一次）----------
function noiseTile(alpha, size = 256, seed = 3) {
  const t = mk(size, size), x = t.getContext("2d"), im = x.createImageData(size, size); let s = seed;
  for (let i = 0; i < im.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const v = (s >>> 24); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = alpha; }
  x.putImageData(im, 0, 0); return t;
}
function relief(freq, surface, seed) {      // 画布 / 纸面的浮雕：噪声 + 光照
  filter("mj-relief-" + seed, `<feTurbulence type="${seed % 2 ? "turbulence" : "fractalNoise"}" baseFrequency="${freq}" numOctaves="3" seed="${seed}"/>
    <feDiffuseLighting surfaceScale="${surface}" lighting-color="#fff"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting>`);
  const c = mk(), x = c.getContext("2d"); x.filter = `url(#mj-relief-${seed})`; x.fillRect(0, 0, W, H); return c;
}
let canvasTex = null, paperTex = null, grainTile = null;
const ready = () => {
  if (P.canvas && !canvasTex) canvasTex = relief("0.9 0.06", 2.2, 7);          // 斜纹画布
  if (P.paper && !paperTex) paperTex = relief(0.4, 0.9, 4);                     // 纸面细纹
  if (P.grain && !grainTile) grainTile = noiseTile(40);
};
const over = (img, alpha, mode) => { g.globalAlpha = alpha; g.globalCompositeOperation = mode; g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; };

const base = window.seek;
window.seek = async (t) => {
  ready();
  await base(P.fps ? Math.floor(t * P.fps + 1e-6) / P.fps : t);                      // 降帧：手绘动画"一拍二"
  bx.clearRect(0, 0, W, H); bx.drawImage(main, 0, 0);
  g.save();
  if (turb) turb.setAttribute("seed", String(P.boilFps ? 1 + Math.floor(t * P.boilFps) % 997 : 1));
  const fl = [];
  if (look || simpleBoil) fl.push("url(#mj-look)");
  if (P.saturate && P.saturate !== 1) fl.push(`saturate(${P.saturate})`);
  if (P.contrast && P.contrast !== 1) fl.push(`contrast(${P.contrast})`);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.filter = fl.join(" ") || "none";
  // 扭曲会把画面外的透明像素拉进来，放大一点把边裁掉
  const s = 1 + (P.boil ? (P.boil * 2.5) / Math.min(W, H) * 2 : 0) + (P.weave ? 0.004 : 0);
  g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-W / 2, -H / 2);
  if (P.weave) { const f = Math.floor(t * 24); g.translate((R(f) - 0.5) * P.weave * 2, (R(f + 7777) - 0.5) * P.weave * 2); }
  g.drawImage(buf, 0, 0);
  g.restore(); g.save();
  // 电影：高光光晕、青橙调色、漏光
  if (P.halation) { g.globalAlpha = P.halation; g.globalCompositeOperation = "screen"; g.filter = "blur(16px) brightness(1.4) contrast(1.6)"; g.drawImage(buf, 0, 0); g.filter = "none"; g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; }
  if (P.grade) {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "rgba(0,110,130,1)"); gr.addColorStop(1, "rgba(255,140,60,1)");
    g.globalAlpha = 0.22 * P.grade; g.globalCompositeOperation = "soft-light"; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  if (P.leak) {
    const k = (Math.sin(t * 0.37) + 1) / 2, lx = W * (0.1 + 0.8 * k), ly = H * (0.2 + 0.3 * Math.sin(t * 0.23)), lr = g.createRadialGradient(lx, ly, 0, lx, ly, W * 0.45);
    lr.addColorStop(0, "rgba(255,150,70,1)"); lr.addColorStop(1, "rgba(255,150,70,0)");
    g.globalAlpha = P.leak * (0.6 + 0.4 * Math.sin(t * 0.9)); g.globalCompositeOperation = "screen"; g.fillStyle = lr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  // 纹理：画布、纸面、颗粒
  if (canvasTex) over(canvasTex, P.canvas, "multiply");
  if (paperTex) over(paperTex, P.paper, "multiply");
  if (grainTile) { const f = Math.floor(t * 24), ox = (f * 97) % 256, oy = (f * 61) % 256; g.globalAlpha = P.grain * 4; g.globalCompositeOperation = "overlay"; for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) g.drawImage(grainTile, x, y); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; }
  if (P.vignette) { const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${P.vignette})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  if (P.letterbox) { const bh = Math.max(0, (H - W / P.letterbox) / 2); g.fillStyle = "#000"; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh); }
  g.restore();
};
})();
