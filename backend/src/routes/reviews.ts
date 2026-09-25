import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, reviewee_id, rating, comment } = req.body;

    if (!order_id || !reviewee_id || !rating) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    const orderCheck = await pool.query(
      'SELECT * FROM care_needs WHERE id = $1 AND status = $2',
      [order_id, 'completed']
    );

    if (orderCheck.rows.length === 0) {
      return res.status(400).json({ message: '订单不存在或未完成' });
    }

    const order = orderCheck.rows[0];
    if (order.child_id !== req.user?.id && order.worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限评价' });
    }

    const existingReview = await pool.query(
      'SELECT id FROM reviews WHERE order_id = $1 AND reviewer_id = $2',
      [order_id, req.user?.id]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ message: '您已评价过此订单' });
    }

    const result = await pool.query(
      'INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [order_id, req.user?.id, reviewee_id, rating, comment]
    );

    const avgResult = await pool.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE reviewee_id = $1',
      [reviewee_id]
    );

    await pool.query(
      'UPDATE users SET rating = $1 WHERE id = $2',
      [parseFloat(avgResult.rows[0].avg_rating).toFixed(2), reviewee_id]
    );

    res.status(201).json({ message: '评价成功', review: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/order/:orderId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT r.*, u.real_name as reviewer_name FROM reviews r JOIN users u ON r.reviewer_id = u.id WHERE r.order_id = $1',
      [req.params.orderId]
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
