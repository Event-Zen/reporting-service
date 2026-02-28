import { Router } from "express";

export const reportsRouter = Router();

reportsRouter.get("/", async (_req, res) => {
  res.json([{ id: "r1", name: "Sales Summary", generatedAt: new Date().toISOString() }]);
});