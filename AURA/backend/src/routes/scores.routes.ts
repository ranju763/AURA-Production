import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  scoreIdSchema,
  createScoreSchema,
  updateScoreSchema,
  matchIdSchema,
} from "@/utils/validation";
import {
  getAllScores,
  getMatchScores,
  createScore,
  updateScore,
  deleteScore,
} from "@/controllers/scores.controller";

export const scoresRoutes = new Hono<AuthContext>();

// GET /scores - Get all scores
scoresRoutes.get("/", authMiddleware, getAllScores);

// GET /matches/:id/scores - Get all scores for a match
scoresRoutes.get(
  "/matches/:id/scores",
  authMiddleware,
  zValidator("param", matchIdSchema),
  getMatchScores
);

// POST /scores - Create a new score
scoresRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createScoreSchema),
  createScore
);

// PUT /scores/:id - Update score
scoresRoutes.put(
  "/:id",
  authMiddleware,
  zValidator("param", scoreIdSchema),
  zValidator("json", updateScoreSchema),
  updateScore
);

// DELETE /scores/:id - Delete score
scoresRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", scoreIdSchema),
  deleteScore
);

