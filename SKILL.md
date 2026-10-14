---
name: mj-video
description: 用纯代码（Canvas/HTML + 无头 Chrome 逐帧渲染 + FFmpeg）把一个科普主题或讲稿做成带配音、字幕、配乐的竖屏讲解视频。当用户要“做一条科普/讲解视频”“把这篇讲稿做成视频”“给某个知识点做动画”时使用。不调用任何视频生成模型。
---

# mj-video：从讲稿到成片的代码视频工作流

引擎目录：`F:\opus vedio\mjvideo`（下面所有命令都在这个目录里执行）。
入口：`node bin/mjv.mjs <命令> <项目目录>`。项目放在 `projects/<项目名>/`。

你的角色有两个：**编导**（规划叙事和镜头）和**动画作者**（复用、改参数或新写场景代码）。
其余步骤（配音、时间轴、渲染、混音、质检）都是命令，照着跑就行。

---

## 0. 开工前检查（每次新会话都做）

```bash
node --version          # 需要 ≥ 22（内置 WebSocket）
ffmpeg -version         # 需要 libx264
python --version        # 3.8+，并且 python -c "import edge_tts, PIL, jieba" 不报错
node bin/mjv.mjs scenes # 能列出场景库
```
Chrome 默认路径 `C:/Program Files/Google/Chrome/Application/chrome.exe`，不同就设环境变量 `MJV_CHROME`。
配音默认用 edge-tts（免费，需要联网）。

如果用户有自己的制作规范（例如 `E:\公司工作区\视频制作规范`）或记忆里有平台规则，**先读完再动手**，规范优先于本文件的默认值。

---

## 1. 标准流程

```
主题/讲稿 → [1] 编导：写 project.json（讲稿 + 分镜）
          → [2] 选场景：复用 / 改参数 / 改代码 / 新写
          → [3] node bin/mjv.mjs tts + timeline
          → [4] node bin/mjv.mjs check + stills（抽帧自查，修到满意）
          → [5] node bin/mjv.mjs render（增量）
          → [6] node bin/mjv.mjs audio + mux + validate
          → [7] 交付成片；好场景 promote 进场景库
```
`node bin/mjv.mjs build <项目>` 会一口气跑完 3–6，但**第一次做一定要分步跑**，在第 4 步看过静帧再渲染整片。

### [1] 编导：写讲稿和分镜

```bash
node bin/mjv.mjs new projects/<项目名>      # 生成 project.json 模板和目录
```
然后改 `projects/<项目名>/project.json`。格式见第 6 节。编导规则：

1. **先定一句话主线**：这条视频要让观众明白的那一件事。
2. **结构用递进链**：每个镜头回答上一个镜头留下的问题，不要并列罗列“第一、第二、第三”。
   开头 1 句就让观众知道讲什么、和自己有什么关系；结尾回收主线，不要中途插关注口播。
3. **一个镜头一段口播**：25–45 个汉字（约 6–10 秒），完整的口语句子。数字、英文缩写如果容易读错，在 `tts` 字段写读音版（例如 `"tts": "G P S 会逐个路口提示"`）。
4. **每段埋 2–4 个动作词**：说到这个词时画面要发生变化（出现、变化、对比、高亮）。动作词要是这段口播里**唯一**或**第一次出现**的词。
5. **每个镜头写清楚“画面要证明什么”**：写在 shot 的 `note` 字段，这是给第 2 步看的。
6. 时长：1–3 分钟的片子一般 8–15 个镜头。只验证一个知识点时 1 个镜头也可以。

### [2] 为每个镜头选场景

```bash
node bin/mjv.mjs scenes projects/<项目名>    # 列出场景库 + 项目自带场景，带用途说明和 cues 参数
```
按这个顺序决策，**不要为了省事硬套不合适的场景**：

| 情况 | 做法 |
|---|---|
| 库里有场景正好能演这个知识点 | 直接用，在 `params.cues` 里把动作词换成本段口播里的词（也可以写秒数） |
| 库里有场景视觉合适，但文字、颜色、数量不对 | 复制到 `projects/<项目名>/scenes/<新名字>.js` 改，不要改库里的原文件 |
| 知识点有自己的“样子”，库里没有（分子链、活塞、轨道、电路……） | 新写场景，见第 2 节。用数学/物理关系直接驱动动画，不要摆关键帧 |

