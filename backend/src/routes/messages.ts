import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await pool.query(
      `SELECT m.*, 
              sender.real_name as sender_name, 
              sender.avatar as sender_avatar,
              receiver.real_name as receiver_name,
              receiver.avatar as receiver_avatar
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id 
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY m.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user?.id, Number(limit), offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE sender_id = $1 OR receiver_id = $1',
      [req.user?.id]
    );

    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END)
              m.*,
              CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
              other.real_name as other_user_name,
              other.avatar as other_user_avatar,
              (SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND sender_id = other_user_id AND is_read = false) as unread_count
       FROM messages m
       JOIN users other ON other.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY other_user_id, m.created_at DESC`,
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/conversation/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await pool.query(
      `SELECT m.*, 
              sender.real_name as sender_name, 
              sender.avatar as sender_avatar
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC 
       LIMIT $3 OFFSET $4`,
      [req.user?.id, req.params.userId, Number(limit), offset]
    );

    await pool.query(
      'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
      [req.params.userId, req.user?.id]
    );

    res.json({
      messages: result.rows.reverse(),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { receiver_id, content } = req.body;

    if (!receiver_id || !content) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [receiver_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: '接收用户不存在' });
    }

    const result = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
      [req.user?.id, receiver_id, content]
    );

    res.status(201).json({ message: '发送成功', data: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as unread_count FROM messages WHERE receiver_id = $1 AND is_read = false',
      [req.user?.id]
    );

    res.json({ unread_count: parseInt(result.rows[0].unread_count) });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/mark-read/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND receiver_id = $2',
      [req.params.id, req.user?.id]
    );

    res.json({ message: '已标记为已读' });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
