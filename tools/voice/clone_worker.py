"""本人音色合成（在独立的语音环境里运行，不是系统 Python）。由 tools/tts.py 调用，一次加载模型、批量合成。
用法：<语音环境的 python> clone_worker.py --config <voice.json> --jobs <jobs.json>
  jobs.json：[{"text": "要读的话", "out": "输出.wav"}, ...]
  voice.json（本机配置，不在仓库里，见 docs/本人音色.md）：
    { "python": ..., "model": "Qwen/Qwen3-TTS-12Hz-0.6B-Base", "hf_home": ..., "ref_audio": ..., "ref_text": "参考录音的逐字稿（可空）",
      "x_vector_only": false, "language": "Chinese", "device": "cuda:0" }
没有核对过的逐字稿时用 x_vector_only（只取音色特征，相似度略低）。
"""
import argparse, inspect, json, os, sys, time

ap = argparse.ArgumentParser()
ap.add_argument("--config", required=True); ap.add_argument("--jobs", required=True)
a = ap.parse_args()
C = json.load(open(a.config, encoding="utf8")); jobs = json.load(open(a.jobs, encoding="utf8"))
if C.get("hf_home"): os.environ.setdefault("HF_HOME", C["hf_home"])
if C.get("hf_endpoint"): os.environ.setdefault("HF_ENDPOINT", C["hf_endpoint"])

import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

t0 = time.time()
dev = C.get("device") or ("cuda:0" if torch.cuda.is_available() else "cpu")
kw = dict(device_map=dev, dtype=torch.bfloat16 if dev.startswith("cuda") else torch.float32)
try:
    import flash_attn  # noqa: F401  可选加速
    kw["attn_implementation"] = "flash_attention_2"
except Exception:
    pass
model = Qwen3TTSModel.from_pretrained(C.get("model", "Qwen/Qwen3-TTS-12Hz-0.6B-Base"), **kw)
print(json.dumps({"stage": "loaded", "device": dev, "secs": round(time.time() - t0, 1)}), flush=True)

ref_text = (C.get("ref_text") or "").strip()
xv = bool(C.get("x_vector_only")) or not ref_text
lang = C.get("language", "Chinese")
gen_params = inspect.signature(model.generate_voice_clone).parameters
ref = dict(ref_audio=C["ref_audio"])
if ref_text and not xv: ref["ref_text"] = ref_text
if "x_vector_only_mode" in gen_params or hasattr(model, "create_voice_clone_prompt"): ref["x_vector_only_mode"] = xv

# 同一个音色反复合成：先做一次参考提示，后面复用（新版 qwen-tts 支持；旧版就每次直接传参考录音）
prompt = None
if hasattr(model, "create_voice_clone_prompt"):
    try:
        pp = inspect.signature(model.create_voice_clone_prompt).parameters
        prompt = model.create_voice_clone_prompt(**{k: v for k, v in ref.items() if k in pp})
    except Exception as e:
        print(json.dumps({"stage": "prompt_fallback", "error": str(e)[:200]}), flush=True)

for i, j in enumerate(jobs):
    t1 = time.time()
    args = dict(text=j["text"], language=lang)
    if prompt is not None: args["voice_clone_prompt"] = prompt
    else: args.update({k: v for k, v in ref.items() if k in gen_params})
    wavs, sr = model.generate_voice_clone(**args)
    os.makedirs(os.path.dirname(os.path.abspath(j["out"])), exist_ok=True)
    sf.write(j["out"], wavs[0], sr)
    print(json.dumps({"stage": "done", "i": i, "out": j["out"], "secs": round(time.time() - t1, 1)}), flush=True)
print(json.dumps({"stage": "all", "n": len(jobs), "secs": round(time.time() - t0, 1), "mode": "x_vector_only" if xv else "ref_text"}), flush=True)
