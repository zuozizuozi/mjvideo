#!/usr/bin/env node
// mjv —— 麻酱视频引擎命令行入口（零 npm 依赖：Node 24 + Chrome + FFmpeg + Python）
//
//   node bin/mjv.mjs new <项目目录> [--vibe] [--style=名]  新建项目（--vibe 无口播横屏；--style 套用风格包）
//   node bin/mjv.mjs styles                         列出风格包
//   node bin/mjv.mjs previews [--force]             生成风格包样张和场景预览小片（工作台用）
//   node bin/mjv.mjs studio                         打开工作台（浏览器）
//   node bin/mjv.mjs ref <项目> <图或视频…>          分析参考素材 → 项目 refs/（拼图、色板、节奏）
//   node bin/mjv.mjs scenes [项目目录]              列出场景库（含项目自带场景）及其参数
//   node bin/mjv.mjs tts <项目> [镜头id...]         合成配音（有缓存）
//   node bin/mjv.mjs timeline <项目>                生成时间轴
//   node bin/mjv.mjs check <项目>                   只加载场景、检查报错和字幕宽度，不渲染
//   node bin/mjv.mjs stills <项目> <秒> [秒...]     抽查静帧 → build/stills/
//   node bin/mjv.mjs render <项目> [--only s03,s04] [--force]   增量渲染（只重渲改过的镜头）
//   node bin/mjv.mjs audio <项目>                   配乐 + 音效 + 混音
//   node bin/mjv.mjs mux <项目>                     合成成片 output/
//   node bin/mjv.mjs validate <项目> [成片]         质检
//   node bin/mjv.mjs build <项目>                   tts → timeline → render → audio → mux → validate
//   node bin/mjv.mjs promote <项目> <场景名> [--force]  把项目里写的新场景收进场景库
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = path.join(ROOT, "engine"), LIB = path.join(ENGINE, "scenes"), TOOLS = path.join(ROOT, "tools");
// Chrome / Python：环境变量优先，否则按系统找常见位置
const CHROME = process.env.MJV_CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find((p) => fs.existsSync(p)) || "chrome";
const PY = process.env.MJV_PYTHON || (process.platform === "win32" ? "python" : "python3");
const [cmd, ...args] = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
const pos = args.filter((a) => !a.startsWith("--"));

