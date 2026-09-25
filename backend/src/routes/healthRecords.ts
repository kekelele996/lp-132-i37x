import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

// 老人健康测量时间线（家属在老人档案中查看）
router.get('/elderly/:elderlyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const elderlyResult = await pool.query(
      'SELECT id, child_id, name FROM elderly_profiles WHERE id = $1',
      [req.params.elderlyId]
    );

    if (elderlyResult.rows.length === 0) {
      return res.status(404).json({ message: '老人档案不存在' });
    }

    const elderly = elderlyResult.rows[0];

    if (req.user?.role === 'child' && elderly.child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    const result = await pool.query(
      `SELECT hr.*, cn.title AS order_title, u.real_name AS worker_name,
              ha.id AS alert_id, ha.status AS alert_status,
              ha.follow_up_result, ha.followed_at
       FROM health_records hr
       LEFT JOIN care_needs cn ON hr.order_id = cn.id
       LEFT JOIN users u ON hr.worker_id = u.id
       LEFT JOIN health_alerts ha ON ha.record_id = hr.id
       WHERE hr.elderly_id = $1
       ORDER BY hr.measured_at DESC`,
      [req.params.elderlyId]
    );

    res.json({ elderly_name: elderly.name, records: result.rows });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
