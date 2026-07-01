import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join, parse } from 'node:path';
import { spawnSync } from 'node:child_process';
import { log } from './logger.js';
import type { NasArchiveConfig } from '../config.js';
import type { DownloadedMedia } from './media.js';

export interface ArchivedMedia extends DownloadedMedia {
  nasPath?: string;
}

const connectedShares = new Set<string>();

function todayFolder(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function uniquePath(dir: string, fileName: string): string {
  const first = join(dir, fileName);
  if (!existsSync(first)) return first;

  const parsed = parse(fileName);
  for (let i = 1; i < 10_000; i++) {
    const candidate = join(dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(dir, `${parsed.name}-${Date.now()}${parsed.ext}`);
}

export function getUncShareRoot(path: string): string | null {
  const normalized = path.replace(/\//g, '\\');
  const match = normalized.match(/^\\\\([^\\]+)\\([^\\]+)/);
  if (!match) return null;
  return `\\\\${match[1]}\\${match[2]}`;
}

function formatNasUser(username: string, domain?: string): string {
  if (!domain || username.includes('\\') || username.includes('@')) return username;
  return `${domain}\\${username}`;
}

export function connectWindowsNasShare(config?: NasArchiveConfig): boolean {
  if (process.platform !== 'win32') return true;
  if (!config?.path || !config.auth?.username || !config.auth.password) return true;

  const shareRoot = getUncShareRoot(config.path);
  if (!shareRoot) return true;
  if (connectedShares.has(shareRoot)) return true;

  const user = formatNasUser(config.auth.username, config.auth.domain);
  const result = spawnSync('net', ['use', shareRoot, config.auth.password, `/user:${user}`], {
    encoding: 'utf-8',
    windowsHide: true,
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status === 0 || /命令成功完成|command completed successfully/i.test(output)) {
    connectedShares.add(shareRoot);
    log.info(`[nas] Connected share: ${shareRoot}`);
    return true;
  }

  if (/1219|multiple connections|多个连接/i.test(output)) {
    connectedShares.add(shareRoot);
    log.warn(`[nas] Share already connected with existing credentials: ${shareRoot}`);
    return true;
  }

  log.error(`[nas] 连接共享失败 ${shareRoot}: ${output.trim() || `exit ${result.status}`}`);
  return false;
}

export function archiveMediaToNas(media: DownloadedMedia, config?: NasArchiveConfig): ArchivedMedia {
  if (!config?.enabled || !config.path) return media;

  try {
    connectWindowsNasShare(config);

    const targetDir = config.organizeByDate === false
      ? config.path
      : join(config.path, todayFolder());
    mkdirSync(targetDir, { recursive: true });

    const fileName = basename(media.fileName || media.path);
    const targetPath = config.overwrite
      ? join(targetDir, fileName)
      : uniquePath(targetDir, fileName);

    copyFileSync(media.path, targetPath);
    log.info(`[nas] Archived media: ${targetPath}`);
    return { ...media, nasPath: targetPath };
  } catch (err) {
    log.error(`[nas] 归档失败: ${(err as Error).message}`);
    return media;
  }
}

export function archiveMediaListToNas(media: DownloadedMedia[], config?: NasArchiveConfig): ArchivedMedia[] {
  return media.map((item) => archiveMediaToNas(item, config));
}
