import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT fw.*, u.real_name, u.avatar, u.skills, u.introduction, u.rating, u.order_count 
       FROM favorite_workers fw 
       JOIN users u ON fw.worker_id = u.id 
       WHERE fw.child_id = $1 
       ORDER BY fw.created_at DESC`,
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/:workerId', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const workerCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role IN ($2, $3)',
      [req.params.workerId, 'worker', 'volunteer']
    );

    if (workerCheck.rows.length === 0) {
      return res.status(404).json({ message: '护工不存在' });
    }

    try {
      await pool.query(
        'INSERT INTO favorite_workers (child_id, worker_id) VALUES ($1, $2)',
        [req.user?.id, req.params.workerId]
      );
    } catch (e: any) {
      if (e.code === '23505') {
        return res.status(400).json({ message: '已收藏该护工' });
      }
      throw e;
    }

    res.json({ message: '收藏成功' });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.delete('/:workerId', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM favorite_workers WHERE child_id = $1 AND worker_id = $2',
      [req.user?.id, req.params.workerId]
    );

    res.json({ message: '已取消收藏' });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
