# cli-in-wechat

在微信里调用本机 AI 编程 CLI、局域网其他设备上的 AI 智能体，并把微信文件自动归档到局域网 NAS。

这个项目是一个运行在你电脑上的桥接服务：微信负责输入和文件传输，电脑负责接入 ClawBot iLink API、调用本机/局域网 Agent、保存媒体文件并转存 NAS。

## 功能

- 微信 ClawBot 官方 iLink Bot API 收发消息
- Claude Code / Codex CLI / Gemini CLI / Hermes Agent / Kimi Code / OpenClaw / OpenCode
- `@工具名` 切换工具，支持 `@tool1>tool2` 链式调用和 `>>` 接力
- `remoteAgents`：通过 HTTP JSON 调用同局域网其他设备上的 AI Agent
- `localAgents`：把本机任意 CLI/Agent 注册成微信里的自定义 `@名称`
- 微信图片、文件、视频自动下载并解密
- `nasArchive`：微信文件自动复制到指定 NAS 目录，默认按日期归档并避免覆盖
- 会话续接、`/resume`、`/session set <id>`
- AI 输出 `[SEND_FILE: /path/to/file]` 时自动把文件发回微信

## 架构

```text
微信 ClawBot
  <-> iLink Bot API
cli-in-wechat 桥接服务
  <-> 本机 AI CLI: claude / codex / gemini / hermes / kimi / openclaw / opencode
  <-> 自定义本机 Agent: @ollama / @localpy / 自定义名称
  <-> 局域网 HTTP Agent: @lan / @nasbot / 自定义名称
  <-> NAS 共享目录: \\NAS\wechat-inbox
```

## 安装

前置要求：

- Node.js >= 18
- 微信已启用 ClawBot 插件
- 至少一个本机 CLI 工具，或配置一个 `remoteAgents` 远端 Agent

```bash
git clone https://github.com/lenlanF/cli-in-wechat.git
cd cli-in-wechat
npm ci
npm run dev
```

首次运行会显示二维码，用微信扫码登录 ClawBot。

## 配置

配置文件位于：

```text
~/.wx-ai-bridge/config.json
```

可参考 [examples/config.local.example.json](examples/config.local.example.json)：

```json
{
  "defaultTool": "lan",
  "workDir": "D:\\Windows\\Default\\Documents\\wechat-workspace",
  "taskKeepAliveInterval": 90000,
  "clawbots": [
    { "name": "default" },
    { "name": "work" }
  ],
  "remoteAgents": {
    "lan": {
      "displayName": "LAN Agent",
      "endpoint": "http://192.168.1.50:8787/agent",
      "apiKey": "change-me",
      "timeout": 300000
    }
  },
  "localAgents": {
    "ollama": {
      "displayName": "Ollama Local",
      "command": "ollama",
      "args": ["run", "qwen2.5-coder:7b"],
      "promptMode": "stdin"
    }
  },
  "nasArchive": {
    "enabled": true,
    "path": "\\\\NAS\\wechat-inbox",
    "auth": {
      "username": "nas-user",
      "password": "nas-password",
      "domain": "WORKGROUP"
    },
    "organizeByDate": true,
    "overwrite": false
  }
}
```

### 局域网 Agent

`remoteAgents` 里的 key 就是微信里的 `@` 名称。上面的配置启用后，可以在微信里发送：

```text
@lan 总结一下这个文件
```

远端服务需要实现一个 `POST /agent` JSON 接口。协议见 [examples/remote-agent-protocol.md](examples/remote-agent-protocol.md)，最小 FastAPI 示例见 [examples/remote-agent-fastapi.py](examples/remote-agent-fastapi.py)。

启动示例远端 Agent：

```bash
cd examples
pip install fastapi uvicorn pydantic
LAN_AGENT_API_KEY=change-me uvicorn remote-agent-fastapi:app --host 0.0.0.0 --port 8787
```

### 多机器 Codex

如果机器 A 是 Linux 且有 Codex CLI，机器 B 是 Windows 且也有 Codex CLI，推荐只让 B 运行 `cli-in-wechat` 作为微信入口：

