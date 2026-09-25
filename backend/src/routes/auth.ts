import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { sendServerError } from '../utils/httpResponses';
import { env } from '../config/env';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, real_name, phone, role, gender, age, address, skills, introduction } = req.body;

    if (!username || !password || !real_name || !phone || !role) {
      return res.status(400).json({ message: '请填写必要信息' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1 OR phone = $2', [username, phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: '用户名或手机号已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password, real_name, phone, role, gender, age, address, skills, introduction) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, username, real_name, phone, role',
      [username, hashedPassword, real_name, phone, role, gender, age, address, skills, introduction]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, role: result.rows[0].role, username: result.rows[0].username },
      env.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: result.rows[0]
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      env.jwtSecret,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: '登录成功',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    sendServerError(res, error);
  }
});

export default router;
