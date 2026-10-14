"""参考素材分析：把参考图 / 参考视频拆成 Agent 能"看"和能用的东西。
用法：python tools/ref.py <项目目录> <文件或文件夹> [...]
输出（都在 <项目>/refs/ 下）：
  原文件的副本
  sheet_<名字>.jpg     视频：按时间均匀取 24 帧拼图，左上角标时间；图片：缩放后的副本
  palette_<名字>.png   主色色板（8 色，按占比排）
  ref_report.md        汇总：每个素材的时长、镜头切换次数、平均镜头时长、画面运动量、主色 HEX
Agent 拿到之后要做的事（见 SKILL.md「参考素材」）：看拼图和色板，写出这条视频的美术方案和 theme，
而不是照抄某一帧。
"""
import json, os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import run

VIDEO = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".gif"}
IMAGE = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf8", errors="replace")


def palette(src, out, n=6):
    """取主色：先量化成 24 色，再把很接近的颜色合并，留占比最高的 n 个；另外挑出最鲜艳的几个当"强调色"。
    返回 [(hex, 占比, 是否强调色)]，并画一张色板图（上排主色按占比，下排强调色）。"""
    import colorsys
    from PIL import Image, ImageDraw
    im = Image.open(src).convert("RGB"); im.thumbnail((320, 320))
    q = im.quantize(colors=24, method=Image.MEDIANCUT); pal = q.getpalette()
    raw = sorted(((c, tuple(pal[i * 3: i * 3 + 3])) for c, i in q.getcolors()), reverse=True)
    total = sum(c for c, _ in raw) or 1; merged = []
    for c, rgb in raw:
        for m in merged:
            if sum((a - b) ** 2 for a, b in zip(m[1], rgb)) ** 0.5 < 28: m[0] += c; break
        else: merged.append([c, rgb])
    merged.sort(reverse=True)
    sat = lambda rgb: colorsys.rgb_to_hsv(*[x / 255 for x in rgb])[1] * colorsys.rgb_to_hsv(*[x / 255 for x in rgb])[2]
    main = merged[:n]
    accents = sorted([m for m in merged if sat(m[1]) > 0.25 and m[0] / total > 0.004], key=lambda m: -sat(m[1]) * (m[0] / total) ** 0.3)[:3]
    hx = lambda rgb: "#%02x%02x%02x" % rgb
    sw = Image.new("RGB", (800, 160), "white"); d = ImageDraw.Draw(sw); x = 0; tm = sum(m[0] for m in main)
    for c, rgb in main:
        w = max(6, int(800 * c / tm)); d.rectangle([x, 0, x + w, 100], fill=rgb); x += w
    for k, (c, rgb) in enumerate(accents): d.rectangle([k * 160, 110, k * 160 + 150, 160], fill=rgb)
    sw.save(out)
    return [(hx(rgb), c / total, False) for c, rgb in main] + [(hx(rgb), c / total, True) for c, rgb in accents]


