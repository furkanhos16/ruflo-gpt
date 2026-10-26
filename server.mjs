import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tools, runTool } from './core.mjs';

const server = new Server({name:'ruflo-codex',version:'1.0.0'}, {capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema, async () => ({tools}));
server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    const result = await runTool(request.params.name,request.params.arguments ?? {});
    return {content:[{type:'text',text:JSON.stringify(result)}]};
  } catch(error) {
    return {isError:true,content:[{type:'text',text:JSON.stringify({error:error.message})}]};
  }
});
await server.connect(new StdioServerTransport());
