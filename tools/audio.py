"""声音：代码合成配乐（每个镜头按音色预设变化）+ 音效（时间点来自场景代码的 sfx() 调用）+ 人声混音。
纯 Python 合成，零音频素材，无版权问题。算法来自《一行代码》成片，音效随机数改成固定种子（可复现）。
用法：python tools/audio.py <项目目录>   需要先有 build/timeline.json、build/sfx.json（渲染时导出）
输出：build/voice.wav build/bgm.wav build/sfx.wav build/mix.wav
"""
import json, math, os, random, struct, sys, wave, zlib
from array import array
sys.path.insert(0, os.path.dirname(__file__))
from common import load_project, bpath, run

pdir = sys.argv[1]
cfg = load_project(pdir)
TL = json.load(open(bpath(pdir, "timeline.json"), encoding="utf8"))
SFX = json.load(open(bpath(pdir, "sfx.json"), encoding="utf8")) if os.path.exists(bpath(pdir, "sfx.json")) else []
TOTAL = TL["total"]; PAR = TL["paras"]
random.seed(3)
bounds = [(PAR[i]["end"] + PAR[i + 1]["start"]) / 2 for i in range(len(PAR) - 1)] + [TOTAL + 5]
MUS = cfg["music"]


def write_wav(path, buf, sr):
    peak = max([1e-9] + [abs(x) for x in buf]); g = 0.89 / peak if peak > 0.89 else 1.0
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * g)) * 32767)) for x in buf))


def add(buf, src, start, gain=1.0):
    i0 = int(start); n = min(len(src), len(buf) - i0)
    for i in range(max(0, -i0), n):
        buf[i0 + i] += src[i] * gain


# ---------------- 配乐 ----------------
SR = 24000
BEAT = 60 / MUS.get("bpm", 100)
N = int((TOTAL + 2) * SR)
music = array("f", [0.0]) * N
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]     # Am F C G
ROOT = [45, 41, 36, 43]
PENTA = [57, 60, 62, 64, 67, 69, 72]
cache = {}


def tone(kind, m, dur):
    key = (kind, m, round(dur, 2))
    if key in cache: return cache[key]
    f = hz(m); n = int(dur * SR); out = array("f", [0.0]) * n; ph = 0.0
    for i in range(n):
        t = i / SR; w = 2 * math.pi * f * t
        if kind == "keys":   v = (math.sin(w) + 0.3 * math.sin(2 * w) + 0.1 * math.sin(3 * w)) * math.exp(-t * 2.0)
        elif kind == "pluck": v = (math.sin(w) + 0.5 * math.sin(2 * w) + 0.25 * math.sin(3 * w)) * math.exp(-t * 7)
        elif kind == "square": v = (1 if math.sin(w) > 0 else -1) * 0.35 * math.exp(-t * 5)
        elif kind == "bell": v = (math.sin(w) + 0.4 * math.sin(2.76 * w)) * math.exp(-t * 3.5)
        elif kind == "marimba": v = (math.sin(w) + 0.25 * math.sin(4 * w)) * math.exp(-t * 9)
        elif kind == "saw": v = sum(math.sin(k * w) / k for k in range(1, 7)) * 0.5 * math.exp(-t * 4)
        elif kind == "pad": v = (math.sin(w) + 0.5 * math.sin(w * 1.003) + 0.3 * math.sin(2 * w)) * min(1, t / 0.6) * math.exp(-t * 0.6)
        elif kind == "zheng":
            ph += 2 * math.pi * f * (1 + 0.012 * math.exp(-t * 18)) / SR; v = (math.sin(ph) + 0.35 * math.sin(2 * ph)) * math.exp(-t * 5)
        elif kind == "bass": v = (math.sin(w) + 0.3 * math.sin(2 * w)) * math.exp(-t * 3.5)
        # ---- 氛围系（无口播 Vibe 风格）：慢起慢收，柔和 ----
        elif kind == "warm":     # 铺底：轻微失谐的正弦叠加，0.9 秒淡入，最后 35% 淡出
            v = (math.sin(w) + 0.6 * math.sin(w * 1.004) + 0.25 * math.sin(2 * w * 0.998) + 0.1 * math.sin(3 * w)) * min(1, t / 0.9) * min(1, (dur - t) / (dur * 0.35))
        elif kind == "piano":    # 柔和钢琴：基频 + 少量泛音，慢衰减
            v = (math.sin(w) + 0.35 * math.sin(2 * w) + 0.12 * math.sin(3 * w) + 0.05 * math.sin(4.01 * w)) * math.exp(-t * 1.6) * min(1, t / 0.004)
        elif kind == "glass":    # 琶音用的玻璃音
            v = (math.sin(w) + 0.3 * math.sin(3.01 * w)) * math.exp(-t * 3.0)
        elif kind == "sub":      # 柔和低音
            v = math.sin(w) * math.exp(-t * 0.9) * min(1, t / 0.05)
        else: v = 0
        out[i] = v * min(1, i / (0.005 * SR))
    cache[key] = out; return out