判断标准：**观众看画面能不能不听口播也大致看懂这个关系或变化**。讲关系就画出关系，讲变化就让它变给你看。

### [3] 配音和时间轴

```bash
node bin/mjv.mjs tts projects/<项目名>        # 按段合成，有缓存：只重做改过文字的镜头
node bin/mjv.mjs timeline projects/<项目名>   # 生成 build/timeline.json：逐字时间、字幕、总时长
```
用户自己录的音：在 shot 里写 `"audio": "assets/s01.wav"`，tts 会直接用这个文件（字幕按字数均分时间）。

### [4] 加载检查 + 抽帧自查（必须做）

```bash
node bin/mjv.mjs check projects/<项目名>                      # 场景报错、cue 找不到、字幕超宽
node bin/mjv.mjs stills projects/<项目名> 1.5 4 7.2 ...       # 输出 build/stills/t<秒>.png
```
抽帧时间怎么选：每个镜头至少 3 张（刚进入、每个动作词之后 0.5 秒、快结束）。用时间轴算：
`build/timeline.json` 里 `paras[i].start` 是镜头开始秒数，`chars[k]` 是第 k 个字的秒数。

把静帧拼成一排再看（省 token，一次能看很多张）：
```bash
ffmpeg -y -i t1.5.png -i t4.png -i t7.2.png -filter_complex "[0]scale=360:-1[a];[1]scale=360:-1[b];[2]scale=360:-1[c];[a][b][c]hstack=3" -frames:v 1 -update 1 strip.jpg
```
逐张检查第 4 节的画面清单，有问题就改场景代码，重新 `stills`，直到满意。

### [5] 渲染

```bash
node bin/mjv.mjs render projects/<项目名> --dry   # 先看哪些镜头需要重渲
node bin/mjv.mjs render projects/<项目名>         # 增量渲染：只重渲改过的镜头，再无损拼接
```
- 按镜头分段渲染到 `build/segments/<镜头id>.mp4`，每段有指纹（场景源码、参数、口播、时间、字幕、相邻镜头）。没变的镜头直接复用。
- 改了某个镜头的**画面代码或参数**：只重渲它和相邻两个镜头（转场会用到相邻画面）。
- 改了**口播文字**：它之后的镜头时间都会后移，后面的都要重渲。这是正常的。
- 渲染速度约 10 帧/秒（1080×1920）。1 分钟片子约 3 分钟。
- 长渲染放后台时，**把输出写进日志文件并定期检查**，不要只靠结束通知：
  `node bin/mjv.mjs render projects/x > projects/x/build/render.log 2>&1`

### [6] 声音、合成、质检

```bash
node bin/mjv.mjs audio projects/<项目名>      # 配乐（按镜头 music 预设变化）+ 音效 + 人声 → build/mix.wav
node bin/mjv.mjs mux projects/<项目名>        # → output/成片.mp4
node bin/mjv.mjs validate projects/<项目名>   # 有 FAIL 就不能交付
```

### [7] 交付和沉淀

- 交付 `output/成片.mp4`。如果用户的规范要求封面和发布文案，另外制作（不在本引擎范围内）。
- 这次新写的场景如果效果好、以后可能再用：
  ```bash
  node bin/mjv.mjs promote projects/<项目名> <场景名>
  ```
  收进场景库的条件见第 9 节。

---

## 2. 场景编写规范

场景文件就是一个 JS 文件，调用 `MJ.scene(名字, 定义)`。模板：`templates/scene.template.js`。真实示例：
`engine/scenes/*.js`（11 个，从成功成片拆出来的）和 `projects/demo_rubber_entropy/scenes/polymer_chain.js`（新知识点的完整示例）。

