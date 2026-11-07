import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findClaude, claudeCandidates, quoteForCmd, envWithClaude } from '../src/platform.js';

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'autoposter-home-'));
const touch = (p) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, ''); };

test('finds claude from the official installer folder without PATH', () => {
  const home = tmpHome();
  touch(path.join(home, '.local', 'bin', 'claude'));
  assert.equal(findClaude({ home, env: { PATH: '' }, platform: 'darwin' }), path.join(home, '.local', 'bin', 'claude'));
});

test('finds claude in the newest nvm Node version', () => {
  const home = tmpHome();
  touch(path.join(home, '.nvm', 'versions', 'node', 'v18.9.1', 'bin', 'claude'));
  touch(path.join(home, '.nvm', 'versions', 'node', 'v24.14.1', 'bin', 'claude'));
  assert.equal(findClaude({ home, env: { PATH: '' }, platform: 'darwin' }),
    path.join(home, '.nvm', 'versions', 'node', 'v24.14.1', 'bin', 'claude'));
});

test('CLAUDE_BIN wins; nothing found returns null', () => {
  const home = tmpHome();
  const bin = path.join(home, 'custom', 'claude');
  touch(bin);
  assert.equal(findClaude({ home, env: { CLAUDE_BIN: bin, PATH: '' }, platform: 'darwin' }), bin);
  assert.equal(findClaude({ home: tmpHome(), env: { PATH: '' }, platform: 'darwin' }), null);
});

test('Windows candidates cover the installer, npm shim and PATH', () => {
  const list = claudeCandidates({ home: 'C:\\Users\\a', env: { APPDATA: 'C:\\Users\\a\\AppData\\Roaming', PATH: 'C:\\tools' }, platform: 'win32' });
  assert.ok(list.some((p) => p.endsWith(path.join('.local', 'bin', 'claude.exe'))));
  assert.ok(list.some((p) => p.endsWith(path.join('npm', 'claude.cmd'))));
  assert.ok(list.some((p) => p.includes('tools') && p.endsWith('claude.cmd')));
});

test('cmd.exe quoting keeps flags bare and quotes paths with spaces', () => {
  assert.equal(quoteForCmd('--model'), '--model');
  assert.equal(quoteForCmd('mcp__claude-in-chrome__*'), 'mcp__claude-in-chrome__*');
  assert.equal(quoteForCmd('C:\\Users\\Jane Doe\\jobs\\1'), '"C:\\Users\\Jane Doe\\jobs\\1"');
  assert.equal(quoteForCmd('say "hi"'), '"say ""hi"""');
});

test('the claude folder goes first on PATH', () => {
  const env = envWithClaude('/x/bin/claude', { PATH: '/usr/bin' });
  assert.ok(env.PATH.startsWith(`/x/bin${path.delimiter}`));
});

test('auth status reports the Claude plan', async () => {
  const { parseAuthStatus } = await import('../src/platform.js');
  assert.deepEqual(parseAuthStatus('{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.c","subscriptionType":"max"}'),
    { loggedIn: true, authMethod: 'claude.ai', email: 'a@b.c', plan: 'max' });
  assert.equal(parseAuthStatus('{"loggedIn":false}').plan, null);
});

test('finds the Claude in Chrome extension per Chrome profile, with profile names', async () => {
  const { findClaudeExtension, CLAUDE_EXTENSION_ID } = await import('../src/platform.js');
  const home = tmpHome();
  const chrome = path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  fs.mkdirSync(path.join(chrome, 'Default', 'Extensions', CLAUDE_EXTENSION_ID), { recursive: true });
  fs.mkdirSync(path.join(chrome, 'Profile 2', 'Extensions', 'someotherextension'), { recursive: true });
  fs.writeFileSync(path.join(chrome, 'Local State'), JSON.stringify({ profile: { info_cache: { Default: { name: 'Work' } } } }));
  assert.deepEqual(findClaudeExtension({ home, platform: 'darwin' }), [{ browser: 'Chrome', profile: 'Work' }]);
  assert.deepEqual(findClaudeExtension({ home: tmpHome(), platform: 'darwin' }), []);
  const win = tmpHome();
  const local = path.join(win, 'AppData', 'Local');
  fs.mkdirSync(path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'Extensions', CLAUDE_EXTENSION_ID), { recursive: true });
  assert.deepEqual(findClaudeExtension({ home: win, env: { LOCALAPPDATA: local }, platform: 'win32' }), [{ browser: 'Chrome', profile: 'Default' }]);
});