def kick():
    if "kick" in cache: return cache["kick"]
    n = int(0.3 * SR); out = array("f"); ph = 0
    for i in range(n):
        t = i / SR; ph += 2 * math.pi * (45 + 80 * math.exp(-t * 30)) / SR; out.append(math.sin(ph) * math.exp(-t * 13))
    cache["kick"] = out; return out


def noise(name, dur, decay, hp=True):
    if name in cache: return cache[name]
    n = int(dur * SR); prev = 0; out = array("f")
    for i in range(n):
        x = random.uniform(-1, 1); out.append((x - prev if hp else x) * math.exp(-i / SR * decay)); prev = x
    cache[name] = out; return out


# 音色预设：(和弦音色, 和弦音量, 贝斯音色, 鼓组, 旋律音色)。镜头的 music 字段或场景名决定用哪个，没有就用 default。
PRESET = {
    "default":  ("keys", 0.5, "bass", "tight", None),
    "calm":     ("pad", 0.5, None, None, "bell"),
    "terminal": ("square", 0.0, "bass", "pulse", "square"),
    "flipbook": ("pluck", 0.5, "bass", "shaker", None),
    "pixel":    ("square", 0.35, "square", "chip", "square"),
    "blueprint": ("bell", 0.45, None, "tick", "bell"),
    "easing":   ("marimba", 0.6, "bass", "clap", "marimba"),
    "synth":    ("saw", 0.35, "saw", "full", "saw"),
    "ink":      (None, 0, None, None, "zheng"),
    "particles": ("pad", 0.5, None, None, "bell"),
    "swiss":    ("keys", 0.45, "bass", "tight", None),
    "comic":    ("keys", 0.55, "bass", "full", "marimba"),
    "film":     ("keys", 0.6, None, None, None),
}


# 镜头的配乐预设：shot.music > 场景定义里的 music（渲染报告里带出来）> 场景名
_rep = json.load(open(bpath(pdir, "report.json"), encoding="utf8")) if os.path.exists(bpath(pdir, "report.json")) else {}
SCENE_MUSIC = {s["id"]: s.get("music", "") for s in _rep.get("scenes", [])}


def name_at(t):
    for i, b in enumerate(bounds):
        if t < b:
            return PAR[i].get("music") or SCENE_MUSIC.get(PAR[i]["id"]) or PAR[i]["scene"]
    return "film"


def preset_at(t):
    return PRESET.get(name_at(t), PRESET["default"])


# 氛围预设（无口播 Vibe 风格，建议 bpm 72–80）：每小节一个长铺底和弦，按织体叠钢琴、低音、轻鼓、琶音、高音旋律。
# 名字以 ambient_ 开头的镜头走这里，不走上面的 PRESET。
# 起伏靠两样东西：① 预设本身的织体厚薄；② 镜头的 energy（0–1，整体音量），可写 energyTo 让音量在镜头内线性渐变（铺垫高潮）。
AMBIENT = {                     # 铺底, 钢琴, 低音, 轻鼓, 琶音, 稀疏铃音, 高音旋律
    "ambient_pad":   (1.0, 0,   0,   0,   0,   1,   0),
    "ambient_piano": (0.8, 1.0, 0,   0,   0,   0,   0),
    "ambient_full":  (0.8, 1.0, 1.0, 1.0, 0,   0,   0),
    "ambient_arp":   (0.7, 0.4, 0.8, 0,   1.0, 0,   0),
    "ambient_lift":  (1.0, 1.0, 1.0, 1.4, 0.6, 1,   1.0),   # 高潮：全部织体 + 高八度铺底 + 旋律 + 更重的鼓
    "ambient_outro": (0.9, 0.6, 0,   0,   0,   1,   0),
}
MELODY = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 2, 4]          # 高潮旋律（五声音阶里的序号）


def energy_at(t):
    for i, b in enumerate(bounds):
        if t < b:
            sh = cfg["shots"][i]; e0 = float(sh.get("energy", 1.0)); e1 = float(sh.get("energyTo", e0))
            p = PAR[i]; k = min(1, max(0, (t - p["start"]) / max(0.1, p["end"] - p["start"])))
            return e0 + (e1 - e0) * k
    return 1.0