```text
微信
  -> B / Windows: cli-in-wechat
       @codex  -> B 本机 Codex
       @codexa -> A / Linux HTTP Agent -> A 本机 Codex
       文件    -> B 下载 -> NAS 指定目录
```

A 上启动 HTTP Agent wrapper，B 上把它配置成 `remoteAgents.codexa`。完整步骤见 [examples/multi-machine-codex.md](examples/multi-machine-codex.md)，Codex wrapper 示例见 [examples/codex-http-agent.py](examples/codex-http-agent.py)。

### 本机自定义 Agent / CLI

`localAgents` 可以把本机任意命令行工具注册成微信 `@名称`。协议见 [examples/local-agent.md](examples/local-agent.md)。

例如：

```json
{
  "localAgents": {
    "localpy": {
      "displayName": "Local Python Agent",
      "command": "python",
      "args": ["examples/local-agent-echo.py"],
      "promptMode": "stdin"
    }
  }
}
```

微信里发送：

```text
@localpy 你好，读取刚才的文件
```

### 多微信 ClawBot

默认只启动一个 `default` ClawBot。需要接入多个微信 ClawBot 时，在配置里加入：

```json
{
  "clawbots": [
    { "name": "default" },
    { "name": "work" },
    { "name": "family" }
  ]
}
```

也可以在微信里配置：

```text
/clawbot list
/clawbot add work
/clawbot remove work
```

新增或删除 ClawBot profile 后需要重启服务。每个 profile 会单独保存：

- 登录凭据
- poll cursor
- context token
- 会话状态

首次启动新 profile 时会显示对应二维码，需要用目标微信 ClawBot 扫码登录。

### NAS 文件归档

启用 `nasArchive` 后，微信发来的图片、文件、视频会同时保存到：

- 桥接服务本地媒体目录
- 指定 NAS 设备和文件夹，例如 `\\NAS01\wechat-inbox\project-a\2026-06-30\report.pdf`

归档后的 `nasPath` 会传给本机 CLI 和远端 Agent，方便 NAS 上的 Agent 直接读取或后续自动化处理。

Windows 推荐使用 UNC 路径：

```json
{
  "nasArchive": {
    "enabled": true,
    "path": "\\\\192.168.1.10\\share\\wechat-inbox\\project-a",
    "organizeByDate": true,
    "overwrite": false
  }
}
```

这里的 `path` 就是“指定设备 + 指定文件夹”。可用 NAS 主机名，例如 `\\\\NAS01\\wechat-inbox\\project-a`，也可用 IP，例如 `\\\\192.168.1.10\\share\\wechat-inbox\\project-a`。

如果 NAS 共享需要用户名和密码，Windows 下可以配置：

```json
{
  "nasArchive": {
    "enabled": true,
    "path": "\\\\NAS01\\wechat-inbox\\project-a",
    "auth": {
      "username": "nas-user",
      "password": "nas-password",
      "domain": "WORKGROUP"
    }
  }
}
```

也可以直接在微信里配置：

```text
/nas auth nas-user nas-password WORKGROUP
/nas auth clear
```

Windows 下归档前会自动执行共享连接。Linux/macOS 建议先用系统方式挂载 NAS，再把 `path` 配成挂载目录。

Linux/macOS 可先挂载 NAS，再填写挂载目录：

```json
{
  "nasArchive": {
    "enabled": true,
    "path": "/mnt/nas/wechat-inbox"
  }
}
```

### 微信内配置

大部分桥接配置可以直接在微信里发命令修改，配置会保存到 `~/.wx-ai-bridge/config.json`。

常用配置命令：

```text
/config show
/config default codex
/config workdir D:\Windows\Default\Documents\wechat-workspace

/clawbot list
/clawbot add work

/nas path \\NAS01\wechat-inbox\project-a
/nas auth nas-user nas-password WORKGROUP
/nas on
/nas date on
/nas overwrite off

/remote set codexa {"displayName":"Codex on Linux A","endpoint":"http://192.168.1.50:8787/agent","apiKey":"change-me","timeout":300000}
/remote list
/remote remove codexa

/local set ollama {"displayName":"Ollama Local","command":"ollama","args":["run","qwen2.5-coder:7b"],"promptMode":"stdin"}
/local list
/local remove ollama
```

