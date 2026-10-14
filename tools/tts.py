"""配音：每个镜头整段合成（不拼词），保存 wav + 逐词时间。按文本哈希缓存，没改的镜头不重新合成。
引擎（project.json 的 voice.engine）：
  edge  —— 微软在线语音（免费，需联网），带逐词时间
  clone —— 本人音色（本机的 Qwen3-TTS 语音环境，见 docs/本人音色.md）；没有逐词时间，字幕按字数均分
           本机没装时：voice.fallback 写了 "edge" 就用 AI 声音代替并醒目提醒，否则报错并告诉用户怎么装
  file  —— 用户自己录的音频：shot.audio 指向文件；没有逐词时间，字幕按字数均分
用法：python tools/tts.py <项目目录> [镜头id ...]
"""
import asyncio, hashlib, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import load_project, bpath, run, probe_dur

pdir = sys.argv[1]; only = set(sys.argv[2:])
cfg = load_project(pdir); V = cfg["voice"]
if V.get("engine") == "none":
    print("无口播模式（voice.engine = none），跳过配音"); sys.exit(0)


def voice_config():
    """本机的本人音色配置（不在仓库里）：~/.mjvideo/voice.json，或环境变量 MJV_VOICE_CONFIG 指定。返回 (配置或 None, 路径, 原因)。"""
    p = os.environ.get("MJV_VOICE_CONFIG") or os.path.join(os.path.expanduser("~"), ".mjvideo", "voice.json")
    if not os.path.exists(p): return None, p, "这台电脑还没装本人音色"
    c = json.load(open(p, encoding="utf8"))
    for k in ("python", "ref_audio"):
        if not os.path.exists(c.get(k, "")): return None, p, f"本人音色配置里的 {k} 不存在：{c.get(k)}"
    return c, p, ""


ENGINE = V.get("engine", "edge")
CLONE, CLONE_PATH, WHY = (voice_config() if ENGINE == "clone" else (None, "", ""))
if ENGINE == "clone" and not CLONE:
    tip = f"{WHY}。在这台电脑上运行：node bin/mjv.mjs voice install，然后 node bin/mjv.mjs voice setup --ref=<本人录音.wav>（说明见 docs/本人音色.md）"
    if V.get("fallback"):
        ENGINE = V["fallback"]
        bar = "!" * 60
        print(f"{bar}\n  ⚠ 没有用本人音色：{tip}\n  这次先用 {ENGINE} 的 AI 声音代替。交付时必须告诉用户。\n{bar}", file=sys.stderr)
        os.makedirs(bpath(pdir, "audio"), exist_ok=True)
        open(bpath(pdir, "audio", "VOICE_FALLBACK.txt"), "w", encoding="utf8").write(f"本人音色不可用，改用 {ENGINE}：{tip}\n")
    else:
        raise SystemExit("✗ " + tip)
elif os.path.exists(bpath(pdir, "audio", "VOICE_FALLBACK.txt")):
    os.remove(bpath(pdir, "audio", "VOICE_FALLBACK.txt"))
CLONE_SIG = [CLONE.get("model"), CLONE["ref_audio"], os.path.getmtime(CLONE["ref_audio"]), CLONE.get("ref_text", ""), CLONE.get("x_vector_only", False)] if CLONE else None


def key_of(shot):
    src = shot.get("audio") or ""
    parts = [shot.get("tts") or shot["text"], V, src]
    if V.get("engine") == "clone": parts += [ENGINE, CLONE_SIG]       # 只有本人音色才多算这两项（老项目的缓存键保持不变）
    return hashlib.sha1(json.dumps(parts, ensure_ascii=False).encode()).hexdigest()[:16]


async def edge(text, mp3):
    import edge_tts
    for attempt in range(6):
        words = []
        try:
            com = edge_tts.Communicate(text, V.get("voice", "zh-CN-XiaoyiNeural"), rate=V.get("rate", "+0%"), boundary="WordBoundary")
            with open(mp3, "wb") as f:
                async for ch in com.stream():
                    if ch["type"] == "audio": f.write(ch["data"])
                    elif ch["type"] == "WordBoundary": words.append({"t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7, "w": ch["text"]})
            if os.path.getsize(mp3) > 2000 and words:
                return words
        except Exception as e:
            print("  重试", attempt + 1, e, file=sys.stderr)
        await asyncio.sleep(1.5)
    raise SystemExit(f"配音失败：{text[:20]}…（微软在线语音连不上：检查网络；返回 403 时运行 pip install -U edge-tts）")


def trim(src, wav):     # 去掉首尾静音，转 48k 单声道
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af",
         "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
         "-ar", "48000", "-ac", "1", wav])


def save(sid, k, wav, words, engine):
    dur = probe_dur(wav)
    json.dump({"key": k, "dur": dur, "words": words, "engine": engine}, open(bpath(pdir, "audio", f"{sid}.json"), "w", encoding="utf8"), ensure_ascii=False)
    print(f"{sid} {engine} {dur:.2f}s {len(words)} 词")


async def main():
    clone_jobs = []
    for shot in cfg["shots"]:
        sid = shot["id"]
        if only and sid not in only: continue
        meta_p = bpath(pdir, "audio", f"{sid}.json"); wav = bpath(pdir, "audio", f"{sid}.wav")
        k = key_of(shot)
        if os.path.exists(meta_p) and os.path.exists(wav) and json.load(open(meta_p, encoding="utf8")).get("key") == k:
            print(f"{sid} 缓存命中"); continue
        text = shot.get("tts") or shot["text"]          # tts 字段可以写成更好读的版本
        engine = "file" if shot.get("audio") else ENGINE
        if engine == "edge":
            mp3 = bpath(pdir, "audio", f"{sid}.mp3")
            words = await edge(text, mp3)
            run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ar", "48000", "-ac", "1", wav])
            save(sid, k, wav, words, engine)
        elif engine == "file":
            trim(os.path.join(pdir, shot["audio"]), wav); save(sid, k, wav, [], engine)
        elif engine == "clone":
            clone_jobs.append({"sid": sid, "k": k, "text": text, "out": bpath(pdir, "audio", f"{sid}.clone.wav")})
        else:
            raise SystemExit(f"未实现的配音引擎：{engine}（可用：edge / clone / file）")
    if clone_jobs:                                   # 本人音色：一次加载模型，批量合成
        jp = bpath(pdir, "audio", "clone_jobs.json")
        json.dump([{"text": j["text"], "out": j["out"]} for j in clone_jobs], open(jp, "w", encoding="utf8"), ensure_ascii=False)
        print(f"本人音色：合成 {len(clone_jobs)} 段（第一次要加载模型，稍等）…")
        worker = os.path.join(os.path.dirname(__file__), "voice", "clone_worker.py")
        r = subprocess.run([CLONE["python"], worker, "--config", CLONE_PATH, "--jobs", jp], text=True, encoding="utf8", errors="replace", capture_output=True)
        if r.returncode != 0:
            raise SystemExit("本人音色合成失败：\n" + r.stderr[-1500:])
        for j in clone_jobs:
            wav = bpath(pdir, "audio", f"{j['sid']}.wav"); trim(j["out"], wav); save(j["sid"], j["k"], wav, [], "clone")

asyncio.run(main())
