#!/usr/bin/env node
// mjvideo MCP 服务（stdio，零 npm 依赖）：把 mjv 命令行包成 MCP 工具，给 Codex / Claude Code / Zaovra / Cursor 等 Agent 调用。
//
//   node mcp/server.mjs
//
// 设计要点：
//   · 渲染、配乐这类命令可能跑几分钟，而有的客户端工具超时只有 5 秒。所以所有命令都在后台跑成"任务"：
//     调用时最多等 wait_seconds 秒，跑完直接返回结果；没跑完返回 job_id，之后用 mjv_job 查进度 / 取结果。
//   · 出静帧（mjv_stills）会把每个镜头的静帧拼成一张图，作为图片直接返回给 Agent 看。
//   · 只开放 mjv 的固定命令，不执行任意 shell。改场景代码、project.json 用 Agent 自己的文件编辑工具。
// 环境变量：MJV_PROJECTS 项目目录（默认 <引擎>/projects）；MJV_MCP_WAIT 默认等待秒数（默认 3.5）；
//           MJV_CHROME / MJV_PYTHON 同命令行。
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = path.resolve(process.env.MJV_PROJECTS || path.join(ROOT, "projects"));
const DEFAULT_WAIT = Number(process.env.MJV_MCP_WAIT || 3.5);
const VERSION = "0.5.0";
const log = (...a) => process.stderr.write("[mjvideo-mcp] " + a.join(" ") + "\n");   // stdout 只能写协议消息

