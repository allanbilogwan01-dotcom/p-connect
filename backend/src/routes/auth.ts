/**
 * Auth Routes
 */

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  full_name: z.string().min(1).max(100),
  role: z.enum(['admin', 'staff', 'guest']).default('staff'),
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    
    const { rows } = await query(
      'SELECT id, username, password_hash, role, full_name, status FROM users WHERE username = $1',
      [username]
    );
    
    if (rows.length === 0) {
      throw ApiError.unauthorized('Invalid credentials');
    }
    
    const user = rows[0];
    
    if (user.status !== 'active') {
      throw ApiError.unauthorized('Account is not active');
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw ApiError.unauthorized('Invalid credentials');
    }
    
    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Create audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'user_login', 'user', user.id, JSON.stringify({ ip: req.ip })]
    );
    
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user!.id, 'user_logout', 'user', req.user!.id]
    );
    
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/setup-needed
router.get('/setup-needed', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT COUNT(*) as count FROM users');
    res.json({ setupNeeded: parseInt(rows[0].count) === 0 });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if username exists
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE username = $1',
      [data.username]
    );
    
    if (existing.length > 0) {
      throw ApiError.conflict('Username already exists');
    }
    
    const passwordHash = await bcrypt.hash(data.password, 12);
    
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role, full_name, status, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, username, role, full_name, status, created_at`,
      [data.username, passwordHash, data.role, data.full_name, 'active', req.user!.id]
    );
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'user_created', 'user', rows[0].id, JSON.stringify({ role: data.role })]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/users
router.get('/users', authenticate, requireRole('super_admin', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, username, role, full_name, status, created_at, approved_at, last_login
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
