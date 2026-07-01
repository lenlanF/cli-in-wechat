import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { archiveMediaToNas, getUncShareRoot } from '../src/utils/nas.js';

test('archiveMediaToNas copies media and avoids overwriting same-name files', () => {
  const root = mkdtempSync(join(tmpdir(), 'wx-nas-'));
  const sourceDir = join(root, 'source');
  const targetDir = join(root, 'nas');
  const sourcePath = join(sourceDir, 'report.txt');

  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(sourcePath, 'first', { flag: 'w' });

  const first = archiveMediaToNas({
    type: 'file',
    path: sourcePath,
    fileName: 'report.txt',
    size: 5,
  }, {
    enabled: true,
    path: targetDir,
    organizeByDate: false,
    overwrite: false,
  });

  writeFileSync(sourcePath, 'second', { flag: 'w' });
  const second = archiveMediaToNas({
    type: 'file',
    path: sourcePath,
    fileName: 'report.txt',
    size: 6,
  }, {
    enabled: true,
    path: targetDir,
    organizeByDate: false,
    overwrite: false,
  });

  assert.ok(first.nasPath?.endsWith('report.txt'));
  assert.ok(second.nasPath?.endsWith('report-1.txt'));
  assert.equal(readFileSync(first.nasPath!, 'utf-8'), 'first');
  assert.equal(readFileSync(second.nasPath!, 'utf-8'), 'second');
});

test('archiveMediaToNas supports a specified NAS device and folder path', () => {
  const root = mkdtempSync(join(tmpdir(), 'wx-nas-device-'));
  const sourceDir = join(root, 'source');
  const nasDeviceFolder = join(root, 'NAS01', 'wechat-inbox', 'project-a');
  const sourcePath = join(sourceDir, 'image.png');

  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(sourcePath, 'png-bytes');

  const archived = archiveMediaToNas({
    type: 'image',
    path: sourcePath,
    fileName: 'image.png',
    size: 9,
  }, {
    enabled: true,
    path: nasDeviceFolder,
    organizeByDate: false,
    overwrite: false,
  });

  assert.ok(archived.nasPath?.startsWith(nasDeviceFolder));
  assert.ok(archived.nasPath?.endsWith('image.png'));
  assert.equal(readFileSync(archived.nasPath!, 'utf-8'), 'png-bytes');
});

test('getUncShareRoot extracts server and share from a nested NAS path', () => {
  assert.equal(getUncShareRoot('\\\\NAS01\\wechat-inbox\\project-a'), '\\\\NAS01\\wechat-inbox');
  assert.equal(getUncShareRoot('\\\\192.168.1.10\\share\\wechat-inbox'), '\\\\192.168.1.10\\share');
  assert.equal(getUncShareRoot('D:\\local\\folder'), null);
});
