// mjv studio：本地工作台（只监听 127.0.0.1）。看风格包和场景库、给项目选风格 / 换场景、出静帧、写修改意见、传参考素材、看成片。
// 创作（写文案、美术方案、新场景代码）还是交给 Codex / 造物等 Agent；工作台写的东西都落在项目文件夹里，Agent 通过 MCP 读得到：
//   project.json 的 style / theme / shots[].scene        （选风格、换场景）
//   review.json                                          （修改意见，MCP 工具 mjv_notes 读取）
//   refs/  assets/                                       （参考素材、图片素材）
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export async function studio(ROOT, flags) {
  const PROJECTS = path.resolve(process.env.MJV_PROJECTS || path.join(ROOT, "projects"));
  const UI = path.join(ROOT, "studio", "ui");
  const MJV = path.join(ROOT, "bin", "mjv.mjs");
  const port = +(flags.port || 5178);
  const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
  const writeJSON = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2));
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".md": "text/plain; charset=utf-8", ".svg": "image/svg+xml" };

  // ---------- 后台任务 ----------
  const jobs = new Map(); let seq = 0;
  function job(label, args, after) {
    const id = "j" + ++seq, j = { id, label, status: "running", out: "", result: null };
    const ch = spawn(process.execPath, [MJV, ...args], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    const on = (d) => { j.out = (j.out + d).slice(-20000); }; ch.stdout.on("data", on); ch.stderr.on("data", on);
    ch.on("close", async (code) => { try { if (code === 0 && after) j.result = await after(); } catch (e) { j.out += "\n" + e.message; code = 1; } j.status = code === 0 ? "done" : "failed"; });
    jobs.set(id, j); return j;
  }

  // ---------- 数据 ----------
  const projDir = (name) => { if (!/^[\w.-]+$/.test(name)) throw new Error("项目名不合法"); const d = path.join(PROJECTS, name); if (!fs.existsSync(path.join(d, "project.json"))) throw new Error("没有项目 " + name); return d; };
  const url = (abs) => "/r/" + path.relative(ROOT, abs).split(path.sep).map(encodeURIComponent).join("/");
  const purl = (name, rel) => `/p/${encodeURIComponent(name)}/` + rel.split(/[\\/]/).map(encodeURIComponent).join("/");

  function styles() {
    const d = path.join(ROOT, "styles");
    return fs.readdirSync(d).filter((n) => fs.existsSync(path.join(d, n, "style.json"))).sort().map((n) => {
      const s = readJSON(path.join(d, n, "style.json")), pv = path.join(d, n, "preview.jpg");
      return { name: n, title: s.title, desc: s.desc, mode: s.theme.mode, texture: s.theme.texture || "none", colors: [s.theme.bg?.center, s.theme.text, s.theme.accent, s.theme.cold].filter(Boolean), preview: fs.existsSync(pv) ? url(pv) + "?v=" + fs.statSync(pv).mtimeMs : null };
    });
  }
  let sceneCache = null;
  function scenes() {
    if (sceneCache) return sceneCache;
    const r = spawnSync(process.execPath, ["-e", `
      const vm=require("vm"),fs=require("fs"),path=require("path");const dir=process.argv[1];const out=[];
      for(const f of fs.readdirSync(dir).filter(x=>x.endsWith(".js")).sort()){const reg={};
        try{vm.runInNewContext(fs.readFileSync(path.join(dir,f),"utf8"),{window:{},MJ:{scene:(n,d)=>{reg[n]=d;},lib:{},theme:{}}});}catch(e){}
        for(const[n,d]of Object.entries(reg))out.push({name:n,title:d.title||"",desc:d.desc||"",design:d.design||[1080,1920],params:Object.keys(d.params||{}).filter(k=>k!=="cues"),cues:Object.keys((d.params||{}).cues||{})});}
      console.log(JSON.stringify(out));`, path.join(ROOT, "engine", "scenes")], { encoding: "utf8" });
    const list = JSON.parse(r.stdout || "[]");
    for (const s of list) { const v = path.join(ROOT, "engine", "scenes", "_previews", s.name); s.video = fs.existsSync(v + ".mp4") ? url(v + ".mp4") : null; s.poster = fs.existsSync(v + ".jpg") ? url(v + ".jpg") : null; s.orientation = s.design[0] > s.design[1] ? "横屏" : "竖屏"; }
    return (sceneCache = list);
  }
  function projects() {
    if (!fs.existsSync(PROJECTS)) return [];
    return fs.readdirSync(PROJECTS).filter((n) => fs.existsSync(path.join(PROJECTS, n, "project.json"))).map((n) => {
      const d = path.join(PROJECTS, n), cfg = readJSON(path.join(d, "project.json"), {}), out = path.join(d, "output", cfg.output_name || "成片.mp4");
      const rv = readJSON(path.join(d, "review.json"), { notes: [] });
      return { name: n, title: cfg.title || n, style: cfg.style || cfg.theme?.name || "", shots: (cfg.shots || []).length, silent: cfg.voice?.engine === "none",
        updated: fs.statSync(path.join(d, "project.json")).mtimeMs, output: fs.existsSync(out), openNotes: (rv.notes || []).filter((x) => x.status !== "done").length };
    }).sort((a, b) => b.updated - a.updated);
  }
  function project(name) {
    const d = projDir(name), cfg = readJSON(path.join(d, "project.json")), tl = readJSON(path.join(d, "build", "timeline.json"));
    const rv = readJSON(path.join(d, "review.json"), { notes: [] });
    const out = path.join(d, "output", cfg.output_name || "成片.mp4"), refs = path.join(d, "refs"), assets = path.join(d, "assets");
    const list = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).sort() : []);
    const sheets = {}; for (const f of list(path.join(d, "build", "stills"), /^sheet_.+\.jpg$/)) sheets[f.slice(6, -4)] = purl(name, "build/stills/" + f) + "?v=" + fs.statSync(path.join(d, "build", "stills", f)).mtimeMs;
    return {
      name, dir: d, cfg, sheets, notes: rv.notes || [],
      timeline: tl ? { total: tl.total, paras: tl.paras.map((p) => ({ id: p.id, start: p.start, end: p.end })) } : null,
      output: fs.existsSync(out) ? purl(name, "output/" + path.basename(out)) + "?v=" + fs.statSync(out).mtimeMs : null,
      refs: list(refs, /^(sheet|palette)_.+\.(jpg|png)$/).map((f) => ({ name: f, url: purl(name, "refs/" + f) })),
      refReport: fs.existsSync(path.join(refs, "ref_report.md")) ? fs.readFileSync(path.join(refs, "ref_report.md"), "utf8") : "",
      refFiles: list(refs, /\.(png|jpe?g|webp|mp4|mov|webm|gif)$/i).filter((f) => !/^(sheet|palette)_/.test(f)),
      assets: list(assets, /\.(png|jpe?g|webp|gif)$/i).map((f) => ({ name: f, url: purl(name, "assets/" + f) })),
      design: fs.existsSync(path.join(d, "design.md")) ? fs.readFileSync(path.join(d, "design.md"), "utf8") : "",
    };
  }
  function stillTimes(d, id) {
    const tl = readJSON(path.join(d, "build", "timeline.json")); const p = tl.paras.find((x) => x.id === id);
    const ts = [p.start + 0.6, ...(p.lines || []).map((l) => p.start + l.t0 + 1.1), p.end - 0.15];
    if (!(p.lines || []).length) ts.splice(1, 0, p.start + (p.end - p.start) * 0.35, p.start + (p.end - p.start) * 0.7);
    return [...new Set(ts.map((t) => +Math.max(0, t).toFixed(2)))];
  }
  function sheet(files, out) {
    const n = files.length, fl = files.map((_, k) => `[${k}]scale=480:-2[s${k}]`).join(";") + ";" + files.map((_, k) => `[s${k}]`).join("") +
      (n === 1 ? "copy" : `xstack=inputs=${n}:layout=${files.map((_, k) => `${(k % 3) * 480}_${Math.floor(k / 3) * 270}`).join("|")}:fill=black`);
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", fl, "-frames:v", "1", "-update", "1", "-q:v", "4", out]);
    if (r.status !== 0) throw new Error("拼图失败");
  }

  // ---------- 接口 ----------
  const api = {
    "GET /api/styles": () => styles(),
    "GET /api/scenes": () => { sceneCache = null; return scenes(); },
    "GET /api/projects": () => projects(),
    "GET /api/project": (q) => project(q.name),
    "POST /api/new": (q, b) => {
      if (!/^[\w-]+$/.test(b.name || "")) throw new Error("项目名只能用字母、数字、下划线、横线");
      const r = spawnSync(process.execPath, [MJV, "new", path.join(PROJECTS, b.name), ...(b.style ? [`--style=${b.style}`] : ["--vibe"])], { cwd: ROOT, encoding: "utf8" });
      if (r.status !== 0) throw new Error(r.stderr || r.stdout); return { ok: true };
    },
    "POST /api/style": (q, b) => {         // 套用风格包：主题、字体写进 project.json（会覆盖原来的 theme）
      const d = projDir(q.name), p = path.join(d, "project.json"), cfg = readJSON(p), st = readJSON(path.join(ROOT, "styles", b.style, "style.json"));
      if (!st) throw new Error("没有风格包 " + b.style);
      cfg.style = st.name; cfg.theme = st.theme; if (st.fonts) cfg.fonts = st.fonts; if (st.fontsToLoad) cfg.fontsToLoad = st.fontsToLoad;
      writeJSON(p, cfg); return { ok: true };
    },
    "POST /api/shot": (q, b) => {          // 换某个镜头的场景
      const d = projDir(q.name), p = path.join(d, "project.json"), cfg = readJSON(p), s = cfg.shots.find((x) => x.id === b.id);
      if (!s) throw new Error("没有镜头 " + b.id); s.scene = b.scene; writeJSON(p, cfg); return { ok: true };
    },
    "POST /api/note": (q, b) => {          // 修改意见：shot 为空 = 整体意见；kind：change 修改 / newscene 需要新画面
      const d = projDir(q.name), p = path.join(d, "review.json"), rv = readJSON(p, { notes: [] });
      if (b.resolve) { const n = rv.notes.find((x) => x.id === b.resolve); if (n) n.status = n.status === "done" ? "open" : "done"; }
      else { if (!String(b.text || "").trim()) throw new Error("意见是空的"); rv.notes.push({ id: "n" + Date.now().toString(36), shot: b.shot || "", kind: b.kind || "change", text: String(b.text).trim(), status: "open", by: "studio", time: new Date().toISOString() }); }
      writeJSON(p, rv); return { ok: true };
    },
    "POST /api/timeline": (q) => { const d = projDir(q.name); return job("时间轴", ["timeline", d]); },
    "POST /api/stills": (q, b) => {
      const d = projDir(q.name);
      if (!fs.existsSync(path.join(d, "build", "timeline.json"))) throw new Error("还没有时间轴，先点「生成时间轴」");
      const ts = stillTimes(d, b.id);
      return job(`静帧 ${b.id}`, ["stills", d, ...ts.map(String)], () => { const dir = path.join(d, "build", "stills"); sheet(ts.map((t) => path.join(dir, `t${t}.png`)).filter((f) => fs.existsSync(f)), path.join(dir, `sheet_${b.id}.jpg`)); });
    },
    "GET /api/job": (q) => { const j = jobs.get(q.id); if (!j) throw new Error("没有任务"); return { id: j.id, label: j.label, status: j.status, out: j.out.slice(-3000) }; },
  };
  async function upload(req, q) {           // 上传：原始请求体，文件名放在 ?file=，kind=refs（参考素材，传完自动分析）或 assets（图片素材）
    const d = projDir(q.name), kind = q.kind === "refs" ? "refs" : "assets", file = path.basename(String(q.file || "")).replace(/[^\w.一-鿿-]+/g, "_");
    if (!file || !/\.(png|jpe?g|webp|gif|mp4|mov|webm|mkv)$/i.test(file)) throw new Error("只支持图片和视频");
    if (kind === "assets" && !/\.(png|jpe?g|webp|gif)$/i.test(file)) throw new Error("图片素材只支持图片");
    const dir = path.join(d, kind); fs.mkdirSync(dir, { recursive: true });
    const dst = path.join(dir, file); let size = 0;
    await new Promise((res, rej) => { const ws = fs.createWriteStream(dst); req.on("data", (c) => { size += c.length; if (size > 500e6) { req.destroy(); rej(new Error("文件超过 500MB")); } }); req.pipe(ws); ws.on("finish", res); ws.on("error", rej); });
    if (kind === "assets") {               // 图片素材自动登记进 project.json 的 images（名字 = 文件名去掉扩展名）
      const p = path.join(d, "project.json"), cfg = readJSON(p); cfg.images = cfg.images || {}; cfg.images[path.parse(file).name] = "assets/" + file; writeJSON(p, cfg);
      return { ok: true, key: path.parse(file).name };
    }
    return job("参考分析 " + file, ["ref", d, dst]);
  }
  function serveFile(req, res, abs) {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.writeHead(404); return res.end("not found"); }
    const st = fs.statSync(abs), type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream", range = req.headers.range;
    if (range) {                            // 视频要支持 Range 才能拖进度条
      const [a, b] = range.replace("bytes=", "").split("-"), s = +a, e = b ? +b : st.size - 1;
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${s}-${e}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": e - s + 1 });
      return fs.createReadStream(abs, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": "no-cache" }); fs.createReadStream(abs).pipe(res);
  }
  const inside = (base, p) => { const r = path.relative(base, p); return r && !r.startsWith("..") && !path.isAbsolute(r); };

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x"), q = Object.fromEntries(u.searchParams), key = `${req.method} ${u.pathname}`;
    const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
    try {
      if (req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)) return send(403, { error: "只接受本机页面的请求" });
      if (key === "POST /api/upload") { const r = await upload(req, q); return send(200, r.id ? { job: r.id } : r); }
      if (api[key]) {
        let body = {}; if (req.method === "POST") { const ch = []; for await (const c of req) ch.push(c); const s = Buffer.concat(ch).toString("utf8"); body = s ? JSON.parse(s) : {}; }
        const r = await api[key](q, body); return send(200, r && r.id && r.status ? { job: r.id } : r);
      }
      if (u.pathname.startsWith("/r/")) { const abs = path.join(ROOT, ...decodeURIComponent(u.pathname.slice(3)).split("/")); if (!inside(ROOT, abs)) return send(403, { error: "路径不允许" }); return serveFile(req, res, abs); }
      if (u.pathname.startsWith("/p/")) { const [, , name, ...rest] = u.pathname.split("/"); const d = projDir(decodeURIComponent(name)); const abs = path.join(d, ...rest.map(decodeURIComponent)); if (!inside(d, abs)) return send(403, { error: "路径不允许" }); return serveFile(req, res, abs); }
      const f = path.join(UI, u.pathname === "/" ? "index.html" : u.pathname.slice(1)); if (!inside(UI, f) && f !== path.join(UI, "index.html")) return send(403, { error: "路径不允许" });
      return serveFile(req, res, f);
    } catch (e) { return send(400, { error: e.message }); }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  const link = `http://127.0.0.1:${port}/`;
  console.log(`✓ 工作台已启动：${link}\n  项目目录：${PROJECTS}\n  关掉这个窗口（或 Ctrl+C）就停止。`);
  if (!flags["no-open"]) spawn(process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open", process.platform === "win32" ? ["/c", "start", "", link] : [link], { stdio: "ignore", detached: true }).unref();
  await new Promise(() => {});
}
