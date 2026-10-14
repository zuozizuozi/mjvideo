# MCP 接入：让 Codex / Claude Code / Zaovra / Cursor 调用 mjvideo

`mcp/server.mjs` 是一个 stdio MCP 服务（零 npm 依赖），把 `mjv` 命令行包成 14 个工具。
Agent 用它跑引擎命令、看静帧；**改 project.json 和场景代码仍然用 Agent 自己的文件编辑工具**。

## 前置依赖
和命令行一样：Node ≥ 22、Chrome、FFmpeg（带 libx264）、Python 3.8+（`pip install edge-tts pillow jieba`）。见 README「依赖」。

## 工具
| 工具 | 作用 |
|---|---|
| `mjv_guide` | 读文档：使用手册（默认）、`doc: "visual"` 视觉手法、`"art"` 美术指导流程、`"case"` 案例；可按节号或关键词取 |
| `mjv_scenes` | 列出场景库和项目场景的用途、参数 |
| `mjv_new_project` | 新建项目（`vibe: true` 无口播横屏；`style` 套用风格包） |
| `mjv_styles` | 列出风格包 |
| `mjv_games` | 已登记的游戏和它们的实测数据（试玩解说用），也能登记新游戏 |
| `mjv_footage` | 导入录屏：代理 + 高光分析，拼图作为图片返回（AI 用它"看"录屏） |
| `mjv_cover` | 从录屏取一帧做封面（3:4 和 9:16） |
| `mjv_history` | 以往项目的风格、配色、美术方案摘要（防重复检查用） |
| `mjv_notes` | 读用户在工作台里写的修改意见，处理完标成已完成 |
| `mjv_ref` | 分析参考图 / 参考视频：返回关键帧拼图、色板、节奏报告（图片直接给 Agent 看） |
| `mjv_project_info` | 项目状态：镜头时长、最近质检、成片路径 |
| `mjv_run` | 跑命令：tts / timeline / check / render / audio / mux / validate / build / promote |
| `mjv_stills` | 抽静帧，按镜头拼图，**直接返回图片**给 Agent 看 |
| `mjv_job` | 查后台任务进度、取结果 |

**长任务**：渲染一条 3 分钟的片子要 8–9 分钟，而有的客户端工具超时只有 5 秒。所以每个命令都在后台跑，调用时最多等 `wait_seconds` 秒（默认 3.5），没跑完就返回 `job_id`，再用 `mjv_job` 查。

环境变量：`MJV_PROJECTS`（项目目录，默认引擎下的 `projects/`）、`MJV_MCP_WAIT`（默认等待秒数）、`MJV_CHROME`、`MJV_PYTHON`。

## 各工具的配置
下面的 `<引擎目录>` 换成仓库实际路径，例如 `F:/opus vedio/mjvideo`。

### Codex（`~/.codex/config.toml`）
```toml
[mcp_servers.mjvideo]
command = "node"
args = ["<引擎目录>/mcp/server.mjs"]
tool_timeout_sec = 60
```
Codex 会自动读仓库里的 `AGENTS.md`，在引擎目录里开 Codex 就能按手册干活。

### Claude Code
仓库根目录自带 `.mcp.json`，在引擎目录里打开 Claude Code 会提示启用。也可以全局添加：
```bash
claude mcp add mjvideo -- node "<引擎目录>/mcp/server.mjs"
```
`CLAUDE.md` 会引入 `AGENTS.md`。

### Zaovra（`zaovra.jsonc` 的 `mcp` 字段）
```jsonc
"mcp": {
  "mjvideo": {
    "type": "local",
    "command": ["node", "<引擎目录>/mcp/server.mjs"],
    "timeout": 60000
  }
}
```
Zaovra 默认工具超时 5 秒，建议像上面这样调大；就算不调，长任务也会返回 job_id 不会卡死。

### Cursor 等（`mcp.json`）
```json
{ "mcpServers": { "mjvideo": { "command": "node", "args": ["<引擎目录>/mcp/server.mjs"] } } }
```

## 自测
```bash
node mcp/server.mjs
```
启动后会在 stderr 打印引擎和项目目录；stdout 只输出协议消息。

## 一条视频的典型调用顺序
`mjv_guide` → `mjv_new_project`（可选 `style`）→ 有参考素材就 `mjv_ref` → （Agent 写美术方案 design.md、theme、场景）→ `mjv_run timeline` → `mjv_run check` → `mjv_stills`（看图、改代码，反复）→ `mjv_run render` → `mjv_job`（等渲染）→ `mjv_run audio` → `mjv_run mux` → `mjv_run validate`