const die = (m) => { console.error("✗ " + m); process.exit(1); };
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (...xs) => crypto.createHash("sha1").update(xs.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\u0000")).digest("hex").slice(0, 16);
const fileUrl = (p) => pathToFileURL(path.resolve(p)).href;

function project(dir) {
  if (!dir) die("请给出项目目录");
  const pdir = path.resolve(dir), cfgp = path.join(pdir, "project.json");
  if (!fs.existsSync(cfgp)) die("找不到 " + cfgp);
  const cfg = readJSON(cfgp);
  cfg.format = { width: 1080, height: 1920, fps: 30, ...(cfg.format || {}) };
  cfg.overlay = { brand: "麻酱 AI 实验室", styleLabel: true, subtitles: true, avatar: "assets/avatar.png", ...(cfg.overlay || {}) };
  for (const d of ["build", "build/segments", "build/stills", "output"]) fs.mkdirSync(path.join(pdir, d), { recursive: true });
  return { pdir, cfg, b: (...p) => path.join(pdir, "build", ...p) };
}
function py(script, ...a) {
  const r = spawnSync(PY, [path.join(TOOLS, script), ...a], { stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (r.status !== 0) die(`${script} 失败`);
}
function sceneFile(pdir, name) {
  const local = path.join(pdir, "scenes", name + ".js"), lib = path.join(LIB, name + ".js");
  if (fs.existsSync(local)) return local;
  if (fs.existsSync(lib)) return lib;
  die(`找不到场景「${name}」：既不在 ${path.join(pdir, "scenes")}，也不在场景库 ${LIB}`);
}
function sceneMeta(file) {           // 在 Node 里读出场景的元信息（不执行绘制）
  const reg = {};
  const sandbox = { window: {}, MJ: { scene: (n, d) => { reg[n] = d; }, lib: {} } };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return Object.entries(reg).map(([name, d]) => ({ name, ...d }));
}

// ---------------- 生成渲染页面 ----------------
function buildPage(P) {
  const { pdir, cfg, b } = P;
  const tl = readJSON(b("timeline.json"));
  const names = [...new Set(cfg.shots.map((s) => s.scene))];
  const files = names.map((n) => sceneFile(pdir, n));
  // fonts 的 src 可以写绝对路径，或相对项目目录 / 引擎目录（例如 "assets/fonts/NotoSerifSC-Bold.otf"）
  // 默认字体只在本机装了时才用（汉仪雅酷黑是商业字体，不随仓库分发；没有时 Heavy 退回系统黑体）
  const fonts = (cfg.fonts || [{ family: "Heavy", src: "C:/Windows/Fonts/HYYakuHei-85W.ttf" }, { family: "Kai", src: "C:/Windows/Fonts/simkai.ttf" }])
    .map((f) => ({ ...f, src: [path.resolve(pdir, f.src), path.resolve(ROOT, f.src)].find((p) => fs.existsSync(p)) }))
    .filter((f) => f.src || (console.error(`⚠ 字体「${f.family}」的文件不存在，用系统字体代替`), false));
  const avatar = cfg.overlay.avatar ? path.join(pdir, cfg.overlay.avatar) : "";
  const PROJECT = { format: cfg.format, shots: cfg.shots, overlay: { ...cfg.overlay, avatar: !!(avatar && fs.existsSync(avatar)) },
    transitionHalf: cfg.transitionHalf || 0.32, transitionSfx: cfg.transitionSfx ?? null, theme: cfg.theme || null, images: cfg.images || null, fontsToLoad: cfg.fontsToLoad || ["40px Heavy", "40px Kai"], timeline: tl };
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${cfg.title || "mjv"}</title><style>
${fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("${fileUrl(f.src)}"); }`).join("\n")}
html, body { margin: 0; width: ${cfg.format.width}px; height: ${cfg.format.height}px; overflow: hidden; background: #000; }
canvas { display: block; }
</style></head><body>
<canvas id="c" width="${cfg.format.width}" height="${cfg.format.height}"></canvas>
<img id="avatar" src="${avatar && fs.existsSync(avatar) ? fileUrl(avatar) : ""}" style="display:none">
${Object.entries(cfg.images || {}).map(([k, p]) => { const f = path.resolve(pdir, p); if (!fs.existsSync(f)) console.error(`⚠ 图片「${k}」不存在：${f}`); return `<img class="mjimg" data-key="${k}" src="${fileUrl(f)}" style="display:none">`; }).join("\n")}
<script>window.PROJECT = ${JSON.stringify(PROJECT)};</script>
${(cfg.vendorScripts || []).map((v) => `<script src="${fileUrl(path.resolve(pdir, v))}"></script>`).join("\n")}
<script src="${fileUrl(path.join(ENGINE, "lib.js"))}"></script>
${files.map((f) => `<script src="${fileUrl(f)}"></script>`).join("\n")}
<script src="${fileUrl(path.join(ENGINE, "runtime.js"))}"></script>
</body></html>`;
  fs.writeFileSync(b("page.html"), html);
  return { tl, files: Object.fromEntries(names.map((n, i) => [n, files[i]])) };
}

// ---------------- 浏览器会话（DevTools 协议，零依赖） ----------------
async function browser(pageFile, W, H) {
  const port = 9400 + Math.floor(Math.random() * 500);          // 随机端口：两个渲染同时跑也不会抢同一个浏览器
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mjv-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--mute-audio",
    "--allow-file-access-from-files", "--disable-background-timer-throttling", `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); wsUrl = l.find((x) => x.type === "page")?.webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) { chrome.kill(); die("Chrome 没有启动（检查 MJV_CHROME 路径）"); }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r, { once: true }); ws.addEventListener("error", j, { once: true }); });
  let seq = 0; const pending = new Map();
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => { const timer = setTimeout(() => { pending.delete(id); rej(new Error(method + " 超时 30 秒")); }, 30000);
      pending.set(id, (m) => { clearTimeout(timer); m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result); }); }); };
  const evaluate = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: fileUrl(pageFile) });
  for (let i = 0; i < 150; i++) { try { if (await evaluate("!!window.ready")) break; } catch {} await sleep(100); }
  try { await evaluate("window.ready"); } catch (e) { const rep = await evaluate("JSON.stringify(window.REPORT||{})").catch(() => "{}"); console.error(rep); throw e; }
  const shot = async (t, fmt = "jpeg") => { await evaluate(`window.seek(${t})`);
    const r = await send("Page.captureScreenshot", { format: fmt, quality: fmt === "jpeg" ? 92 : undefined, optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    return Buffer.from(r.data, "base64"); };
  const close = async () => { ws.close(); chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { evaluate, shot, close };
}

async function loadSession(P) {
  const { cfg, b } = P;
  if (!fs.existsSync(b("timeline.json"))) die("还没有时间轴，先运行 tts 和 timeline");
  const page = buildPage(P);
  const br = await browser(b("page.html"), cfg.format.width, cfg.format.height);
  const report = await br.evaluate("window.REPORT");
  report.bounds = await br.evaluate("window.MJ_BOUNDS");
  fs.writeFileSync(b("report.json"), JSON.stringify(report, null, 1));
  fs.writeFileSync(b("sfx.json"), JSON.stringify(await br.evaluate("window.SFX"), null, 1));
  return { br, report, ...page };
}

// ---------------- 增量渲染 ----------------
function segmentPlan(P, tl, files, bounds) {
  const { cfg, pdir } = P, fps = cfg.format.fps, shots = cfg.shots, n = shots.length;
  const totalFrames = Math.round(tl.total * fps);
  const engineSrc = ["lib.js", "runtime.js"].map((f) => fs.readFileSync(path.join(ENGINE, f), "utf8")).join("");
  const sceneSrc = (name) => fs.readFileSync(files[name], "utf8");
  const anyThumbs = (i) => { const m = sceneMeta(files[shots[i].scene])[0]; return m && m.needsThumbs; };
  const avatarP = cfg.overlay.avatar ? path.join(pdir, cfg.overlay.avatar) : "";
  const avatarSig = avatarP && fs.existsSync(avatarP) ? fs.statSync(avatarP).size : 0;
  const imgSig = Object.entries(cfg.images || {}).map(([k, p]) => { const f = path.resolve(pdir, p); return [k, fs.existsSync(f) ? fs.statSync(f).size + ":" + fs.statSync(f).mtimeMs : 0]; });
  return shots.map((s, i) => {
    const f0 = i === 0 ? 0 : Math.round(bounds[i - 1] * fps), f1 = i === n - 1 ? totalFrames : Math.round(bounds[i] * fps);
    const near = [i - 1, i, i + 1].filter((k) => k >= 0 && k < n);
    const deps = anyThumbs(i) ? shots.map((x) => x.scene) : near.map((k) => shots[k].scene);
    const subs = tl.subs.filter((x) => x.t1 >= f0 / fps - 0.2 && x.t0 <= f1 / fps + 0.2);
    const hash = sha(engineSrc, [...new Set(deps)].map(sceneSrc), near.map((k) => shots[k]), near.map((k) => tl.paras[k]), subs,
      cfg.format, cfg.overlay, cfg.fonts || null, cfg.vendorScripts || null, cfg.transitionSfx ?? null, cfg.theme || null, imgSig, tl.total, avatarSig, cfg.transitionHalf || 0.32, f0, f1);
    return { id: s.id, f0, f1, hash, file: path.join(pdir, "build", "segments", s.id + ".mp4") };
  });
}

async function render(P) {
  const { cfg, b } = P, fps = cfg.format.fps;
  const { br, report, tl, files } = await loadSession(P);
  try {
    if (report.errors.length && !flags.force) die("场景有错误，先修：\n  " + report.errors.join("\n  "));
    const plan = segmentPlan(P, tl, files, report.bounds);
    const hp = b("segments", "hashes.json"); const old = fs.existsSync(hp) ? readJSON(hp) : {};
    const only = flags.only ? String(flags.only).split(",") : null;
    const todo = plan.filter((s) => (only ? only.includes(s.id) : flags.force || old[s.id] !== s.hash || !fs.existsSync(s.file)));
    console.log(`镜头 ${plan.length} 个，需要渲染 ${todo.length} 个：${todo.map((s) => s.id).join(" ") || "（全部命中缓存）"}`);
    if (flags.dry) return;                                   // --dry：只看哪些镜头要重渲
    const t0 = Date.now();
    for (const s of todo) {
      const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-crf", String(cfg.crf || 17), "-pix_fmt", "yuv420p", "-r", String(fps), s.file], { stdio: ["pipe", "inherit", "inherit"] });
      for (let f = s.f0; f < s.f1; f++) {
        const buf = await br.shot(f / fps);
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end(); await new Promise((r) => ff.on("close", r));
      old[s.id] = s.hash; fs.writeFileSync(hp, JSON.stringify(old, null, 1));
      console.log(`  ${s.id}  帧 ${s.f0}–${s.f1 - 1}（${s.f1 - s.f0} 帧）  累计 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    const list = b("segments", "list.txt");
    fs.writeFileSync(list, plan.map((s) => `file '${s.file.replace(/\\/g, "/")}'`).join("\n"));
    const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", b("video.mp4")], { stdio: "inherit" });
    if (r.status !== 0) die("拼接分段失败");
    console.log(`✓ 画面 ${b("video.mp4")}（${Math.round(tl.total * fps)} 帧）`);
  } finally { await br.close(); }
}

async function stills(P, times) {
  const { br, report } = await loadSession(P);
  try {
    if (report.errors.length) console.error("⚠ 场景报错：\n  " + report.errors.join("\n  "));
    for (const t of times) { const f = P.b("stills", `t${t}.png`); fs.writeFileSync(f, await br.shot(+t, "png")); console.log("  " + f); }
  } finally { await br.close(); }
}

// 小预览片段：从 t0 开始 dur 秒，缩到宽 w、帧率 fps，输出无声 mp4（给工作台和目录页用）
async function clip(P, t0, dur, out, w = 480, fps = 15) {
  const { br } = await loadSession(P);
  try {
    const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
      "-vf", `scale=${w}:-2`, "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
    for (let k = 0; k < Math.round(dur * fps); k++) { const buf = await br.shot(+t0 + k / fps); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r)); }
    ff.stdin.end(); await new Promise((r) => ff.on("close", r));
    console.log("✓ " + out);
  } finally { await br.close(); }
}