```js
MJ.scene("piston", {
  title: "发动机活塞",                       // 必填（promote 时检查）
  desc: "曲轴带动活塞上下运动，四冲程依次点亮。适合讲发动机、往复运动、曲柄连杆。",   // 必填：画什么、适合讲什么
  dark: true,                                 // 背景偏暗 → 顶部品牌字用白色
  music: "blueprint",                         // 配乐音色预设（tools/audio.py 的 PRESET）
  design: [1080, 1920],                       // 设计尺寸
  params: { cues: { cIntake: "吸气", cPower: "做功" }, rpm: 60 },
  create(ctx) {
    const { W, H, clamp, mix, E, pr, rng, canvas, rr, text, HEAVY, YH, MONO, KAI, SERIF } = MJ.lib;
    const { cue, sfx, shot } = ctx;              // cue("词")/cue(秒数)；sfx(秒, 类型, 音量)；shot.dur 镜头时长
    const P = ctx.params;
    const cIntake = cue(P.cues.cIntake);         // 在 create 里把动作词换成秒数
    sfx(cIntake, "pop", 0.6);
    const draw = (c, u) => {                     // u = 镜头内秒数（转场时可能略小于 0 或大于时长）
      c.fillStyle = "#0b1020"; c.fillRect(0, 0, W, H);
      const angle = u * P.rpm / 60 * Math.PI * 2;                // 用物理/数学关系驱动
      const y = 700 + 160 * Math.cos(angle) + Math.sqrt(400 ** 2 - (160 * Math.sin(angle)) ** 2);
      // ……画缸体、活塞、连杆
      const k = pr(u, cIntake, 0.5, E.back);     // 说到“吸气”时 0.5 秒弹入
      c.globalAlpha = clamp(k); text(c, "吸气", 540, 400, HEAVY(110), "#fff", "center"); c.globalAlpha = 1;
    };
    return draw;
  },
});
```

**硬性规则（违反会导致渲染错误或画面不一致）：**
1. **确定性**：`draw(c, u)` 只依赖 `u` 和 create 里算好的常量。禁止 `Math.random()`、`Date.now()`、`performance.now()`、`requestAnimationFrame`、`setTimeout`、CSS 动画。要随机就用 `rng(固定种子)`，并且在 create 里生成。
2. **每帧铺满背景**（第一句 `fillRect`），不能依赖上一帧的残留。
3. **不要在 draw 里改全局状态不恢复**：用了 `globalAlpha`、`shadowBlur`、`globalCompositeOperation`、`setLineDash`、`filter`，画完要恢复（或用 `c.save()/c.restore()` 包住）。
4. **cue 的词必须在本段口播里出现**，否则 check 会报错。动作词放 `params.cues`，不要写死在代码里，方便复用。
5. **数值要防越界**：`arc`/`ellipse` 半径不能为负；距离、除数要防 0 和负数（曾经因为取模出负数导致半径为负而崩溃）。
6. **性能**：每帧绘制最好 < 50ms。大量静态内容（纸纹、噪点、文字采样）在 create 里画到离屏画布 `canvas(w, h)`，draw 里只 `drawImage`。
7. **布局安全区（竖屏 1080×1920）**：顶部 0–160 是品牌和风格标签；字幕在 y≈1450–1545；左下角头像在 x<200、y>1580；y>1650 会被平台按钮和文案挡住。关键信息放在 y 180–1420。
8. `u` 在转场时会略超出 [0, 时长]，动画要能处理（`pr` 已经做了 clamp）。

**可用工具（`MJ.lib`）**：`pr(u, 起点, 时长, 缓动)` 0→1 进度；`E.out / E.inOut / E.back / E.elastic / E.lin`；`mix(a,b,k)`；`clamp`；`rng(seed)`；`rr(c,x,y,w,h,r)` 圆角矩形路径；`text(c,字,x,y,字体,颜色,对齐)`；`typed(字符串,u,起点,每秒字数)` 打字机；字体 `HEAVY(n)` 粗黑标题、`YH(n)` 雅黑、`MONO(n)` 等宽、`KAI(n)` 楷体、`SERIF(n)` 衬线。
**音效类型**：pop blip ding thud pow stamp whoosh rise zap pluck click type tick page glitch error。
**ctx 里还有**：`ctx.totalFrames`、`ctx.total`（全片秒数）、`ctx.shotIndex`、`ctx.shotCount`、`ctx.thumbs`（场景声明 `needsThumbs: true` 时，其他镜头的缩略图数组）。

---

## 3. Canvas、SVG、Three.js 怎么选

