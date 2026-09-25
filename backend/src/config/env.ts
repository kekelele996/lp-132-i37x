import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: toNumber(process.env.PORT, 3232),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8232',
  jwtSecret: process.env.JWT_SECRET || 'secret',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: toNumber(process.env.DB_PORT, 5732),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'elderly_care',
  },
};
