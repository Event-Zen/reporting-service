import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const statusCodes: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  
  const readyState = mongoose.connection.readyState;
  res.json({ 
    ok: true, 
    service: "reporting-service",
    database: statusCodes[readyState] || "unknown",
    timestamp: new Date().toISOString()
  });
});