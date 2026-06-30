# Local Agent Configuration

`localAgents` 用于把本机任意命令行 Agent 注册成微信里的自定义 `@名称`。

## stdin 模式

适合 Codex-like、Ollama-like、Python 脚本等从标准输入读取 prompt 的工具。

```json
{
  "localAgents": {
    "ollama": {
      "displayName": "Ollama Local",
      "command": "ollama",
      "args": ["run", "qwen2.5-coder:7b"],
      "promptMode": "stdin"
    }
  }
}
```

微信里发送：

```text
@ollama 分析这个文件
```

## arg 模式

适合通过命令行参数接收 prompt 的工具。

```json
{
  "localAgents": {
    "mycli": {
      "command": "my-agent",
      "args": ["--model", "local-model"],
      "promptMode": "arg",
      "promptArg": "--prompt"
    }
  }
}
```

实际执行相当于：

```bash
my-agent --model local-model --prompt "用户消息"
```

如果不需要 `--prompt` 这种标志，可以省略 `promptArg`，prompt 会作为最后一个参数。

## template 模式

适合必须把 prompt 插入固定参数位置的工具。

```json
{
  "localAgents": {
    "templated": {
      "command": "my-agent",
      "args": ["run", "--input", "{prompt}", "--workdir", "{workDir}"],
      "promptMode": "template"
    }
  }
}
```

支持的占位符：

- `{prompt}`
- `{model}`
- `{mode}`
- `{sessionId}`
- `{workDir}`

## shell 模式

默认情况下 `localAgents` 使用原生进程启动方式，这样 Windows 上包含空格的 prompt 不会被 shell 拆开。

如果你的工具必须通过 `.cmd`/shell wrapper 启动，可以显式开启：

```json
{
  "localAgents": {
    "npmagent": {
      "command": "npm.cmd",
      "args": ["run", "agent", "--"],
      "promptMode": "arg",
      "shell": true
    }
  }
}
```

开启 `shell` 后，请避免把不可信内容放进模板参数里；更推荐优先使用 `stdin` 模式。

## 媒体文件

微信发来的文件会附加到 prompt 后面：

```text
[收到媒体文件]
- file: report.pdf | path=D:\...\report.pdf | nasPath=\\NAS\wechat-inbox\2026-06-30\report.pdf
```

因此本地 Agent 可以读取本地路径，也可以读取 NAS 路径。
