import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  courtIdSchema,
  createCourtSchema,
  updateCourtSchema,
  venueIdSchema,
} from "@/utils/validation";
import {
  getAllCourts,
  getVenueCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
} from "@/controllers/courts.controller";

export const courtsRoutes = new Hono<AuthContext>();

// GET /courts - Get all courts
courtsRoutes.get("/", authMiddleware, getAllCourts);

// GET /courts/:id - Get court by ID
courtsRoutes.get(
  "/:id",
  authMiddleware,
  zValidator("param", courtIdSchema),
  getCourtById
);

// GET /venues/:id/courts - Get all courts for a venue
courtsRoutes.get(
  "/venues/:id/courts",
  authMiddleware,
  zValidator("param", venueIdSchema),
  getVenueCourts
);

// POST /courts - Create a new court
courtsRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createCourtSchema),
  createCourt
);

// PUT /courts/:id - Update court
courtsRoutes.put(
  "/:id",
  authMiddleware,
  zValidator("param", courtIdSchema),
  zValidator("json", updateCourtSchema),
  updateCourt
);

// DELETE /courts/:id - Delete court
courtsRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", courtIdSchema),
  deleteCourt
);

