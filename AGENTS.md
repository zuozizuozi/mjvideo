# 给 Coding Agent 的入口说明

这个目录是麻酱代码视频引擎。接到“做一条科普/讲解视频”“把讲稿做成视频”“给某个知识点做动画”的任务时：

1. 先完整读 `SKILL.md`，照着第 1 节的标准流程执行。
2. 编导阶段读 `prompts/director.md`；文案定稿后、写场景前，按 `prompts/art_director.md` 做美术方案（每条视频都要做，要和以往作品看得出区别）；写场景读 `prompts/scene_author.md`。
3. 所有操作通过 `node bin/mjv.mjs <命令> <项目目录>`，不要自己拼 FFmpeg 命令合成成片。
4. 改了 `engine/` 或 `engine/scenes/` 里的文件，必须按 README「回归测试」跑一遍。
5. 交付前 `node bin/mjv.mjs validate` 不能有 FAIL；向用户报告时如实区分实测和示意、说明占位项。
6. 如果你是通过 MCP 调用本引擎（工具名 `mjv_*`）：先调 `mjv_guide` 读手册；跑命令用 `mjv_run`，看画面用 `mjv_stills`（会直接返回拼图），长任务用 `mjv_job` 查。接入方法见 `docs/MCP接入.md`。
7. 无口播形式（字幕 + 配乐、横屏）：`node bin/mjv.mjs new projects/<名字> --vibe` 或 `--style=<风格包>`（`mjv styles` 查看），见 `SKILL.md` 第 11–15 节。场景库和风格包是零件和起点，不是模板，鼓励自由发挥。
8. 用户给了参考图 / 参考视频：先 `node bin/mjv.mjs ref <项目> <素材…>`（MCP：`mjv_ref`），提炼风格，不照抄。
9. 用户可能在工作台（`node bin/mjv.mjs studio`）里选了风格、换了场景、写了修改意见、传了素材。开工前先用 MCP `mjv_notes` 读意见，处理完标成已完成。见 `SKILL.md` 第 16 节。
10. 加了新场景或新风格包后跑 `node bin/mjv.mjs previews`，更新工作台的样张和预览。
11. 写美术方案、新画面之前读 `docs/视觉手法.md`（MCP：`mjv_guide` 的 `doc: "visual"`）。美术方案要先在关键镜头上做出静帧给用户挑，不要只用文字描述，也不要替用户决定。防重复检查用 MCP `mjv_history`。
