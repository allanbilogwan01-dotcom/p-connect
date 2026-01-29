/**
 * Request Logger Middleware
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${logLevel.toUpperCase()}]`, JSON.stringify(logData));
    } else if (res.statusCode >= 400) {
      console.warn(`[WARN]`, JSON.stringify(logData));
    }
  });
  
  next();
}
