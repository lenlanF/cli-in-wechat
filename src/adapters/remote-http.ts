import { log } from '../utils/logger.js';
import type { CLIAdapter, ExecOptions, ExecResult, AdapterCapabilities } from './base.js';
import type { RemoteAgentConfig } from '../config.js';

interface RemoteAgentResponse {
  text?: string;
  response?: string;
  result?: string;
  thinking?: string;
  sessionId?: string;
  session_id?: string;
  error?: string | boolean;
}

export class RemoteHttpAgentAdapter implements CLIAdapter {
  readonly command = 'remote-http';
  readonly capabilities: AdapterCapabilities = {
    streaming: false,
    jsonOutput: true,
    sessionResume: true,
    modes: ['auto', 'safe', 'plan'],
    hasEffort: false,
    hasModel: true,
    hasSearch: false,
    hasBudget: false,
  };

  constructor(
    readonly name: string,
    readonly displayName: string,
    private readonly config: RemoteAgentConfig,
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.config.endpoint);
  }

  async execute(prompt: string, opts: ExecOptions): Promise<ExecResult> {
    const controller = new AbortController();
    const timeout = this.config.timeout ?? opts.timeout ?? 300_000;
    const timer = setTimeout(() => controller.abort(), timeout);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const started = Date.now();
    const media = opts.media?.map((item) => ({
      type: item.type,
      path: item.path,
      fileName: item.fileName,
      mimeType: item.mimeType,
      size: item.size,
      nasPath: item.nasPath,
    }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(this.config.headers || {}),
      };
      if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

      log.debug(`[${this.name}] POST ${this.config.endpoint}`);
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          model: opts.settings.model || undefined,
          mode: opts.settings.mode,
          sessionId: opts.settings.sessionIds[this.name],
          workDir: opts.settings.workDir || opts.workDir,
          systemPrompt: opts.settings.systemPrompt || undefined,
          media,
        }),
        signal: controller.signal,
      });

      const raw = await res.text();
      let data: RemoteAgentResponse | null = null;
      try {
        data = raw ? JSON.parse(raw) as RemoteAgentResponse : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        return {
          text: data?.error ? String(data.error) : raw || `HTTP ${res.status}`,
          error: true,
          duration: Date.now() - started,
        };
      }

      const text = data?.text ?? data?.response ?? data?.result ?? raw;
      return {
        text: String(text || '').trim() || '(远端 Agent 无输出)',
        thinking: data?.thinking,
        sessionId: data?.sessionId ?? data?.session_id,
        error: Boolean(data?.error),
        duration: Date.now() - started,
      };
    } catch (err) {
      if (opts.signal?.aborted) return { text: '已取消', error: true };
      const message = err instanceof Error ? err.message : String(err);
      return { text: `远端 Agent 调用失败: ${message}`, error: true, duration: Date.now() - started };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
}
