#!/usr/bin/env node
import { tools, runTool } from './core.mjs';

const [name, json] = process.argv.slice(2);
if (!name || name === '--help') {
  console.log('ruflo-codex tools | <tool_name> <JSON>\nUse - instead of JSON to read arguments from stdin. Every call requires project_path.');
} else if (name === 'tools') {
  console.log(JSON.stringify(tools,null,2));
} else {
  try {
    let body = json;
    if (body === '-') {body='';for await(const chunk of process.stdin) body+=chunk;}
    console.log(JSON.stringify(await runTool(name,JSON.parse(body ?? '{}')),null,2));
  } catch(error) {console.error(JSON.stringify({error:error.message}));process.exitCode=1;}
}
