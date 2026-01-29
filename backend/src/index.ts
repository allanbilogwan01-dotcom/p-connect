/**
 * WatchGuard Backend Server
 * 
 * Production-grade Express server for LAN deployment.
 * PostgreSQL SSOT + Biometrics Service Proxy
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import pdlRoutes from './routes/pdl.js';
import visitorsRoutes from './routes/visitors.js';
import linksRoutes from './routes/links.js';
import visitsRoutes from './routes/visits.js';
import biometricsRoutes from './routes/biometrics.js';
import auditRoutes from './routes/audit.js';
import healthRoutes from './routes/health.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Static files for uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pdl', pdlRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/health', healthRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗              ║
║   ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║              ║
║   ██║ █╗ ██║███████║   ██║   ██║     ███████║              ║
║   ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║              ║
║   ╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║              ║
║    ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝              ║
║                    GUARD SERVER                            ║
╠════════════════════════════════════════════════════════════╣
║  Server running at http://${HOST}:${PORT}
║  Environment: ${process.env.NODE_ENV || 'development'}
║  CORS Origins: ${corsOrigins.join(', ')}
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
