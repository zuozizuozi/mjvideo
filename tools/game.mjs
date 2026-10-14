// 游戏登记：node bin/mjv.mjs game add <游戏仓库目录> [--slug=名字]   /   node bin/mjv.mjs game list
// 从游戏仓库自动读出解说能用的事实，写到 games/<slug>.json：名字、一句话介绍、单文件大小、源码行数、提交历史、
// 文档路径（README / DESIGN / PROGRESS，Agent 写解说前要读）、"拍视频建议"段落。数字都是实测，可以直接上屏。
// 以后游戏更新了，重新 add 一次就会刷新数字（手写的 notes、tags 会保留）。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const git = (repo, ...a) => { const r = spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : ""; };

export function gameAdd(ROOT, repo, flags) {
  repo = path.resolve(repo);
  if (!fs.existsSync(repo)) throw new Error("找不到游戏仓库：" + repo);
  const slug = String(flags.slug || path.basename(repo).replace(/^qks-/, "")).replace(/[^\w-]+/g, "-");
  const readme = ["README.md", "readme.md"].map((f) => path.join(repo, f)).find((f) => fs.existsSync(f));
  const md = readme ? fs.readFileSync(readme, "utf8") : "";
  const h1 = (md.match(/^#\s+(.+)$/m) || [, slug])[1].trim();
  const intro = (md.split(/\n#{1,6}\s/)[0].split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">")).find((l) => !/^([-*]\s|\|)/.test(l.trim())) || "").replace(/\*\*/g, "").trim();
  const filming = (md.match(/##\s*拍视频建议[\s\S]*?(?=\n##\s|$)/) || [""])[0].trim();
  // 单文件成品：仓库根目录下非 index 的 .html（例如 萤渊.html）
  const html = fs.readdirSync(repo).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => path.join(repo, f))[0] || null;
  // 源码行数：src/ 下被 git 跟踪的 js / ts / glsl / css / html
  const files = git(repo, "ls-files", "src").split("\n").filter((f) => /\.(m?js|ts|glsl|frag|vert|css|html)$/.test(f));
  let lines = 0; for (const f of files) { try { lines += fs.readFileSync(path.join(repo, f), "utf8").split("\n").length; } catch {} }
  const commits = +(git(repo, "rev-list", "--count", "HEAD") || 0);
  const dates = git(repo, "log", "--format=%ad", "--date=short").split("\n").filter(Boolean);
  const log = git(repo, "log", "--format=%ad %s", "--date=short", "-n", "30").split("\n").filter(Boolean);
  const docs = ["README.md", "DESIGN.md", "PROGRESS.md", "docs"].filter((f) => fs.existsSync(path.join(repo, f))).map((f) => path.join(repo, f).replace(/\\/g, "/"));
  const out = path.join(ROOT, "games", slug + ".json"), old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
  const g = {
    slug, name: h1, intro, repo: repo.replace(/\\/g, "/"), docs,
    facts: {
      singleFile: html ? path.basename(html) : null, sizeKB: html ? Math.round(fs.statSync(html).size / 1024) : null,
      srcFiles: files.length, srcLines: lines, commits, firstCommit: dates[dates.length - 1] || null, lastCommit: dates[0] || null,
      zeroExternalArt: /零外部|不依赖任何外网|全部由代码|程序化生成/.test(md) || null,
    },
    recentCommits: log, filming,
    notes: old.notes || "", tags: old.tags || [],
    updated: new Date().toISOString().slice(0, 10),
  };
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(g, null, 2));
  console.log(`✓ 已登记「${g.name}」→ games/${slug}.json\n  单文件 ${g.facts.singleFile || "无"}（${g.facts.sizeKB ?? "?"} KB），源码 ${files.length} 个文件 ${lines} 行，${commits} 次提交（${g.facts.firstCommit} → ${g.facts.lastCommit}）`);
  return g;
}

export function gameList(ROOT) {
  const d = path.join(ROOT, "games"); if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8")));
}
