import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

// 家属首页待跟进提醒（关闭前一直显示）
router.get('/pending', authenticate, requireRole('child', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const conditions = [`ha.status = 'pending'`];
    const params: any[] = [];

    if (req.user?.role === 'child') {
      conditions.push(`ha.child_id = $${params.length + 1}`);
      params.push(req.user.id);
    }

    const result = await pool.query(
      `SELECT ha.*, e.name AS elderly_name,
              hr.systolic_pressure, hr.diastolic_pressure, hr.heart_rate,
              hr.measured_at, hr.abnormal_reason,
              cn.title AS order_title, u.real_name AS worker_name
       FROM health_alerts ha
       JOIN elderly_profiles e ON ha.elderly_id = e.id
       JOIN health_records hr ON ha.record_id = hr.id
       LEFT JOIN care_needs cn ON hr.order_id = cn.id
       LEFT JOIN users u ON hr.worker_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ha.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

// 家属填写跟进结果，保存后提醒关闭
router.post('/:id/follow-up', authenticate, requireRole('child', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const followUpResult = String(req.body?.follow_up_result ?? '').trim();

    if (!followUpResult) {
      return res.status(400).json({ message: '请填写跟进结果' });
    }

    const checkResult = await pool.query(
      'SELECT * FROM health_alerts WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '提醒不存在' });
    }

    const alert = checkResult.rows[0];

    if (req.user?.role === 'child' && alert.child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (alert.status !== 'pending') {
      return res.status(400).json({ message: '该提醒已关闭' });
    }

    const result = await pool.query(
      `UPDATE health_alerts SET status = 'closed', follow_up_result = $1, followed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [followUpResult, req.params.id]
    );

    res.json({ message: '跟进结果已保存，提醒已关闭', alert: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