| 需求 | 用什么 | 说明 |
|---|---|---|
| 绝大多数：图形、文字、粒子、物理/数学驱动的运动 | **Canvas 2D** | 已验证（13 个场景）。最快、最可控。 |
| 已有 SVG 路径（图标、地图轮廓） | Canvas 里用 `new Path2D("M10 10 L…")` 再 `fill/stroke` | SVG 路径语法可以直接用。 |
| 真 3D（金属材质、旋转的分子模型、行星光照） | Three.js（MIT 许可） | **本引擎还没有实际跑过 Three.js 场景**。做法：用户同意后下载 `three.min.js` 放进项目，在 project.json 写 `"vendorScripts": ["vendor/three.min.js"]`；场景在 create 里建 `new THREE.WebGLRenderer({ canvas: 离屏canvas, preserveDrawingBuffer: true })`，draw 里根据 u 设好相机和物体，`renderer.render()` 后 `c.drawImage(离屏canvas, 0, 0)`。第一次用时先 `stills` 确认无头 Chrome 的 WebGL 能出图。 |
| 网页 DOM + CSS 排版动画 | 本引擎**不支持** | 上一条《AI说改好了》用的 DOM 方案在 `../backup/07_样片_AI说改好了_原版/工程/web/app.js`，如需要可以参考，但要自己接入。 |

---

## 4. 画面和动画质量要求（抽帧时逐条对照）

- **动作有意义**：每个动作对应口播里的一个词；讲关系就出现关系，讲变化就看到变化。没有意义的晃动不要加。
- **元素依次出场**：不要所有东西同时弹出来；两次出场之间至少隔 0.2 秒，重要信息出现后留 0.8 秒以上让人看清。
- **缓动有变化**：弹入用 `E.back`，移动用 `E.inOut`，回弹用 `E.elastic`，不要整片都用同一种弹跳。
- **文字手机上看得清**：标题 ≥ 80px，正文/标注 ≥ 34px；浅底深字、深底浅字，对比要够。
- **不遮挡**：元素之间、元素和字幕、头像之间不重叠；文字不贴边（距离边缘 ≥ 60px）。
- **画面不空不挤**：一个画面 1 个主角 + 不超过 3 个辅助信息。
- **示意内容要标注**：示意图、示意数据标“示意”，不能包装成实测。
- **字幕**：单行，自动切分；validate 会量宽度，超过 W−80 就失败。不要手动在字幕里换行。

## 5. 时间轴、配音、渲染、导出规范

- 30fps；竖屏 1080×1920（默认），横屏 1920×1080 可用：`format` 改尺寸即可，竖屏设计的场景会自动等比放进横屏（两边用模糊背景填充）。要做原生横屏，场景写 `design: [1920, 1080]`。
- 配音必须**整段合成**，改文字就重新合成整段（tts 有缓存，只重做改过的）。不要拼词剪字。
- 镜头之间默认空 0.55 秒，转场占边界前后各 0.32 秒。`"transition"` 写在**前一个镜头**上：`glitch / pixel / wipe / circle / slide / fade / cut`。
- 口播说完画面还想多停一会儿：shot 里写 `"hold": 1.5`（秒）。
- 成片：H.264 yuv420p crf 17、AAC 192k、响度 −14 LUFS、真峰值 −1.5 dBTP。

## 6. project.json 格式

```jsonc
{
  "title": "片名",
  "format": { "width": 1080, "height": 1920, "fps": 30 },
  "voice": { "engine": "edge", "voice": "zh-CN-XiaoyiNeural", "rate": "+4%" },
  "timing": { "lead": 0.5, "gap": 0.55, "tail": 3.2 },      // 片头留白、镜头间隔、片尾留白（秒）
  "overlay": {
    "brand": "麻酱 AI 实验室",        // 左上角品牌字；null 关闭
    "styleLabel": false,               // 右上角“STYLE 01 / 11 · 名称”
    "subtitles": true,
    "avatar": "assets/avatar.png",     // 左下角静态头像；null 关闭
    "outro": { "shot": "s11", "phrase": "我是麻酱" }   // 说到这个词时头像移到画面中间（可选）
  },
  "music": { "enabled": true, "volume": 0.26, "bpm": 100 },
  "mix": { "sfx_volume": 0.30, "loudness": -14 },
  "vendorScripts": [],                 // 额外的开源库（项目内相对路径），例如 three.min.js
  "output_name": "成片.mp4",
  "shots": [
    {
      "id": "s01",                     // 唯一，建议 s01 s02…
      "scene": "terminal",             // 场景名：先找 项目/scenes/，再找 engine/scenes/
      "label": "终端",                 // 风格标签（styleLabel 打开时显示）
      "text": "口播，也是字幕来源。",
      "tts": "可选：给语音合成读的版本",
      "audio": "可选：自录音频路径",
      "note": "可选：这一镜要证明什么（给编导自己看）",
      "transition": "glitch",          // 到下一个镜头的转场
      "music": "calm",                 // 可选：配乐预设，默认用场景名或场景的 music
      "hold": 0,                       // 可选：口播后多停留几秒
      "params": { "cues": { "cNo": "没有一个镜头" } }   // 覆盖场景参数
    }
  ]
}
```

