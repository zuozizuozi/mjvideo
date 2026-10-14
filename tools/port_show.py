"""一次性迁移脚本：把《一行代码，怎么变成一段视频？》的 show.js 拆成 11 个可复用的场景文件。
保留原绘制代码不变，只做机械替换：
  cue(id, "词")         → cue(CUES.变量名)，原来的词变成参数 params.cues 的默认值
  sfx(P(id).start + x)  → sfx(x)            （ctx.sfx 接收镜头内相对时间）
  P(id).start + u       → shot.start + u
  SCENES[id] = ...      → const draw = ...; return draw
  TOTAL_FRAMES / thumbs → ctx.totalFrames / ctx.thumbs
用法：python tools/port_show.py <show.js> <输出目录>
"""
import json, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
js = open(SRC, encoding="utf8").read()
body = js[js.index("// ---------- 01 终端"):js.index("// =====================================================================\n//  时间线")]
parts = re.split(r"// ---------- (\d\d) ([^\n]+?) ----------\n", body)

META = {  # name, title, desc, dark, extra
    "01": ("terminal", "终端打字", "代码雨背景 + 终端逐行打字（帧号实时跳动）+ 打字机大标题。适合开场、讲程序/命令。", True, {}),
    "02": ("flipbook", "手翻书", "笔记本纸 + 铅笔跑步小人逐页翻动 + 一排分帧小图。适合讲帧、动画原理、连续动作。", False, {}),
    "03": ("pixel", "8-bit 像素", "矢量图逐步像素化 + 扫描线逐格上色 + RGB 读数。适合讲像素、图像、数字化。", True, {}),
    "04": ("blueprint", "工程蓝图", "蓝图网格 + 轨道小球 + 同步绘制 x-t 函数图和实时读数。适合讲函数、物理量随时间变化。", True, {}),
    "05": ("easing", "纸艺缓动", "粉色纸艺 + 匀速/缓动双跑道残影 + 缓动曲线卡片 + 落地挤压。适合讲速度、加速度、对比。", False, {}),
    "06": ("synth", "合成波透视", "霓虹透视网格地面 + 条纹太阳 + 远小近大的灯柱 + 霓虹公式。适合讲透视、3D、空间。", True, {}),
    "07": ("ink", "水墨分层", "宣纸 + 三层远中近山视差 + 雾 + 小舟 + 竖排楷书 + 印章。适合讲层次、纵深、东方文化。", False, {}),
    "08": ("particles", "粒子聚字", "1500 个粒子游走后聚成文字 + 标记单个粒子的目标。适合讲涌现、群体规则、数据点。", True, {}),
    "09": ("swiss", "瑞士海报流水线", "红黑网格海报 + 大号计数器 + 五步流水线依次点亮。适合讲流程、步骤、计数。", False, {}),
    "10": ("comic", "漫画波普", "网点背景 + 漫画分格 + 数值被划掉替换 + 爆炸框。适合讲对比、改动、强调。", False, {}),
    "11": ("film", "胶片收尾", "暖色散景 + 滚动胶片（播放本片其他镜头的真实缩略图）+ 衬线标题 + 署名。适合结尾回顾。", True,
           {"needsThumbs": True, "noThumb": True}),
}

catalog = []
for i in range(1, len(parts), 3):
    num, label, code = parts[i], parts[i + 1], parts[i + 2]
    name, title, desc, dark, extra = META[num]
    code = code.replace("const thumbs = [];\n", "")
    code = code.strip()
    assert code.startswith("{") and code.endswith("}"), num
    code = code[1:-1]
    cues = {}
    def cue_sub(m):
        cues[m.group(1)] = m.group(2)
        return f"{m.group(1)} = cue(CUES.{m.group(1)})"
    code = re.sub(r'(\w+) = cue\(id, "([^"]+)"\)', cue_sub, code)
    code = re.sub(r'const id = "s\d+", ', "const ", code)
    code = re.sub(r'const id = "s\d+";\s*', "", code)
    code = code.replace("sfx(P(id).start + ", "sfx(")
    code = code.replace("(P(id).start + u)", "(shot.start + u)")
    code = code.replace("SCENES[id] = (c, u) =>", "const draw = (c, u) =>")
    code = code.replace("TOTAL_FRAMES", "ctx.totalFrames")
    code = re.sub(r"\bthumbs\b", "ctx.thumbs", code)
    assert "P(id)" not in code and "cue(id" not in code, (num, "未替换干净")
    lines = "\n".join("    " + ln if ln.strip() else "" for ln in code.strip("\n").split("\n"))
    meta = {"title": title, "desc": desc, "dark": dark, "music": name, "design": [1080, 1920], **extra,
            "params": {"cues": cues}}
    head = json.dumps(meta, ensure_ascii=False, indent=2)[1:-1].strip()
    out = f"""// 场景「{title}」—— 来自《一行代码，怎么变成一段视频？》STYLE {num}（{label}）
// {desc}
// cues：口播里触发动画的词（镜头内首次出现的时间），换讲稿时在 project.json 的 shot.params.cues 里改；也可以直接写秒数。
MJ.scene("{name}", {{
  {head},
  create(ctx) {{
    const {{ W, H, FPS, clamp, mix, E, pr, rng, canvas, rr, text, typed, HEAVY, YH, MONO, KAI, SERIF }} = MJ.lib;
    const {{ cue, sfx, shot }} = ctx;
    const CUES = ctx.params.cues;
{lines}
    return draw;
  }},
}});
"""
    open(f"{OUT}/{name}.js", "w", encoding="utf8").write(out)
    catalog.append((name, title, cues))
    print(num, name, "cues:", list(cues))
