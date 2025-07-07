import { MCPPackageServer } from './server.js';

async function main(): Promise<void> {
  const server = new MCPPackageServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();
}

// Run the server
main().catch((error) => {
  console.error('Failed to start MCP Package Server:', error);
  process.exit(1);
});