## 7. 常见失败和修法

| 现象 | 原因 | 怎么修 |
|---|---|---|
| check 报「口播里找不到 cue」 | 动作词不在这段口播里，或者改过稿 | 改 `params.cues` 成本段里的词，或者写秒数 |
| check 报「找不到场景」 | 场景名拼错，或文件不在 `项目/scenes/` | `node bin/mjv.mjs scenes 项目` 看可用名字 |
| check 报「场景初始化失败」 | create 里代码出错 | 看报错信息；常见是 cue 不存在、参数缺失 |
| render 报「Runtime.evaluate: … radius … negative」 | 画圆半径为负 | 找到对应计算，clamp 到 ≥ 0 或跳过 |
| render 报「超时 30 秒」 | 某一帧画得太慢或死循环 | 抽这附近的静帧定位；把静态内容挪到 create 里预画 |
| 渲染长时间没有新日志 | 卡住（之前出现过两个渲染抢同一端口） | 现在每次随机端口 + 30 秒超时会自动报错；查 `render.log`，必要时结束 node 和 chrome 进程再跑 |
| validate：帧数不对 / 音画时长不一致 | 合成时被截断 | 用 `mux` 命令合成（已处理：音频补静音、按画面时长输出），不要自己加 `-shortest` |
| validate：全黑画面 | 场景没铺背景、报错后画面空白、或者本来就是暗场景 | 抽该时间的静帧看；故意的暗场景在定义里加 `allowDark: true` |
| validate：字幕超宽 | 一句话太长且没有标点 | 稿子里加逗号，或缩短句子 |
| validate：画面静止 > 3 秒 | 动画在某段时间没有任何变化 | 加持续的细微运动（背景流动、呼吸感），或缩短这段 |
| 配音失败 / 重试 6 次 | edge-tts 网络问题 | 稍后重跑 `tts`，有缓存不会重复合成已成功的段 |
| 字读错（数字、英文） | TTS 读法 | shot 里加 `tts` 字段写读音版 |
| 中文字体缺字、显示成方框 | 字体里没有这个字符（例如 ⇄ ✓ 在某些字体里没有） | 换字符，或用 Canvas 画图形代替 |

## 8. 质量验证标准（全部满足才交付）

1. `node bin/mjv.mjs validate` 没有 FAIL：没有场景错误，字幕都不超宽，分辨率/帧率/帧数正确，音画时长差 ≤ 0.1 秒，没有意外的全黑画面。
2. WARN 都看过：静止画面、响度偏差都有合理解释。
3. 每个镜头至少抽 3 张静帧看过，满足第 4 节清单。
4. 成片从头到尾抽帧拼图看一遍（`ffmpeg -i output/成片.mp4 -vf "fps=1/3,scale=120:-1,tile=10x4" -frames:v 1 sheet.jpg`）。
5. 向用户报告时，如实说明：哪些是实测、哪些是示意；用了哪些占位（例如配音不是本人音色）；有没有没解决的问题。

## 9. 场景的积累和复用

- 新写的场景先放在 `projects/<项目>/scenes/`，成片满意后再考虑收进库。
- 收进库（`promote`）的条件：
  1. 有 `title` 和 `desc`（desc 写清“画什么 + 适合讲什么知识点”，`scenes` 命令靠它让下一个 Agent 找到）；
  2. 动作词全部在 `params.cues` 里，可以换讲稿复用；文字内容、数量等常改的东西也尽量做成参数；
  3. 在至少一条成片里跑通过，validate 无 FAIL；
  4. 名字表达知识点或视觉语言（`polymer_chain`、`piston`），不要用 `scene1`。
