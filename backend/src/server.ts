import http from 'http';
import { Server } from 'socket.io';

import { createApp } from './app';
import { env } from './config/env';
import { messages } from './constants/messages';
import { logger } from './utils/logger';
import { registerSocketHandlers } from './socket';
import pool from './config/database';
import { ensureVitalRecordsTable } from './config/ensureSchema';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

registerSocketHandlers(io);

const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info(messages.errors.databaseConnected);

    await ensureVitalRecordsTable();

    server.listen(env.port, () => {
      logger.info(`服务器运行在端口 ${env.port}`);
    });
  } catch (error) {
    logger.error(messages.errors.databaseConnectionFailed, error);
    process.exit(1);
  }
};

startServer();
