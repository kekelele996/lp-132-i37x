import { Express } from 'express';

import authRoutes from './auth';
import userRoutes from './users';
import elderlyRoutes from './elderly';
import careNeedsRoutes from './careNeeds';
import reviewRoutes from './reviews';
import messageRoutes from './messages';
import favoriteRoutes from './favorites';
import scheduleRoutes from './schedules';

export const registerRoutes = (app: Express): void => {
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/elderly', elderlyRoutes);
  app.use('/api/care-needs', careNeedsRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/schedules', scheduleRoutes);
};