- 库里的场景**不要直接改**（会影响以后所有引用它的项目和回归测试）。要改就复制到项目里改个名字。
- 改了引擎（`engine/lib.js`、`engine/runtime.js`）或库里的场景，必须跑一次回归（见 README「回归测试」）。

## 10. 内容规范（麻酱 AI 实验室账号）

- 字幕和画面里不出现网址、域名；GPT、Codex、Claude、Opus 等模型名不出现在字幕、画面和封面中（口播可以说，用 `tts` 字段让口播和字幕不一样）。需要时用官方 logo 代替。
- 左下角只放静态头部头像，不做动态猫。
- 配音应使用本人音色（目前本机没有克隆环境，暂用晓伊，交付时必须说明是占位）。
- 字体授权：标题字体 HYYakuHei、正文微软雅黑商用需要授权，发布前确认或换成思源黑体等可商用字体（`fonts` 字段可改）。

## 11. 无口播 Vibe 风格（字幕 + 配乐，横屏）

参考抖音"Vibe知识大赏"：没有配音，只有逐句淡入的居中字幕、慢节奏氛围配乐和柔和音效；深蓝黑底、暖金色光点。
第一条实战：`projects/ep09_llm`（《它只会猜下一个字，为什么看起来像在思考？》，3 分钟，15 个镜头）。新项目从 `templates/project.vibe.example.json` 起步。

**什么时候用**：观众静音也能看懂的知识类短片；文案有诗意、靠字幕节奏推进；画面以粒子、光点、图解为主。

### 配置要点
```jsonc
"format": { "width": 1920, "height": 1080, "fps": 30 },
"voice": { "engine": "none" },                       // 无口播：tts 自动跳过，时间轴按阅读时间排
"timing": { "lead": 0.8, "gap": 0.45, "tail": 2.5, "pre": 0.8, "lineGap": 0.3, "cps": 6, "linePad": 0.8, "minLine": 1.7 },
"overlay": { "brand": null, "styleLabel": false, "subtitles": "scene", "avatar": null },   // 字幕交给场景画
"music": { "enabled": true, "volume": 0.55, "bpm": 76 },
"mix": { "sfx_volume": 0.6, "loudness": -14 },
"fonts": [ { "family": "SongB", "src": "assets/fonts/NotoSerifSC-Bold.otf" }, { "family": "SongH", "src": "assets/fonts/NotoSerifSC-Black.otf" } ],
"fontsToLoad": ["40px SongB", "40px SongH"],
"transitionHalf": 0.5, "transitionSfx": { "kind": "swell", "vol": 0.18 }
```
- 字体：思源宋体 Bold / Black（开源、可商用），在引擎 `assets/fonts/`。`fonts.src` 可以写相对项目目录或引擎目录的路径。
- 每个镜头用 `lines` 写字幕，不写 `text`：
  ```jsonc
  { "id": "s05", "scene": "vibe_dot_grid", "music": "ambient_full", "transition": "fade", "hold": 0.8,
    "lines": [ { "text": "我们叫它——**参数**。" }, { "text": "每一个，都像一个小小的**旋钮**。", "hold": 1.0 } ],
    "params": { "phase": "reveal" } }
  ```
  `**词**` 金色高亮；`dur` 手动指定这句停留秒数；`hold` 在自动时长上多留；镜头的 `pre` 是第一句出现前画面先走几秒、`hold` 是最后一句后多留几秒。
  自动时长 = `max(minLine, 有效字数 / cps + linePad)`。`timeline` 命令会打印每个镜头的起止和总时长，先看总时长再调 `cps`。
- `cue("词")` 照常可用（词的时间 = 这句出现时刻 + 按位置快速阅读的偏移）。但 Vibe 场景更推荐直接用 `ctx.lines[i].t0` 对齐：第几句出现，画面就做第几件事。

### 场景里怎么画字幕
- `ctx.lines`：本镜头每句 `{ text（带 ** 标记）, plain, t0, t1 }`，时间是镜头内秒数。
- `MJ.lib.captions(c, ctx.lines, u, { y, size, skip: [句号], mode: "replace" | "stack", per: { 序号: {覆盖参数} } })`：
  replace 同一位置依次替换、最后一句留到镜头结束；stack 依次往下排、旧句变暗。`skip` 掉场景自己用大字画的句子。
