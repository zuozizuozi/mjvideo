// 录屏素材导入 + 分析：node bin/mjv.mjs footage <项目> <录屏文件> [--key=名字]
// 1. 生成代理：H.264、30 帧、每帧都是关键帧（渲染时能精确跳到任意帧），宽度最多 1920，去掉声音（原声另存 wav）
// 2. 分析：每秒画面运动量、镜头切换点、静止 / 黑屏段、高光候选（运动量最高的几段）
// 3. 给 Agent "看"的东西：带时间和 10% 坐标网格的关键帧拼图（全片概览 + 每个高光候选的细看拼图）
// 4. 登记进 project.json 的 videos（名字 = key），报告写在 footage/<key>_report.md
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export async function footage(pdir, file, flags) {
  const ff = (args, opt = {}) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 28, ...opt }); if (r.status !== 0 && !opt.ok) throw new Error("ffmpeg 失败：" + (r.stderr || "").slice(-600)); return r.stderr || ""; };
  const probe = (f) => JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", f], { encoding: "utf8" }).stdout);
  if (!fs.existsSync(file)) throw new Error("找不到录屏：" + file);
  const key = String(flags.key || path.parse(file).name).replace(/[^\w一-鿿-]+/g, "_").slice(0, 40);
  const dir = path.join(pdir, "footage"); fs.mkdirSync(dir, { recursive: true });
  const info = probe(file), vs = info.streams.find((s) => s.codec_type === "video"), hasAudio = info.streams.some((s) => s.codec_type === "audio");
  if (!vs) throw new Error("文件里没有视频流");
  const dur = +info.format.duration, [fn, fd] = vs.r_frame_rate.split("/").map(Number);
  console.log(`录屏：${path.basename(file)}，${vs.width}×${vs.height}，${(fn / fd).toFixed(1)} 帧，${dur.toFixed(1)} 秒${hasAudio ? "，有声音" : "，无声"}`);

  // ---------- 1. 代理 ----------
  const proxy = path.join(dir, key + ".mp4");
  console.log("  生成代理（全关键帧，渲染时能精确取帧）…");
  ff(["-i", file, "-vf", "fps=30,scale='min(1920,iw)':-2:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-g", "1", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", proxy]);
  if (hasAudio) ff(["-i", file, "-vn", "-ac", "2", "-ar", "48000", path.join(dir, key + ".wav")], { ok: true });
  const pinfo = probe(proxy), pv = pinfo.streams.find((s) => s.codec_type === "video"), W = pv.width, H = pv.height;

  // ---------- 2. 分析 ----------
  console.log("  分析运动量和镜头切换…");
  const motionLog = ff(["-i", proxy, "-vf", "scale=160:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"]);
  const perFrame = [...motionLog.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const secs = Math.ceil(dur), motion = Array(secs).fill(0), cnt = Array(secs).fill(0);
  for (const [t, v] of perFrame) { const k = Math.min(secs - 1, Math.floor(t)); motion[k] += v; cnt[k]++; }
  for (let k = 0; k < secs; k++) motion[k] = cnt[k] ? +(motion[k] / cnt[k]).toFixed(2) : 0;
  const lumLog = ff(["-i", proxy, "-vf", "fps=1,scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"]);
  const luma = [...lumLog.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]);
  const cutLog = ff(["-i", proxy, "-vf", "select='gt(scene,0.28)',showinfo", "-an", "-f", "null", "-"]);
  const cuts = [...cutLog.matchAll(/pts_time:([\d.]+)/g)].map((m) => +(+m[1]).toFixed(2));
  const still = motion.map((m, k) => m < 0.35 || (luma[k] ?? 50) < 8);           // 几乎不动或接近全黑：菜单、加载、发呆
  // 高光候选：长度 4 秒的窗口，运动量平均值最高、互不重叠的 8 段（跳过静止段）
  const win = Math.min(4, Math.max(1, secs - 1)), scores = [];
  for (let s = 0; s + win <= secs; s++) { let v = 0, bad = 0; for (let k = s; k < s + win; k++) { v += motion[k]; bad += still[k] ? 1 : 0; } if (bad < win / 2) scores.push({ start: s, end: s + win, score: +(v / win).toFixed(2), cuts: cuts.filter((c) => c >= s && c < s + win).length }); }
  scores.sort((a, b) => b.score - a.score);
  const cands = []; for (const c of scores) { if (cands.length >= 8) break; if (cands.every((x) => c.end <= x.start - 1 || c.start >= x.end + 1)) cands.push(c); }
  cands.sort((a, b) => a.start - b.start);

  // ---------- 3. 拼图 ----------
  const font = process.platform === "win32" ? "C\\:/Windows/Fonts/consola.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
  const label = `drawgrid=w=iw/10:h=ih/10:t=1:c=white@0.22,drawtext=fontfile='${font}':text='%{pts\\:hms}':x=6:y=6:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.6`;
  const tileW = W >= H ? 384 : 216;
  const sheets = [];
  const step = Math.max(1, Math.ceil(dur / 100));                                       // 全片最多约 100 帧
  const nOver = Math.ceil(dur / step / 20);
  for (let i = 0; i < nOver; i++) {
    const out = path.join(dir, `${key}_overview_${String(i + 1).padStart(2, "0")}.jpg`), t0 = i * step * 20;
    ff(["-ss", String(t0), "-t", String(step * 20), "-i", proxy, "-vf", `fps=1/${step},scale=${tileW}:-2,setpts=PTS+${t0}/TB,${label},tile=5x4`, "-frames:v", "1", "-q:v", "4", out]);
    sheets.push({ kind: "全片概览", file: path.basename(out), from: t0, to: Math.min(dur, t0 + step * 20), every: step });
  }
  for (const [n, c] of cands.entries()) {
    const out = path.join(dir, `${key}_hl${n + 1}_${c.start}s.jpg`);
    ff(["-ss", String(c.start), "-t", String(c.end - c.start), "-i", proxy, "-vf", `fps=2,scale=${tileW}:-2,setpts=PTS+${c.start}/TB,${label},tile=4x2`, "-frames:v", "1", "-q:v", "4", out]);
    sheets.push({ kind: `高光候选 ${n + 1}`, file: path.basename(out), from: c.start, to: c.end, every: 0.5 });
  }

  // ---------- 4. 报告 + 登记 ----------
  const bar = (v) => "▁▂▃▄▅▆▇█"[Math.min(7, Math.floor(v / 1.2))];
  const rows = []; for (let s = 0; s < secs; s += 10) rows.push(`| ${String(s).padStart(4)}s | ${motion.slice(s, s + 10).map((v, k) => (still[s + k] ? "·" : bar(v))).join("")} | ${cuts.filter((c) => c >= s && c < s + 10).map((c) => c + "s").join(" ")} |`);
  const meta = { key, source: path.resolve(file), proxy: path.relative(pdir, proxy).replace(/\\/g, "/"), width: W, height: H, duration: +dur.toFixed(2), audio: hasAudio ? `footage/${key}.wav` : null, motion, cuts, still: still.map((x, k) => (x ? k : -1)).filter((k) => k >= 0), candidates: cands, sheets };
  fs.writeFileSync(path.join(dir, key + ".json"), JSON.stringify(meta, null, 1));
  const md = [`# 录屏分析：${key}`, "", `来源：${path.basename(file)}　代理：\`${meta.proxy}\`　${W}×${H}　${dur.toFixed(1)} 秒　${hasAudio ? "有原声（footage/" + key + ".wav）" : "无声"}`, "",
    "拼图说明：每个格子左上角是这一帧在录屏里的时间（时:分:秒.毫秒），**白色细线是 10% 坐标网格**——标注框的位置用 0–1 的比例写（左上角 0,0，右下角 1,1）。", "",
    "## 高光候选（运动量最高、互不重叠的 4 秒窗口）", "", "| # | 时间 | 运动量 | 镜头切换 | 细看拼图 |", "|---|---|---|---|---|",
    ...cands.map((c, n) => `| ${n + 1} | ${c.start}–${c.end}s | ${c.score} | ${c.cuts} | ${key}_hl${n + 1}_${c.start}s.jpg |`), "",
    "## 每秒运动量（每格一秒；· = 静止或黑屏，多半是菜单 / 加载 / 发呆，剪掉）", "", "| 起点 | 运动 | 镜头切换 |", "|---|---|---|", ...rows, "",
    "## 拼图", "", ...sheets.map((s) => `- ${s.kind}：\`${s.file}\`（${s.from}–${s.to}s，每 ${s.every}s 一帧）`), "",
    "下一步：看拼图写剪辑和解说。镜头用 `footage_play` 场景，`params.video` 填 `" + key + "`，`params.in` 填录屏里的开始秒数。"].join("\n");
  fs.writeFileSync(path.join(dir, key + "_report.md"), md);
  const pj = path.join(pdir, "project.json"), cfg = JSON.parse(fs.readFileSync(pj, "utf8"));
  cfg.videos = { ...(cfg.videos || {}), [key]: meta.proxy };
  fs.writeFileSync(pj, JSON.stringify(cfg, null, 2));
  console.log(`✓ 已导入「${key}」：代理 ${meta.proxy}，高光候选 ${cands.length} 段，拼图 ${sheets.length} 张\n  报告：${path.join(dir, key + "_report.md")}`);
  return meta;
}
