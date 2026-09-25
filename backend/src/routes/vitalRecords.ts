import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

/**
 * 家属首页：异常血压待跟进提醒（关闭前一直显示）
 */
router.get('/pending-followups', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, e.name AS elderly_name, cn.title AS order_title, cn.id AS order_id,
              w.real_name AS worker_name
       FROM vital_records vr
       LEFT JOIN elderly_profiles e ON vr.elderly_id = e.id
       LEFT JOIN care_needs cn ON vr.order_id = cn.id
       LEFT JOIN users w ON vr.worker_id = w.id
       WHERE vr.child_id = $1 AND vr.follow_up_status = 'pending'
       ORDER BY vr.measured_at DESC`,
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

/**
 * 家属在老人档案查看健康时间线（按测量时间倒序）
 */
router.get('/by-elderly/:elderlyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profileResult = await pool.query(
      'SELECT child_id FROM elderly_profiles WHERE id = $1',
      [req.params.elderlyId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: '老人档案不存在' });
    }

    if (req.user?.role === 'child' && profileResult.rows[0].child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    const result = await pool.query(
      `SELECT vr.*, w.real_name AS worker_name, fu.real_name AS followed_up_name
       FROM vital_records vr
       LEFT JOIN users w ON vr.worker_id = w.id
       LEFT JOIN users fu ON vr.followed_up_by = fu.id
       WHERE vr.elderly_id = $1
       ORDER BY vr.measured_at DESC`,
      [req.params.elderlyId]
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

/**
 * 家属填写跟进结果并关闭提醒
 */
router.post('/:id/follow-up', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const { follow_up_result } = req.body;

    if (!follow_up_result || !String(follow_up_result).trim()) {
      return res.status(400).json({ message: '请填写跟进结果' });
    }

    const checkResult = await pool.query(
      'SELECT child_id, follow_up_status FROM vital_records WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '测量记录不存在' });
    }

    if (checkResult.rows[0].child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (checkResult.rows[0].follow_up_status !== 'pending') {
      return res.status(400).json({ message: '该提醒已关闭，无需重复跟进' });
    }

    const result = await pool.query(
      `UPDATE vital_records
       SET follow_up_status = 'closed',
           follow_up_result = $1,
           followed_up_by = $2,
           followed_up_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [String(follow_up_result).trim(), req.user?.id, req.params.id]
    );

    res.json({ message: '跟进完成，提醒已关闭', record: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