async function check(P) {
  const { br, report } = await loadSession(P);
  await br.close();
  const bad = report.subtitles.filter((s) => !s.ok);
  report.errors.forEach((e) => console.log("  FAIL " + e));
  bad.forEach((s) => console.log(`  FAIL 字幕超宽 ${s.width}px：「${s.text}」`));
  console.log(report.errors.length || bad.length ? "✗ 检查未通过" : `✓ ${report.scenes.length} 个镜头加载正常，${report.subtitles.length} 条字幕宽度正常`);
  if (report.errors.length || bad.length) process.exit(1);
}

function mux(P) {
  const { cfg, pdir, b } = P;
  const out = path.join(pdir, "output", cfg.output_name || "成片.mp4");
  // 不用 -shortest：音频比画面短几十毫秒时它会把最后几帧画面一起截掉。改成音频补静音、按画面精确时长输出。
  const tl = readJSON(b("timeline.json")), frames = Math.round(tl.total * cfg.format.fps), dur = (frames / cfg.format.fps).toFixed(4);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", b("video.mp4"), "-i", b("mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "apad", "-c:a", "aac", "-b:a", "192k", "-t", dur, "-movflags", "+faststart", out], { stdio: "inherit" });
  if (r.status !== 0) die("合成失败");
  console.log("✓ 成片 " + out);
}

