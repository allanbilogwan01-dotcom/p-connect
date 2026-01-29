/**
 * Visits Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const router = Router();

const checkInSchema = z.object({
  visitor_id: z.string().uuid(),
  pdl_id: z.string().uuid(),
  link_id: z.string().uuid().optional(),
  visit_type: z.enum(['regular', 'conjugal', 'legal']).default('regular'),
  verification_method: z.enum(['qr', 'manual', 'face']),
  notes: z.string().optional(),
});

// GET /api/visits
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { dateFrom, dateTo, search, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (dateFrom) {
      whereClause += ` AND vs.check_in_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereClause += ` AND vs.check_in_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }
    
    if (search) {
      whereClause += ` AND (
        v.first_name ILIKE $${paramIndex} OR 
        v.last_name ILIKE $${paramIndex} OR 
        p.first_name ILIKE $${paramIndex} OR 
        p.last_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const countResult = await query(
      `SELECT COUNT(*) as total 
       FROM visitation_sessions vs
       LEFT JOIN visitors v ON vs.visitor_id = v.id
       LEFT JOIN pdl p ON vs.pdl_id = p.id
       ${whereClause}`,
      params
    );
    
    const { rows } = await query(
      `SELECT vs.*,
        json_build_object('id', v.id, 'visitor_code', v.visitor_code, 'first_name', v.first_name, 'last_name', v.last_name) as visitor,
        json_build_object('id', p.id, 'pdl_code', p.pdl_code, 'first_name', p.first_name, 'last_name', p.last_name) as pdl
       FROM visitation_sessions vs
       LEFT JOIN visitors v ON vs.visitor_id = v.id
       LEFT JOIN pdl p ON vs.pdl_id = p.id
       ${whereClause}
       ORDER BY vs.check_in_at DESC
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

// GET /api/visits/active
router.get('/active', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT vs.*,
        json_build_object('id', v.id, 'visitor_code', v.visitor_code, 'first_name', v.first_name, 'last_name', v.last_name) as visitor,
        json_build_object('id', p.id, 'pdl_code', p.pdl_code, 'first_name', p.first_name, 'last_name', p.last_name) as pdl
       FROM visitation_sessions vs
       LEFT JOIN visitors v ON vs.visitor_id = v.id
       LEFT JOIN pdl p ON vs.pdl_id = p.id
       WHERE vs.check_out_at IS NULL
       ORDER BY vs.check_in_at DESC`
    );
    
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/visits/today
router.get('/today', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT vs.*,
        json_build_object('id', v.id, 'visitor_code', v.visitor_code, 'first_name', v.first_name, 'last_name', v.last_name) as visitor,
        json_build_object('id', p.id, 'pdl_code', p.pdl_code, 'first_name', p.first_name, 'last_name', p.last_name) as pdl
       FROM visitation_sessions vs
       LEFT JOIN visitors v ON vs.visitor_id = v.id
       LEFT JOIN pdl p ON vs.pdl_id = p.id
       WHERE DATE(vs.check_in_at) = CURRENT_DATE
       ORDER BY vs.check_in_at DESC`
    );
    
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/visits/check-in
router.post('/check-in', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = checkInSchema.parse(req.body);
    const id = uuidv4();
    
    // Check if visitor already has an active session
    const { rows: activeSession } = await query(
      `SELECT id FROM visitation_sessions 
       WHERE visitor_id = $1 AND check_out_at IS NULL`,
      [data.visitor_id]
    );
    
    if (activeSession.length > 0) {
      throw ApiError.conflict('Visitor already has an active session');
    }
    
    const { rows } = await query(
      `INSERT INTO visitation_sessions 
       (id, visitor_id, pdl_id, link_id, visit_type, check_in_at, check_in_method, check_in_result, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'pass', $7, $8)
       RETURNING *`,
      [id, data.visitor_id, data.pdl_id, data.link_id, data.visit_type, data.verification_method, data.notes, req.user!.id]
    );
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'visit_check_in', 'visitation_session', id, JSON.stringify({ visit_type: data.visit_type })]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/visits/:id/check-out
router.post('/:id/check-out', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { method = 'manual' } = req.body;
    
    const { rows } = await query(
      `UPDATE visitation_sessions 
       SET check_out_at = NOW(), check_out_method = $1, check_out_result = 'pass'
       WHERE id = $2 AND check_out_at IS NULL
       RETURNING *`,
      [method, req.params.id]
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Active session not found');
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user!.id, 'visit_check_out', 'visitation_session', req.params.id]
    );
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/visits/check-out-by-visitor/:visitorId
router.post('/check-out-by-visitor/:visitorId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { method = 'manual' } = req.body;
    
    const { rows } = await query(
      `UPDATE visitation_sessions 
       SET check_out_at = NOW(), check_out_method = $1, check_out_result = 'pass'
       WHERE visitor_id = $2 AND check_out_at IS NULL
       RETURNING *`,
      [method, req.params.visitorId]
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Active session not found for this visitor');
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user!.id, 'visit_check_out', 'visitation_session', rows[0].id]
    );
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
