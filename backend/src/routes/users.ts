import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, username, real_name, phone, role, avatar, gender, age, address, skills, introduction, rating, order_count, total_income, created_at FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { real_name, gender, age, address, avatar, skills, introduction } = req.body;

    const result = await pool.query(
      'UPDATE users SET real_name = COALESCE($1, real_name), gender = COALESCE($2, gender), age = COALESCE($3, age), address = COALESCE($4, address), avatar = COALESCE($5, avatar), skills = COALESCE($6, skills), introduction = COALESCE($7, introduction), updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING id, username, real_name, phone, role, avatar, gender, age, address, skills, introduction',
      [real_name, gender, age, address, avatar, skills, introduction, req.user?.id]
    );

    res.json({ message: '更新成功', user: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/workers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await pool.query(
      'SELECT id, real_name, avatar, skills, introduction, rating, order_count, total_income FROM users WHERE role IN ($1, $2) ORDER BY rating DESC LIMIT $3 OFFSET $4',
      ['worker', 'volunteer', Number(limit), offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM users WHERE role IN ($1, $2)',
      ['worker', 'volunteer']
    );

    res.json({
      workers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/workers/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, real_name, avatar, gender, age, address, skills, introduction, rating, order_count, total_income, created_at FROM users WHERE id = $1 AND role IN ($2, $3)',
      [req.params.id, 'worker', 'volunteer']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '护工不存在' });
    }

    const reviewsResult = await pool.query(
      'SELECT r.rating, r.comment, r.created_at, u.real_name as reviewer_name FROM reviews r JOIN users u ON r.reviewer_id = u.id WHERE r.reviewee_id = $1 ORDER BY r.created_at DESC LIMIT 10',
      [req.params.id]
    );

    res.json({
      worker: result.rows[0],
      reviews: reviewsResult.rows
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/income-ranking', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, real_name, avatar, total_income, order_count FROM users WHERE role IN ($1, $2) ORDER BY total_income DESC LIMIT 20',
      ['worker', 'volunteer']
    );

    const myRank = result.rows.findIndex((w: any) => w.id === req.user?.id) + 1;

    res.json({
      ranking: result.rows,
      myRank
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
