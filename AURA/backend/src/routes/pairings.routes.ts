import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import { generateRoundSchema } from "@/utils/validation";
import { generateRound } from "@/controllers/pairings.controller";

export const pairingsRoutes = new Hono<AuthContext>();

// POST /pairings/generate-round - Generate pairings for the next round
pairingsRoutes.post(
  "/generate-round",
  authMiddleware,
  zValidator("json", generateRoundSchema),
  generateRound
);
