# Contributing

欢迎提交 issue、文档改进、适配器和测试。

## 本地开发

```bash
npm ci
npm run typecheck
npm test
npm run build
```

开发运行：

```bash
npm run dev
```

调试运行：

```bash
npm run dev:debug
```

## Pull Request 约定

- 保持改动聚焦，避免夹带无关格式化。
- 新增功能尽量补测试或至少补配置示例。
- 不要提交本地凭据、token、`.env`、`~/.wx-ai-bridge` 内容或 NAS 私有路径。
- 新增适配器请实现 `CLIAdapter`，并在 `AdapterRegistry` 注册。

## 安全提醒

本项目会代表用户执行本机 CLI、访问局域网服务并复制微信文件到本地/NAS。提交功能时请优先考虑最小权限、可配置开关、清晰日志和失败时不破坏原文件。
