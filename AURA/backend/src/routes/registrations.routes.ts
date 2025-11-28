import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  tournamentIdSchema,
  registrationIdSchema,
  createRegistrationSchema,
} from "@/utils/validation";
import {
  getMyRegistrations,
  getTournamentRegistrations,
  registerForTournament,
  unregisterFromTournament,
} from "@/controllers/registrations.controller";

export const registrationsRoutes = new Hono<AuthContext>();

// GET /registrations - Get all registrations for current player
registrationsRoutes.get("/", authMiddleware, getMyRegistrations);

// Note: Tournament-specific registration routes are handled in tournaments.routes.ts
// These routes are for general registration management

// DELETE /registrations/:id - Unregister from tournament
registrationsRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", registrationIdSchema),
  unregisterFromTournament
);

