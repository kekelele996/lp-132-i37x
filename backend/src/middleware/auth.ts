import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { messages } from '../constants/messages';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    username: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: messages.auth.missingToken });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; role: string; username: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: messages.auth.invalidToken });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: messages.auth.forbidden });
    }
    next();
  };
};
