# 给 Coding Agent 的入口说明

这个目录是麻酱代码视频引擎。接到“做一条科普/讲解视频”“把讲稿做成视频”“给某个知识点做动画”的任务时：

1. 先完整读 `SKILL.md`，照着第 1 节的标准流程执行。
2. 编导阶段读 `prompts/director.md`；需要新写场景时读 `prompts/scene_author.md`。
3. 所有操作通过 `node bin/mjv.mjs <命令> <项目目录>`，不要自己拼 FFmpeg 命令合成成片。
4. 改了 `engine/` 或 `engine/scenes/` 里的文件，必须按 README「回归测试」跑一遍。
5. 交付前 `node bin/mjv.mjs validate` 不能有 FAIL；向用户报告时如实区分实测和示意、说明占位项。
6. 如果你是通过 MCP 调用本引擎（工具名 `mjv_*`）：先调 `mjv_guide` 读手册；跑命令用 `mjv_run`，看画面用 `mjv_stills`（会直接返回拼图），长任务用 `mjv_job` 查。接入方法见 `docs/MCP接入.md`。
7. 做无口播的 Vibe 风格（字幕 + 配乐、横屏）：`node bin/mjv.mjs new projects/<名字> --vibe`，规范见 `SKILL.md` 第 11 节。