// ---------------- 工具定义 ----------------
const projectProp = { type: "string", description: "项目名（在项目目录下）或项目的绝对路径" };
const waitProp = { type: "number", description: `最多等待多少秒再返回（默认 ${DEFAULT_WAIT}，最大 50）。没跑完会返回 job_id，用 mjv_job 继续查` };
const TOOLS = [
  { name: "mjv_guide",
    description: "读取 mjvideo 引擎的完整使用手册（SKILL.md）：工作流、场景编写规范、project.json 格式、无口播 Vibe 风格、常见错误。第一次用本引擎时必须先读。",
    inputSchema: { type: "object", properties: {
      doc: { type: "string", enum: ["skill", "visual", "art", "case", "gameplay"], description: "gameplay 试玩解说指南 / skill 使用手册（默认）/ visual 视觉手法（怎么把一句话变成画面、比喻库、动效、运镜、字幕样式、画风、什么时候问用户）/ art 美术指导流程 / case EP09 案例" },
      section: { type: "string", description: "只看某一节：填节号（如 \"2\"、\"11\"）或关键词；不填返回全文" } } } },
  { name: "mjv_scenes",
    description: "列出场景库（以及某个项目自带的场景）：名字、用途说明、尺寸、可调参数和 cues。选场景前先看这个。",
    inputSchema: { type: "object", properties: { project: projectProp } } },
  { name: "mjv_new_project",
    description: "新建一个视频项目，返回项目路径和 project.json 模板。template=gameplay：试玩解说（竖屏、配音、录屏片段，见 mjv_guide doc=gameplay）；vibe=true：无口播横屏（字幕 + 配乐）；都不写：竖屏配音讲解。style=风格包名（见 mjv_styles）会把该风格的主题写进 project.json。",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "项目名，只用字母数字下划线" }, template: { type: "string", enum: ["gameplay"] }, vibe: { type: "boolean" }, style: { type: "string", description: "风格包名，如 paper / neon / cinema" }, game: { type: "string", description: "试玩解说：游戏 slug（见 mjv_games）" } }, required: ["name"] } },
  { name: "mjv_styles",
    description: "列出风格包（styles/）：名字、气质、适合的话题。风格包是起点，不是终点：选一个后可以在 project.json 的 theme 里改配色、字体、纹理，或者完全自己定。",
    inputSchema: { type: "object", properties: {} } },
  { name: "mjv_ref",
    description: "分析参考图 / 参考视频（本机文件路径）：复制到项目 refs/，生成关键帧拼图（视频按时间取 24 帧）、主色和强调色色板、镜头切换节奏和运动量报告，并把拼图和色板作为图片返回。用来提炼风格写美术方案，不是照抄。录屏素材最好先裁掉手机界面。",
    inputSchema: { type: "object", properties: { project: projectProp, files: { type: "array", items: { type: "string" }, description: "参考素材的绝对路径（图片、视频或文件夹）" }, wait_seconds: waitProp }, required: ["project", "files"] } },
  { name: "mjv_footage",
    description: "导入一段录屏（本机路径）到项目：生成可精确取帧的代理、分析每秒运动量 / 镜头切换 / 静止段 / 高光候选，返回分析报告和带时间、10% 坐标网格的关键帧拼图（图片）。写试玩解说前用它'看'录屏。长录屏会跑一阵子，没跑完返回 job_id。",
    inputSchema: { type: "object", properties: { project: projectProp, file: { type: "string", description: "录屏文件的绝对路径" }, key: { type: "string", description: "给这段录屏起的名字（字母数字下划线），不填用文件名" }, wait_seconds: waitProp }, required: ["project", "file"] } },
  { name: "mjv_games",
    description: "已登记的游戏：名字、一句话介绍、单文件大小、源码行数、提交次数和日期、文档路径（README / DESIGN / PROGRESS，写解说前要读）、拍视频建议。给 slug 返回单个游戏的完整信息。新游戏用 mjv_run 以外的命令行 `node bin/mjv.mjs game add <仓库目录>` 登记，或在这里传 repo 登记。",
    inputSchema: { type: "object", properties: { slug: { type: "string" }, repo: { type: "string", description: "要登记 / 刷新的游戏仓库目录（绝对路径）" } } } },
  { name: "mjv_cover",
    description: "生成封面：从录屏里取一帧，叠大字标题，输出 output/封面_3x4.jpg 和 封面_9x16.jpg，并把 3:4 那张作为图片返回。标题用 | 换行，每行 ≤ 8 字。",
    inputSchema: { type: "object", properties: { project: projectProp, video: { type: "string" }, t: { type: "number", description: "取录屏第几秒" }, title: { type: "string" }, sub: { type: "string" } }, required: ["project", "title"] } },
  { name: "mjv_history",
    description: "列出以往所有项目的长相：标题、风格包、后期画风、主配色、美术方案摘要（design.md）。写新美术方案前用它做防重复检查：新方案要和以往每一期在视觉概念、主配色、动效语言、招牌镜头手法四项里至少三项不同。",
    inputSchema: { type: "object", properties: {} } },
  { name: "mjv_notes",
    description: "读用户在工作台（mjv studio）里写的修改意见：每条有镜头号、类型（change 修改 / newscene 需要新画面）、内容、状态。处理完一条就用 done 把它标成已完成（可附一句 reply 说明怎么改的）。开工前和交付前都要看一遍。",
    inputSchema: { type: "object", properties: { project: projectProp, done: { type: "array", items: { type: "string" }, description: "要标成已完成的意见 id" }, reply: { type: "string", description: "给这些意见的回复（可选）" }, all: { type: "boolean", description: "连已完成的也列出来" } }, required: ["project"] } },
  { name: "mjv_project_info",
    description: "查看项目状态：路径、镜头列表和时长（来自时间轴）、最近一次质检结果、成片路径。",
    inputSchema: { type: "object", properties: { project: projectProp }, required: ["project"] } },
  { name: "mjv_run",
    description: "运行引擎命令（后台任务）。command：tts 配音 / timeline 时间轴 / check 加载检查 / render 渲染（增量）/ audio 配乐混音 / mux 合成成片 / validate 质检 / build 一条龙（tts→validate）/ promote 把项目场景收进场景库。render 可带 only（逗号分隔镜头 id）、force、dry；promote 要带 scene。",
    inputSchema: { type: "object", properties: {
      command: { type: "string", enum: ["tts", "timeline", "check", "render", "audio", "mux", "validate", "build", "promote"] },
      project: projectProp,
      only: { type: "string", description: "render：只渲这些镜头，逗号分隔（注意不会带上相邻镜头，之后要再跑一次普通 render）" },
      force: { type: "boolean", description: "render：全部重渲；promote：覆盖库里同名场景" },
      dry: { type: "boolean", description: "render：只看哪些镜头需要重渲" },
      scene: { type: "string", description: "promote：场景名" },
      wait_seconds: waitProp }, required: ["command", "project"] } },
  { name: "mjv_stills",
    description: "抽静帧自查：渲染指定时间点的画面，按镜头拼成拼图并作为图片返回。不给 times 时自动取每个镜头的开头、每句字幕出现后 1.1 秒和结尾。改完场景代码后用它看效果，满意再 render。",
    inputSchema: { type: "object", properties: {
      project: projectProp,
      shots: { type: "array", items: { type: "string" }, description: "只看这些镜头（如 [\"s03\",\"s05\"]）；不填看全部（镜头多时建议分批，每次 ≤ 6 个）" },
      times: { type: "array", items: { type: "number" }, description: "自己指定全片时间点（秒）。给了就不按镜头自动取" },
      wait_seconds: waitProp }, required: ["project"] } },
  { name: "mjv_job",
    description: "查后台任务：状态、退出码、日志末尾；任务完成时返回它的结果（mjv_stills 的任务会带图片）。",
    inputSchema: { type: "object", properties: { job_id: { type: "string" }, wait_seconds: waitProp }, required: ["job_id"] } },
];

