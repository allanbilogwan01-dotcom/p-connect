/**
 * PDL Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const router = Router();

const createPDLSchema = z.object({
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
  sex: z.enum(['male', 'female']),
  date_of_birth: z.string().optional(),
  housing_cell: z.string().max(50).optional(),
  housing_block: z.string().max(50).optional(),
  status: z.enum(['detained', 'released', 'transferred', 'deceased']).default('detained'),
});

function generatePDLCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PDL${timestamp}${random}`.substring(0, 12);
}

// GET /api/pdl
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
        pdl_code ILIKE $${paramIndex}
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
      `SELECT COUNT(*) as total FROM pdl ${whereClause}`,
      params
    );
    
    const { rows } = await query(
      `SELECT * FROM pdl ${whereClause} 
       ORDER BY created_at DESC 
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

// GET /api/pdl/stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'detained') as detained,
        COUNT(*) FILTER (WHERE status = 'released') as released,
        COUNT(*) FILTER (WHERE status = 'transferred') as transferred,
        COUNT(*) FILTER (WHERE status = 'deceased') as deceased
      FROM pdl
    `);
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/pdl/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM pdl WHERE id = $1', [req.params.id]);
    
    if (rows.length === 0) {
      throw ApiError.notFound('PDL not found');
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/pdl/code/:code
router.get('/code/:code', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM pdl WHERE pdl_code = $1', [req.params.code]);
    
    if (rows.length === 0) {
      throw ApiError.notFound('PDL not found');
    }
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/pdl
router.post('/', authenticate, requireRole('super_admin', 'admin', 'staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = createPDLSchema.parse(req.body);
    const id = uuidv4();
    const pdlCode = generatePDLCode();
    
    const { rows } = await query(
      `INSERT INTO pdl (id, pdl_code, first_name, middle_name, last_name, suffix, sex, date_of_birth, housing_cell, housing_block, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, pdlCode, data.first_name, data.middle_name, data.last_name, data.suffix, data.sex, data.date_of_birth, data.housing_cell, data.housing_block, data.status]
    );
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'pdl_created', 'pdl', id, JSON.stringify({ pdl_code: pdlCode })]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/pdl/:id
router.put('/:id', authenticate, requireRole('super_admin', 'admin', 'staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = createPDLSchema.partial().parse(req.body);
    
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
      `UPDATE pdl SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('PDL not found');
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'pdl_updated', 'pdl', req.params.id, JSON.stringify(data)]
    );
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
