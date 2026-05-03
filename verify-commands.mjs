#!/usr/bin/env node

/**
 * verify-commands.mjs -- Cross-CLI slash-command parity check.
 *
 * Confirms that the same set of `career-ops-*` commands is defined in
 * `.gemini/commands/*.toml` and `.opencode/commands/*.md`. Fails CI when
 * a command exists in one but not the other. Run: node verify-commands.mjs
 *
 * Output: JSON status to stdout on success; human error to stderr on failure.
 * Exit codes: 0 = parity, 1 = drift, 2 = setup error.
 */

import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const PREFIX = 'career-ops-';

function listCommands(relDir, ext) {
  const dir = join(projectRoot, relDir);
  if (!existsSync(dir)) {
    console.error(`verify-commands.mjs: missing directory ${relDir}`);
    process.exit(2);
  }
  return new Set(
    readdirSync(dir)
      .filter(f => f.startsWith(PREFIX) && f.endsWith(ext))
      .map(f => f.slice(PREFIX.length, -ext.length))
  );
}

const gemini = listCommands('.gemini/commands', '.toml');
const opencode = listCommands('.opencode/commands', '.md');

const onlyGemini = [...gemini].filter(x => !opencode.has(x)).sort();
const onlyOpencode = [...opencode].filter(x => !gemini.has(x)).sort();

if (onlyGemini.length === 0 && onlyOpencode.length === 0) {
  console.log(JSON.stringify({
    status: 'ok',
    count: gemini.size,
    commands: [...gemini].sort(),
  }));
  process.exit(0);
}

console.error('Cross-CLI command parity check FAILED.');
if (onlyGemini.length) {
  console.error(`  Only in .gemini/commands: ${onlyGemini.join(', ')}`);
  console.error(`    -> add .opencode/commands/${PREFIX}{name}.md for each, or remove from .gemini/`);
}
if (onlyOpencode.length) {
  console.error(`  Only in .opencode/commands: ${onlyOpencode.join(', ')}`);
  console.error(`    -> add .gemini/commands/${PREFIX}{name}.toml for each, or remove from .opencode/`);
}
process.exit(1);
