"""无口播模式的时间轴：没有配音，每句字幕按阅读时间排。
project.json：
  "voice": { "engine": "none" }
  "timing": { "lead": 0.8, "gap": 0.4, "tail": 3.0, "pre": 0.6, "lineGap": 0.35, "cps": 5, "linePad": 0.9, "minLine": 1.8 }
  shot.lines = [ { "text": "可它其实，只会做**一件事**。", "dur": 3.2, "hold": 0.4, "gap": 0.2 } ... ]
    text 里 **词** 表示高亮（金色）；dur 手动指定停留秒数；hold 在自动时长上再加；gap 覆盖这句之后的间隔
  shot.pre  第一句出现前画面先走几秒；shot.hold 最后一句结束后画面多留几秒
每句时长 = dur 或 max(minLine, 字数 / cps + linePad) + hold。
输出的 timeline.json 结构和有配音时一样（paras / subs / chars），cue("词") 照常可用：
词的时间 = 这句出现的时刻 + 按字的位置在阅读时间里均分。另外每个 para 多一个 lines（相对镜头开始的秒数）。
"""
import json, re
from common import bpath

MARK = re.compile(r"\*\*")


def plain(s):
    return MARK.sub("", s)


def silent_timeline(pdir, cfg):
    T = cfg["timing"]
    LEAD, GAP, TAIL = T.get("lead", 0.8), T.get("gap", 0.4), T.get("tail", 3.0)
    PRE, LGAP, CPS = T.get("pre", 0.6), T.get("lineGap", 0.35), T.get("cps", 5.0)
    PAD, MINL = T.get("linePad", 0.9), T.get("minLine", 1.8)
    t = LEAD
    paras, subs = [], []
    for shot in cfg["shots"]:
        lines = shot.get("lines") or [{"text": x} for x in re.findall(r"[^。？！]+[。？！]?", shot.get("text", "")) if x.strip()]
        start = t
        cur = t + float(shot.get("pre", PRE))
        text, chars, rel = "", [], []
        for j, ln in enumerate(lines):
            raw = ln["text"]; pt = plain(raw)
            n = len(re.sub(r"[\s，。、：；？！“”‘’,.:;?!—…「」()（）]", "", pt)) or 1
            dur = float(ln["dur"]) if "dur" in ln else max(MINL, n / CPS + PAD)
            dur += float(ln.get("hold", 0))
            read = min(dur * 0.8, len(pt) / (CPS * 2.2))       # 一句话里的字按快速阅读速度依次"到达"（给 cue 用）
            for k in range(len(pt)):
                chars.append(round(cur + read * k / max(1, len(pt)), 3))
            text += pt
            rel.append({"text": raw, "plain": pt, "t0": round(cur - start, 3), "t1": round(cur + dur - start, 3), "i": j})
            subs.append({"text": pt, "raw": raw, "t0": round(cur, 3), "t1": round(cur + dur, 3), "pid": shot["id"]})
            cur += dur
            if j < len(lines) - 1: cur += float(ln.get("gap", LGAP))
        end = cur + float(shot.get("hold", 0))
        paras.append({"id": shot["id"], "scene": shot["scene"], "name": shot.get("label", ""), "music": shot.get("music", ""),
                      "start": round(start, 3), "audio": round(cur - start, 3), "end": round(end, 3),
                      "text": text, "chars": chars, "lines": rel})
        t = end + GAP
    total = t - GAP + TAIL
    out = {"total": round(total, 3), "fps": cfg["format"]["fps"], "silent": True, "paras": paras, "subs": subs}
    json.dump(out, open(bpath(pdir, "timeline.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"无口播时间轴：总时长 {total:.2f}s，{len(paras)} 个镜头，{len(subs)} 句字幕")
    for p in paras:
        print(f"  {p['id']}  {p['start']:7.2f}–{p['end']:7.2f}  ({p['end'] - p['start']:.1f}s)  {len(p['lines'])} 句")