- `MJ.lib.caption(c, line, u, opts)` 画单句；`lineAlpha(line, u, opts)` 只算透明度。超宽会自动缩字号，但 `check` 按 54px 不缩的宽度报超宽。
- 字幕默认位置 y≈960（横屏），关键画面放在 y 120–880。

### Vibe 工具（`MJ.lib`）
`bgVibe(c, u, opts)` 深蓝黑径向渐变 + 漂浮微尘；`glowDot([r,g,b], 半径)` 预渲染发光点精灵，配 `dot(c, 精灵, x, y, 缩放)` 和 `globalCompositeOperation = "lighter"`（比 shadowBlur 快得多）；
`textPoints(字, 字体, cx, cy, 间距)` / `samplePoints(paint, w, h, 间距)` 把文字或图形采样成粒子目标点；`mixRGB`、`GOLD`、`ICE`、`PAPER` 配色；`SONG(n)` / `SONGH(n)` 粗宋。

> **注意：字体在 `create` 运行时还没加载完。** 凡是要量文字宽度、把文字采样成点的，放到第一次绘制时再做（`let lay = null; ... if (!lay) lay = layout(c);`），否则会用错字体。

### 配乐和音效
- 配乐预设（镜头 `music` 字段）：`ambient_pad`（只有铺底）→ `ambient_piano`（加钢琴）→ `ambient_full`（加低音和轻鼓）→ `ambient_arp`（琶音）→ `ambient_lift`（高潮：全部织体 + 高八度 + 旋律 + 更重的鼓）→ `ambient_outro`（收尾）。
- **起伏要靠 `energy` 做出来**（用户反馈过"全篇都差不多、高潮不明显"）：镜头写 `"energy": 0.3–1.0`（整体音量），`"energyTo"` 让音量在镜头内渐变。EP09 的曲线：开头 0.85 → 疑问处掉到 0.25 → 训练段 lift 0.7→1.0（第一次高潮）→ "它真的懂吗"掉到 0.3（低谷）→ 0.55→0.85 铺垫 → 金句 lift 1.0（最高潮）→ 收尾 0.3。高潮和低谷要差 8–10 LU 才听得出来。
- 检查起伏：`ffmpeg -i build/mix.wav -af "ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=m.txt" -f null -`，按镜头算平均响度。**注意 ametadata 的 file 是追加写入，测之前先删掉旧文件**。
- 柔和音效：`chime`（光点、关键词）`swell`（大字聚合、转场）`glow`（重要画面出现）`shimmer`（粒子散开 / 聚拢）`tick`（轻节拍）。不要用 glitch / error / pow。
- 无口播时混音不做人声闪避，也不用动态 loudnorm（它会把起伏压平）：先混好测整体响度，再整体线性增益到 −14 LUFS，最后限幅到约 −1.5 dBFS。

### Vibe 场景库（`node bin/mjv.mjs scenes` 可查参数）
| 场景 | 演什么 | 关键参数 |
|---|---|---|
| `vibe_chat_flow` | 对话框提问 → 回答流出 → 文字铺满屏 → 倒吸成光标 | question, answer, cues.cCollapse |
| `vibe_particle_title` | 粒子聚成大字标题 / 金句 | blocks（哪几句画成大字）, extras（英文小字）, cursorUntil, from: random/figure |
| `vibe_prob_bars` | 半句话 + 候选词概率条，一轮轮续写 | prompt, rounds, more |
| `vibe_dot_grid` | 参数光点阵：question / reveal（拉远成星海再推近成旋钮）/ chaos（冷蓝乱闪 + 乱码）/ dim | phase |
| `vibe_neural_net` | 分层网络，信号逐层流过，输出概率 | input, layers, outputs |
| `vibe_loss_valley` | 文字雨 + 计数器 → 误差地形上的真实梯度下降 | snippets, counterTo, lr, steps |
| `vibe_embedding_stars` | 词语星星从乱飘到聚团，平行向量类比 | groups, analogy, focus |
| `vibe_attention_lines` | 一个词向其他词连权重弧线，最后全句成网 | tokens, query, weights |
| `vibe_particle_figure` | 光点汇聚成人形 / 人形里神经元连线点亮 | phase: converge / neurons |
| `vibe_outro_note` | 片尾彩蛋小字 + 金色账号名 | （无） |

示意数据（概率、权重、计数器、误差曲线）场景里都自带"示意"标注，参数 `note` 可以改文字。
