# Remote Agent HTTP Protocol

`remoteAgents` 使用一个简单的 HTTP JSON 协议。任何局域网设备只要暴露这个接口，就可以在微信里通过 `@lan`、`@nasbot` 等名字调用。

## Request

`POST /agent`

```json
{
  "prompt": "用户消息",
  "model": "可选模型名",
  "mode": "auto",
  "sessionId": "可选会话 ID",
  "workDir": "桥接服务工作目录",
  "systemPrompt": "可选系统提示",
  "media": [
    {
      "type": "file",
      "path": "D:\\...\\.wx-media\\report.pdf",
      "fileName": "report.pdf",
      "size": 12345,
      "nasPath": "\\\\NAS\\wechat-inbox\\2026-06-30\\report.pdf"
    }
  ]
}
```

## Response

```json
{
  "text": "回复给微信的文本",
  "sessionId": "remote-session-id",
  "thinking": "可选调试内容"
}
```

也兼容 `response` 或 `result` 字段作为文本输出。

## Headers

配置了 `apiKey` 时，桥接服务会发送：

```http
Authorization: Bearer <apiKey>
```

也可以用 `headers` 配置额外请求头。