说明：

- `/nas path` 会自动开启 NAS 归档。
- `/nas auth` 会保存 NAS 用户名、密码和可选域；回复不会回显密码。
- `/remote set` 和 `/local set` 写入后会热注册，通常不需要重启。
- 复杂配置使用 JSON，手机输入时注意双引号必须是英文半角。

## 使用

```text
@lan 帮我分析刚发的 PDF
@localpy 处理刚收到的文件
@codex fix the bug
@claude>lan 先分析项目，再交给局域网 Agent 生成报告
>> 继续根据上一条结果处理
/send D:\tmp\report.docx
/status
/help
```

发送微信文件时，消息会自动附带本地路径和 NAS 路径。AI 需要主动发文件回微信时，在输出中包含：

```text
[SEND_FILE: D:\tmp\result.png]
```

### 主动发送限制

截至公开可见的 ClawBot/iLink API 版本，Bot 发送消息需要已有用户会话的 `context_token`。这意味着：

- 用户必须先给某个 ClawBot 发过至少一条消息，桥接服务才能保存该用户的 `context_token`。
- `wcli send` 或桥接服务后续可以基于已保存的 `context_token` 给这个用户继续发送。
- 目前没有公开接口支持 Bot 对一个从未互动过的用户/会话主动创建新对话。

因此本项目支持的是“对已建立会话的主动发送/延迟发送”，不是“凭空新建微信对话”。多 ClawBot profile 会分别保存各自的 context token。

公开资料没有给出 `context_token` 的明确有效期；不同版本/场景下表现可能不同。有实现提到较长时间内可复用，也有实践反馈长任务静默约数分钟后可能发送失败。因此本项目按“不保证长期有效”处理：

- 长任务默认每 `90s` 发送一次轻量 keepalive：`仍在处理...`。
- 最终结果发送失败时，会缓存最多 5 条待补发消息。
- 用户下一次给同一 ClawBot 发消息时，桥接服务拿到新的 `context_token` 后会先补发缓存结果。

可以在配置里调整 keepalive 间隔，设为 `0` 表示关闭：

```json
{
  "taskKeepAliveInterval": 90000
}
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `/status` | 查看当前工具、模型、目录、会话 |
| `/dir <路径>` | 设置工作目录 |
| `/model <名>` | 设置模型 |
| `/mode <auto\|safe\|plan>` | 设置权限模式 |
| `/msgmode <verbose\|normal\|compact>` | 设置消息详细度 |
| `/resume` | 浏览历史会话 |
| `/new` | 新会话 |
| `/cancel` | 取消当前任务 |
| `/send <路径>` | 发送本地文件到微信 |

## 开发

```bash
npm ci
npm run typecheck
npm test
npm run build
```

项目结构：

```text
src/
  adapters/       AI CLI 和远端 HTTP Agent 适配器
  bridge/         微信消息路由、会话、格式化
  ilink/          iLink 登录、轮询、发送消息、媒体上传
  utils/          日志、加解密、媒体下载、NAS 归档
examples/         配置和远端 Agent 示例
test/             Node test 测试
```

## 安全建议

- 本项目默认认为接入的 ClawBot 拥有完整配置权限；不要把 ClawBot 暴露给不可信用户。
- 如需多个微信 ClawBot，在 `clawbots` 中配置多个 profile。每个 profile 会单独保存登录凭据、poll cursor、context token 和会话状态。
- 远端 Agent 建议设置 `apiKey`
- NAS 共享目录建议使用专用目录和最小写权限
- 不要提交 `~/.wx-ai-bridge/credentials.json`
- `auto` 模式会给 CLI 较高权限，请只在可信环境使用

## License

MIT

## Acknowledgements

- [liangminmx/cli-in-wechat](https://github.com/liangminmx/cli-in-wechat)
- [sgaofen/cli-in-wechat](https://github.com/sgaofen/cli-in-wechat)
- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- [anomalyco/openclaw](https://github.com/anomalyco/openclaw)
