// 生成工作台 / 目录页用的预览：
//   风格包：用 studio/showcase（中性的样张项目）套上每个风格，取 4 张静帧拼成 styles/<名>/preview.jpg
//   场景库：在用到这个场景的项目里截一段 3 秒小片 → engine/scenes/_previews/<场景>.mp4 + .jpg（封面）
// 用法：node bin/mjv.mjs previews [--force] [--only=styles|scenes]
// 已经有预览、而且风格 / 场景文件没改过的会跳过（按修改时间比较）。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export async function previews(ROOT, flags) {
  const MJV = path.join(ROOT, "bin", "mjv.mjs");
  const mjv = (...a) => { const r = spawnSync(process.execPath, [MJV, ...a], { cwd: ROOT, encoding: "utf8" }); if (r.status !== 0) throw new Error(`mjv ${a.join(" ")} 失败：\n${(r.stderr || r.stdout).slice(-800)}`); return r.stdout; };
  const ff = (...a) => { const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...a], { encoding: "utf8" }); if (r.status !== 0) throw new Error("ffmpeg 失败：" + r.stderr.slice(-500)); };
  const newer = (out, ...srcs) => flags.force || !fs.existsSync(out) || srcs.some((s) => fs.existsSync(s) && fs.statSync(s).mtimeMs > fs.statSync(out).mtimeMs);
  const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const SHOW = path.join(ROOT, "studio", "showcase");

  // ---------- 风格包 ----------
  if (flags.only !== "scenes") {
    const base = read(path.join(SHOW, "project.json"));
    const T = [4.2, 13.5, 24.0, 27.6];                       // 样张里 4 个代表时刻（标题、概率条、神经网络、图片）
    for (const name of fs.readdirSync(path.join(ROOT, "styles")).sort()) {
      const sp = path.join(ROOT, "styles", name, "style.json"); if (!fs.existsSync(sp)) continue;
      const out = path.join(ROOT, "styles", name, "preview.jpg");
      if (!newer(out, sp, path.join(SHOW, "project.json"), path.join(ROOT, "engine", "lib.js"))) { console.log(`  风格 ${name}：已是最新`); continue; }
      const st = read(sp), dir = path.join(ROOT, "styles", name, "_build");
      fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
      fs.copyFileSync(path.join(SHOW, "assets", "sample.jpg"), path.join(dir, "assets", "sample.jpg"));
      const cfg = { ...base, theme: st.theme, fonts: st.fonts || base.fonts, fontsToLoad: st.fontsToLoad || base.fontsToLoad };
      fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(cfg, null, 1));
      mjv("timeline", dir); mjv("stills", dir, ...T.map(String));
      const ins = T.flatMap((t) => ["-i", path.join(dir, "build", "stills", `t${t}.png`)]);
      ff(...ins, "-filter_complex", "[0]scale=640:-2[a];[1]scale=640:-2[b];[2]scale=640:-2[c];[3]scale=640:-2[d];[a][b][c][d]xstack=inputs=4:layout=0_0|640_0|0_360|640_360", "-frames:v", "1", "-update", "1", "-q:v", "4", out);
      console.log(`  风格 ${name}：✓ ${out}`);
    }
  }

  // ---------- 场景库 ----------
  if (flags.only !== "styles") {
    const PD = path.join(ROOT, "previews_src.json");          // 可选：手动指定某个场景用哪个项目的哪个镜头
    const manual = fs.existsSync(PD) ? read(PD) : {};
    const projects = [SHOW, ...fs.readdirSync(path.join(ROOT, "projects")).map((p) => path.join(ROOT, "projects", p))]
      .filter((d) => fs.existsSync(path.join(d, "project.json")));
    const outDir = path.join(ROOT, "engine", "scenes", "_previews"); fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(path.join(ROOT, "engine", "scenes")).filter((x) => x.endsWith(".js")).sort()) {
      const scene = f.slice(0, -3), out = path.join(outDir, scene + ".mp4"), poster = path.join(outDir, scene + ".jpg");
      if (!newer(out, path.join(ROOT, "engine", "scenes", f))) { console.log(`  场景 ${scene}：已是最新`); continue; }
      let hit = null;
      for (const d of manual[scene] ? [path.join(ROOT, manual[scene].project)] : projects) {
        const cfg = read(path.join(d, "project.json")), shot = cfg.shots.find((s) => s.scene === scene && (!manual[scene] || s.id === manual[scene].shot));
        if (shot) { hit = { d, shot }; break; }
      }
      if (!hit) { console.log(`  场景 ${scene}：没有项目用到它，跳过`); continue; }
      const tlp = path.join(hit.d, "build", "timeline.json");
      if (!fs.existsSync(tlp)) mjv("timeline", hit.d);
      const p = read(tlp).paras.find((x) => x.id === hit.shot.id);
      const t0 = (p.start + (p.end - p.start) * 0.35).toFixed(2);
      mjv("clip", hit.d, t0, "3", out, "--w=480", "--fps=15");
      ff("-ss", "1.5", "-i", out, "-frames:v", "1", "-q:v", "4", poster);
      console.log(`  场景 ${scene}：✓（来自 ${path.basename(hit.d)} / ${hit.shot.id}）`);
    }
  }
}