def video(src, refs, name):
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).strip() or 0)
    info = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", src]))["streams"][0]
    # 镜头切换：场景变化分数 > 0.3 的帧
    r = sh(["ffmpeg", "-i", src, "-vf", "select='gt(scene,0.15)',showinfo", "-an", "-f", "null", "-"]).stderr
    cuts = [float(x) for x in re.findall(r"pts_time:([\d.]+)", r)]
    # 运动量：相邻帧平均差异（低分辨率下算）
    r = sh(["ffmpeg", "-i", src, "-vf", "scale=160:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"]).stderr
    mv = [float(x) for x in re.findall(r"YAVG=([\d.]+)", r)]
    motion = sum(mv) / len(mv) if mv else 0
    still = sum(1 for x in mv if x < 0.6) / len(mv) if mv else 0
    # 24 帧拼图（6×4），每帧标时间
    n = 24; fps = n / max(dur, 0.1)
    sheet = os.path.join(refs, f"sheet_{name}.jpg")
    font = "C\\:/Windows/Fonts/consola.ttf" if os.name == "nt" else "DejaVuSansMono.ttf"
    vf = f"fps={fps:.5f},scale=320:-2,drawtext=fontfile='{font}':text='%{{pts\\:hms}}':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.5,tile=6x4"
    r = sh(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-frames:v", "1", sheet])
    if r.returncode != 0:      # 没有字体时去掉时间标注
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"fps={fps:.5f},scale=320:-2,tile=6x4", "-frames:v", "1", sheet])
    mid = os.path.join(refs, f"_mid_{name}.png")
    run(["ffmpeg", "-v", "error", "-y", "-i", sheet, "-frames:v", "1", mid])
    cols = palette(mid, os.path.join(refs, f"palette_{name}.png")); os.remove(mid)
    shots = len(cuts) + 1
    return {"类型": "视频", "时长": f"{dur:.1f}s", "画幅": f"{info['width']}×{info['height']}",
            "镜头切换": f"{len(cuts)} 次，平均每个镜头 {dur / shots:.1f}s",
            "运动量": f"{motion:.2f}（相邻帧平均亮度差；<0.6 算静止，静止帧占 {still * 100:.0f}%）",
            "拼图": os.path.basename(sheet), "主色": cols}


def picture(src, refs, name):
    from PIL import Image
    im = Image.open(src); w, h = im.size
    sheet = os.path.join(refs, f"sheet_{name}.jpg"); im2 = im.convert("RGB"); im2.thumbnail((1280, 1280)); im2.save(sheet, quality=88)
    cols = palette(src, os.path.join(refs, f"palette_{name}.png"))
    return {"类型": "图片", "尺寸": f"{w}×{h}", "拼图": os.path.basename(sheet), "主色": cols}


def main():
    pdir = sys.argv[1]; refs = os.path.join(pdir, "refs"); os.makedirs(refs, exist_ok=True)
    files = []
    for a in sys.argv[2:]:
        if os.path.isdir(a): files += [os.path.join(a, f) for f in sorted(os.listdir(a))]
        else: files.append(a)
    files = [f for f in files if os.path.splitext(f)[1].lower() in VIDEO | IMAGE]
    if not files: raise SystemExit("没有可分析的图片或视频（支持 " + " ".join(sorted(VIDEO | IMAGE)) + "）")
    rows = []
    for f in files:
        name = re.sub(r"[^\w一-鿿-]+", "_", os.path.splitext(os.path.basename(f))[0])[:40]
        dst = os.path.join(refs, os.path.basename(f))
        if os.path.abspath(f) != os.path.abspath(dst): shutil.copyfile(f, dst)
        ext = os.path.splitext(f)[1].lower()
        res = video(dst, refs, name) if ext in VIDEO else picture(dst, refs, name)
        rows.append((os.path.basename(f), res)); print(f"✓ {os.path.basename(f)}：{res['类型']}，主色 {' '.join(h for h, _, a in res['主色'] if not a)}，强调色 {' '.join(h for h, _, a in res['主色'] if a) or '无'}")
    md = ["# 参考素材分析", "", "由 `mjv ref` 生成。拼图和色板在同一目录。Agent：看完拼图写美术方案（design.md）和 theme，提炼风格，不要逐帧照抄。", ""]
    for fn, r in rows:
        md += [f"## {fn}", ""]
        for k, v in r.items():
            if k == "主色":
                md.append("- 主色（按占比）：" + "　".join(f"`{h}` {p * 100:.0f}%" for h, p, a in v if not a))
                acc = [h for h, p, a in v if a]
                md.append("- 强调色（最鲜艳）：" + ("　".join(f"`{h}`" for h in acc) if acc else "无（整体偏灰 / 单色）"))
            else: md.append(f"- {k}：{v}")
        md.append("")
    open(os.path.join(refs, "ref_report.md"), "w", encoding="utf8").write("\n".join(md))
    print("✓ 报告 " + os.path.join(refs, "ref_report.md"))


main()
