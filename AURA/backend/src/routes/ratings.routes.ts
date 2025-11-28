import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import { getRatingSchema } from "@/utils/validation";
import {
  getPlayerRating,
  getPlayerRatingHistory,
  getLeaderboard,
} from "@/controllers/ratings.controller";

export const ratingsRoutes = new Hono<AuthContext>();

// GET /ratings/leaderboard - Get leaderboard
ratingsRoutes.get("/leaderboard", authMiddleware, getLeaderboard);

// GET /ratings/:player_id - Get player rating
ratingsRoutes.get(
  "/:player_id",
  authMiddleware,
  zValidator("param", getRatingSchema),
  getPlayerRating
);

// GET /ratings/:player_id/history - Get player rating history
ratingsRoutes.get(
  "/:player_id/history",
  authMiddleware,
  zValidator("param", getRatingSchema),
  getPlayerRatingHistory
);

