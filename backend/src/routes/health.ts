/**
 * Health Check Routes
 */

import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();
const BIOMETRICS_URL = process.env.BIOMETRICS_URL || 'http://localhost:8000';

// GET /api/health
router.get('/', async (req, res) => {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
  };
  
  // Database check
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    health.checks.database = {
      status: 'healthy',
      latency: `${Date.now() - start}ms`,
    };
  } catch (error: any) {
    health.status = 'degraded';
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }
  
  // Biometrics service check
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${BIOMETRICS_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      health.checks.biometrics = {
        status: 'healthy',
        latency: `${Date.now() - start}ms`,
        version: data.version,
        models_loaded: data.models_loaded,
      };
    } else {
      health.status = 'degraded';
      health.checks.biometrics = {
        status: 'unhealthy',
        error: 'Service returned non-OK status',
      };
    }
  } catch (error: any) {
    health.status = 'degraded';
    health.checks.biometrics = {
      status: 'unhealthy',
      error: error.name === 'AbortError' ? 'Timeout' : 'Connection refused',
    };
  }
  
  // Memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };
  
  // Uptime
  health.uptime = `${Math.round(process.uptime())}s`;
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// GET /api/health/ready
router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

// GET /api/health/live
router.get('/live', (req, res) => {
  res.json({ alive: true });
});

export default router;
