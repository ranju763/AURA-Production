import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  matchFormatIdSchema,
  createMatchFormatSchema,
  updateMatchFormatSchema,
} from "@/utils/validation";
import {
  getAllMatchFormats,
  getMatchFormatById,
  createMatchFormat,
  updateMatchFormat,
  deleteMatchFormat,
} from "@/controllers/matchFormats.controller";

export const matchFormatsRoutes = new Hono<AuthContext>();

// GET /match-formats - Get all match formats
matchFormatsRoutes.get("/", authMiddleware, getAllMatchFormats);

// GET /match-formats/:id - Get match format by ID
matchFormatsRoutes.get(
  "/:id",
  authMiddleware,
  zValidator("param", matchFormatIdSchema),
  getMatchFormatById
);

// POST /match-formats - Create a new match format
matchFormatsRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createMatchFormatSchema),
  createMatchFormat
);

// PUT /match-formats/:id - Update match format
matchFormatsRoutes.put(
  "/:id",
  authMiddleware,
  zValidator("param", matchFormatIdSchema),
  zValidator("json", updateMatchFormatSchema),
  updateMatchFormat
);

// DELETE /match-formats/:id - Delete match format
matchFormatsRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", matchFormatIdSchema),
  deleteMatchFormat
);

