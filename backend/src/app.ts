import express from 'express';
import cors from 'cors';

import { messages } from './constants/messages';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { registerRoutes } from './routes';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: messages.health });
  });

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
