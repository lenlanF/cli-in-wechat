import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Credentials } from './ilink/types.js';

const DATA_DIR = join(homedir(), '.wx-ai-bridge');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const CREDENTIALS_FILE = join(DATA_DIR, 'credentials.json');
const SESSIONS_DIR = join(DATA_DIR, 'sessions');
const POLL_CURSOR_FILE = join(DATA_DIR, 'poll_cursor.txt');
const CONTEXT_TOKENS_FILE = join(DATA_DIR, 'context_tokens.json');

function botDataDir(botName?: string): string {
  const name = botName || 'default';
  return name === 'default' ? DATA_DIR : join(DATA_DIR, 'bots', name);
}

function credentialsFile(botName?: string): string {
  return botName && botName !== 'default' ? join(botDataDir(botName), 'credentials.json') : CREDENTIALS_FILE;
}

function pollCursorFile(botName?: string): string {
  return botName && botName !== 'default' ? join(botDataDir(botName), 'poll_cursor.txt') : POLL_CURSOR_FILE;
}

function contextTokensFile(botName?: string): string {
  return botName && botName !== 'default' ? join(botDataDir(botName), 'context_tokens.json') : CONTEXT_TOKENS_FILE;
}

export interface ToolConfig {
  args?: string[];
  files?: string[];
}

export interface RemoteAgentConfig {
  endpoint: string;
  displayName?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface LocalAgentConfig {
  command: string;
  displayName?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  promptMode?: 'stdin' | 'arg' | 'template';
  promptArg?: string;
  shell?: boolean;
  timeout?: number;
}

export interface NasAuthConfig {
  username?: string;
  password?: string;
  domain?: string;
}

export interface NasArchiveConfig {
  enabled: boolean;
  path: string;
  organizeByDate?: boolean;
  overwrite?: boolean;
  auth?: NasAuthConfig;
}

export interface ClawBotConfig {
  name: string;
  enabled?: boolean;
}

export interface BridgeConfig {
  defaultTool: string;
  maxResponseChunkSize: number;
  cliTimeout: number;
  typingInterval: number;
  allowedUsers: string[];
  workDir: string;
  tools: Record<string, ToolConfig>;
  remoteAgents: Record<string, RemoteAgentConfig>;
  localAgents: Record<string, LocalAgentConfig>;
  nasArchive: NasArchiveConfig;
  clawbots: ClawBotConfig[];
}

const DEFAULT_CONFIG: BridgeConfig = {
  defaultTool: 'claude',
  maxResponseChunkSize: 2000,
  cliTimeout: 300_000,      // 5 minutes
  typingInterval: 5_000,    // 5 seconds
  allowedUsers: [],          // empty = allow all
  workDir: process.cwd(),
  tools: {},
  remoteAgents: {},
  localAgents: {},
  nasArchive: {
    enabled: false,
    path: '',
    organizeByDate: true,
    overwrite: false,
  },
  clawbots: [],
};

export function ensureDataDir(): void {
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o700 });
}

export function loadConfig(): BridgeConfig {
  ensureDataDir();
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BridgeConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      tools: { ...DEFAULT_CONFIG.tools, ...(parsed.tools || {}) },
      remoteAgents: { ...DEFAULT_CONFIG.remoteAgents, ...(parsed.remoteAgents || {}) },
      localAgents: { ...DEFAULT_CONFIG.localAgents, ...(parsed.localAgents || {}) },
      nasArchive: { ...DEFAULT_CONFIG.nasArchive, ...(parsed.nasArchive || {}) },
      clawbots: parsed.clawbots || DEFAULT_CONFIG.clawbots,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: BridgeConfig): void {
  ensureDataDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function loadCredentials(botName?: string): Credentials | null {
  const file = credentialsFile(botName);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    if (!data.botToken) return null;
    return data as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials, botName?: string): void {
  ensureDataDir();
  mkdirSync(botDataDir(botName), { recursive: true, mode: 0o700 });
  writeFileSync(credentialsFile(botName), JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function clearCredentials(botName?: string): void {
  const file = credentialsFile(botName);
  if (existsSync(file)) {
    writeFileSync(file, '{}', { mode: 0o600 });
  }
}

export function loadPollCursor(botName?: string): string {
  const file = pollCursorFile(botName);
  if (!existsSync(file)) return '';
  try {
    return readFileSync(file, 'utf-8').trim();
  } catch {
    return '';
  }
}

export function savePollCursor(cursor: string, botName?: string): void {
  ensureDataDir();
  mkdirSync(botDataDir(botName), { recursive: true, mode: 0o700 });
  writeFileSync(pollCursorFile(botName), cursor, { mode: 0o600 });
}

export function saveContextTokens(tokens: Map<string, string>, botName?: string): void {
  ensureDataDir();
  mkdirSync(botDataDir(botName), { recursive: true, mode: 0o700 });
  const obj: Record<string, string> = {};
  for (const [k, v] of tokens) obj[k] = v;
  const file = contextTokensFile(botName);
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}

export function loadContextTokens(botName?: string): Map<string, string> {
  const file = contextTokensFile(botName);
  if (!existsSync(file)) return new Map();
  try {
    const raw = readFileSync(file, 'utf-8');
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function getSessionsDir(botName?: string): string {
  return botName && botName !== 'default' ? join(botDataDir(botName), 'sessions') : SESSIONS_DIR;
}

export { DATA_DIR };
