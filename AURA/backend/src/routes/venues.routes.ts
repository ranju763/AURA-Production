import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  venueIdSchema,
  createVenueSchema,
  updateVenueSchema,
} from "@/utils/validation";
import {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
} from "@/controllers/venues.controller";

export const venuesRoutes = new Hono<AuthContext>();

// GET /venues - Get all venues
venuesRoutes.get("/", authMiddleware, getAllVenues);

// GET /venues/:id - Get venue by ID
venuesRoutes.get(
  "/:id",
  authMiddleware,
  zValidator("param", venueIdSchema),
  getVenueById
);

// POST /venues - Create a new venue
venuesRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createVenueSchema),
  createVenue
);

// PUT /venues/:id - Update venue
venuesRoutes.put(
  "/:id",
  authMiddleware,
  zValidator("param", venueIdSchema),
  zValidator("json", updateVenueSchema),
  updateVenue
);

// DELETE /venues/:id - Delete venue
venuesRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", venueIdSchema),
  deleteVenue
);

