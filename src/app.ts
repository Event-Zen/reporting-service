import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { healthRouter } from "./api/routes/health.routes";
import { errorHandler } from "./api/middlewares/errorHandler";
import { reportsRouter } from "./api/routes/reports.routes";


export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp());

  app.use("/health", healthRouter);
app.use("/api/events", reportsRouter);

  app.use(errorHandler);

  return app;
}