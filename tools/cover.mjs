// 封面：node bin/mjv.mjs cover <项目> --video=<录屏名> --t=<秒> --title="主标题" [--sub="副标题"]
// 从录屏代理里取一帧，压暗下半部分，叠思源宋体大字标题；输出 output/封面_3x4.jpg（1080×1440）和 output/封面_9x16.jpg（1080×1920）。
// 标题里用 | 换行（每行建议 ≤ 8 个字）。强调色取项目主题的 accent。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function cover(ROOT, pdir, flags) {
  const cfg = JSON.parse(fs.readFileSync(path.join(pdir, "project.json"), "utf8"));
  const key = flags.video || Object.keys(cfg.videos || {})[0];
  if (!key || !cfg.videos?.[key]) throw new Error("没有录屏：先 mjv footage 导入，或者用 --video= 指定");
  if (!flags.title) throw new Error('要写 --title="主标题"（用 | 换行）');
  const src = path.resolve(pdir, cfg.videos[key]), t = +(flags.t ?? 1);
  const accent = (cfg.theme && cfg.theme.accent) || "#ffd166";
  const font = path.join(ROOT, "assets", "fonts", "NotoSerifSC-Black.otf").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mjv-cover-"));
  const lines = String(flags.title).split("|"), sub = flags.sub ? String(flags.sub) : "";
  const outs = [];
  for (const [name, w, h] of [["封面_3x4.jpg", 1080, 1440], ["封面_9x16.jpg", 1080, 1920]]) {
    const size = Math.min(150, Math.floor((w - 140) / Math.max(...lines.map((l) => l.length)))), lh = Math.round(size * 1.22);
    const blockH = lines.length * lh + (sub ? 90 : 0), y0 = h - blockH - (h > 1500 ? 380 : 170);
    const draws = lines.map((l, i) => {
      const f = path.join(tmp, `l${i}.txt`); fs.writeFileSync(f, l);
      const tf = f.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
      return `drawtext=fontfile='${font}':textfile='${tf}':fontsize=${size}:fontcolor=white:borderw=6:bordercolor=black@0.85:shadowx=0:shadowy=8:shadowcolor=black@0.6:x=(w-text_w)/2:y=${y0 + i * lh}`;
    });
    if (sub) { const f = path.join(tmp, "sub.txt"); fs.writeFileSync(f, sub); const tf = f.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
      draws.push(`drawtext=fontfile='${font}':textfile='${tf}':fontsize=54:fontcolor=${accent}:borderw=4:bordercolor=black@0.8:x=(w-text_w)/2:y=${y0 + lines.length * lh + 26}`); }
    // 下半部分压暗：真正的透明度渐变（从 40% 高度开始，越往下越暗）
    const fc = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},eq=saturation=1.15:contrast=1.05[bg];` +
      `color=black:s=${w}x${h},format=rgba,geq=r=0:g=0:b=0:a='if(lt(Y\,H*0.4)\,0\,pow((Y-H*0.4)/(H*0.6)\,1.2)*200)'[g];` +
      `[bg][g]overlay=format=auto,${draws.join(",")}`;
    const out = path.join(pdir, "output", name); fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", src, "-filter_complex", fc, "-frames:v", "1", "-q:v", "2", out], { encoding: "utf8" });
    if (r.status !== 0) throw new Error("封面生成失败：" + r.stderr.slice(-400));
    outs.push(out); console.log("✓ " + out);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return outs;
}
