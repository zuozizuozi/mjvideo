"""配音：每个镜头整段合成（不拼词），保存 wav + 逐词时间。按文本哈希缓存，没改的镜头不重新合成。
引擎：
  edge  —— 微软在线语音（免费，需联网），带逐词时间
  file  —— 用户自己录的音频：shot.audio 指向文件；没有逐词时间，字幕按字数均分
用法：python tools/tts.py <项目目录> [镜头id ...]
"""
import asyncio, hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import load_project, bpath, run, probe_dur

pdir = sys.argv[1]; only = set(sys.argv[2:])
cfg = load_project(pdir); V = cfg["voice"]
if V.get("engine") == "none":
    print("无口播模式（voice.engine = none），跳过配音"); sys.exit(0)


def key_of(shot):
    src = shot.get("audio") or ""
    return hashlib.sha1(json.dumps([shot.get("tts") or shot["text"], V, src], ensure_ascii=False).encode()).hexdigest()[:16]


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
    raise SystemExit(f"配音失败：{text[:20]}…")


async def main():
    for shot in cfg["shots"]:
        sid = shot["id"]
        if only and sid not in only: continue
        meta_p = bpath(pdir, "audio", f"{sid}.json"); wav = bpath(pdir, "audio", f"{sid}.wav")
        k = key_of(shot)
        if os.path.exists(meta_p) and os.path.exists(wav) and json.load(open(meta_p, encoding="utf8")).get("key") == k:
            print(f"{sid} 缓存命中"); continue
        text = shot.get("tts") or shot["text"]          # tts 字段可以写成更好读的版本（比如 Opus 五点五）
        engine = "file" if shot.get("audio") else V.get("engine", "edge")
        if engine == "edge":
            mp3 = bpath(pdir, "audio", f"{sid}.mp3")
            words = await edge(text, mp3)
            run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ar", "48000", "-ac", "1", wav])
        elif engine == "file":
            src = os.path.join(pdir, shot["audio"])
            run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af",
                 "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
                 "-ar", "48000", "-ac", "1", wav])
            words = []
        else:
            raise SystemExit(f"未实现的配音引擎：{engine}（可用：edge / file）")
        dur = probe_dur(wav)
        json.dump({"key": k, "dur": dur, "words": words, "engine": engine}, open(meta_p, "w", encoding="utf8"), ensure_ascii=False)
        print(f"{sid} {engine} {dur:.2f}s {len(words)} 词")

asyncio.run(main())
