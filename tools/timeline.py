"""时间轴：把各镜头配音的逐词时间拼成全片绝对时间，生成逐字时间（动画 cue 用）和字幕。
算法与《一行代码》《AI说改好了》两条成片一致。
用法：python tools/timeline.py <项目目录>   → build/timeline.json
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import load_project, bpath, split_sentences_then_sub

pdir = sys.argv[1]
cfg = load_project(pdir)
T = cfg["timing"]
if cfg["voice"].get("engine") == "none":       # 无口播模式：按字幕阅读时间排时间轴（见 silent_timeline）
    from silent import silent_timeline
    silent_timeline(pdir, cfg); sys.exit(0)
LEAD, GAP, TAIL = T.get("lead", 0.5), T.get("gap", 0.55), T.get("tail", 3.2)
PUNCT = "，。、：；？！“”‘’,.:;?! "
maxw = 1000 if cfg["format"]["height"] >= cfg["format"]["width"] else cfg["format"]["width"] - 200

t = LEAD
paras, subs = [], []
for shot in cfg["shots"]:
    a = json.load(open(bpath(pdir, "audio", f"{shot['id']}.json"), encoding="utf8"))
    text = shot["text"]
    char_t = [None] * len(text)
    if a["words"]:
        pos = 0
        for w in a["words"]:
            k = text.find(w["w"], pos)
            if k < 0: continue
            for j in range(len(w["w"])):
                char_t[k + j] = t + w["t"] + w["d"] * j / max(1, len(w["w"]))
            pos = k + len(w["w"])
    else:  # 自录音频没有逐词时间：按字数在整段时长里均分
        n = max(1, len(text))
        for j in range(len(text)):
            char_t[j] = t + a["dur"] * j / n
    last = t
    for i, c in enumerate(char_t):
        if c is None: char_t[i] = last
        else: last = c
    hold = float(shot.get("hold", 0))            # 镜头额外停留秒数（口播说完后画面多留一会儿）
    paras.append({"id": shot["id"], "scene": shot["scene"], "name": shot.get("label", ""), "music": shot.get("music", ""),
                  "start": round(t, 3), "audio": a["dur"], "end": round(t + a["dur"] + hold, 3),
                  "text": text, "chars": [round(x, 3) for x in char_t]})
    cur = 0
    for c in split_sentences_then_sub(text, maxw):
        core = c.strip(PUNCT)
        k = text.find(core[:2], cur) if core else cur
        k = max(k, cur)
        subs.append({"text": c, "t0": round(char_t[k] - 0.08, 3), "pid": shot["id"]})
        cur = k + len(core)
    t += a["dur"] + hold + GAP

total = t - GAP + TAIL
for i, s in enumerate(subs):
    nxt = subs[i + 1]["t0"] if i + 1 < len(subs) and subs[i + 1]["pid"] == s["pid"] else None
    p = next(p for p in paras if p["id"] == s["pid"])
    pend = p["start"] + p["audio"]
    s["t1"] = round(min(nxt, pend) if nxt else pend, 3)

out = {"total": round(total, 3), "fps": cfg["format"]["fps"], "paras": paras, "subs": subs}
json.dump(out, open(bpath(pdir, "timeline.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"总时长 {total:.2f}s，{len(paras)} 个镜头，{len(subs)} 条字幕")
