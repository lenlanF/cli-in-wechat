import test from 'node:test';
import assert from 'node:assert/strict';

import { AdapterRegistry } from '../src/adapters/registry.js';
import type { BridgeConfig } from '../src/config.js';

function createConfig(): BridgeConfig {
  return {
    defaultTool: 'lan',
    maxResponseChunkSize: 2000,
    cliTimeout: 300_000,
    typingInterval: 5000,
    allowedUsers: [],
    workDir: process.cwd(),
    tools: {},
    remoteAgents: {
      lan: {
        displayName: 'LAN Agent',
        endpoint: 'http://127.0.0.1:8787/agent',
      },
    },
    nasArchive: {
      enabled: false,
      path: '',
      organizeByDate: true,
      overwrite: false,
    },
  };
}

test('AdapterRegistry registers configured remote HTTP agents', async () => {
  const registry = new AdapterRegistry(createConfig());
  const adapter = registry.get('lan');

  assert.equal(adapter?.name, 'lan');
  assert.equal(adapter?.displayName, 'LAN Agent');
  assert.equal(adapter?.capabilities.sessionResume, true);
  assert.equal(await adapter?.isAvailable(), true);
});
