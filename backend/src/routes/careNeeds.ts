import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { hasMeasurementPayload, parseMeasurement, upsertHealthRecord } from '../utils/health';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, care_type, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `SELECT cn.*, e.name as elderly_name, e.gender as elderly_gender, e.age as elderly_age, u.real_name as child_name, u.phone as child_phone, w.real_name as worker_name FROM care_needs cn LEFT JOIN elderly_profiles e ON cn.elderly_id = e.id LEFT JOIN users u ON cn.child_id = u.id LEFT JOIN users w ON cn.worker_id = w.id`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push(`cn.status = $${params.length + 1}`);
      params.push(status);
    }

    if (care_type) {
      conditions.push(`cn.care_type = $${params.length + 1}`);
      params.push(care_type);
    }

    if (req.user?.role === 'child') {
      conditions.push(`cn.child_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (req.user?.role === 'worker' || req.user?.role === 'volunteer') {
      conditions.push(`(cn.status = 'pending' OR cn.worker_id = $${params.length + 1})`);
      params.push(req.user.id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY cn.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM care_needs cn';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      needs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cn.*, e.name as elderly_name, e.gender as elderly_gender, e.age as elderly_age, 
              e.medical_history, e.medication, e.address as elderly_address,
              e.emergency_contact, e.emergency_phone,
              u.real_name as child_name, u.phone as child_phone,
              w.real_name as worker_name, w.phone as worker_phone
       FROM care_needs cn 
       LEFT JOIN elderly_profiles e ON cn.elderly_id = e.id 
       LEFT JOIN users u ON cn.child_id = u.id 
       LEFT JOIN users w ON cn.worker_id = w.id 
       WHERE cn.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    const need = result.rows[0];

    if (req.user?.role === 'child' && need.child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    if ((req.user?.role === 'worker' || req.user?.role === 'volunteer') && need.status === 'pending' && need.child_id !== req.user?.id) {
    } else if ((req.user?.role === 'worker' || req.user?.role === 'volunteer') && need.worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    // 同步返回该订单的测量记录，护工重进订单详情也能看到
    const recordResult = await pool.query(
      'SELECT * FROM health_records WHERE order_id = $1',
      [req.params.id]
    );

    res.json({ ...need, health_record: recordResult.rows[0] || null });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const { elderly_id, title, description, care_type, start_time, end_time, address, duration_hours, price } = req.body;

    if (!elderly_id || !title || !description || !care_type || !start_time || !address) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    const elderlyCheck = await pool.query(
      'SELECT id FROM elderly_profiles WHERE id = $1 AND child_id = $2',
      [elderly_id, req.user?.id]
    );

    if (elderlyCheck.rows.length === 0) {
      return res.status(404).json({ message: '老人档案不存在或无权限' });
    }

    const result = await pool.query(
      'INSERT INTO care_needs (child_id, elderly_id, title, description, care_type, start_time, end_time, address, duration_hours, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [req.user?.id, elderly_id, title, description, care_type, start_time, end_time, address, duration_hours, price]
    );

    res.status(201).json({ message: '发布成功', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/:id/accept', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (checkResult.rows[0].status !== 'pending') {
      return res.status(400).json({ message: '该需求已被接单' });
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, worker_id = $2, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['accepted', req.user?.id, req.params.id]
    );

    res.json({ message: '接单成功', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/:id/start', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status, worker_id FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (checkResult.rows[0].worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (checkResult.rows[0].status !== 'accepted') {
      return res.status(400).json({ message: '状态不正确' });
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['in_progress', req.params.id]
    );

    res.json({ message: '服务已开始', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.put('/:id/health-record', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { data, error: measureError } = parseMeasurement(req.body);
    if (measureError || !data) {
      return res.status(400).json({ message: measureError });
    }

    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT id, status, worker_id, elderly_id, child_id FROM care_needs WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '需求不存在' });
    }

    const order = checkResult.rows[0];

    if (order.worker_id !== req.user?.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: '无权限操作' });
    }

    if (!['accepted', 'in_progress'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '订单当前状态不可填写测量记录' });
    }

    const record = await upsertHealthRecord(client, order, req.user!.id, data);

    await client.query('COMMIT');

    res.json({ message: '测量记录已保存', record });
  } catch (error) {
    await client.query('ROLLBACK');
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

router.post('/:id/complete', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkResult = await client.query(
      'SELECT id, status, worker_id, price, elderly_id, child_id FROM care_needs WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '需求不存在' });
    }

    const order = checkResult.rows[0];

    if (order.worker_id !== req.user?.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: '无权限操作' });
    }

    if (order.status !== 'in_progress') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '状态不正确' });
    }

    // 完成订单时允许一并提交测量数据（重复提交只保留一条）
    if (hasMeasurementPayload(req.body)) {
      const { data, error: measureError } = parseMeasurement(req.body);
      if (measureError || !data) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: measureError });
      }
      await upsertHealthRecord(client, order, req.user!.id, data);
    }

    // 测量记录没填完，订单不能完成
    const recordResult = await client.query(
      'SELECT * FROM health_records WHERE order_id = $1',
      [req.params.id]
    );

    if (recordResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: '请先填写血压、心率和测量时间，再完成订单' });
    }

    const result = await client.query(
      'UPDATE care_needs SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['completed', req.params.id]
    );

    await client.query(
      'UPDATE users SET order_count = order_count + 1, total_income = total_income + $1 WHERE id = $2',
      [order.price || 0, req.user?.id]
    );

    await client.query('COMMIT');

    res.json({ message: '服务已完成', need: result.rows[0], health_record: recordResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    sendServerError(res, error);
  } finally {
    client.release();
  }
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status, child_id, worker_id FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (req.user?.role === 'child' && checkResult.rows[0].child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if ((req.user?.role === 'worker' || req.user?.role === 'volunteer') && checkResult.rows[0].worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (!['pending', 'accepted'].includes(checkResult.rows[0].status)) {
      return res.status(400).json({ message: '无法取消该订单' });
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', req.params.id]
    );

    res.json({ message: '已取消', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
