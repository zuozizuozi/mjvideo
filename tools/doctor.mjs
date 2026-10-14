// 环境检查：node bin/mjv.mjs doctor [--online] [--json]
// 每台新电脑、每次开工前跑一次。逐项报告缺什么、怎么装；Agent 看到 ✗ 要告诉用户，不要自己默默绕过。
//   --online：顺便试一下微软在线配音能不能连通（会合成一个字）
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function doctor(ROOT, flags, CHROME, PY) {
  const rows = [];
  const add = (ok, name, detail, fix = "") => rows.push({ ok, name, detail, fix });
  const run = (c, a, o = {}) => spawnSync(c, a, { encoding: "utf8", ...o });
  const nodeMajor = +process.versions.node.split(".")[0];
  add(nodeMajor >= 22 ? "ok" : "bad", "Node.js", process.versions.node, "装 Node 22 以上");
  const ff = run("ffmpeg", ["-hide_banner", "-encoders"]);
  add(ff.status === 0 && /libx264/.test(ff.stdout) ? "ok" : "bad", "FFmpeg + libx264", ff.status === 0 ? (/libx264/.test(ff.stdout) ? "有" : "缺 libx264") : "没找到 ffmpeg", "装带 libx264 的 FFmpeg，并加进 PATH");
  add(fs.existsSync(CHROME) ? "ok" : "bad", "Chrome", CHROME, "装 Google Chrome，或设环境变量 MJV_CHROME 指向 chrome");
  const py = run(PY, ["-c", "import sys,importlib.metadata as m;print(sys.version.split()[0]);[print(p, m.version(p)) for p in ('edge-tts','Pillow','jieba')]"]);
  if (py.status !== 0) add("bad", "Python", py.stderr.split("\n").filter(Boolean).pop() || "没找到", `pip install edge-tts pillow jieba（Python 3.8+）`);
  else {
    const L = py.stdout.trim().split("\n"); add("ok", "Python", L[0]);
    const ver = Object.fromEntries(L.slice(1).map((l) => l.split(" ")));
    const et = ver["edge-tts"] || "", [a, b] = et.split(".").map(Number);
    add(a > 7 || (a === 7 && b >= 3) ? "ok" : "bad", "edge-tts（免费 AI 配音）", et || "没装", "pip install -U edge-tts（7.3 以下会被微软拒绝：403）");
  }
  if (flags.online) {
    const r = run(PY, ["-c", "import asyncio,edge_tts\nasync def m():\n  c=edge_tts.Communicate('好','zh-CN-YunxiNeural')\n  n=0\n  async for ch in c.stream():\n    n+=ch['type']=='audio'\n  print(n)\nasyncio.run(m())"], { timeout: 30000 });
    add(r.status === 0 && +r.stdout.trim() > 0 ? "ok" : "bad", "微软在线配音连通", r.status === 0 ? "能连上" : (r.stderr || "").split("\n").filter(Boolean).pop()?.slice(0, 120) || "失败", "检查网络；403 就升级 edge-tts");
  }
  // 本人音色
  const cfgP = process.env.MJV_VOICE_CONFIG || path.join(os.homedir(), ".mjvideo", "voice.json");
  if (!fs.existsSync(cfgP)) add("warn", "本人音色", "这台电脑没装", "node bin/mjv.mjs voice install，再 voice setup --ref=<本人录音.wav>（见 docs/本人音色.md）。没装时 voice.engine=clone 的项目会改用 AI 声音（有 fallback 时）或报错");
  else {
    const c = JSON.parse(fs.readFileSync(cfgP, "utf8"));
    if (!fs.existsSync(c.python || "")) add("bad", "本人音色", "语音环境不存在：" + c.python, "node bin/mjv.mjs voice install");
    else if (!fs.existsSync(c.ref_audio || "")) add("warn", "本人音色", "环境装好了，还没设参考录音", "node bin/mjv.mjs voice setup --ref=<本人录音.wav>");
    else add(c.x_vector_only ? "warn" : "ok", "本人音色", c.x_vector_only ? "可用（只取音色特征：参考录音的逐字稿还没核对）" : "可用（完整克隆）", c.x_vector_only ? "请本人核对逐字稿：node bin/mjv.mjs voice setup --text=\"…\"（草稿在 voice status 里）" : "");
  }
  const fonts = ["NotoSerifSC-Bold.otf", "NotoSerifSC-Black.otf"].filter((f) => !fs.existsSync(path.join(ROOT, "assets", "fonts", f)));
  add(fonts.length ? "bad" : "ok", "字体（思源宋体）", fonts.length ? "缺 " + fonts.join("、") : "有", "git pull 拉全仓库（字体在 assets/fonts）");
  const games = fs.existsSync(path.join(ROOT, "games")) ? fs.readdirSync(path.join(ROOT, "games")).filter((f) => f.endsWith(".json")) : [];
  const badRepo = games.map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "games", f), "utf8"))).filter((g) => !fs.existsSync(g.repo));
  add(badRepo.length ? "warn" : "ok", "游戏仓库（试玩解说）", badRepo.length ? `这台电脑上找不到：${badRepo.map((g) => g.slug + " → " + g.repo).join("；")}` : `${games.length} 个都在`, "把游戏仓库克隆到同样的位置，或在新位置重新 node bin/mjv.mjs game add <仓库>（数字会刷新）");
  if (flags.json) return rows;
  if (flags["json-out"]) { console.log(JSON.stringify(rows)); return rows; }
  const icon = { ok: "✓", warn: "⚠", bad: "✗" };
  for (const r of rows) console.log(`${icon[r.ok]} ${r.name.padEnd(18)} ${r.detail}${r.ok !== "ok" && r.fix ? `\n    → ${r.fix}` : ""}`);
  const bad = rows.filter((r) => r.ok === "bad").length, warn = rows.filter((r) => r.ok === "warn").length;
  console.log(bad ? `\n✗ 有 ${bad} 项必须先处理` : warn ? `\n⚠ 能用，有 ${warn} 项提醒` : "\n✓ 环境齐全");
  return rows;
}
