from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Any
import os
import uuid

API_KEY = os.getenv("LAN_AGENT_API_KEY", "change-me")

app = FastAPI()


class AgentRequest(BaseModel):
    prompt: str
    model: str | None = None
    mode: str | None = None
    sessionId: str | None = None
    workDir: str | None = None
    systemPrompt: str | None = None
    media: list[dict[str, Any]] = []


@app.post("/agent")
def agent(req: AgentRequest, authorization: str | None = Header(default=None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="unauthorized")

    media_lines = []
    for item in req.media:
        media_lines.append(
            f"- {item.get('fileName')} local={item.get('path')} nas={item.get('nasPath')}"
        )

    # Replace this section with your own agent, Ollama, OpenAI-compatible service,
    # LangGraph workflow, Home Assistant automation, NAS script, etc.
    text = "LAN Agent 收到：\n"
    text += req.prompt
    if media_lines:
        text += "\n\n媒体文件：\n" + "\n".join(media_lines)

    return {
        "text": text,
        "sessionId": req.sessionId or str(uuid.uuid4()),
    }


# Run:
#   pip install fastapi uvicorn pydantic
#   LAN_AGENT_API_KEY=change-me uvicorn remote-agent-fastapi:app --host 0.0.0.0 --port 8787
