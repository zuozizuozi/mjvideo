// MJ 引擎运行时：读取 window.PROJECT（配置 + 时间轴），实例化各镜头的场景，提供 seek(t) 给渲染器。
// 这一份逻辑从《一行代码，怎么变成一段视频？》的 show.js 原样抽出，保证回归一致。
(() => {
const MJ = window.MJ;
const { clamp, mix, E, pr, rng, rr, text } = MJ.lib;
const PROJ = window.PROJECT, TL = PROJ.timeline, SHOTS = PROJ.shots;
const W = PROJ.format.width, H = PROJ.format.height, FPS = PROJ.format.fps;
const PORTRAIT = H >= W;
const PARAS = TL.paras, TOTAL = TL.total, TOTAL_FRAMES = Math.round(TOTAL * FPS);
const main = document.getElementById("c"); main.width = W; main.height = H;
const g = main.getContext("2d");
const avatarImg = document.getElementById("avatar");
const SFX = [];
const REPORT = { errors: [], subtitles: [], scenes: [], allowDark: Object.values(MJ.registry).filter((d) => d.allowDark).map((d) => d.name) };
const sfxAbs = (t, kind, vol = 1) => SFX.push({ t: +t.toFixed(3), kind, vol });
const P = (id) => PARAS.find((p) => p.id === id);

function cueOf(id, phrase, nth = 0) {          // 口播里某个词在本镜头内的相对时间
  const p = P(id); let k = -1;
  for (let i = 0; i <= nth; i++) k = p.text.indexOf(phrase, k + 1);
  if (k < 0) throw new Error(`[${id}] 口播里找不到 cue「${phrase}」`);
  return p.chars[k] - p.start;
}
function canvas(w = W, h = H) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// ---------- 实例化每个镜头的场景 ----------
const ORDER = SHOTS.map((s) => s.id);
const DRAW = {}, META = {}, DESIGN = {};
const thumbs = [];
for (const shot of SHOTS) {
  const def = MJ.registry[shot.scene];
  if (!def) { REPORT.errors.push(`[${shot.id}] 找不到场景「${shot.scene}」`); continue; }
  const p = P(shot.id);
  const [dw, dh] = def.design || [1080, 1920];
  MJ.lib.W = dw; MJ.lib.H = dh; MJ.lib.FPS = FPS;
  const ctx = {
    id: shot.id, shot: { ...shot, start: p.start, end: p.end, dur: p.end - p.start, text: p.text },
    params: { ...(def.params || {}), ...(shot.params || {}),
              cues: { ...((def.params || {}).cues || {}), ...((shot.params || {}).cues || {}) } },
    cue: (phrase, nth = 0) => (typeof phrase === "number" ? phrase : cueOf(shot.id, phrase, nth)),   // 数字 = 直接给秒数
    sfx: (u, kind, vol = 1) => sfxAbs(p.start + u, kind, vol),   // u 是镜头内相对时间
    total: TOTAL, totalFrames: TOTAL_FRAMES, fps: FPS, W: dw, H: dh,
    shotCount: SHOTS.length, shotIndex: ORDER.indexOf(shot.id),
    lines: p.lines || [],                                           // 无口播模式：本镜头每句字幕（镜头内秒数），配合 MJ.lib.caption 画
    thumbs,                                                         // 其他镜头的缩略图（needsThumbs 的场景用）
  };
  try { DRAW[shot.id] = def.create(ctx); META[shot.id] = def; DESIGN[shot.id] = [dw, dh]; }
  catch (e) { REPORT.errors.push(`[${shot.id}] 场景「${shot.scene}」初始化失败：${e.message}`); }
  REPORT.scenes.push({ id: shot.id, scene: shot.scene, music: shot.music || (def && def.music) || "" });
}
MJ.lib.W = W; MJ.lib.H = H;

// 场景设计尺寸和输出尺寸不同（比如竖屏场景放进横屏成片）时，先画到设计尺寸的画布再等比放进去
const fitBuf = {};
function drawScene(i, c, t) {
  const id = ORDER[i], f = DRAW[id]; if (!f) { c.fillStyle = "#300"; c.fillRect(0, 0, W, H); return; }
  const [dw, dh] = DESIGN[id], u = t - P(id).start;
  if (dw === W && dh === H) { c.save(); f(c, u); c.restore(); return; }
  const key = dw + "x" + dh; const b = fitBuf[key] || (fitBuf[key] = canvas(dw, dh)); const bc = b.getContext("2d");
  bc.save(); f(bc, u); bc.restore();
  c.save(); c.filter = "blur(40px) brightness(0.5)"; c.drawImage(b, 0, 0, W, H); c.restore();
  const s = Math.min(W / dw, H / dh); c.drawImage(b, (W - dw * s) / 2, (H - dh * s) / 2, dw * s, dh * s);
}

// ---------- 转场 ----------
const bounds = ORDER.map((id, i) => (i < ORDER.length - 1 ? (P(id).end + P(ORDER[i + 1]).start) / 2 : TOTAL + 1));
const TR = PROJ.transitionHalf || 0.32;
const TRANS = ORDER.slice(0, -1).map((id, i) => SHOTS[i].transition || "circle");
const bufA = canvas(), bufB = canvas(), ca = bufA.getContext("2d"), cb = bufB.getContext("2d");
const TW = Math.round(W / 10), TH = Math.round(H / 10);
const tiny = canvas(TW, TH), ct = tiny.getContext("2d");
function transition(type, k, A, B) {
  k = clamp(k); const kk = E.inOut(k);
  if (type === "cut") { g.drawImage(k < 0.5 ? A : B, 0, 0); }
  else if (type === "fade") { g.drawImage(A, 0, 0); g.globalAlpha = kk; g.drawImage(B, 0, 0); g.globalAlpha = 1; }
  else if (type === "wipe") { g.drawImage(A, 0, 0); g.save(); g.beginPath(); g.moveTo(-400 + kk * (W + 820), 0); g.lineTo(-400 + kk * (W + 820) + 400, 0); g.lineTo(-400 + kk * (W + 820) - 300, H); g.lineTo(-1600, H); g.lineTo(-1600, 0); g.closePath(); g.clip(); g.drawImage(B, 0, 0); g.restore(); }
  else if (type === "circle") { g.drawImage(A, 0, 0); g.save(); g.beginPath(); g.arc(W / 2, H * 0.46875, kk * 1300 * Math.hypot(W, H) / Math.hypot(1080, 1920), 0, 7); g.clip(); g.drawImage(B, 0, 0); g.restore(); }
  else if (type === "slide") { g.drawImage(A, 0, -kk * H); g.drawImage(B, 0, H - kk * H); }
  else if (type === "pixel") { const src = k < 0.5 ? A : B; const n = Math.max(4, Math.round(mix(TW, 6, Math.sin(k * Math.PI)))); const nh = Math.round(n * (W === 1080 && H === 1920 ? 1.78 : H / W)); ct.imageSmoothingEnabled = true; ct.clearRect(0, 0, TW, TH); ct.drawImage(src, 0, 0, n, nh); g.imageSmoothingEnabled = false; g.drawImage(tiny, 0, 0, n, nh, 0, 0, W, H); g.imageSmoothingEnabled = true; }
  else { // glitch：错位切片 + 色偏
    const src = k < 0.5 ? A : B; g.drawImage(src, 0, 0); const R = rng(Math.floor(k * 40) + 3); const amt = Math.sin(k * Math.PI);
    for (let s = 0; s < 14; s++) { const y = R() * H, h = 20 + R() * 120, dx = (R() - 0.5) * 260 * amt; g.drawImage(src, 0, y, W, h, dx, y, W, h); }
    g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.35 * amt; g.drawImage(src, 14 * amt, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }
}
// 转场音效：project.json 的 transitionSfx = false 关掉，或 { "kind": "swell", "vol": 0.3 } 换成别的
const TSFX = PROJ.transitionSfx;
if (TSFX !== false) TRANS.forEach((type, i) => { if (type !== "cut") sfxAbs(bounds[i] - 0.15, TSFX ? TSFX.kind : type === "glitch" ? "glitch" : "whoosh", TSFX ? TSFX.vol ?? 0.4 : 0.55); });

// ---------- 常驻层：品牌、风格编号、字幕、头像 ----------
const OV = PROJ.overlay || {};
const LAY = PORTRAIT
  ? { brandX: 60, brandY: 120, labelY: 84, subY: 1452, subH: 90, subFont: 50, avX: 50, avY: 1600, avS: 130 }
  : { brandX: 50, brandY: 70, labelY: 36, subY: H - 170, subH: 80, subFont: 44, avX: 40, avY: H - 160, avS: 110 };
const SUB_FONT = (n) => `700 ${n}px "Microsoft YaHei"`;
let outroT = null;
if (OV.outro) { try { outroT = P(OV.outro.shot).start + cueOf(OV.outro.shot, OV.outro.phrase); } catch (e) { REPORT.errors.push(e.message); } }
function overlays(t, idx) {
  const id = ORDER[idx], dark = META[id] ? META[id].dark !== false : true;
  if (OV.brand) text(g, OV.brand, LAY.brandX, LAY.brandY, `700 ${PORTRAIT ? 32 : 28}px "Microsoft YaHei"`, dark ? "rgba(255,255,255,0.85)" : "rgba(20,20,20,0.85)");
  if (OV.styleLabel !== false) {
    const label = `STYLE ${String(idx + 1).padStart(2, "0")} / ${ORDER.length} · ${SHOTS[idx].label || ""}`;
    g.font = `700 28px Consolas, "Microsoft YaHei"`; const lw = g.measureText(label).width + 40;
    rr(g, W - 60 - lw, LAY.labelY, lw, 52, 26); g.fillStyle = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"; g.fill();
    text(g, label, W - 60 - lw / 2, LAY.labelY + 36, `700 28px Consolas, "Microsoft YaHei"`, dark ? "#ffffff" : "#111111", "center");
  }
  if (OV.subtitles !== false && OV.subtitles !== "scene") {   // "scene"：字幕由场景用 MJ.lib.caption 自己画
    const s = TL.subs.find((x) => t >= x.t0 && t < x.t1 + 0.05);
    if (s) {
      const k = pr(t, s.t0, 0.14); g.font = SUB_FONT(LAY.subFont); const w = g.measureText(s.text).width + 64;
      g.globalAlpha = k; rr(g, W / 2 - w / 2, LAY.subY + (1 - k) * 8, w, LAY.subH, 22); g.fillStyle = "rgba(10,10,14,0.72)"; g.fill();
      text(g, s.text, W / 2, LAY.subY + 62 + (1 - k) * 8, SUB_FONT(LAY.subFont), "#ffffff", "center"); g.globalAlpha = 1;
    }
  }
  if (OV.avatar && avatarImg.complete && avatarImg.naturalWidth) {
    const km = outroT == null ? 0 : pr(t, outroT - 0.3, 0.7, E.inOut);
    const big = PORTRAIT ? 280 : 220;
    const sz = mix(LAY.avS, big, km), ax = mix(LAY.avX, W / 2 - big / 2, km), ay = mix(LAY.avY, PORTRAIT ? 690 : H * 0.25, km);
    g.save(); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 18; g.drawImage(avatarImg, ax, ay, sz, sz); g.restore();
  }
}

// ---------- 渲染入口 ----------
window.seek = (t) => {
  let i = ORDER.findIndex((id, k) => t < bounds[k]); if (i < 0) i = ORDER.length - 1;
  const prevB = i > 0 ? bounds[i - 1] : -99;
  if (i > 0 && t < prevB + TR && TRANS[i - 1] !== "cut") {
    drawScene(i - 1, ca, t); drawScene(i, cb, t); transition(TRANS[i - 1], (t - (prevB - TR)) / (2 * TR), bufA, bufB);
  } else if (i < ORDER.length - 1 && t > bounds[i] - TR && TRANS[i] !== "cut") {
    drawScene(i, ca, t); drawScene(i + 1, cb, t); transition(TRANS[i], (t - (bounds[i] - TR)) / (2 * TR), bufA, bufB);
  } else { drawScene(i, g, t); }
  overlays(t, i);
  const f = Math.max(1 - pr(t, 0, 0.4), pr(t, TOTAL - 0.8, 0.8));
  if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
};
window.SFX = SFX;
window.MJ_BOUNDS = bounds;
window.REPORT = REPORT;
window.ready = (async () => {
  for (const f of PROJ.fontsToLoad || []) { try { await document.fonts.load(f); } catch (e) {} }
  await document.fonts.ready;
  if (OV.avatar && !avatarImg.complete) await new Promise((r) => { avatarImg.onload = avatarImg.onerror = r; });
  // 胶片类场景要用的缩略图：其余镜头在 72% 处的真实画面
  if (SHOTS.some((s) => MJ.registry[s.scene] && MJ.registry[s.scene].needsThumbs)) {
    for (const shot of SHOTS) {
      const def = MJ.registry[shot.scene]; if (!def || def.noThumb || !DRAW[shot.id]) continue;
      const [dw, dh] = DESIGN[shot.id]; const c = canvas(dw, dh), x = c.getContext("2d"), p = P(shot.id);
      try { DRAW[shot.id](x, (p.end - p.start) * 0.72); } catch (e) { REPORT.errors.push(`[${shot.id}] 缩略图失败：${e.message}`); }
      const th = canvas(420, Math.round(420 * dh / dw)); th.getContext("2d").drawImage(c, 0, 0, th.width, th.height); thumbs.push(th);
    }
  }
  // 字幕宽度检查（给 Validator 用）
  if (OV.subtitles === "scene") {   // 场景字幕默认 54px 粗宋，最大宽度 W−240（caption 超宽会自动缩字号，这里按不缩算，超了就报）
    g.font = MJ.lib.SONG(54);
    for (const s of TL.subs) { const w = g.measureText(s.text).width; REPORT.subtitles.push({ text: s.text, width: Math.round(w), max: W - 240, ok: w <= W - 240 }); }
  } else {
    g.font = SUB_FONT(LAY.subFont);
    for (const s of TL.subs) { const w = g.measureText(s.text).width + 64; REPORT.subtitles.push({ text: s.text, width: Math.round(w), max: W - 80, ok: w <= W - 80 }); }
  }
  SFX.sort((a, b) => a.t - b.t);
  try { window.seek(0); } catch (e) { REPORT.errors.push("seek(0) 失败：" + e.message); }
  return true;
})();
})();
