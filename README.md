# cli-in-wechat

在微信里调用本机 AI 编程 CLI、局域网其他设备上的 AI 智能体，并把微信文件自动归档到局域网 NAS。

这个项目是一个运行在你电脑上的桥接服务：微信负责输入和文件传输，电脑负责接入 ClawBot iLink API、调用本机/局域网 Agent、保存媒体文件并转存 NAS。

## 功能

- 微信 ClawBot 官方 iLink Bot API 收发消息
- Claude Code / Codex CLI / Gemini CLI / Hermes Agent / Kimi Code / OpenClaw / OpenCode
- `@工具名` 切换工具，支持 `@tool1>tool2` 链式调用和 `>>` 接力
- `remoteAgents`：通过 HTTP JSON 调用同局域网其他设备上的 AI Agent
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
  "allowedUsers": [],
  "remoteAgents": {
    "lan": {
      "displayName": "LAN Agent",
      "endpoint": "http://192.168.1.50:8787/agent",
      "apiKey": "change-me",
      "timeout": 300000
    }
  },
  "nasArchive": {
    "enabled": true,
    "path": "\\\\NAS\\wechat-inbox",
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

### NAS 文件归档

启用 `nasArchive` 后，微信发来的图片、文件、视频会同时保存到：

- 桥接服务本地媒体目录
- 指定 NAS 目录，例如 `\\NAS\wechat-inbox\2026-06-30\report.pdf`

归档后的 `nasPath` 会传给本机 CLI 和远端 Agent，方便 NAS 上的 Agent 直接读取或后续自动化处理。

Windows 推荐使用 UNC 路径：

```json
{
  "nasArchive": {
    "enabled": true,
    "path": "\\\\192.168.1.10\\share\\wechat-inbox",
    "organizeByDate": true,
    "overwrite": false
  }
}
```

Linux/macOS 可先挂载 NAS，再填写挂载目录：

```json
{
  "nasArchive": {
    "enabled": true,
    "path": "/mnt/nas/wechat-inbox"
  }
}
```

## 使用

```text
@lan 帮我分析刚发的 PDF
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

- 生产使用时请配置 `allowedUsers`
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
