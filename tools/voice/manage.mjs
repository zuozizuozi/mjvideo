// 本人音色：安装、设置参考录音、试音、查看状态。说明见 docs/本人音色.md。
//   node bin/mjv.mjs voice install [--dir=F:/mjv-voice] [--cpu]   装独立语音环境（Python 3.12 + PyTorch + qwen-tts + Qwen3-TTS 0.6B），约 5GB
//   node bin/mjv.mjs voice setup --ref=<本人录音.wav> [--text="录音里逐字说的话"]
//        没给 --text 时自动转写一份草稿（会有错字），先用"只取音色特征"模式；本人核对后再 setup --text= 补上，相似度更高
//   node bin/mjv.mjs voice test [--text="试音文本"]                  合成一段试音 → ~/.mjvideo/voice_test.wav
//   node bin/mjv.mjs voice status
// 本机配置写在 ~/.mjvideo/voice.json（不在仓库里）。参考录音复制到 ~/.mjvideo/ref.wav，**不要放进仓库**（仓库是公开的）。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = path.join(os.homedir(), ".mjvideo"), CFG = process.env.MJV_VOICE_CONFIG || path.join(HOME, "voice.json");
const MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-Base";
const read = () => (fs.existsSync(CFG) ? JSON.parse(fs.readFileSync(CFG, "utf8")) : {});
const write = (c) => { fs.mkdirSync(path.dirname(CFG), { recursive: true }); fs.writeFileSync(CFG, JSON.stringify(c, null, 2)); };
const sh = (cmd, args, env = {}, opt = {}) => { console.log("  $ " + [cmd, ...args].join(" ").slice(0, 160)); const r = spawnSync(cmd, args, { stdio: opt.capture ? "pipe" : "inherit", encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", ...env } }); if (r.status !== 0 && !opt.ok) throw new Error(`${cmd} 失败（退出码 ${r.status}）${opt.capture ? "\n" + (r.stderr || "").slice(-800) : ""}`); return r; };

export async function voice(ROOT, sub, flags) {
  const PY = process.env.MJV_PYTHON || (process.platform === "win32" ? "python" : "python3");
  if (sub === "install") {
    const dir = path.resolve(String(flags.dir || (process.platform === "win32" && fs.existsSync("F:/") ? "F:/mjv-voice" : path.join(os.homedir(), "mjv-voice"))));
    const env = { UV_CACHE_DIR: path.join(dir, "uv-cache"), UV_PYTHON_INSTALL_DIR: path.join(dir, "python") };
    console.log(`安装本人音色环境到 ${dir}（约 5GB，需要联网）`);
    fs.mkdirSync(dir, { recursive: true });
    if (sh(PY, ["-m", "uv", "--version"], {}, { ok: true, capture: true }).status !== 0) sh(PY, ["-m", "pip", "install", "-q", "uv"]);
    sh(PY, ["-m", "uv", "python", "install", "3.12"], env);
    const venv = path.join(dir, "venv"), vpy = path.join(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    if (!fs.existsSync(vpy)) sh(PY, ["-m", "uv", "venv", "--python", "3.12", venv], env);
    const gpu = !flags.cpu && spawnSync("nvidia-smi", [], { stdio: "ignore" }).status === 0;
    console.log(gpu ? "检测到 NVIDIA 显卡：装 CUDA 12.8 版 PyTorch" : "⚠ 没有 NVIDIA 显卡：装 CPU 版，合成会很慢（几十秒一句）");
    // 顺序很重要：先装 qwen-tts 等依赖，最后再装显卡版 PyTorch 并强制替换。
    // 反过来装（或者用 -U 升级全部）会被 PyPI 上更新的 CPU 版 PyTorch 顶掉，显卡就用不上了。
    sh(PY, ["-m", "uv", "pip", "install", "--python", vpy, "qwen-tts", "soundfile", "faster-whisper"], env);
    sh(PY, ["-m", "uv", "pip", "install", "--python", vpy, "torch", "torchaudio", "--reinstall-package", "torch", "--reinstall-package", "torchaudio",
      ...(gpu ? ["--index-url", "https://download.pytorch.org/whl/cu128"] : ["--index-url", "https://download.pytorch.org/whl/cpu"])], env);
    const chk = sh(vpy, ["-c", "import torch,torchaudio;print(torch.__version__, torch.cuda.is_available())"], {}, { capture: true });
    console.log("  PyTorch：" + chk.stdout.trim());
    if (gpu && !/True/.test(chk.stdout)) throw new Error("PyTorch 装成了 CPU 版或显卡驱动太旧：更新 NVIDIA 驱动后重跑 voice install");
    // 有的电脑设了 HF_HUB_OFFLINE=1（禁止联网下载模型），这里下载时临时关掉
    const hf = path.join(dir, "hf"), dl = `from huggingface_hub import snapshot_download; snapshot_download("${MODEL}")`, online = { HF_HUB_OFFLINE: "0", TRANSFORMERS_OFFLINE: "0" };
    let hfEndpoint = "";
    if (sh(vpy, ["-c", dl], { HF_HOME: hf, ...online }, { ok: true }).status !== 0) {
      console.log("Hugging Face 连不上，改用国内镜像 hf-mirror.com …"); hfEndpoint = "https://hf-mirror.com";
      sh(vpy, ["-c", dl], { HF_HOME: hf, HF_ENDPOINT: hfEndpoint, ...online });
    }
    const c = read(); write({ ...c, python: vpy, model: MODEL, hf_home: hf, ...(hfEndpoint ? { hf_endpoint: hfEndpoint } : {}), language: "Chinese", device: gpu ? "cuda:0" : "cpu" });
    console.log(`✓ 语音环境装好了。配置：${CFG}\n  下一步：node bin/mjv.mjs voice setup --ref=<本人录音.wav>`);
    return;
  }
  const c = read();
  if (sub === "setup") {
    if (!c.python) throw new Error("还没装语音环境：先 node bin/mjv.mjs voice install");
    if (flags.ref) {
      const src = path.resolve(String(flags.ref)); if (!fs.existsSync(src)) throw new Error("找不到录音：" + src);
      const dst = path.join(HOME, "ref.wav"); fs.mkdirSync(HOME, { recursive: true });
      sh("ffmpeg", ["-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "24000", dst]);
      c.ref_audio = dst; c.ref_source = src; c.ref_text = ""; c.ref_text_verified = false;
    }
    if (!c.ref_audio) throw new Error("要给参考录音：--ref=<本人录音.wav>（10–20 秒、只有本人说话、正常语速）");
    if (flags.text) { c.ref_text = String(flags.text); c.ref_text_verified = true; c.x_vector_only = false; console.log("✓ 已写入核对过的逐字稿，用完整克隆模式"); }
    else if (!c.ref_text) {
      console.log("没有逐字稿：自动转写一份草稿（机器转写会有错字）…");
      const r = sh(c.python, [path.join(ROOT, "tools", "voice", "transcribe.py"), c.ref_audio, "--hf_home", c.hf_home || ""], { HF_HUB_OFFLINE: "0", ...(c.hf_endpoint ? { HF_ENDPOINT: c.hf_endpoint } : {}) }, { capture: true });
      const line = r.stdout.trim().split("\n").pop(); const j = JSON.parse(line);
      c.ref_text_draft = j.text; c.x_vector_only = true;
      console.log(`  草稿：${j.text}\n  ⚠ 现在先用"只取音色特征"模式（不需要逐字稿，相似度略低）。\n  请本人听一遍录音，把上面的草稿改成逐字准确的文字，再运行：\n  node bin/mjv.mjs voice setup --text="改好的逐字稿"`);
    }
    write(c); return;
  }
  if (sub === "test") {
    if (!c.python || !c.ref_audio) throw new Error("还没装好：先 voice install，再 voice setup --ref=…");
    const text = String(flags.text || "大家好，我是麻酱。今天带大家看一个游戏，它从画面到音乐，全是 AI 用代码写出来的。");
    const jobs = path.join(HOME, "test_jobs.json"), out = path.join(HOME, "voice_test.wav");
    fs.writeFileSync(jobs, JSON.stringify([{ text, out }]));
    sh(c.python, [path.join(ROOT, "tools", "voice", "clone_worker.py"), "--config", CFG, "--jobs", jobs]);
    console.log(`✓ 试音：${out}（模式：${c.x_vector_only ? "只取音色特征" : "完整克隆"}）`); return;
  }
  // status
  console.log(`配置：${CFG}${fs.existsSync(CFG) ? "" : "（不存在：还没装）"}`);
  for (const [k, v] of Object.entries(c)) console.log(`  ${k}: ${typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "…" : v}`);
  const ok = c.python && fs.existsSync(c.python) && c.ref_audio && fs.existsSync(c.ref_audio);
  console.log(ok ? `✓ 本人音色可用（${c.x_vector_only ? "只取音色特征，逐字稿还没核对" : "完整克隆"}）` : "✗ 本人音色不可用：node bin/mjv.mjs voice install → voice setup --ref=…");
}
