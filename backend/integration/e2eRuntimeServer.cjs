process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'surplussync-browser-test-secret-with-32-bytes';
process.env.FRONTEND_ORIGIN = 'http://127.0.0.1:5174';

const http = require('node:http');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const getMongoBinaryOptions = require('./mongoBinaryOptions.cjs');
const User = require('../models/User');
const FoodListing = require('../models/FoodListing');

let replicaSet;
let socketServer;
let httpServer;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (socketServer) {
    await new Promise((resolve) => socketServer.close(resolve));
  } else if (httpServer?.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
}

async function start() {
  replicaSet = await MongoMemoryReplSet.create({
    ...getMongoBinaryOptions(),
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.createIndexes(), FoodListing.createIndexes()]);
  await User.create({
    name: 'Browser Test Administrator',
    email: 'admin-browser-test@example.test',
    password: 'Browser-test-password-123!',
    role: 'admin',
    isActive: true,
    isVerified: true,
    verificationStatus: 'not_required',
  });

  const app = require('../app');
  const { createSocketServer } = require('../realtime/socketServer');
  httpServer = http.createServer(app);
  socketServer = createSocketServer(httpServer);
  httpServer.listen(8001, '127.0.0.1', () => {
    console.log('Isolated E2E API ready at http://127.0.0.1:8001');
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  console.error('E2E runtime server failed:', error);
  process.exitCode = 1;
  void shutdown();
});

start().catch((error) => {
  console.error('E2E runtime server failed to start:', error);
  process.exitCode = 1;
  void shutdown();
});
