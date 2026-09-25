import { NextFunction, Request, Response } from 'express';
import { messages } from '../constants/messages';
import { logger } from '../utils/logger';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ message: messages.errors.notFound, path: req.path });
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error(messages.errors.internal, err.stack || err.message);
  res.status(500).json({ message: messages.errors.internal });
};
