/**
 * Visitors Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const router = Router();

const createVisitorSchema = z.object({
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
  sex: z.enum(['male', 'female']),
  date_of_birth: z.string().optional(),
  contact_number: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  status: z.enum(['active', 'blacklisted', 'inactive']).default('active'),
});

function generateVisitorCode(): string {
  return Math.random().toString().substring(2, 12).padStart(10, '0');
}

// GET /api/visitors
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, status, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (search) {
      whereClause += ` AND (
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex} OR 
        visitor_code ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (status && status !== 'all') {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM visitors ${whereClause}`,
      params
    );
    
    const { rows } = await query(
      `SELECT v.*, 
        EXISTS(SELECT 1 FROM biometrics_templates bt WHERE bt.subject_id = v.id) as has_biometrics
       FROM visitors v ${whereClause} 
       ORDER BY v.created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );
    
    res.json({
      items: rows,
      total: parseInt(countResult.rows[0].total),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/visitors/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT v.*, 
        EXISTS(SELECT 1 FROM biometrics_templates bt WHERE bt.subject_id = v.id) as has_biometrics
       FROM visitors v WHERE v.id = $1`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Visitor not found');
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/visitors/code/:code
router.get('/code/:code', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT v.*, 
        EXISTS(SELECT 1 FROM biometrics_templates bt WHERE bt.subject_id = v.id) as has_biometrics
       FROM visitors v WHERE v.visitor_code = $1`,
      [req.params.code]
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Visitor not found');
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/visitors/:id/enrollment-status
router.get('/:id/enrollment-status', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) as count FROM biometrics_templates WHERE subject_id = $1`,
      [req.params.id]
    );
    
    const count = parseInt(rows[0].count);
    res.json({ enrolled: count > 0, samples_count: count });
  } catch (error) {
    next(error);
  }
});

// POST /api/visitors
router.post('/', authenticate, requireRole('super_admin', 'admin', 'staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = createVisitorSchema.parse(req.body);
    const id = uuidv4();
    const visitorCode = generateVisitorCode();
    
    const { rows } = await query(
      `INSERT INTO visitors (id, visitor_code, first_name, middle_name, last_name, suffix, sex, date_of_birth, contact_number, address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, visitorCode, data.first_name, data.middle_name, data.last_name, data.suffix, data.sex, data.date_of_birth, data.contact_number, data.address, data.status]
    );
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'visitor_created', 'visitor', id, JSON.stringify({ visitor_code: visitorCode })]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/visitors/:id
router.put('/:id', authenticate, requireRole('super_admin', 'admin', 'staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = createVisitorSchema.partial().parse(req.body);
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      throw ApiError.badRequest('No updates provided');
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    
    const { rows } = await query(
      `UPDATE visitors SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Visitor not found');
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'visitor_updated', 'visitor', req.params.id, JSON.stringify(data)]
    );
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
