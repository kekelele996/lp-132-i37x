import pool from '../config/database';
import { logger } from '../utils/logger';

/**
 * 确保体征测量记录表存在（幂等）。
 * 对已有数据库卷同样生效，无需重建数据库容器。
 */
export const ensureVitalRecordsTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vital_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL UNIQUE REFERENCES care_needs(id) ON DELETE CASCADE,
      child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      elderly_id UUID NOT NULL REFERENCES elderly_profiles(id) ON DELETE CASCADE,
      worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      systolic INTEGER NOT NULL CHECK (systolic BETWEEN 50 AND 300),
      diastolic INTEGER NOT NULL CHECK (diastolic BETWEEN 30 AND 200),
      heart_rate INTEGER NOT NULL CHECK (heart_rate BETWEEN 30 AND 250),
      measured_at TIMESTAMP NOT NULL,
      is_abnormal BOOLEAN NOT NULL DEFAULT FALSE,
      abnormal_reason VARCHAR(255),
      follow_up_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (follow_up_status IN ('none', 'pending', 'closed')),
      follow_up_result TEXT,
      followed_up_by UUID REFERENCES users(id),
      followed_up_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vital_elderly ON vital_records(elderly_id, measured_at)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vital_child_followup ON vital_records(child_id, follow_up_status)
  `);

  logger.info('体征记录表检查完成');
};
