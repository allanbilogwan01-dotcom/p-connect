/**
 * Settings Routes
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../db/pool.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Configure multer for logo uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const logosDir = path.join(uploadDir, 'logos');

// Ensure directories exist
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slot = req.params.slot;
    cb(null, `logo${slot}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// GET /api/settings/jail
router.get('/jail', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT key, value FROM app_settings');
    
    const settings: Record<string, any> = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/jail
router.post('/jail', authenticate, requireRole('super_admin', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const updates = req.body;
    
    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      await query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, stringValue]
      );
    }
    
    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action_type, subject_type, subject_id, detail_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'settings_changed', 'settings', 'jail', JSON.stringify({ keys: Object.keys(updates) })]
    );
    
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/settings/jail/logo/:slot
router.post('/jail/logo/:slot', authenticate, requireRole('super_admin', 'admin'), upload.single('logo'), async (req: AuthRequest, res, next) => {
  try {
    const slot = req.params.slot;
    
    if (!['1', '2', '3', '4'].includes(slot)) {
      throw ApiError.badRequest('Invalid logo slot');
    }
    
    if (!req.file) {
      throw ApiError.badRequest('No file uploaded');
    }
    
    const logoPath = `/uploads/logos/${req.file.filename}`;
    
    await query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [`logo${slot}_path`, logoPath]
    );
    
    res.json({ ok: true, path: logoPath });
  } catch (error) {
    next(error);
  }
});

export default router;