function listScenes(pdir) {
  const dirs = [[LIB, "库"]]; if (pdir) dirs.push([path.join(path.resolve(pdir), "scenes"), "项目"]);
  for (const [d, tag] of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".js")).sort()) {
      for (const m of sceneMeta(path.join(d, f))) {
        console.log(`[${tag}] ${m.name.padEnd(12)} ${m.title || ""}  ${m.dark === false ? "浅色" : "深色"}  ${(m.design || [1080, 1920]).join("×")}`);
        if (m.desc) console.log(`       ${m.desc}`);
        const cues = (m.params && m.params.cues) || {}; if (Object.keys(cues).length) console.log(`       cues: ${JSON.stringify(cues)}`);
        const other = Object.keys(m.params || {}).filter((k) => k !== "cues"); if (other.length) console.log(`       params: ${other.join(", ")}`);
      }
    }
  }
}

function newProject(dir) {
  const pdir = path.resolve(dir);
  if (fs.existsSync(path.join(pdir, "project.json"))) die("已存在 project.json：" + pdir);
  for (const d of ["scenes", "assets", "build", "output"]) fs.mkdirSync(path.join(pdir, d), { recursive: true });
  // --vibe：无口播模板（横屏、字幕 + 配乐，见 SKILL.md 第 11 节）；--style=名字：套用 styles/ 里的风格包（主题、字体）
  const vibe = flags.vibe || flags.style;
  fs.copyFileSync(path.join(ROOT, "templates", vibe ? "project.vibe.example.json" : "project.example.json"), path.join(pdir, "project.json"));
  if (!vibe) fs.copyFileSync(path.join(ROOT, "assets", "avatar.png"), path.join(pdir, "assets", "avatar.png"));
  if (flags.style) {
    const sp = path.join(ROOT, "styles", String(flags.style), "style.json");
    if (!fs.existsSync(sp)) die(`没有风格包「${flags.style}」，用 node bin/mjv.mjs styles 查看`);
    const st = readJSON(sp), cfgp = path.join(pdir, "project.json"), cfg = readJSON(cfgp);
    cfg.style = st.name; cfg.theme = st.theme;
    if (st.fonts) cfg.fonts = st.fonts;
    if (st.fontsToLoad) cfg.fontsToLoad = st.fontsToLoad;
    if (st.music) cfg.music = { ...cfg.music, ...st.music };
    fs.writeFileSync(cfgp, JSON.stringify(cfg, null, 2));
    console.log(`✓ 套用风格包「${st.title}」：主题已写进 project.json 的 theme，可以在此基础上改`);
  }
  fs.copyFileSync(path.join(ROOT, "templates", "scene.template.js"), path.join(pdir, "scenes", "README_新场景模板.js.txt"));
  console.log("✓ 新项目 " + pdir + "\n  下一步：改 project.json（讲稿和分镜），然后 node bin/mjv.mjs build " + dir);
}

