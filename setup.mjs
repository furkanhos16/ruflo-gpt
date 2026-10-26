import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generate an exact local configuration without rewriting the user's settings.
const root = dirname(fileURLToPath(import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (process.platform !== 'linux' || major < 20 || (major === 20 && minor < 9)) {
  throw new Error('Ruflo GPT currently requires Linux and Node.js 20.9 or newer.');
}
await access('/usr/bin/flock', constants.X_OK);
const pkg = JSON.parse(await readFile(join(root, 'node_modules/ruflo/package.json'), 'utf8'));
if (pkg.version !== '3.63.0') throw new Error('Run npm ci --ignore-scripts first (Ruflo 3.63.0 required).');
const output = join(root, '.ruflo-setup');
await mkdir(join(output, 'ruflo-codex/agents'), {recursive:true, mode:0o700});
const config = [
  '[mcp_servers.ruflo]',
  `command = ${JSON.stringify(process.execPath)}`,
  `args = [${JSON.stringify(join(root, 'server.mjs'))}]`,
  'startup_timeout_sec = 20',
  'tool_timeout_sec = 130',
  ''
].join('\n');
await writeFile(join(output, 'mcp-config.toml'), config, {mode:0o600});
const skill = (await readFile(join(root, 'skill/SKILL.md'), 'utf8')).replaceAll('<checkout>', root);
await writeFile(join(output, 'ruflo-codex/SKILL.md'), skill, {mode:0o600});
await writeFile(join(output, 'ruflo-codex/agents/openai.yaml'), await readFile(join(root, 'skill/agents/openai.yaml')), {mode:0o600});
console.log(config);
console.log(`Generated configuration and skill: ${output}`);
console.log('Add this block to your Codex config.toml, and copy the generated ruflo-codex folder into your Codex skills directory.');
console.log('If a ruflo entry or skill already exists, review and back it up before replacing it. Existing settings were not changed.');
