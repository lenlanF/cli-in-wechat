import { log } from '../utils/logger.js';
import type { CLIAdapter, ExecOptions, ExecResult, AdapterCapabilities } from './base.js';
import { commandExists, spawnProc, setupAbort, setupTimeout, stripAnsi } from './base.js';
import type { DownloadedMedia } from '../utils/media.js';
import { copyMediaToWorkDir } from '../utils/media.js';
import { randomUUID } from 'node:crypto';

function buildMediaPrompt(prompt: string, media?: DownloadedMedia[], workDir?: string): string {
  if (!media || media.length === 0) return prompt;
  
  const copiedMedia = workDir ? media.map(m => copyMediaToWorkDir(m, workDir)) : media;
  
  const fileList = copiedMedia.map(m => {
    const relativePath = workDir && m.path.startsWith(workDir) 
      ? m.path.slice(workDir.length).replace(/^[\/\\]/, '')
      : m.path;
    const typeNames: Record<string, string> = { image: '图片', file: '文件', video: '视频' };
    const sizeStr = m.size ? `${(m.size / 1024).toFixed(1)}KB` : '未知大小';
    const nasPath = m.nasPath ? `\n  NAS路径: ${m.nasPath}` : '';
    return `- ${m.fileName}\n  类型: ${typeNames[m.type] || '文件'}\n  大小: ${sizeStr}\n  路径: ${relativePath}${nasPath}`;
  }).join('\n\n');
  
  const userPrompt = prompt.trim() && !prompt.startsWith('[文件:') && !prompt.startsWith('[图片:') && !prompt.startsWith('[视频:')
    ? `\n\n用户说：${prompt}`
    : '';
  
  return `已接收到用户通过微信发送的文件：

${fileList}

文件已保存到工作目录。请勿主动读取或处理这些文件，等待用户明确指示需要做什么。${userPrompt}`;
}

function extractOpenClawContent(text: string): string {
  const lines = text.split('\n');
  const contentLines: string[] = [];
  let inContent = false;

  for (const line of lines) {
    const stripped = stripAnsi(line);
    const l = stripped.trim();

    if (l.startsWith('[plugins]')) continue;
    if (l.startsWith('[mnemo]')) continue;
    if (l.startsWith('[agent/')) continue;
    if (l.startsWith('[tools]')) continue;
    if (l.startsWith('[diagnostic]')) continue;
    if (l.startsWith('[compaction-')) continue;
    if (l.startsWith('Config warnings:')) continue;
    if (l.startsWith('- plugins.')) continue;
    if (l.startsWith('Registered')) continue;
    if (l.startsWith('Server mode')) continue;
    if (l.startsWith('low context window')) continue;
    if (l.startsWith('tools.profile')) continue;
    if (l.startsWith('Auto-provisioned')) continue;
    if (l.startsWith('Claim your')) continue;
    if (l.startsWith('Compaction safeguard')) continue;
    if (l.startsWith('Compaction detected')) continue;
    if (l.startsWith('Ingest accepted')) continue;
    if (l.includes('FailoverError')) continue;
    if (l.includes('session file locked')) continue;
    if (!l) continue;

    inContent = true;
    contentLines.push(stripped);
  }

  return contentLines.join('\n').trim();
}

export class OpenClawAdapter implements CLIAdapter {
  readonly name = 'openclaw';
  readonly displayName = 'OpenClaw';
  readonly command = 'openclaw';
  readonly capabilities: AdapterCapabilities = {
    streaming: false,
    jsonOutput: true,
    sessionResume: true,
    modes: ['auto'],
    hasEffort: false,
    hasModel: true,
    hasSearch: false,
    hasBudget: false,
  };

  async isAvailable(): Promise<boolean> {
    return commandExists(this.command);
  }

  execute(prompt: string, opts: ExecOptions): Promise<ExecResult> {
    return new Promise((resolve) => {
      const { settings } = opts;
      const workDir = settings.workDir || opts.workDir;
      const fullPrompt = buildMediaPrompt(prompt, opts.media, workDir);
      const args = ['agent', '--message', fullPrompt, '--local'];

      if (settings.model) {
        args.push('--model', settings.model);
      }

      const sessionId = settings.sessionIds[this.name];
      if (sessionId) {
        args.push('--session-id', sessionId);
      } else {
        args.push('--session-id', `wx-${randomUUID().slice(0, 8)}`);
      }

      if (opts.extraArgs) args.push(...opts.extraArgs);

      log.debug(`[openclaw] executing`);

      const proc = spawnProc(this.command, args, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      setupAbort(proc, opts.signal);
      const timer = setupTimeout(proc, opts.timeout);

      let stdout = '';
      let stderr = '';
      proc.stdout!.on('data', (c: Buffer) => { stdout += c.toString(); });
      proc.stderr!.on('data', (c: Buffer) => { stderr += c.toString(); });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (opts.signal?.aborted) {
          resolve({ text: '已取消', error: true });
          return;
        }

        const stdoutText = stripAnsi(stdout.trim());
        const stderrText = stripAnsi(stderr.trim());

        const jsonLines = stdoutText.split('\n').filter(l => l.trim().startsWith('{'));
        for (const line of jsonLines) {
          try {
            const r = JSON.parse(line);
            if (r.text || r.result || r.response || r.message || r.content) {
              const content = r.text || r.result || r.response || r.message || r.content;
              resolve({
                text: typeof content === 'string' ? content : JSON.stringify(content),
                error: !!r.error || code !== 0,
                sessionId: r.sessionId || r.session_id,
              });
              return;
            }
          } catch { continue; }
        }

        const content = extractOpenClawContent(stdoutText || stderrText);
        const sessionMatch = stdoutText.match(/sessionID[":\s]+([a-f0-9-]{8,})/i) ||
                             stdoutText.match(/session[-_]?id[":\s]+([a-f0-9-]{8,})/i);

        resolve({
          text: content || `完成`,
          error: code !== 0,
          sessionId: sessionMatch ? sessionMatch[1] : undefined,
        });
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({ text: `无法启动 OpenClaw: ${err.message}`, error: true });
      });
    });
  }
}
