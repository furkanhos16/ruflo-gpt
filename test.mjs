import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const base = await mkdtemp(join(tmpdir(),'ruflo-codex-test-'));
const projectA=join(base,'project-a'),projectB=join(base,'project-b');
await mkdir(projectA);await mkdir(projectB);
const clients=[];const results=[];
async function connect() {
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],env:{RUFLO_CODEX_STATE_DIR:join(base,'state')},stderr:'pipe'});
  let errors='';transport.stderr.on('data',d=>{errors+=d;});
  const client=new Client({name:'integration-test',version:'1.0.0'});
  await client.connect(transport);clients.push(client);return client;
}
async function call(client,name,args,project=projectA) {
  const result=await client.callTool({name,arguments:{project_path:project,...args}},undefined,{timeout:125000});
  const data=JSON.parse(result.content[0].text);
  if(result.isError)throw new Error(data.error);
  return data;
}
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name);}
try {
 let c=await connect();
 await check('MCP handshake and 16 validated tools',async()=>assert.equal((await c.listTools()).tools.length,16));
 await check('Pinned Ruflo runtime status',async()=>assert.equal((await call(c,'codex_status',{})).rufloVersion,'3.63.0'));
 await check('Turkish and structured memory store',async()=>{
  const r=await call(c,'memory_store',{key:'turkce',namespace:'qa',value:{text:'Türkçe: ı, İ, ş, ğ, ç, ö, ü',nested:{ok:true}},provenance_type:'tool_result'});
  assert.equal(r.stored,true);
 });
 await c.close();c=await connect();
 await check('Memory survives a fresh MCP process',async()=>{
  const r=await call(c,'memory_retrieve',{key:'turkce',namespace:'qa'});
  assert.equal(r.found,true);assert.equal(r.value.nested.ok,true);assert.match(r.value.text,/ı, İ/);
 });
 await check('Project stores are isolated',async()=>{
  const r=await call(c,'memory_list',{namespace:'qa'},projectB);
  assert.equal((r.entries??r.results??[]).length,0);
 });
 await check('Canonical paths share one store',async()=>{
  const alias=join(base,'alias');await symlink(projectA,alias);
  const a=await call(c,'codex_status',{});const b=await call(c,'codex_status',{},alias);
  assert.equal(a.stateDirectory,b.stateDirectory);
 });
 await check('Real local semantic retrieval',async()=>{
  await call(c,'memory_store',{key:'auth',namespace:'semantic',value:'Use short-lived JWT access tokens and rotating refresh tokens for user authentication.'});
  await call(c,'memory_store',{key:'cooking',namespace:'semantic',value:'Bake sourdough bread in a hot oven with steam.'});
  const r=await call(c,'memory_search',{query:'How should login credentials be renewed securely?',namespace:'semantic',limit:2,threshold:0});
  assert.equal(r.results[0].key,'auth');assert.ok(r.results[0].similarity>r.results[1].similarity);
 });
 let id;
 await check('Task creation and real completion metadata',async()=>{
  const t=await call(c,'task_create',{type:'research',description:'Bağlantı testi'});id=t.taskId;
  await call(c,'task_update',{taskId:id,status:'in_progress',progress:40});
  await call(c,'task_complete',{taskId:id,result:{evidence:'Integration assertion passed'}});
  assert.equal((await call(c,'task_status',{taskId:id})).status,'completed');
 });
 await c.close();c=await connect();
 await check('Tasks survive restart',async()=>assert.equal((await call(c,'task_status',{taskId:id})).status,'completed'));
 await check('Invalid progress and path override are rejected',async()=>{
  await assert.rejects(()=>call(c,'task_update',{taskId:id,progress:101}),/<= 100/);
  await assert.rejects(()=>call(c,'memory_list',{dbPath:'/tmp/escape.db'}),/additional properties/);
  await assert.rejects(()=>call(c,'task_summary',{},'relative-path'),/absolute/);
 });
 await check('Concurrent chats retain every task',async()=>{
  const c2=await connect();
  const writes=await Promise.all(Array.from({length:12},(_,i)=>call(i%2?c:c2,'task_create',{type:'research',description:`concurrent-${i}`})));
  const listed=await call(c,'task_list',{limit:100});
  const ids=new Set(listed.tasks.map(t=>t.taskId));
  for(const t of writes)assert.ok(ids.has(t.taskId));
  assert.equal(ids.size,13);
 });
 await check('Memory upsert and deletion',async()=>{
  await call(c,'memory_store',{key:'turkce',namespace:'qa',value:'güncellendi'});
  assert.equal((await call(c,'memory_retrieve',{key:'turkce',namespace:'qa'})).value,'güncellendi');
  await call(c,'memory_delete',{key:'turkce',namespace:'qa'});
  const list=await call(c,'memory_list',{namespace:'qa'});
  assert.equal((list.entries??list.results??[]).length,0);
 });
 await check('Assignment, cancellation, retry and summary',async()=>{
  const t=await call(c,'task_create',{type:'research',description:'Lifecycle verification'});
  await call(c,'task_assign',{taskId:t.taskId,agentIds:['codex-agent-test']});
  assert.deepEqual((await call(c,'task_status',{taskId:t.taskId})).assignedTo,['codex-agent-test']);
  await call(c,'task_cancel',{taskId:t.taskId,reason:'Test cancellation'});
  assert.equal((await call(c,'task_status',{taskId:t.taskId})).status,'cancelled');
  const retry=await call(c,'task_retry',{taskId:t.taskId});
  assert.equal(retry.taskId,t.taskId);
  assert.ok(retry.newTaskId && retry.newTaskId!==t.taskId);
  assert.equal((await call(c,'task_status',{taskId:retry.newTaskId})).status,'pending');
  const summary=await call(c,'task_summary',{});
  assert.equal(summary.cancelled,1);
  assert.equal(summary.completed,1);
  assert.equal(summary.total,15);
 });
 await check('Memory statistics reflect stored data',async()=>{
  const stats=await call(c,'memory_stats',{});
  assert.ok(stats.totalEntries>=2);
  assert.ok(stats.entriesWithEmbeddings>=2);
 });
 const report={passed:true,checks:results,date:new Date().toISOString(),ruflo:'3.63.0',adapter:'1.0.0'};
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
} finally {
 await Promise.allSettled(clients.map(c=>c.close()));
 await rm(base,{recursive:true,force:true});
}
