"""质量检查。FAIL = 必须修，WARN = 建议看一眼。结果写到 build/validation.json，有 FAIL 时退出码为 1。
检查项：
  场景报错 / cue 找不到            （渲染器导出的 build/report.json）
  字幕超宽                          （浏览器里按真实字体量出来的宽度）
  分辨率、帧率、帧数是否与配置一致
  音画时长是否一致（差 > 0.1s 算失败）
  全黑画面（渲染失败的典型表现）    blackdetect，片头片尾淡入淡出除外
  长时间静止画面                    freezedetect > 3s
  响度是否接近目标                  ebur128
用法：python tools/validate.py <项目目录> [成片路径]
"""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import load_project, bpath

pdir = sys.argv[1]
cfg = load_project(pdir)
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(pdir, "output", cfg.get("output_name", "成片.mp4"))
TL = json.load(open(bpath(pdir, "timeline.json"), encoding="utf8"))
F = cfg["format"]
fails, warns, info = [], [], []


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf8", errors="replace")


def shot_at(t):
    for p in TL["paras"]:
        if t <= p["end"] + 0.4: return p
    return TL["paras"][-1]


# 1. 渲染器报告
rep_p = bpath(pdir, "report.json")
if os.path.exists(rep_p):
    rep = json.load(open(rep_p, encoding="utf8"))
    for e in rep.get("errors", []): fails.append("场景错误：" + e)
    for s in rep.get("subtitles", []):
        if not s["ok"]: fails.append(f"字幕超宽 {s['width']}px > {s['max']}px：「{s['text']}」")
    allow_dark = set(rep.get("allowDark", []))
else:
    warns.append("没有 build/report.json（还没渲染过？）"); allow_dark = set()

if not os.path.exists(out):
    fails.append(f"成片不存在：{out}")
else:
    # 2. 规格
    pr = json.loads(sh(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,nb_frames,duration",
                        "-show_entries", "format=duration", "-of", "json", out]).stdout)
    v = next((s for s in pr["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    if not v: fails.append("成片没有视频流")
    if not a: fails.append("成片没有音频流")
    if v:
        if (int(v["width"]), int(v["height"])) != (F["width"], F["height"]): fails.append(f"分辨率 {v['width']}x{v['height']} ≠ 配置 {F['width']}x{F['height']}")
        num, den = map(int, v["r_frame_rate"].split("/"))
        if abs(num / den - F["fps"]) > 0.01: fails.append(f"帧率 {num/den:.2f} ≠ {F['fps']}")
        expect = round(TL["total"] * F["fps"])
        nf = int(v.get("nb_frames") or 0)
        if nf and abs(nf - expect) > 1: fails.append(f"帧数 {nf} ≠ 时间轴应有的 {expect}")
        info.append(f"视频 {v['width']}x{v['height']} @{num/den:g}fps，{nf} 帧")
    if v and a:
        dv, da = float(v["duration"]), float(a["duration"])
        if abs(dv - da) > 0.1: fails.append(f"音画时长不一致：视频 {dv:.2f}s / 音频 {da:.2f}s")
        info.append(f"时长 视频 {dv:.2f}s / 音频 {da:.2f}s / 时间轴 {TL['total']:.2f}s")
    # 3. 全黑画面
    r = sh(["ffmpeg", "-i", out, "-vf", "blackdetect=d=0.4:pic_th=0.995:pix_th=0.03", "-an", "-f", "null", "-"]).stderr
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", r):
        b0, b1 = float(m.group(1)), float(m.group(2))
        if b1 <= 0.6 or b0 >= TL["total"] - 1.2: continue          # 片头片尾的淡入淡出
        p = shot_at(b0)
        if p["scene"] in allow_dark: continue
        fails.append(f"全黑画面 {b0:.2f}–{b1:.2f}s（镜头 {p['id']} / {p['scene']}）")
    # 4. 静止画面
    r = sh(["ffmpeg", "-i", out, "-vf", "freezedetect=n=0.0008:d=3", "-an", "-f", "null", "-"]).stderr
    for m in re.finditer(r"freeze_start: ([\d.]+)[\s\S]*?freeze_end: ([\d.]+)", r):
        f0, f1 = float(m.group(1)), float(m.group(2))
        if f0 >= TL["total"] - 3.5: continue
        warns.append(f"画面静止 {f0:.2f}–{f1:.2f}s（镜头 {shot_at(f0)['id']}），检查动画是否卡住")
    # 5. 响度
    r = sh(["ffmpeg", "-i", out, "-vn", "-af", "ebur128", "-f", "null", "-"]).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r)
    if m:
        lufs = float(m[-1]); target = cfg["mix"].get("loudness", -14)
        info.append(f"响度 {lufs:.1f} LUFS（目标 {target}）")
        if abs(lufs - target) > 2: warns.append(f"响度 {lufs:.1f} LUFS 偏离目标 {target}")

res = {"output": out, "fails": fails, "warns": warns, "info": info, "ok": not fails}
json.dump(res, open(bpath(pdir, "validation.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
for s in info: print("  ·", s)
for s in warns: print("  WARN", s)
for s in fails: print("  FAIL", s)
print("质检通过" if not fails else f"质检未通过：{len(fails)} 项")
sys.exit(0 if not fails else 1)
