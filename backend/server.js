const http = require('node:http');
const { port } = require('./config/env');
const connectToDatabase = require('./config/db');
const { validateJwtConfiguration } = require('./utils/jwt');
const Notification = require('./models/Notification');
const app = require('./app');
const { startBackgroundJobs } = require('./jobs/backgroundJobs');
const { createSocketServer } = require('./realtime/socketServer');

async function startServer() {
  validateJwtConfiguration();
  await connectToDatabase();
  await Notification.createIndexes();
  startBackgroundJobs();

  const server = http.createServer(app);
  createSocketServer(server);
  server.listen(port, () => {
    const baseUrl = `http://localhost:${port}`;
    console.log(`SurplusSync API: ${baseUrl}`);
    console.log(`Health check: ${baseUrl}/api/health`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
