/**
 * Biometrics Routes - Proxy to Python FastAPI service
 */

import { Router } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { query } from '../db/pool.js';

const router = Router();
const BIOMETRICS_URL = process.env.BIOMETRICS_URL || 'http://localhost:8000';

async function proxyRequest(endpoint: string, body: any): Promise<any> {
  try {
    const response = await fetch(`${BIOMETRICS_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Biometrics service error: ${error}`);
    }
    
    return await response.json();
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
      throw ApiError.internal('Biometrics service unavailable');
    }
    throw error;
  }
}

// GET /api/biometrics/health
router.get('/health', async (req, res, next) => {
  try {
    const response = await fetch(`${BIOMETRICS_URL}/health`);
    
    if (!response.ok) {
      throw new Error('Biometrics service unhealthy');
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.json({ 
      ok: false, 
      error: error.message || 'Biometrics service unavailable' 
    });
  }
});

// POST /api/biometrics/quality
router.post('/quality', authenticate, async (req, res, next) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      throw ApiError.badRequest('imageBase64 is required');
    }
    
    const result = await proxyRequest('/quality', { imageBase64 });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/biometrics/enroll
router.post('/enroll', authenticate, requireRole('super_admin', 'admin', 'staff'), async (req: AuthRequest, res, next) => {
  try {
    const { visitor_id, samples } = req.body;
    
    if (!visitor_id || !samples || !Array.isArray(samples)) {
      throw ApiError.badRequest('visitor_id and samples[] are required');
    }
    
    if (samples.length < 3) {
      throw ApiError.badRequest('Minimum 3 samples required');
    }
    
    // Check if visitor exists
    const { rows: visitor } = await query(
      'SELECT id FROM visitors WHERE id = $1',
      [visitor_id]
    );
    
    if (visitor.length === 0) {
      throw ApiError.notFound('Visitor not found');
    }
    
    // Proxy to biometrics service
    const result = await proxyRequest('/enroll', {
      subject_type: 'visitor',
      subject_id: visitor_id,
      samples,
    });
    
    if (result.ok) {
      // Audit log
      await query(
        `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user!.id, 'biometrics_enrolled', 'visitor', visitor_id, JSON.stringify({ samples_count: samples.length })]
      );
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/biometrics/verify
router.post('/verify', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { visitor_id, imageBase64 } = req.body;
    
    if (!visitor_id || !imageBase64) {
      throw ApiError.badRequest('visitor_id and imageBase64 are required');
    }
    
    const result = await proxyRequest('/verify', {
      subject_type: 'visitor',
      subject_id: visitor_id,
      imageBase64,
    });
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'biometrics_verified', 'visitor', visitor_id, JSON.stringify({ match: result.match })]
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/biometrics/match
router.post('/match', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageBase64, topK = 5 } = req.body;
    
    if (!imageBase64) {
      throw ApiError.badRequest('imageBase64 is required');
    }
    
    const result = await proxyRequest('/match', {
      subject_type: 'visitor',
      imageBase64,
      top_k: topK,
    });
    
    // Audit log if match found
    if (result.best_match?.decision === 'match') {
      await query(
        `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user!.id, 'biometrics_matched', 'visitor', result.best_match.visitor_id, JSON.stringify({ score: result.best_match.score })]
      );
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/biometrics/liveness
router.post('/liveness', authenticate, async (req, res, next) => {
  try {
    const { frames } = req.body;
    
    if (!frames || !Array.isArray(frames) || frames.length < 5) {
      throw ApiError.badRequest('At least 5 frames are required for liveness check');
    }
    
    const result = await proxyRequest('/liveness', { frames });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/biometrics/:visitorId
router.delete('/:visitorId', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const result = await proxyRequest('/delete', {
      subject_type: 'visitor',
      subject_id: req.params.visitorId,
    });
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user!.id, 'biometrics_deleted', 'visitor', req.params.visitorId]
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/biometrics/enrollment/:visitorId
router.get('/enrollment/:visitorId', authenticate, async (req, res, next) => {
  try {
    const response = await fetch(`${BIOMETRICS_URL}/enrollment/${req.params.visitorId}`);
    
    if (!response.ok) {
      res.json({ enrolled: false });
      return;
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.json({ enrolled: false });
  }
});

export default router;