def ambient_step(name, i, st, en=1.0):
    pad, pno, bass, drum, arp, bell, mel = AMBIENT[name]
    beat = i // 2; bar = beat // 4; ci = bar % 4; s8 = i % 8
    barlen = BEAT * 4
    g = en
    if pad and s8 == 0:
        for m in CH[ci]: add(music, tone("warm", m - 12, round(barlen * 1.3, 2)), st, 0.055 * pad * g)
        if mel:                                       # 高潮：铺底加高八度，声场更满
            for m in CH[ci]: add(music, tone("warm", m, round(barlen * 1.3, 2)), st, 0.035 * g)
    if pno and s8 in (0, 3, 4, 6):
        seq = [CH[ci][0], CH[ci][2], CH[ci][1] + 12, CH[ci][2]]
        add(music, tone("piano", seq[[0, 3, 4, 6].index(s8)] + 12, 2.5), st, 0.075 * pno * g)
        if s8 == 4 and bar % 2 == 1 and not mel: add(music, tone("piano", PENTA[(bar * 3) % len(PENTA)] + 12, 2.5), st, 0.05 * pno * g)
    if mel and s8 % 2 == 0:                           # 高音旋律：每拍一个音
        m = PENTA[MELODY[(beat) % len(MELODY)]] + 12
        add(music, tone("piano", m, 1.8), st, 0.085 * mel * g)
    if bass and s8 in (0, 4):
        add(music, tone("sub", ROOT[ci], 2.4), st, 0.16 * bass * g)
    if drum:
        if s8 in (0, 4): add(music, kick(), st, 0.2 * drum * g)
        if s8 in (2, 6): add(music, noise("tick", 0.02, 300), st, 0.035 * drum * g)
        if drum > 1 and s8 % 2 == 1: add(music, noise("hat", 0.05, 80), st, 0.04 * g)
        if drum > 1 and s8 == 4: add(music, noise("clap", 0.2, 20), st, 0.07 * g)
    if arp:
        m = (CH[ci] + [x + 12 for x in CH[ci]])[i % 6] + 12
        add(music, tone("glass", m, 1.2), st, 0.045 * arp * g)
    if bell and s8 == 0 and bar % 2 == 0:
        add(music, tone("bell", CH[ci][2] + 24, 2.0), st, 0.03 * bell * g)


