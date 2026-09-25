import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';
import { buildAbnormalReason } from '../utils/vitalSigns';

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
              w.real_name as worker_name, w.phone as worker_phone,
              vr.id as vital_id, vr.systolic, vr.diastolic, vr.heart_rate,
              vr.measured_at as vital_measured_at, vr.is_abnormal, vr.abnormal_reason,
              vr.follow_up_status, vr.follow_up_result, vr.followed_up_at
       FROM care_needs cn
       LEFT JOIN elderly_profiles e ON cn.elderly_id = e.id
       LEFT JOIN users u ON cn.child_id = u.id
       LEFT JOIN users w ON cn.worker_id = w.id
       LEFT JOIN vital_records vr ON vr.order_id = cn.id
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

    if (need.vital_id) {
      need.vital_record = {
        id: need.vital_id,
        systolic: need.systolic,
        diastolic: need.diastolic,
        heart_rate: need.heart_rate,
        measured_at: need.vital_measured_at,
        is_abnormal: need.is_abnormal,
        abnormal_reason: need.abnormal_reason,
        follow_up_status: need.follow_up_status,
        follow_up_result: need.follow_up_result,
        followed_up_at: need.followed_up_at,
      };
    }
    delete need.vital_id;
    delete need.systolic;
    delete need.diastolic;
    delete need.heart_rate;
    delete need.vital_measured_at;
    delete need.is_abnormal;
    delete need.abnormal_reason;
    delete need.follow_up_status;
    delete need.follow_up_result;
    delete need.followed_up_at;

    res.json(need);
  } catch (error) {
    sendServerError(res, error);
  }
});

/**
 * 护工查询订单的血压测量记录（重进订单详情时同步展示）
 */
router.get('/:id/vital-record', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const orderResult = await pool.query(
      'SELECT child_id, worker_id, status FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    const order = orderResult.rows[0];

    if (req.user?.role === 'child' && order.child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    if ((req.user?.role === 'worker' || req.user?.role === 'volunteer')
        && !(order.status === 'pending' || order.worker_id === req.user?.id)) {
      return res.status(403).json({ message: '无权限查看' });
    }

    const result = await pool.query(
      `SELECT vr.*, w.real_name AS worker_name
       FROM vital_records vr
       LEFT JOIN users w ON vr.worker_id = w.id
       WHERE vr.order_id = $1`,
      [req.params.id]
    );

    res.json({ record: result.rows[0] || null });
  } catch (error) {
    sendServerError(res, error);
  }
});

/**
 * 护工完成订单前填写血压、心率和测量时间。
 * 以 order_id 唯一约束 + UPSERT 保证重复提交只留一条；
 * 收缩压 >= 140 或 舒张压 >= 90 自动标记异常并生成待跟进提醒。
 */
router.post('/:id/vital-record', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { systolic, diastolic, heart_rate, measured_at } = req.body;

    const sys = Number(systolic);
    const dia = Number(diastolic);
    const hr = Number(heart_rate);

    if (!Number.isInteger(sys) || sys < 50 || sys > 300) {
      return res.status(400).json({ message: '请输入有效的收缩压（50-300 的整数）' });
    }
    if (!Number.isInteger(dia) || dia < 30 || dia > 200) {
      return res.status(400).json({ message: '请输入有效的舒张压（30-200 的整数）' });
    }
    if (!Number.isInteger(hr) || hr < 30 || hr > 250) {
      return res.status(400).json({ message: '请输入有效的心率（30-250 的整数）' });
    }
    if (dia >= sys) {
      return res.status(400).json({ message: '舒张压应小于收缩压，请核对测量数据' });
    }
    if (!measured_at || Number.isNaN(Date.parse(measured_at))) {
      return res.status(400).json({ message: '请选择测量时间' });
    }

    const orderResult = await client.query(
      'SELECT id, status, worker_id, child_id, elderly_id FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    const order = orderResult.rows[0];

    if (order.worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (order.status !== 'in_progress') {
      return res.status(400).json({ message: '服务进行中才能填写测量记录' });
    }

    const abnormal = sys >= 140 || dia >= 90;
    const abnormalReason = buildAbnormalReason(sys, dia);

    const result = await client.query(
      `INSERT INTO vital_records
         (order_id, child_id, elderly_id, worker_id, systolic, diastolic, heart_rate,
          measured_at, is_abnormal, abnormal_reason, follow_up_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (order_id) DO UPDATE
         SET systolic = EXCLUDED.systolic,
             diastolic = EXCLUDED.diastolic,
             heart_rate = EXCLUDED.heart_rate,
             measured_at = EXCLUDED.measured_at,
             is_abnormal = EXCLUDED.is_abnormal,
             abnormal_reason = EXCLUDED.abnormal_reason,
             follow_up_status = CASE
               WHEN vital_records.follow_up_status = 'closed' THEN vital_records.follow_up_status
               WHEN EXCLUDED.is_abnormal THEN 'pending'
               ELSE 'none'
             END,
             updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        order.id,
        order.child_id,
        order.elderly_id,
        order.worker_id,
        sys,
        dia,
        hr,
        measured_at,
        abnormal,
        abnormalReason,
        abnormal ? 'pending' : 'none',
      ]
    );

    res.status(201).json({
      message: abnormal ? '血压异常，已生成待跟进提醒' : '测量记录已保存',
      record: result.rows[0],
    });
  } catch (error) {
    sendServerError(res, error);
  } finally {
    client.release();
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

router.post('/:id/complete', authenticate, requireRole('worker', 'volunteer'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT status, worker_id, price, care_type FROM care_needs WHERE id = $1',
      [req.params.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '需求不存在' });
    }

    if (checkResult.rows[0].worker_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限操作' });
    }

    if (checkResult.rows[0].status !== 'in_progress') {
      return res.status(400).json({ message: '状态不正确' });
    }

    // 量血压类订单：血压、心率、测量时间未填写完整不能完成
    if (checkResult.rows[0].care_type === 'health_check') {
      const vitalResult = await pool.query(
        'SELECT id FROM vital_records WHERE order_id = $1',
        [req.params.id]
      );
      if (vitalResult.rows.length === 0) {
        return res.status(400).json({ message: '请先填写血压、心率和测量记录，再完成订单' });
      }
    }

    const result = await pool.query(
      'UPDATE care_needs SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['completed', req.params.id]
    );

    await pool.query(
      'UPDATE users SET order_count = order_count + 1, total_income = total_income + $1 WHERE id = $2',
      [checkResult.rows[0].price || 0, req.user?.id]
    );

    res.json({ message: '服务已完成', need: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
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
