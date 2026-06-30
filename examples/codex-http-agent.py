import os
import subprocess
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

API_KEY = os.getenv("LAN_AGENT_API_KEY", "change-me")
CODEX_COMMAND = os.getenv("CODEX_COMMAND", "codex")
CODEX_WORKDIR = os.getenv("CODEX_WORKDIR", str(Path.home()))
CODEX_TIMEOUT = int(os.getenv("CODEX_TIMEOUT", "300"))

app = FastAPI()


class AgentRequest(BaseModel):
    prompt: str
    model: str | None = None
    mode: str | None = None
    sessionId: str | None = None
    workDir: str | None = None
    systemPrompt: str | None = None
    media: list[dict[str, Any]] = []


def build_prompt(req: AgentRequest) -> str:
    parts = []
    if req.systemPrompt:
        parts.append(f"[System]\n{req.systemPrompt}")
    parts.append(req.prompt)

    if req.media:
        lines = []
        for item in req.media:
            lines.append(
                "- "
                + " | ".join(
                    str(v)
                    for v in [
                        item.get("type"),
                        item.get("fileName"),
                        f"local={item.get('path')}" if item.get("path") else "",
                        f"nas={item.get('nasPath')}" if item.get("nasPath") else "",
                    ]
                    if v
                )
            )
        parts.append("[Media]\n" + "\n".join(lines))

    return "\n\n".join(parts)


@app.post("/agent")
def agent(req: AgentRequest, authorization: str | None = Header(default=None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="unauthorized")

    args = [CODEX_COMMAND, "exec", "--skip-git-repo-check"]
    if req.model:
        args.extend(["-m", req.model])
    if req.mode == "auto":
        args.append("--dangerously-bypass-approvals-and-sandbox")
    else:
        args.append("--full-auto")

    prompt = build_prompt(req)
    cwd = req.workDir or CODEX_WORKDIR

    try:
        proc = subprocess.run(
            args,
            input=prompt,
            text=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=CODEX_TIMEOUT,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="codex timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"codex command not found: {CODEX_COMMAND}")

    output = (proc.stdout or proc.stderr).strip()
    return {
        "text": output or f"codex exit {proc.returncode}",
        "sessionId": req.sessionId or str(uuid.uuid4()),
        "error": proc.returncode != 0,
    }


# Run on Linux machine A:
#   pip install fastapi uvicorn pydantic
#   LAN_AGENT_API_KEY=change-me CODEX_WORKDIR=/home/you/project \
#     uvicorn codex-http-agent:app --host 0.0.0.0 --port 8787
