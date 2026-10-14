"""工具链公共函数：读项目配置、路径、字幕切分。"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_project(pdir):
    cfg = json.load(open(os.path.join(pdir, "project.json"), encoding="utf8"))
    cfg.setdefault("format", {}).setdefault("width", 1080)
    cfg["format"].setdefault("height", 1920)
    cfg["format"].setdefault("fps", 30)
    cfg.setdefault("voice", {"engine": "edge", "voice": "zh-CN-XiaoyiNeural", "rate": "+4%"})
    cfg.setdefault("timing", {"lead": 0.5, "gap": 0.55, "tail": 3.2})
    cfg.setdefault("music", {"enabled": True, "volume": 0.26, "bpm": 100})
    cfg.setdefault("mix", {"sfx_volume": 0.30, "loudness": -14})
    os.makedirs(os.path.join(pdir, "build", "audio"), exist_ok=True)
    return cfg


def bpath(pdir, *p):
    return os.path.join(pdir, "build", *p)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf8", errors="replace", **kw)
    if r.returncode != 0:
        print(" ".join(map(str, cmd))[:400], file=sys.stderr); print(r.stderr[-2000:], file=sys.stderr)
        raise SystemExit(1)
    return r.stdout


def probe_dur(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())


# ---------------- 字幕切分（来自上高/样片流程：先按句，再按标点，太长按 jieba 词边界切） ----------------
_FONT = None
SUB_MAXW = 1000
_PUNCT = "，。、：；？！,"


def _w(s):
    global _FONT
    from PIL import ImageFont, ImageDraw, Image
    if _FONT is None:   # 量字幕宽度用的字体：环境变量 MJV_SUB_FONT > 微软雅黑粗 > 苹方 > Noto > 引擎自带思源宋体
        cands = [os.environ.get("MJV_SUB_FONT", ""), "C:/Windows/Fonts/msyhbd.ttc", "/System/Library/Fonts/PingFang.ttc",
                 "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", os.path.join(ROOT, "assets", "fonts", "NotoSerifSC-Bold.otf")]
        _FONT = ImageFont.truetype(next(p for p in cands if p and os.path.exists(p)), 50)
    return ImageDraw.Draw(Image.new("RGBA", (1, 1))).textsize(s, font=_FONT)[0]


def sub_weight(c):
    return sum(0.55 if ord(ch) < 128 else 1.0 for ch in c if not ch.isspace()) + 0.3


def _split_long(s, maxw):
    if _w(s) <= maxw:
        return [s]
    import jieba
    toks = list(jieba.cut(s)); best = None
    for k in range(1, len(toks)):
        a, b = "".join(toks[:k]), "".join(toks[k:])
        score = abs(_w(a) - _w(b))
        if best is None or score < best[0]:
            best = (score, a.strip(), b.strip())
    return _split_long(best[1], maxw) + _split_long(best[2], maxw)


def split_sub(s, maxw=SUB_MAXW):
    parts, buf = [], ""
    for ch in s:
        buf += ch
        if ch in _PUNCT:
            parts.append(buf); buf = ""
    if buf.strip():
        parts.append(buf)
    parts = [p.strip() for p in parts if p.strip()]
    merged = []
    for p in parts:
        if merged and len(merged[-1].rstrip(_PUNCT)) <= 4 and sub_weight(merged[-1] + p) <= 14:
            merged[-1] += p
        else:
            merged.append(p)
    out = []
    for p in merged:
        out += _split_long(p, maxw)
    return [c.rstrip("，。、；,") or c for c in out]


def split_sentences_then_sub(text, maxw=SUB_MAXW):
    chunks = []
    for sent in re.findall(r"[^。？！]+[。？！]?", text):
        chunks += split_sub(sent, maxw)
    return chunks
