import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  playerIdSchema,
  createPlayerSchema,
  updatePlayerSchema,
} from "@/utils/validation";
import {
  getAllPlayers,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
  searchPlayers,
} from "@/controllers/players.controller";

export const playersRoutes = new Hono<AuthContext>();

// GET /players - Get all players
playersRoutes.get("/", authMiddleware, getAllPlayers);

// GET /players/search?q=query - Search players by username
playersRoutes.get("/search", authMiddleware, searchPlayers);

// GET /players/:id - Get player by ID
playersRoutes.get(
  "/:id",
  authMiddleware,
  zValidator("param", playerIdSchema),
  getPlayerById
);

// POST /players - Create a new player
playersRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createPlayerSchema),
  createPlayer
);

// PUT /players/:id - Update player
playersRoutes.put(
  "/:id",
  authMiddleware,
  zValidator("param", playerIdSchema),
  zValidator("json", updatePlayerSchema),
  updatePlayer
);

// DELETE /players/:id - Delete player
playersRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", playerIdSchema),
  deletePlayer
);

