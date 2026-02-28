import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err?.statusCode || 500;
  res.status(status).json({
    message: err?.message || "Server Error",
  });
}