import { readFile, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import Ajv from 'ajv';

export const root = dirname(fileURLToPath(import.meta.url));
export const stateRoot = resolve(process.env.RUFLO_CODEX_STATE_DIR || join(homedir(), '.local/share/ruflo-codex/state'));
export const tools = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
tools.unshift({
  name: 'codex_status',
  description: 'Use to inspect the installed Ruflo/Codex adapter and its project store. Reports actual versions and boundaries. Does not launch agents or modify Codex settings.',
  inputSchema: {type:'object',properties:{project_path:{type:'string',minLength:1}},required:['project_path'],additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
});
const ajv = new Ajv({strict:false,allErrors:true});
const validators = new Map(tools.map(t => [t.name, ajv.compile(t.inputSchema)]));

export async function projectStore(projectPath) {
  if (!isAbsolute(projectPath)) throw new Error('project_path must be an absolute existing directory');
  const canonical = await realpath(projectPath);
  if (!(await stat(canonical)).isDirectory()) throw new Error('project_path must be a directory');
  const id = createHash('sha256').update(canonical).digest('hex');
  const directory = join(stateRoot, 'projects', id);
  await mkdir(directory, {recursive:true,mode:0o700});
  const metadata = join(directory, 'project.json');
  try { await writeFile(metadata, JSON.stringify({project_path:canonical,id},null,2)+'\n', {flag:'wx',mode:0o600}); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  return {directory,canonical,id};
}

async function worker(name, args, directory) {
  // A process-wide mutex is not enough: separate Codex chats can share a project.
  // flock serializes read/modify/write operations across every adapter process.
  return await new Promise((accept, reject) => {
    const env = {
      HOME:homedir(), PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',
      LANG:'C.UTF-8', CLAUDE_FLOW_DISABLE_BRIDGE:'1', RUFLO_REQUIRE_REAL_EMBEDDINGS:'1',
      // Avoid oversubscribing CPU threads for a short memory operation.
      OMP_NUM_THREADS:'2', TOKENIZERS_PARALLELISM:'false'
    };
    const child = spawn('/usr/bin/flock', ['--exclusive','--wait','60',join(directory,'.adapter.lock'),process.execPath,join(root,'worker.mjs')], {
      cwd:directory,env,stdio:['pipe','pipe','pipe'],detached:true
    });
    let output = '', diagnostic = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else accept(value);
    };
    const stop = () => { try {process.kill(-child.pid,'SIGKILL');} catch {} };
    const timer = setTimeout(() => {
      stop(); finish(new Error('Ruflo operation timed out. Inspect status before retrying a write; its outcome may be unknown.'));
    }, 115_000);
    child.stdout.on('data', data => {
      output += data.toString();
      if (Buffer.byteLength(output) > 4_000_000) {stop();finish(new Error('Ruflo result too large; request fewer entries'));}
    });
    child.stderr.on('data', data => {diagnostic = (diagnostic+data.toString()).slice(-4000);});
    child.on('error', error => finish(error));
    child.stdin.on('error', error => finish(error));
    child.on('close', code => {
      if (settled) return;
      try {
        const result = JSON.parse(output);
        if (code !== 0 || result.error || result.success === false) {
          finish(new Error(result.error || `Ruflo failed (${code})`));
        } else finish(null,result);
      } catch (e) {
        finish(new Error(`Invalid Ruflo response (${code}): ${diagnostic.slice(-1000) || e.message}`));
      }
    });
    child.stdin.end(JSON.stringify({name,args}));
  });
}

export async function runTool(name, input) {
  const validate = validators.get(name);
  if (!validate) throw new Error(`Unknown tool: ${name}`);
  if (!validate(input)) throw new Error(ajv.errorsText(validate.errors));
  if (Buffer.byteLength(JSON.stringify(input)) > 1_100_000) throw new Error('Tool input too large');
  const {project_path, ...args} = input;
  const project = await projectStore(project_path);
  if (name === 'codex_status') {
    const pkg = JSON.parse(await readFile(join(root,'node_modules/ruflo/package.json'),'utf8'));
    return {
      adapter:'ruflo-codex-local',adapterVersion:'1.0.0',rufloVersion:pkg.version,nodeVersion:process.version,
      project:project.canonical,stateDirectory:project.directory,tools:tools.map(t=>t.name),
      execution:'Task records do not execute work. Use Codex native tools and, when authorized, native subagents.',
      memory:'Upstream sql.js SQLite with real local ONNX embeddings required; hash/mock fallback is rejected.',
      hooks:'Explicit pre-task recall and post-task updates through the Codex skill; no Claude hooks installed.',
      cloudProviders:'Not configured or called by this adapter.',
      scheduling:'Not enabled; use Codex automations only when requested.'
    };
  }
  const result = await worker(name,args,project.directory);
  // Upstream search labels HNSW even when the fallback scans vectors directly.
  // We deliberately disable the AgentDB bridge: report the actual backend.
  if (name.startsWith('memory_')) {
    result.adapterStorage = 'Ruflo sql.js SQLite (local, project-isolated)';
    if (name === 'memory_search') {
      result.upstreamBackendLabel = result.backend;
      result.backend = 'sql.js local vector search (no HNSW speed claim)';
    }
  }
  return result;
}
