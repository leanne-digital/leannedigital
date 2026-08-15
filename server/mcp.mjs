import { loadEnv } from '../scripts/load-env.mjs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp-tools.mjs';

loadEnv();

const server = createMcpServer({
    actor: { email: 'mcp', createdBy: 'mcp' },
});
const transport = new StdioServerTransport();
await server.connect(transport);
