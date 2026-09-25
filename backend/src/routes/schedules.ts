import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/my', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `SELECT ws.*, cn.title as order_title, cn.address as order_address, cn.start_time as order_start_time, cn.status as order_status 
                 FROM worker_schedules ws 
                 LEFT JOIN care_needs cn ON ws.order_id = cn.id 
                 WHERE ws.worker_id = $1`;
    const params: any[] = [req.user?.id];

    if (start_date) {
      query += ` AND ws.date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND ws.date <= $${params.length + 1}`;
      params.push(end_date);
    }

    query += ' ORDER BY ws.date ASC, ws.shift_type ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, shift_type, is_available } = req.body;

    if (!date || !shift_type) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    try {
      const result = await pool.query(
        'INSERT INTO worker_schedules (worker_id, date, shift_type, is_available) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user?.id, date, shift_type, is_available !== false]
      );
      res.status(201).json({ message: '创建成功', schedule: result.rows[0] });
    } catch (e: any) {
      if (e.code === '23505') {
        return res.status(400).json({ message: '该时段已存在排班' });
      }
      throw e;
    }
  } catch (error) {
    sendServerError(res, error);
  }
});

router.put('/:id', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const { is_available } = req.body;

    const checkResult = await pool.query(
      'SELECT * FROM worker_schedules WHERE id = $1 AND worker_id = $2',
      [req.params.id, req.user?.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '排班不存在或无权限' });
    }

    if (checkResult.rows[0].order_id) {
      return res.status(400).json({ message: '该排班已有订单，无法修改' });
    }

    const result = await pool.query(
      'UPDATE worker_schedules SET is_available = $1 WHERE id = $2 RETURNING *',
      [is_available, req.params.id]
    );

    res.json({ message: '更新成功', schedule: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.delete('/:id', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT * FROM worker_schedules WHERE id = $1 AND worker_id = $2',
      [req.params.id, req.user?.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '排班不存在或无权限' });
    }

    if (checkResult.rows[0].order_id) {
      return res.status(400).json({ message: '该排班已有订单，无法删除' });
    }

    await pool.query('DELETE FROM worker_schedules WHERE id = $1', [req.params.id]);

    res.json({ message: '删除成功' });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/income', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;

    let dateFilter = '';
    const params: any[] = [req.user?.id];

    if (month) {
      dateFilter = `AND to_char(cn.completed_at, 'YYYY-MM') = $2`;
      params.push(month);
    }

    const result = await pool.query(
      `SELECT DATE(cn.completed_at) as date, 
              COUNT(*) as order_count, 
              SUM(cn.price) as daily_income
       FROM care_needs cn 
       WHERE cn.worker_id = $1 AND cn.status = 'completed' ${dateFilter}
       GROUP BY DATE(cn.completed_at)
       ORDER BY date DESC`,
      params
    );

    const summaryResult = await pool.query(
      `SELECT COUNT(*) as total_orders, 
              COALESCE(SUM(cn.price), 0) as total_income
       FROM care_needs cn 
       WHERE cn.worker_id = $1 AND cn.status = 'completed' ${dateFilter}`,
      params
    );

    res.json({
      daily_income: result.rows,
      summary: summaryResult.rows[0]
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
