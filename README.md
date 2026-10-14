# mjvideo · 麻酱代码视频引擎

把一个科普主题或一篇讲稿，变成带配音、字幕、配乐和音效的讲解视频。
画面全部由代码逐帧绘制（Canvas），用本机 Chrome 无头渲染、FFmpeg 编码。**不调用任何视频生成模型，不依赖 Remotion 等商业授权框架，没有 npm 依赖。**

来源：从《一行代码，怎么变成一段视频？》（11 种风格，2915 帧）的真实工程整理而来，回归测试可以重新渲染出同一条片子（见下文）。
给 Coding Agent 的执行手册：[SKILL.md](SKILL.md)。接入 Codex / Claude Code / Zaovra / Cursor：[docs/MCP接入.md](docs/MCP接入.md)（MCP 服务 `mcp/server.mjs`）。制作复盘：[docs/复盘.md](docs/复盘.md)。

## 依赖

| 依赖 | 版本 | 用途 | 检查 |
|---|---|---|---|
| Node.js | ≥ 22（实测 24.13） | 命令行、浏览器通信（内置 WebSocket） | `node --version` |
| Google Chrome | 实测 Windows 版 | 无头逐帧渲染 | 路径不同时设 `MJV_CHROME` |
| FFmpeg | 实测 8.0.1，需要 libx264 | 编码、拼接、混音、质检 | `ffmpeg -version` |
| Python | 3.8+（实测 3.8.6） | 配音、时间轴、配乐、质检 | `python --version`，路径不同时设 `MJV_PYTHON` |
| edge-tts（pip） | 实测 7.2.8 | 默认配音（免费，需联网） | `python -c "import edge_tts"` |
| Pillow（pip） | 实测 7.2 | 量字幕宽度 | `python -c "import PIL"` |
| jieba（pip） | 任意 | 字幕按词切分 | `python -c "import jieba"` |
| 字体 | 系统自带 | 汉仪雅酷黑 85W（标题）、楷体、微软雅黑、Consolas | **商用前确认授权**，可在 project.json 的 `fonts` 换成思源黑体等 |

安装 Python 包：`pip install edge-tts pillow jieba`

## 快速开始

```bash
cd "F:/opus vedio/mjvideo"
node bin/mjv.mjs new projects/my_topic        # 新建项目
#   编辑 projects/my_topic/project.json：讲稿和分镜（格式见 SKILL.md 第 6 节）
#   需要新画面时在 projects/my_topic/scenes/ 写场景（模板 templates/scene.template.js）
node bin/mjv.mjs scenes projects/my_topic     # 看有哪些场景可以复用
node bin/mjv.mjs tts projects/my_topic        # 配音（有缓存）
node bin/mjv.mjs timeline projects/my_topic   # 时间轴
node bin/mjv.mjs check projects/my_topic      # 场景报错、cue、字幕宽度
node bin/mjv.mjs stills projects/my_topic 2 5.5 9   # 抽静帧自查
node bin/mjv.mjs render projects/my_topic     # 增量渲染（--dry 只看计划，--force 全部重渲，--only=s03,s04）
node bin/mjv.mjs audio projects/my_topic      # 配乐 + 音效 + 混音
node bin/mjv.mjs mux projects/my_topic        # 成片 → output/成片.mp4
node bin/mjv.mjs validate projects/my_topic   # 质检
# 或者一条命令跑完 tts → validate：
node bin/mjv.mjs build projects/my_topic
node bin/mjv.mjs promote projects/my_topic <场景名>   # 好场景收进场景库
```

**试玩解说**（给无声录屏，AI 写解说、配音、剪辑、出封面）：`new --template=gameplay` → `footage` → 见 SKILL.md 第 17 节和 `prompts/game_commentary.md`。

**工作台**（看风格和场景、选风格、换场景、写意见、传素材和录屏）：双击 `打开工作台.bat`，或 `node bin/mjv.mjs studio`，浏览器打开 http://127.0.0.1:5178 。

无口播横屏（字幕 + 配乐）：
```bash
node bin/mjv.mjs styles                                   # 12 套风格包
node bin/mjv.mjs previews                                 # 生成风格样张和场景预览（加了新场景 / 风格后跑）
node bin/mjv.mjs new projects/my_topic --style=paper      # 用风格包起步（主题写进 project.json，可以随便改）
node bin/mjv.mjs ref projects/my_topic 参考视频.mp4 参考图.jpg   # 分析参考素材 → refs/（拼图、色板、节奏）
```
每条视频先做美术方案（`prompts/art_director.md`），场景颜色从主题取，图片在 project.json 的 `images` 登记。详见 SKILL.md 第 11–15 节。

## 目录