// ---------------- 工具实现 ----------------
const text = (t) => ({ type: "text", text: t });
const fail = (m) => ({ content: [text("✗ " + m)], isError: true });

function resolveProject(p) {
  if (!p) throw new Error("缺少 project");
  const cands = path.isAbsolute(p) ? [p] : [path.join(PROJECTS, p), path.resolve(ROOT, p)];
  const hit = cands.find((d) => fs.existsSync(path.join(d, "project.json")));
  if (!hit) throw new Error(`找不到项目「${p}」（找过：${cands.join("、")}）`);
  return hit;
}

const jobs = new Map(); let jobSeq = 0;
function startJob(label, args, { cwd = ROOT, after } = {}) {
  const id = `j${++jobSeq}-${Date.now().toString(36)}`;
  const job = { id, label, out: "", status: "running", code: null, started: Date.now(), result: null, after };
  const child = spawn(process.execPath, [path.join(ROOT, "bin", "mjv.mjs"), ...args], { cwd, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  const onData = (d) => { job.out += d.toString(); if (job.out.length > 200000) job.out = job.out.slice(-100000); };
  child.stdout.on("data", onData); child.stderr.on("data", onData);
  job.done = new Promise((res) => child.on("close", async (code) => {
    job.code = code;
    try { if (code === 0 && after) job.result = await after(job); } catch (e) { job.out += "\n结果整理失败：" + e.message; }
    job.status = code === 0 ? "done" : "failed"; res();
  }));
  jobs.set(id, job); return job;
}
async function waitJob(job, seconds) {
  const s = Math.min(50, Math.max(0, seconds ?? DEFAULT_WAIT));
  await Promise.race([job.done, new Promise((r) => setTimeout(r, s * 1000))]);
  return jobReport(job);
}
function jobReport(job) {
  const secs = ((Date.now() - job.started) / 1000).toFixed(0);
  const tail = job.out.trim().split("\n").filter((l) => !/stills[\\/]t[\d.]+\.png\s*$/.test(l)).slice(-25).join("\n");   // 静帧路径太多，只留拼图
  if (job.status === "running") return { content: [text(`⏳ 任务 ${job.id}（${job.label}）还在运行，已 ${secs}s。用 mjv_job 查进度：{"job_id":"${job.id}"}\n--- 日志末尾 ---\n${tail}`)] };
  const head = job.status === "done" ? `✓ ${job.label} 完成（${secs}s）` : `✗ ${job.label} 失败（退出码 ${job.code}，${secs}s）`;
  const content = [text(`${head}\n--- 输出 ---\n${tail}`)];
  if (job.result) content.push(...job.result);
  return { content, isError: job.status === "failed" };
}

function stillTimes(pdir, shots) {
  const tl = JSON.parse(fs.readFileSync(path.join(pdir, "build", "timeline.json"), "utf8"));
  return tl.paras.filter((p) => !shots || shots.includes(p.id)).map((p) => {
    const ts = [p.start + 0.6];
    if (p.lines && p.lines.length) for (const l of p.lines) ts.push(p.start + l.t0 + 1.1);
    else for (const f of [0.35, 0.7]) ts.push(p.start + (p.end - p.start) * f);
    ts.push(p.end - 0.15);
    return { id: p.id, times: [...new Set(ts.map((x) => +Math.max(0, x).toFixed(2)))] };
  });
}
function sheet(files, out) {           // 把若干静帧拼成每行 3 张、每张 640 宽的拼图
  const n = files.length, inp = files.flatMap((f) => ["-i", f]);
  const fl = files.map((_, k) => `[${k}]scale=640:-2[s${k}]`).join(";") + ";" + files.map((_, k) => `[s${k}]`).join("") +
    (n === 1 ? "copy" : `xstack=inputs=${n}:layout=${files.map((_, k) => `${(k % 3) * 640}_${Math.floor(k / 3) * 360}`).join("|")}:fill=black`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...inp, "-filter_complex", fl, "-frames:v", "1", "-update", "1", "-q:v", "4", out]);
  if (r.status !== 0) throw new Error("拼图失败：" + r.stderr.toString().slice(-300));
  return out;
}

const handlers = {
  async mjv_guide({ section, doc } = {}) {
    const DOCS = { skill: "SKILL.md", visual: "docs/视觉手法.md", art: "prompts/art_director.md", case: "docs/案例_EP09.md", gameplay: "prompts/game_commentary.md" };
    const md = fs.readFileSync(path.join(ROOT, DOCS[doc || "skill"] || DOCS.skill), "utf8");
    const info = `引擎目录：${ROOT}\n项目目录：${PROJECTS}\n（改 project.json 和场景代码用你自己的文件编辑工具；跑命令用 mjv_run / mjv_stills）\n\n`;
    if (!section) return { content: [text(info + md)] };
    const parts = md.split(/\n(?=## )/);   // 视觉手法里的节号是"一、二、三……"，按关键词找即可
    const sec = String(section).trim();
    const hit = /^\d+$/.test(sec) ? parts.filter((s) => s.startsWith(`## ${sec}.`))          // 节号只按标题匹配
      : parts.filter((s) => s.toLowerCase().includes(sec.toLowerCase()));
    return { content: [text(info + (hit.length ? hit.join("\n") : `没有找到「${section}」，各节标题：\n` + parts.map((s) => s.split("\n")[0]).join("\n")))] };
  },
  async mjv_scenes({ project } = {}) {
    const args = ["scenes"]; if (project) args.push(resolveProject(project));
    return waitJob(startJob("scenes", args), 20);
  },
  async mjv_new_project({ name, vibe, style, template, game }) {
    if (!/^[\w-]+$/.test(name || "")) return fail("项目名只能用字母、数字、下划线、横线");
    if (style && !/^[\w-]+$/.test(style)) return fail("风格包名不合法");
    const pdir = path.join(PROJECTS, name);
    const job = startJob("new", ["new", pdir, ...(vibe ? ["--vibe"] : []), ...(style ? [`--style=${style}`] : []), ...(template ? [`--template=${template}`] : [])]);
    await job.done;
    if (job.status !== "done") return jobReport(job);
    if (game) { const pj = path.join(pdir, "project.json"), c = JSON.parse(fs.readFileSync(pj, "utf8")); c.game = game; fs.writeFileSync(pj, JSON.stringify(c, null, 2)); }
    const next = template === "gameplay" ? `下一步（试玩解说，按 mjv_guide doc=gameplay 的流程）：
1. mjv_games 读游戏资料（slug ${game || "?"}），读它的 README / DESIGN / PROGRESS。
2. mjv_footage 导入用户给的录屏，看报告和拼图，挑高光。
3. 写分镜：每个镜头一句解说（text）+ 用哪段录屏（params.in）+ 版式 / 标注；穿插 stat_cards / milestone_timeline / doc_quote 讲制作过程。
4. 配音 tts → timeline → check → mjv_stills 抽帧核对"画面和解说对不对得上"。
5. 把脚本和静帧发给用户确认（用户说"直接出"就跳过）→ render → audio → mux → validate → mjv_cover → 写标题和发布文案。
用户可能在工作台里留了意见：随时用 mjv_notes 看。` : vibe || style ? `下一步（按顺序）：
1. 写文案分镜（每个镜头的 lines），给用户确认。
2. 美术方案：读 mjv_guide doc=art（流程）和 doc=visual（比喻库、动效、运镜、画风），用 mjv_history 做防重复检查，用 mjv_styles 看风格包。
   给用户 2–3 个差别明显的方案，每个先在一两个关键镜头上做出来，用 mjv_stills 出静帧一起给用户看，**等用户选**。
3. 选定后写 design.md、改 project.json 的 theme，按方案写场景（新画面写在 ${path.join(pdir, "scenes")}，颜色字体从 MJ.theme 取）。
4. mjv_run timeline / check → mjv_stills 逐镜头看 → 用户确认 → render → audio → mux → validate。
用户可能在工作台里留了意见：随时用 mjv_notes 看。` : `下一步：改 project.json（格式见 mjv_guide），需要新画面时在 ${path.join(pdir, "scenes")} 写场景。`;
    return { content: [text(`✓ 新项目：${pdir}\n${next}\n\n--- project.json ---\n` + fs.readFileSync(path.join(pdir, "project.json"), "utf8"))] };
  },
  async mjv_styles() { return waitJob(startJob("styles", ["styles"]), 20); },
  async mjv_ref({ project, files, wait_seconds }) {
    const pdir = resolveProject(project);
    const list = (files || []).map((f) => path.resolve(f));
    const missing = list.filter((f) => !fs.existsSync(f)); if (missing.length) return fail("找不到：" + missing.join("、"));
    const refs = path.join(pdir, "refs"), before = new Set(fs.existsSync(refs) ? fs.readdirSync(refs) : []);
    const after = async () => {
      const outs = [text(fs.readFileSync(path.join(refs, "ref_report.md"), "utf8"))];
      for (const f of fs.readdirSync(refs).filter((x) => /^(sheet|palette)_.*\.(jpg|png)$/.test(x) && !before.has(x)).sort())
        outs.push(text(f), { type: "image", data: fs.readFileSync(path.join(refs, f)).toString("base64"), mimeType: f.endsWith(".png") ? "image/png" : "image/jpeg" });
      return outs;
    };
    return waitJob(startJob(`ref ${path.basename(pdir)}`, ["ref", pdir, ...list], { after }), wait_seconds);
  },
  async mjv_footage({ project, file, key, wait_seconds }) {
    const pdir = resolveProject(project), f = path.resolve(file || "");
    if (!fs.existsSync(f)) return fail("找不到录屏：" + f);
    const k = String(key || path.parse(f).name).replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 40);
    const after = async () => {
      const dir = path.join(pdir, "footage"), meta = JSON.parse(fs.readFileSync(path.join(dir, k + ".json"), "utf8"));
      const outs = [text(fs.readFileSync(path.join(dir, k + "_report.md"), "utf8"))];
      const pick = [...meta.sheets.filter((x) => x.kind === "全片概览").slice(0, 5), ...meta.sheets.filter((x) => x.kind !== "全片概览").slice(0, 4)];
      for (const sh of pick) outs.push(text(`${sh.kind}：${sh.file}（${sh.from}–${sh.to}s）`), { type: "image", data: fs.readFileSync(path.join(dir, sh.file)).toString("base64"), mimeType: "image/jpeg" });
      const rest = meta.sheets.length - pick.length; if (rest > 0) outs.push(text(`另有 ${rest} 张拼图在 ${dir}，需要时用文件工具读。`));
      return outs;
    };
    return waitJob(startJob(`footage ${k}`, ["footage", pdir, f, `--key=${k}`], { after }), wait_seconds ?? 20);
  },
  async mjv_games({ slug, repo }) {
    if (repo) { const j = startJob("game add", ["game", "add", path.resolve(repo)]); await j.done; if (j.status !== "done") return jobReport(j); }
    const dir = path.join(ROOT, "games"), all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) : [];
    if (slug) { const g = all.find((x) => x.slug === slug); return g ? { content: [text(JSON.stringify(g, null, 2) + "\n\n写解说前读这些文档：" + g.docs.join("、"))] } : fail("没有登记 " + slug); }
    return { content: [text(all.map((g) => `- ${g.slug}：${g.name}｜${g.facts.sizeKB ?? "?"} KB 单文件，${g.facts.srcLines} 行源码，${g.facts.commits} 次提交（${g.facts.firstCommit} → ${g.facts.lastCommit}）${g.facts.zeroExternalArt ? "，零外部美术" : ""}\n  ${g.intro}`).join("\n") || "还没有登记的游戏。")] };
  },
  async mjv_cover({ project, video, t, title, sub }) {
    const pdir = resolveProject(project), args = ["cover", pdir, `--title=${title}`];
    if (video) args.push(`--video=${video}`); if (t != null) args.push(`--t=${t}`); if (sub) args.push(`--sub=${sub}`);
    const after = async () => { const f = path.join(pdir, "output", "封面_3x4.jpg"); return [{ type: "image", data: fs.readFileSync(f).toString("base64"), mimeType: "image/jpeg" }]; };
    return waitJob(startJob("cover", args, { after }), 30);
  },
  async mjv_history() {
    const rows = [];
    for (const n of fs.existsSync(PROJECTS) ? fs.readdirSync(PROJECTS) : []) {
      const d = path.join(PROJECTS, n), pj = path.join(d, "project.json"); if (!fs.existsSync(pj)) continue;
      let cfg; try { cfg = JSON.parse(fs.readFileSync(pj, "utf8")); } catch { continue; }
      const th = cfg.theme || {}, dz = path.join(d, "design.md");
      const design = fs.existsSync(dz) ? fs.readFileSync(dz, "utf8").split("\n").filter((l) => /^\s*[-*]/.test(l)).slice(0, 6).join("\n") : "（没有 design.md）";
      rows.push(`## ${n}：${cfg.title || ""}\n风格包 ${cfg.style || th.name || "默认"}；后期 ${th.post ? th.post.preset || "自定义" : "无"}；${th.mode === "light" ? "浅底" : "深底"}；底 ${th.bg?.center || "#12172c"}，强调 ${th.accent || "#f3c46b"}；镜头 ${(cfg.shots || []).length} 个\n${design}`);
    }
    for (const f of fs.readdirSync(path.join(ROOT, "docs")).filter((x) => x.startsWith("案例_"))) rows.push(`## ${f}（案例文档，见 mjv_guide doc=case）`);
    return { content: [text(rows.join("\n\n") || "还没有以往项目。")] };
  },
  async mjv_notes({ project, done, reply, all }) {
    const pdir = resolveProject(project), p = path.join(pdir, "review.json");
    const rv = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { notes: [] };
    if (done && done.length) {
      for (const n of rv.notes) if (done.includes(n.id)) { n.status = "done"; n.doneAt = new Date().toISOString(); if (reply) n.reply = reply; }
      fs.writeFileSync(p, JSON.stringify(rv, null, 2));
    }
    const list = rv.notes.filter((n) => all || n.status !== "done");
    if (!list.length) return { content: [text(done && done.length ? `✓ 已标记完成。没有未处理的意见了。` : "没有未处理的意见。")] };
    return { content: [text((done && done.length ? `✓ 已标记 ${done.length} 条完成。\n` : "") + `${all ? "全部" : "未处理的"}意见（${list.length} 条）：\n` +
      list.map((n) => `- [${n.id}] ${n.shot || "整体"} · ${n.kind === "newscene" ? "需要新画面" : "修改"}${n.status === "done" ? " · 已完成" : ""}：${n.text}${n.reply ? `（回复：${n.reply}）` : ""}`).join("\n"))] };
  },
  async mjv_project_info({ project }) {
    const pdir = resolveProject(project), b = (...p) => path.join(pdir, "build", ...p);
    const cfg = JSON.parse(fs.readFileSync(path.join(pdir, "project.json"), "utf8"));
    let s = `项目：${pdir}\n标题：${cfg.title || ""}\n画幅：${(cfg.format || {}).width || 1080}×${(cfg.format || {}).height || 1920}；配音：${(cfg.voice || {}).engine || "edge"}；镜头 ${cfg.shots.length} 个\n`;
    if (fs.existsSync(b("timeline.json"))) {
      const tl = JSON.parse(fs.readFileSync(b("timeline.json"), "utf8"));
      s += `\n时间轴：总时长 ${tl.total.toFixed(2)}s\n` + tl.paras.map((p) => `  ${p.id}  ${p.scene.padEnd(22)} ${p.start.toFixed(2)}–${p.end.toFixed(2)}s`).join("\n") + "\n";
    } else s += "\n还没有时间轴（先 mjv_run timeline，有配音的项目先 tts）\n";
    if (fs.existsSync(b("validation.json"))) { const v = JSON.parse(fs.readFileSync(b("validation.json"), "utf8")); s += `\n最近一次质检：${v.ok ? "通过" : "未通过"}\n` + [...v.info, ...v.warns.map((w) => "WARN " + w), ...v.fails.map((f) => "FAIL " + f)].map((x) => "  " + x).join("\n") + "\n"; }
    const out = path.join(pdir, "output", cfg.output_name || "成片.mp4");
    s += fs.existsSync(out) ? `\n成片：${out}（${(fs.statSync(out).size / 1e6).toFixed(1)} MB）` : "\n还没有成片";
    return { content: [text(s)] };
  },
  async mjv_run({ command, project, only, force, dry, scene, wait_seconds }) {
    const CMDS = ["tts", "timeline", "check", "render", "audio", "mux", "validate", "build", "promote"];
    if (!CMDS.includes(command)) return fail(`不支持的命令「${command}」，可用：${CMDS.join(" / ")}`);
    const pdir = resolveProject(project), args = [command, pdir];
    if (command === "promote") { if (!scene) return fail("promote 需要 scene"); args.push(scene); if (force) args.push("--force"); }
    if (command === "render") { if (only) args.push(`--only=${only}`); if (force) args.push("--force"); if (dry) args.push("--dry"); }
    return waitJob(startJob(`${command} ${path.basename(pdir)}`, args), wait_seconds);
  },
  async mjv_stills({ project, shots, times, wait_seconds }) {
    const pdir = resolveProject(project);
    if (!fs.existsSync(path.join(pdir, "build", "timeline.json"))) return fail("还没有时间轴，先 mjv_run timeline（有配音的项目先 tts）");
    const groups = times && times.length ? [{ id: "custom", times: times.map((t) => +(+t).toFixed(2)) }] : stillTimes(pdir, shots);
    if (!groups.length) return fail("没有匹配的镜头：" + (shots || []).join(","));
    if (groups.length > 8) return fail(`一次最多看 8 个镜头（这次 ${groups.length} 个），请用 shots 分批`);
    const all = [...new Set(groups.flatMap((g) => g.times))];
    const after = async () => {
      const dir = path.join(pdir, "build", "stills"), outs = [];
      for (const g of groups) {
        const files = g.times.map((t) => path.join(dir, `t${t}.png`)).filter((f) => fs.existsSync(f));
        if (!files.length) continue;
        const out = sheet(files, path.join(dir, `sheet_${g.id}.jpg`));
        outs.push(text(`${g.id}：${g.times.join("s、")}s（从左到右、从上到下）→ ${out}`), { type: "image", data: fs.readFileSync(out).toString("base64"), mimeType: "image/jpeg" });
      }
      return outs;
    };
    return waitJob(startJob(`stills ${path.basename(pdir)}`, ["stills", pdir, ...all.map(String)], { after }), wait_seconds);
  },
  async mjv_job({ job_id, wait_seconds }) {
    const job = jobs.get(job_id);
    if (!job) return fail(`没有任务 ${job_id}（服务重启后任务记录会丢失；渲染日志在项目 build 目录里）`);
    return waitJob(job, wait_seconds);
  },
};

// ---------------- MCP 协议（JSON-RPC 2.0，按行分隔） ----------------
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyErr = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    const v = SUPPORTED.includes(params?.protocolVersion) ? params.protocolVersion : SUPPORTED[0];
    return reply(id, { protocolVersion: v, capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mjvideo", version: VERSION },
      instructions: "mjvideo：用代码（Canvas + 无头 Chrome + FFmpeg）做讲解视频的引擎，不调用视频生成模型。第一次使用先调 mjv_guide 读手册。流程：mjv_new_project（可选 style）→ 有参考素材先 mjv_ref → 用户可能在工作台（mjv studio）里选了风格、换了场景、写了意见，先 mjv_notes 读意见 → 写美术方案 design.md、改 project.json 的 theme 和场景代码 → mjv_run timeline/check → mjv_stills 看画面并修改 → mjv_run render → audio → mux → validate。风格和画面自由发挥，场景库只是零件。长任务会返回 job_id，用 mjv_job 查。" });
  }
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS });
  if (method === "tools/call") {
    const h = handlers[params?.name];
    if (!h) return replyErr(id, -32602, "未知工具：" + params?.name);
    try { return reply(id, await h(params.arguments || {})); }
    catch (e) { return reply(id, fail(e.message)); }
  }
  if (id !== undefined && id !== null) return replyErr(id, -32601, "不支持的方法：" + method);   // 通知（没有 id）直接忽略
}

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return log("无法解析：", line.slice(0, 200)); }
  handle(msg).catch((e) => { log(e.stack); if (msg.id != null) replyErr(msg.id, -32603, e.message); });
});
process.stdin.on("end", () => process.exit(0));
log(`已启动 v${VERSION}，引擎 ${ROOT}，项目 ${PROJECTS}`);
