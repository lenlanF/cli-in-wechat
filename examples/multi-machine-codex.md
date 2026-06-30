# Multi-Machine Codex Setup

推荐只让一台机器登录微信 ClawBot 并运行 `cli-in-wechat`，其他机器作为 `remoteAgents` 接入。

示例：

```text
微信
  -> 机器 B / Windows: cli-in-wechat 主入口
       @codex  -> 调 B 本机 Codex CLI
       @codexa -> HTTP 调机器 A / Linux -> A 本机 Codex CLI
       文件    -> B 下载并归档到 NAS 指定目录
```

不建议 A 和 B 同时登录同一个 ClawBot 入口，否则可能重复消费消息或造成会话上下文混乱。

## 机器 A: Linux Codex HTTP Agent

机器 A 需要已经安装并登录好 Codex CLI。

确认：

```bash
codex --version
codex exec --skip-git-repo-check "hello"
```

复制 `examples/codex-http-agent.py` 到机器 A，然后启动：

```bash
cd /path/to/cli-in-wechat/examples
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic

LAN_AGENT_API_KEY=change-me \
CODEX_WORKDIR=/home/you/project \
uvicorn codex-http-agent:app --host 0.0.0.0 --port 8787
```

参数：

- `LAN_AGENT_API_KEY`: B 调 A 时使用的 Bearer token
- `CODEX_WORKDIR`: A 上 Codex 默认工作目录
- `CODEX_COMMAND`: Codex 命令名，默认 `codex`
- `CODEX_TIMEOUT`: 超时时间，单位秒，默认 `300`

机器 A 的防火墙需要允许 B 访问 TCP `8787`。

## 机器 B: Windows cli-in-wechat 配置

编辑 B 上的：

```text
~/.wx-ai-bridge/config.json
```

示例：

```json
{
  "defaultTool": "codex",
  "workDir": "D:\\Windows\\Default\\Documents\\wechat-workspace",
  "remoteAgents": {
    "codexa": {
      "displayName": "Codex on Linux A",
      "endpoint": "http://192.168.1.50:8787/agent",
      "apiKey": "change-me",
      "timeout": 300000
    }
  },
  "nasArchive": {
    "enabled": true,
    "path": "\\\\NAS01\\wechat-inbox\\project-a",
    "organizeByDate": true,
    "overwrite": false
  }
}
```

微信里使用：

```text
@codex 分析 B 机器上的项目
@codexa 分析 A 机器上的项目
```

如果你把微信文件发给 `@codexa`，B 会先下载文件并归档到 NAS，然后把本地路径和 `nasPath` 一起传给 A。A 上的 Codex 可以根据 `nasPath` 读取 NAS 文件，前提是 A 也能访问同一个 NAS 共享或挂载路径。

## NAS 路径

Windows B 推荐使用 UNC 路径：

```json
"path": "\\\\NAS01\\wechat-inbox\\project-a"
```

如果 Linux A 也需要直接读同一份文件，建议在 A 上挂载 NAS，例如：

```bash
sudo mkdir -p /mnt/wechat-inbox
sudo mount -t cifs //NAS01/wechat-inbox /mnt/wechat-inbox -o username=YOUR_USER
```

然后让 A 的 Agent 或 Codex 使用挂载后的路径。当前桥接服务传给远端 Agent 的是 B 侧归档路径；如果 A 与 B 的 NAS 路径表示不同，可以在 A 的 HTTP Agent wrapper 里做路径映射。
