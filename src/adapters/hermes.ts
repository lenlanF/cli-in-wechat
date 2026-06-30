import { log } from '../utils/logger.js';
import type { CLIAdapter, ExecOptions, ExecResult, AdapterCapabilities } from './base.js';
import { commandExists, spawnProc, setupAbort, setupTimeout, stripAnsi } from './base.js';
import type { DownloadedMedia } from '../utils/media.js';
import { copyMediaToWorkDir } from '../utils/media.js';

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

export class HermesAdapter implements CLIAdapter {
  readonly name = 'hermes';
  readonly displayName = 'Hermes';
  readonly command = 'hermes';
  readonly capabilities: AdapterCapabilities = {
    streaming: false,
    jsonOutput: false,
    sessionResume: true,
    modes: ['auto', 'safe'],
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
      const args = ['chat', '-q', fullPrompt, '-Q'];

      if (settings.mode === 'auto') {
        args.push('--yolo');
      }

      if (settings.model) {
        args.push('-m', settings.model);
      }

      const sessionId = settings.sessionIds[this.name];
      if (sessionId) {
        args.push('--resume', sessionId);
      }

      if (opts.extraArgs) args.push(...opts.extraArgs);

      log.debug(`[hermes] executing`);

      const proc = spawnProc(this.command, args, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      setupAbort(proc, opts.signal);
      const timer = setupTimeout(proc, opts.timeout);

      let stdout = '';
      let stderr = '';
      proc.stdout!.on('data', (c: Buffer) => {
        stdout += c.toString();
      });
      proc.stderr!.on('data', (c: Buffer) => {
        stderr += c.toString();
      });

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (opts.signal?.aborted) {
          resolve({ text: '已取消', error: true });
          return;
        }

        const text = stripAnsi(stdout.trim() || stderr.trim());
        const sessionMatch = text.match(/session[:\s]+([a-f0-9-]{20,})/i);

        resolve({
          text: text || `exit ${code}`,
          error: code !== 0,
          sessionId: sessionMatch ? sessionMatch[1] : undefined,
        });
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({ text: `无法启动 Hermes: ${err.message}`, error: true });
      });
    });
  }
}
