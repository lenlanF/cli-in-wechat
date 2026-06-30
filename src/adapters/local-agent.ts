import { spawn } from 'node:child_process';
import { log } from '../utils/logger.js';
import type { CLIAdapter, ExecOptions, ExecResult, AdapterCapabilities } from './base.js';
import { commandExists, setupAbort, setupTimeout, stripAnsi } from './base.js';
import type { LocalAgentConfig } from '../config.js';

function buildPrompt(prompt: string, opts: ExecOptions): string {
  const media = opts.media || [];
  if (media.length === 0) return prompt;

  const mediaLines = media.map((item) => {
    const parts = [
      `${item.type}: ${item.fileName}`,
      `path=${item.path}`,
      item.nasPath ? `nasPath=${item.nasPath}` : '',
      item.size ? `size=${item.size}` : '',
    ].filter(Boolean);
    return `- ${parts.join(' | ')}`;
  });

  return `${prompt}\n\n[收到媒体文件]\n${mediaLines.join('\n')}`;
}

function expandTemplate(value: string, prompt: string, opts: ExecOptions, agentName: string): string {
  return value
    .replaceAll('{prompt}', prompt)
    .replaceAll('{model}', opts.settings.model || '')
    .replaceAll('{mode}', opts.settings.mode || '')
    .replaceAll('{sessionId}', opts.settings.sessionIds[agentName] || '')
    .replaceAll('{workDir}', opts.settings.workDir || opts.workDir || '');
}

export class LocalAgentAdapter implements CLIAdapter {
  readonly capabilities: AdapterCapabilities = {
    streaming: false,
    jsonOutput: false,
    sessionResume: false,
    modes: ['auto', 'safe', 'plan'],
    hasEffort: false,
    hasModel: true,
    hasSearch: false,
    hasBudget: false,
  };

  constructor(
    readonly name: string,
    readonly displayName: string,
    readonly command: string,
    private readonly config: LocalAgentConfig,
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.command) && commandExists(this.command);
  }

  execute(prompt: string, opts: ExecOptions): Promise<ExecResult> {
    return new Promise((resolve) => {
      const started = Date.now();
      const fullPrompt = buildPrompt(prompt, opts);
      const promptMode = this.config.promptMode || 'stdin';
      const args = (this.config.args || []).map((arg) =>
        promptMode === 'template' ? expandTemplate(arg, fullPrompt, opts, this.name) : arg,
      );

      if (promptMode === 'arg') {
        if (this.config.promptArg) args.push(this.config.promptArg);
        args.push(fullPrompt);
      }

      const cwd = this.config.cwd || opts.settings.workDir || opts.workDir;
      log.debug(`[${this.name}] ${this.command} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`);
      const proc = spawn(this.command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...(this.config.env || {}) },
        shell: this.config.shell === true,
      });

      if (promptMode === 'stdin') {
        proc.stdin?.write(fullPrompt, 'utf8');
      }
      proc.stdin?.end();

      setupAbort(proc, opts.signal);
      const timer = setupTimeout(proc, this.config.timeout ?? opts.timeout);
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (opts.signal?.aborted) {
          resolve({ text: '已取消', error: true, duration: Date.now() - started });
          return;
        }
        const output = stripAnsi(stdout.trim() || stderr.trim());
        resolve({
          text: output || `exit ${code}`,
          error: code !== 0,
          duration: Date.now() - started,
        });
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({
          text: `无法启动本地 Agent ${this.displayName}: ${err.message}`,
          error: true,
          duration: Date.now() - started,
        });
      });
    });
  }
}
