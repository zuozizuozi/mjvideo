"""把参考录音转成逐字稿草稿（在语音环境里运行）。结果只是草稿：机器转写会有错字，必须本人听一遍改对再用。
用法：<语音环境的 python> transcribe.py <录音> [--model large-v3-turbo]
"""
import argparse, json, os
ap = argparse.ArgumentParser(); ap.add_argument("audio"); ap.add_argument("--model", default="large-v3-turbo"); ap.add_argument("--hf_home")
a = ap.parse_args()
if a.hf_home: os.environ["HF_HOME"] = a.hf_home
from faster_whisper import WhisperModel
import torch
dev = "cuda" if torch.cuda.is_available() else "cpu"
m = WhisperModel(a.model, device=dev, compute_type="float16" if dev == "cuda" else "int8")
# 自己解码成 16kHz 单声道数组再交给 faster-whisper：它自带的解码依赖 PyAV，新版 PyAV 和它不兼容
import soundfile as sf, librosa
wav, sr = sf.read(a.audio, dtype="float32", always_2d=True)
wav = librosa.resample(wav.mean(axis=1), orig_sr=sr, target_sr=16000) if sr != 16000 else wav.mean(axis=1)
segs, info = m.transcribe(wav, language="zh", initial_prompt="以下是普通话的句子，带标点。", vad_filter=True)
text = "".join(s.text.strip() for s in segs)
print(json.dumps({"text": text, "duration": round(info.duration, 2)}, ensure_ascii=False))