```
mjvideo/
├─ bin/mjv.mjs              统一命令行入口
├─ engine/
│  ├─ lib.js                场景注册 + 绘图/缓动/随机数工具（MJ.lib）
│  ├─ runtime.js            时间轴、转场、字幕、头像、seek(t)、质检数据
│  └─ scenes/               场景库（零件库）：竖屏 11 个 + 无口播 10 个 vibe_* + 通用图片场景 image_reveal
├─ tools/
│  ├─ tts.py                配音（edge-tts / 自录音频），按文本缓存
│  ├─ timeline.py           逐字时间、字幕、总时长
│  ├─ audio.py              代码合成配乐 + 音效 + 混音
│  ├─ validate.py           质检
│  ├─ silent.py             无口播时间轴
│  ├─ ref.py                参考素材分析
│  ├─ common.py             公共函数、字幕切分
│  └─ port_show.py          把原版 show.js 拆成场景库的迁移脚本（留档）
├─ games/                   登记过的游戏（mjv game add 生成：实测数据 + 文档路径）
├─ styles/                  风格包（每个一个 style.json：主题配色、字体、纹理）
├─ templates/               project.example.json、project.vibe.example.json、scene.template.js
├─ prompts/                 director.md（编导）、art_director.md（美术方案）、scene_author.md（场景作者）
├─ mcp/server.mjs           MCP 服务（docs/MCP接入.md）
├─ studio/                  工作台前端（ui/）和风格样张项目（showcase/）
├─ docs/复盘.md
├─ assets/avatar.png        默认头像
├─ projects/
│  ├─ regress_code_video/          回归测试：《一行代码，怎么变成一段视频？》
│  ├─ demo_rubber_entropy/         新知识点验证：橡皮筋的熵力（约 13 秒）
│  └─ demo_rubber_entropy_landscape/  横屏测试（只做了静帧）
└─ SKILL.md
```
每个项目：`project.json`（配置和分镜）、`scenes/`（项目自己的场景）、`assets/`、`build/`（中间产物，可删）、`output/`（成片）。

## 架构

| 模块 | 实现 | 自动化程度 |
|---|---|---|
| Director 编导 | Agent 按 `prompts/director.md` 写 `project.json` | Agent 完成 |
| Scene Generator 动画 | 复用 `engine/scenes/`、改 `params`、或 Agent 按 `prompts/scene_author.md` 新写场景 | 复用和改参数是配置；新场景由 Agent 写代码 |
| Timeline 时间轴 | `tools/timeline.py` + `engine/runtime.js` | 自动 |
| Audio 声音 | `tools/tts.py`、`tools/audio.py` | 自动 |
| Renderer 渲染 | `bin/mjv.mjs render`：Chrome DevTools 协议逐帧截图 → FFmpeg；按镜头分段、按指纹增量 | 自动 |
| Validator 质检 | `bin/mjv.mjs check`（加载期）+ `tools/validate.py`（成片） | 自动 |

## 回归测试

基准：`projects/regress_code_video/reference/成片_原版.mp4`（原工程交付的成片）。

```bash
node bin/mjv.mjs build projects/regress_code_video
# 按帧号严格对齐比较画面（不要用默认的按时间戳配对，原版文件会错配）：
ffmpeg -i projects/regress_code_video/output/成片.mp4 -i projects/regress_code_video/reference/成片_原版.mp4 \
  -lavfi "[0:v]trim=end_frame=2913,setpts=N/30/TB[a];[1:v]setpts=N/30/TB[b];[a][b]psnr" -f null -
```
通过标准：每一帧 PSNR ≥ 40 dB（只有编码差异）；validate 无 FAIL。实测结果见 [docs/验收报告.md](docs/验收报告.md)（最低 43.57 dB，中位 53.12 dB）。

## 已知限制

- 配音默认是晓伊（edge-tts）。本人音色克隆需要另装模型（见 `C:\Users\Administrator\Desktop\opus视频\备忘录_待办.md`），目前可用 `audio` 字段接入自录音频。
- 只支持 Canvas 场景。DOM/CSS 动画场景（《AI说改好了》那种）没有接入；Three.js 可通过 `vendorScripts` 引入，但还没有实际跑过。
- 横屏：原生横屏场景（`design: [1920, 1080]`）已经出过完整成片（`projects/ep09_llm`）。竖屏设计的场景放进横屏只会等比放在中间。
- 无口播模式（`voice.engine: "none"` + 镜头 `lines`）和场景字幕（`overlay.subtitles: "scene"`）见 SKILL.md 第 11 节。
- 渲染速度和画面复杂度有关：竖屏《一行代码》约 10 帧/秒；横屏 Vibe 粒子场景实测见 docs/验收报告.md 第 8 节。
- 确定性：同样的渲染顺序逐像素可复现；大量使用 `shadowBlur` 发光的镜头单独重渲时可能有 1–2 级像素误差（肉眼不可见）。
- 自录音频、Three.js 还没有实际跑过；`render --only`、`--force` 的实测见 docs/验收报告.md 第 8 节。
- 封面和发布文案不在引擎范围内。
- 字体：标题字体 HYYakuHei、微软雅黑商用需要授权；Vibe 风格用的思源宋体（`assets/fonts/`，SIL OFL）可以商用。
