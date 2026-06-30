import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join, parse } from 'node:path';
import { log } from './logger.js';
import type { NasArchiveConfig } from '../config.js';
import type { DownloadedMedia } from './media.js';

export interface ArchivedMedia extends DownloadedMedia {
  nasPath?: string;
}

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

export function archiveMediaToNas(media: DownloadedMedia, config?: NasArchiveConfig): ArchivedMedia {
  if (!config?.enabled || !config.path) return media;

  try {
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