function listStyles() {           // 风格包：styles/<名字>/style.json
  const d = path.join(ROOT, "styles");
  for (const n of fs.existsSync(d) ? fs.readdirSync(d).sort() : []) {
    const p = path.join(d, n, "style.json"); if (!fs.existsSync(p)) continue;
    const s = readJSON(p);
    console.log(`${n.padEnd(12)} ${s.title}  （${s.theme.mode === "light" ? "浅底" : "深底"}，纹理 ${s.theme.texture || "none"}）
             ${s.desc}`);
  }
}

function promote(P, name) {
  const src = path.join(P.pdir, "scenes", name + ".js"), dst = path.join(LIB, name + ".js");
  if (!fs.existsSync(src)) die("项目里没有场景文件 " + src);
  const m = sceneMeta(src)[0];
  if (!m || !m.title || !m.desc) die("收进场景库前，场景必须写 title 和 desc（用途说明）");
  if (fs.existsSync(dst) && !flags.force) die(`场景库里已有「${name}」，确认要覆盖请加 --force`);
  fs.copyFileSync(src, dst);
  console.log(`✓ 已收进场景库：${dst}\n  ${m.title}：${m.desc}`);
}

// ---------------- 分发 ----------------
const t0 = Date.now();
switch (cmd) {
  case "new": newProject(pos[0]); break;
  case "scenes": listScenes(pos[0]); break;
  case "styles": listStyles(); break;
  case "studio": { const { studio } = await import(pathToFileURL(path.join(TOOLS, "studio.mjs")).href); await studio(ROOT, flags); break; }
  case "previews": { const { previews } = await import(pathToFileURL(path.join(TOOLS, "previews.mjs")).href); await previews(ROOT, flags); break; }
  case "ref": { const P = project(pos[0]); if (!pos[1]) die("用法：mjv ref <项目> <参考图或视频…>"); py("ref.py", P.pdir, ...pos.slice(1).map((f) => path.resolve(f))); break; }
  case "tts": { const P = project(pos[0]); py("tts.py", P.pdir, ...pos.slice(1)); break; }
  case "timeline": { const P = project(pos[0]); py("timeline.py", P.pdir); break; }
  case "check": await check(project(pos[0])); break;
  case "stills": await stills(project(pos[0]), pos.slice(1)); break;
  case "clip": await clip(project(pos[0]), pos[1], +pos[2], path.resolve(pos[3]), +(flags.w || 480), +(flags.fps || 15)); break;
  case "render": await render(project(pos[0])); break;
  case "audio": { const P = project(pos[0]); py("audio.py", P.pdir); break; }
  case "mux": mux(project(pos[0])); break;
  case "validate": { const P = project(pos[0]); py("validate.py", P.pdir, ...(pos[1] ? [path.resolve(pos[1])] : [])); break; }
  case "promote": promote(project(pos[0]), pos[1]); break;
  case "build": {
    const P = project(pos[0]);
    py("tts.py", P.pdir); py("timeline.py", P.pdir); await check(P); await render(P); py("audio.py", P.pdir); mux(P); py("validate.py", P.pdir);
    console.log(`✓ 全流程完成，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    break;
  }
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 17).join("\n").replace(/^\/\/ ?/gm, ""));
}
