/**
 * PDL-Visitor Links Routes (Kin Dalaw)
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const router = Router();

const createLinkSchema = z.object({
  pdl_id: z.string().uuid(),
  visitor_id: z.string().uuid(),
  relationship: z.enum([
    'spouse', 'wife', 'husband', 'live_in_partner', 'common_law_partner',
    'parent', 'child', 'sibling', 'grandparent', 'grandchild',
    'aunt_uncle', 'cousin', 'niece_nephew', 'legal_guardian', 'close_friend', 'other'
  ]),
  category: z.enum(['immediate_family', 'legal_guardian', 'close_friend']),
});

// GET /api/links/pdl/:pdlId
router.get('/pdl/:pdlId', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT l.*, 
        json_build_object('id', v.id, 'visitor_code', v.visitor_code, 'first_name', v.first_name, 'last_name', v.last_name) as visitor
       FROM pdl_visitor_links l
       LEFT JOIN visitors v ON l.visitor_id = v.id
       WHERE l.pdl_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.pdlId]
    );
    
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/links/visitor/:visitorId
router.get('/visitor/:visitorId', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT l.*, 
        json_build_object('id', p.id, 'pdl_code', p.pdl_code, 'first_name', p.first_name, 'last_name', p.last_name) as pdl
       FROM pdl_visitor_links l
       LEFT JOIN pdl p ON l.pdl_id = p.id
       WHERE l.visitor_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.visitorId]
    );
    
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/links/pending
router.get('/pending', authenticate, requireRole('super_admin', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT l.*, 
        json_build_object('id', p.id, 'pdl_code', p.pdl_code, 'first_name', p.first_name, 'last_name', p.last_name) as pdl,
        json_build_object('id', v.id, 'visitor_code', v.visitor_code, 'first_name', v.first_name, 'last_name', v.last_name) as visitor
       FROM pdl_visitor_links l
       LEFT JOIN pdl p ON l.pdl_id = p.id
       LEFT JOIN visitors v ON l.visitor_id = v.id
       WHERE l.approval_status = 'pending'
       ORDER BY l.created_at ASC`
    );
    
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/links
router.post('/', authenticate, requireRole('super_admin', 'admin', 'staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = createLinkSchema.parse(req.body);
    const id = uuidv4();
    
    // Check if link already exists
    const { rows: existing } = await query(
      'SELECT id FROM pdl_visitor_links WHERE pdl_id = $1 AND visitor_id = $2',
      [data.pdl_id, data.visitor_id]
    );
    
    if (existing.length > 0) {
      throw ApiError.conflict('Link already exists between this PDL and visitor');
    }
    
    const { rows } = await query(
      `INSERT INTO pdl_visitor_links (id, pdl_id, visitor_id, relationship, category, approval_status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [id, data.pdl_id, data.visitor_id, data.relationship, data.category]
    );
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'link_created', 'pdl_visitor_link', id, JSON.stringify(data)]
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/links/:id/approve
router.post('/:id/approve', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE pdl_visitor_links 
       SET approval_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user!.id, req.params.id]
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Link not found');
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user!.id, 'link_approved', 'pdl_visitor_link', req.params.id]
    );
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/links/:id/reject
router.post('/:id/reject', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    
    const { rows } = await query(
      `UPDATE pdl_visitor_links 
       SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason, req.params.id]
    );
    
    if (rows.length === 0) {
      throw ApiError.notFound('Link not found');
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'link_rejected', 'pdl_visitor_link', req.params.id, JSON.stringify({ reason })]
    );
    
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
