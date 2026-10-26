// One isolated, OS-locked operation against the pinned upstream implementation.
// Keep dependency diagnostics off the JSON response stream.
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 2_000_000) throw new Error('Input too large');
}
try {
  const { name, args } = JSON.parse(input);
  const module = name.startsWith('memory_')
    ? await import('./node_modules/@claude-flow/cli/dist/src/mcp-tools/memory-tools.js')
    : await import('./node_modules/@claude-flow/cli/dist/src/mcp-tools/task-tools.js');
  let result;
  if (name === 'task_summary') {
    // Upstream registers its summary elsewhere and omits cancelled tasks.
    // Reuse the authoritative task reader and count every canonical status.
    const listing = await module.taskTools.find(t => t.name === 'task_list').handler({limit:Number.MAX_SAFE_INTEGER});
    if (listing.error) throw new Error(listing.error);
    result = {total:listing.total,pending:0,in_progress:0,completed:0,failed:0,cancelled:0,unknown:0};
    for (const task of listing.tasks) {
      if (['pending','in_progress','completed','failed','cancelled'].includes(task.status)) result[task.status]++;
      else result.unknown++;
    }
  } else {
    const tool = (module.memoryTools ?? module.taskTools).find(t => t.name === name);
    if (!tool) throw new Error('Unsupported worker tool');
    result = await tool.handler(args);
  }
  process.stdout.write(JSON.stringify(result) + '\n', () => process.exit(0));
} catch (error) {
  process.stdout.write(JSON.stringify({ error: error.message }) + '\n', () => process.exit(1));
}
