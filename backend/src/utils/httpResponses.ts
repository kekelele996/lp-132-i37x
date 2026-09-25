import { Response } from 'express';
import { logger } from './logger';

export const sendServerError = (res: Response, error: unknown): void => {
  logger.error('服务器错误', error);
  res.status(500).json({ message: '服务器错误' });
};