if MUS.get("enabled", True):
    step = BEAT / 2; i = 0
    while i * step < TOTAL - 1.5:
        t = i * step; beat = i // 2; off = i % 2; bar = beat // 4; ci = bar % 4; bb = beat % 4
        st = int(t * SR)
        if name_at(t) in AMBIENT:
            ambient_step(name_at(t), i, st, energy_at(t)); i += 1; continue
        chord_k, chord_v, bass_k, drums, mel_k = preset_at(t)
        if chord_k and chord_v and off == 0 and bb in (0, 2):
            for m in CH[ci]: add(music, tone(chord_k, m + (12 if chord_k in ("bell", "square") else 0), 1.2), st, 0.10 * chord_v)
        if bass_k and off == 0 and bb in (0, 2, 3):
            add(music, tone(bass_k, ROOT[ci] - (12 if bass_k != "square" else 0) + 12, 0.6), st, 0.28)
        if mel_k:
            if mel_k == "zheng":
                if (i * 7) % 5 < 2: add(music, tone("zheng", PENTA[(i * 3) % len(PENTA)], 1.0), st, 0.22)
            elif off == 1 or mel_k in ("square", "saw"):
                m = CH[ci][(i // (1 if mel_k in ("square", "saw") else 2)) % 3] + 12
                add(music, tone(mel_k, m, 0.35), st, 0.07)
        if drums:
            if drums in ("full", "tight", "pulse", "chip") and off == 0 and bb in (0, 2): add(music, kick(), st, 0.5 if drums != "pulse" else 0.35)
            if drums in ("full", "clap", "tight") and off == 0 and bb in (1, 3): add(music, noise("clap", 0.2, 20), st, 0.14)
            if drums in ("full", "tight", "shaker", "pulse", "chip") and off == 1: add(music, noise("hat", 0.05, 80), st, 0.07)
            if drums == "tick" and off == 0: add(music, noise("tick", 0.02, 300), st, 0.12)
        i += 1
    if name_at(TOTAL - 1) in AMBIENT:       # 氛围结尾：长铺底 + 一个钢琴和弦
        eo = energy_at(TOTAL - 1)
        for m in [45, 57, 60, 64]: add(music, tone("warm", m, 6.0), int(max(0, TOTAL - 6.2) * SR), 0.06 * eo)
        for m in [57, 64, 69, 72]: add(music, tone("piano", m, 4.5), int(max(0, TOTAL - 6.0) * SR), 0.06 * eo)
    else:
        for m in [57, 60, 64, 69, 72]:
            add(music, tone("keys", m, 4.5), int(max(0, TOTAL - 4.6) * SR), 0.09)
write_wav(bpath(pdir, "bgm.wav"), music, SR)

# ---------------- 音效 ----------------
SR2 = 48000


def gen(kind):
    n = lambda d: int(d * SR2); out = array("f"); R = random.Random(zlib.crc32(kind.encode()))
    def sweep(f0, f1, d, dec, wave_="sin", amp=0.7):
        ph = 0
        for i in range(n(d)):
            t = i / SR2; f = f1 + (f0 - f1) * math.exp(-t * 25); ph += 2 * math.pi * f / SR2
            s = math.sin(ph) if wave_ == "sin" else (1 if math.sin(ph) > 0 else -1) * 0.5
            out.append(s * math.exp(-t * dec) * amp)
    if kind == "pop": sweep(1200, 520, 0.12, 30)
    elif kind == "blip": sweep(1600, 900, 0.09, 35, "sq", 0.6)
    elif kind == "error": sweep(300, 180, 0.25, 8, "sq", 0.5)
    elif kind == "ding":
        for i in range(n(0.9)):
            t = i / SR2; out.append((math.sin(2 * math.pi * 1318.5 * t) + 0.4 * math.sin(2 * math.pi * 1975.5 * t)) * math.exp(-t * 6) * 0.45)
    elif kind in ("thud", "pow", "stamp"):
        ph = 0
        for i in range(n(0.35)):
            t = i / SR2; ph += 2 * math.pi * (50 + 90 * math.exp(-t * 30)) / SR2
            out.append(math.sin(ph) * math.exp(-t * 12) + (R.uniform(-1, 1) * math.exp(-t * (120 if kind != "pow" else 30)) * (0.5 if kind == "pow" else 0.3)))
    elif kind in ("whoosh", "rise"):
        lp = 0; m = n(0.45 if kind == "whoosh" else 1.0)
        for i in range(m):
            x = i / m; a = 0.04 + 0.5 * (math.sin(math.pi * x) if kind == "whoosh" else x); lp += a * (R.uniform(-1, 1) - lp)
            out.append(lp * (math.sin(math.pi * x) ** 1.5 if kind == "whoosh" else x ** 2) * 1.4)
    elif kind == "glitch":
        for i in range(n(0.3)):
            t = i / SR2; out.append((1 if math.sin(2 * math.pi * (200 + 900 * ((i // 900) % 3)) * t) > 0 else -1) * 0.25 * (1 if (i // 1200) % 2 else 0.3))
    elif kind == "zap": sweep(2400, 200, 0.35, 6, "sin", 0.5)
    elif kind == "pluck":
        for i in range(n(0.8)):
            t = i / SR2; out.append((math.sin(2 * math.pi * 659 * t) + 0.4 * math.sin(4 * math.pi * 659 * t)) * math.exp(-t * 7) * 0.5)
    elif kind in ("click", "type", "tick"):
        reps = 8 if kind == "type" else 1
        for r in range(reps):
            for i in range(n(0.07 if kind == "type" else 0.05)):
                t = i / SR2; out.append((R.uniform(-1, 1) * 0.5 + math.sin(2 * math.pi * 1800 * t) * 0.3) * math.exp(-t * 120))
    # ---- 柔和音效（无口播 Vibe 风格）----
    elif kind == "chime":       # 轻柔高音铃：光点出现、关键词
        for i in range(n(1.6)):
            t = i / SR2; out.append((math.sin(2 * math.pi * 1760 * t) + 0.5 * math.sin(2 * math.pi * 2637 * t) * math.exp(-t * 3)) * math.exp(-t * 2.6) * 0.22 * min(1, t / 0.003))
    elif kind == "swell":       # 柔和上扬：大字聚合、转场
        lp = 0; m = n(1.4)
        for i in range(m):
            x = i / m; t = i / SR2; lp += 0.05 * (R.uniform(-1, 1) - lp)
            out.append((lp * 2.5 + 0.25 * math.sin(2 * math.pi * (220 + 220 * x) * t)) * (x ** 2) * (1 - x) ** 0.3 * 0.9)
    elif kind == "glow":        # 低沉的光晕：重要画面出现
        for i in range(n(1.8)):
            t = i / SR2; out.append((math.sin(2 * math.pi * 110 * t) + 0.4 * math.sin(2 * math.pi * 165 * t)) * min(1, t / 0.25) * math.exp(-t * 1.8) * 0.45)
    elif kind == "shimmer":     # 闪烁：粒子散开 / 聚拢
        for i in range(n(1.2)):
            t = i / SR2; v = sum(math.sin(2 * math.pi * f * t + f) * math.exp(-t * (2 + k)) for k, f in enumerate((2093, 2637, 3136, 3951)))
            out.append(v * min(1, t / 0.08) * 0.08)
    elif kind == "page":
        lp = 0
        for i in range(n(0.35)):
            x = i / n(0.35); lp += 0.3 * (R.uniform(-1, 1) - lp); out.append(lp * math.sin(math.pi * x) * 0.9)
    else:
        print(f"  未知音效 {kind}，用 pop 代替", file=sys.stderr); return gen("pop")
    return out


bank = {k: gen(k) for k in {s["kind"] for s in SFX}}
fx = array("f", [0.0]) * int((TOTAL + 2) * SR2)
for s in SFX:
    add(fx, bank[s["kind"]], int(s["t"] * SR2), s["vol"])
write_wav(bpath(pdir, "sfx.wav"), fx, SR2)

# ---------------- 人声轨 + 混音 ----------------
M = cfg["mix"]
if cfg["voice"].get("engine") == "none":     # 无口播：只有配乐 + 音效，不做闪避
    # 不用动态 loudnorm：它会把音乐的起伏压平。先混好测整体响度，再整体线性增益到目标，最后限幅防爆音。
    pre = (f"[0:a]aresample=48000,volume={MUS.get('volume', 0.26) if MUS.get('enabled', True) else 0}[m];"
           f"[1:a]volume={M.get('sfx_volume', 0.30)}[fx];"
           f"[m][fx]amix=inputs=2:normalize=0,apad,atrim=0:{TOTAL},afade=t=in:d=0.6,afade=t=out:st={max(0, TOTAL - 2.5)}:d=2.5")
    raw = bpath(pdir, "mix_raw.wav")
    run(["ffmpeg", "-y", "-v", "error", "-i", bpath(pdir, "bgm.wav"), "-i", bpath(pdir, "sfx.wav"), "-filter_complex", pre + "[a]",
         "-map", "[a]", "-ar", "48000", "-ac", "2", raw])
    import re, subprocess
    r = subprocess.run(["ffmpeg", "-i", raw, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf8", errors="replace").stderr
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); gain = M.get("loudness", -14) - lufs
    run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=5:release=80:level=false",
         "-ar", "48000", "-ac", "2", bpath(pdir, "mix.wav")])
    print(f"混音完成（无口播，线性增益 {gain:+.1f} dB）：{TOTAL:.2f}s，音效 {len(SFX)} 个"); sys.exit(0)
inputs, fl = [], []
for k, p in enumerate(PAR):
    inputs += ["-i", bpath(pdir, "audio", f"{p['id']}.wav")]; ms = int(p["start"] * 1000); fl.append(f"[{k}:a]adelay={ms}|{ms}[v{k}]")
fl.append("".join(f"[v{k}]" for k in range(len(PAR))) + f"amix=inputs={len(PAR)}:normalize=0,apad,atrim=0:{TOTAL}[vo]")
run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(fl), "-map", "[vo]", "-ar", "48000", bpath(pdir, "voice.wav")])
M = cfg["mix"]
fc = ("[0:a]highpass=f=70,equalizer=f=2500:t=q:w=1.2:g=2,loudnorm=I=-16:TP=-2:LRA=9,asplit=2[v1][v2];"
      f"[1:a]aresample=48000,volume={MUS.get('volume', 0.26) if MUS.get('enabled', True) else 0}[m];"
      "[m][v1]sidechaincompress=threshold=0.04:ratio=4:attack=30:release=350[md];"
      f"[2:a]volume={M.get('sfx_volume', 0.30)}[fx];"
      f"[v2][md][fx]amix=inputs=3:normalize=0,atrim=0:{TOTAL},afade=t=in:d=0.3,afade=t=out:st={max(0, TOTAL - 1.0)}:d=1.0,"
      f"loudnorm=I={M.get('loudness', -14)}:TP=-1.5:LRA=11[a]")
run(["ffmpeg", "-y", "-v", "error", "-i", bpath(pdir, "voice.wav"), "-i", bpath(pdir, "bgm.wav"), "-i", bpath(pdir, "sfx.wav"),
     "-filter_complex", fc, "-map", "[a]", "-ar", "48000", "-ac", "2", bpath(pdir, "mix.wav")])
print(f"混音完成：{TOTAL:.2f}s，音效 {len(SFX)} 个")
