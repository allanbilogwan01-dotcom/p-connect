/**
 * Global Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Error]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    code: err.code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export class ApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code?: string) {
    return new ApiError(message, 400, code);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string) {
    return new ApiError(message, 401, code);
  }

  static forbidden(message: string = 'Forbidden', code?: string) {
    return new ApiError(message, 403, code);
  }

  static notFound(message: string = 'Not found', code?: string) {
    return new ApiError(message, 404, code);
  }

  static conflict(message: string, code?: string) {
    return new ApiError(message, 409, code);
  }

  static internal(message: string = 'Internal server error', code?: string) {
    return new ApiError(message, 500, code);
  }
}
