import { Router, Response } from 'express';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM elderly_profiles WHERE child_id = $1 ORDER BY created_at DESC',
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, gender, age, phone, id_card, medical_history, medication, allergy_history, address, emergency_contact, emergency_phone, avatar, notes } = req.body;

    if (!name || !gender || !age || !address) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    const result = await pool.query(
      'INSERT INTO elderly_profiles (child_id, name, gender, age, phone, id_card, medical_history, medication, allergy_history, address, emergency_contact, emergency_phone, avatar, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
      [req.user?.id, name, gender, age, phone, id_card, medical_history, medication, allergy_history, address, emergency_contact, emergency_phone, avatar, notes]
    );

    res.status(201).json({ message: '创建成功', profile: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.put('/:id', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, gender, age, phone, id_card, medical_history, medication, allergy_history, address, emergency_contact, emergency_phone, avatar, notes } = req.body;

    const checkResult = await pool.query(
      'SELECT id FROM elderly_profiles WHERE id = $1 AND child_id = $2',
      [req.params.id, req.user?.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '档案不存在或无权限' });
    }

    const result = await pool.query(
      'UPDATE elderly_profiles SET name = COALESCE($1, name), gender = COALESCE($2, gender), age = COALESCE($3, age), phone = COALESCE($4, phone), id_card = COALESCE($5, id_card), medical_history = COALESCE($6, medical_history), medication = COALESCE($7, medication), allergy_history = COALESCE($8, allergy_history), address = COALESCE($9, address), emergency_contact = COALESCE($10, emergency_contact), emergency_phone = COALESCE($11, emergency_phone), avatar = COALESCE($12, avatar), notes = COALESCE($13, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $14 RETURNING *',
      [name, gender, age, phone, id_card, medical_history, medication, allergy_history, address, emergency_contact, emergency_phone, avatar, notes, req.params.id]
    );

    res.json({ message: '更新成功', profile: result.rows[0] });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.delete('/:id', authenticate, requireRole('child'), async (req: AuthRequest, res: Response) => {
  try {
    const checkResult = await pool.query(
      'SELECT id FROM elderly_profiles WHERE id = $1 AND child_id = $2',
      [req.params.id, req.user?.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: '档案不存在或无权限' });
    }

    await pool.query('DELETE FROM elderly_profiles WHERE id = $1', [req.params.id]);

    res.json({ message: '删除成功' });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM elderly_profiles WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '档案不存在' });
    }

    if (req.user?.role === 'child' && result.rows[0].child_id !== req.user?.id) {
      return res.status(403).json({ message: '无权限查看' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
