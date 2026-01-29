/**
 * Audit Routes
 */

import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/audit
router.get('/', authenticate, requireRole('super_admin', 'admin'), async (req, res, next) => {
  try {
    const { 
      action, 
      subject_type, 
      actor_id,
      dateFrom, 
      dateTo, 
      page = '1', 
      limit = '50' 
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (action) {
      whereClause += ` AND al.action_type = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    if (subject_type) {
      whereClause += ` AND al.subject_type = $${paramIndex}`;
      params.push(subject_type);
      paramIndex++;
    }
    
    if (actor_id) {
      whereClause += ` AND al.actor_user_id = $${paramIndex}`;
      params.push(actor_id);
      paramIndex++;
    }
    
    if (dateFrom) {
      whereClause += ` AND al.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereClause += ` AND al.created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params
    );
    
    const { rows } = await query(
      `SELECT al.*,
        json_build_object('id', u.id, 'username', u.username, 'full_name', u.full_name) as actor
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
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

// GET /api/audit/actions
router.get('/actions', authenticate, requireRole('super_admin', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT action_type FROM audit_logs ORDER BY action_type`
    );
    
    res.json(rows.map(r => r.action_type));
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/stats
router.get('/stats', authenticate, requireRole('super_admin', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d,
        COUNT(DISTINCT actor_user_id) as unique_actors
      FROM audit_logs
    `);
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
