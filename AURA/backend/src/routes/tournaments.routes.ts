import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  tournamentQuerySchema,
  tournamentIdSchema,
  tournamentRoundSchema,
  tournamentMatchSchema,
  createTournamentSchema,
  addTournamentRefereeSchema,
  removeTournamentRefereeSchema,
} from "@/utils/validation";
import {
  getAllTournaments,
  getTournamentById,
  getTournamentRound,
  getTournamentRounds,
  getTournamentRoundStatus,
  getCurrentRoundMatches,
  joinAsReferee,
  getMatchDetails,
  getRefereeMatchDetails,
  createTournament,
  getHostedTournaments,
  getRefereeTournaments,
  getRegisteredTournaments,
  addTournamentReferee,
  removeTournamentReferee,
} from "@/controllers/tournaments.controller";
import {
  getTournamentRegistrations,
  registerForTournament,
} from "@/controllers/registrations.controller";
import { createRegistrationSchema } from "@/utils/validation";

export const tournamentsRoutes = new Hono<AuthContext>();

// POST /tournaments - Create a new tournament
tournamentsRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createTournamentSchema),
  createTournament
);

// GET /tournaments/hosted - Get tournaments hosted by current player
tournamentsRoutes.get(
  "/hosted",
  authMiddleware,
  getHostedTournaments
);

// GET /tournaments/referee - Get tournaments where current player is a referee
tournamentsRoutes.get(
  "/referee",
  authMiddleware,
  getRefereeTournaments
);

// GET /tournaments/registered - Get tournaments where current player is registered
tournamentsRoutes.get(
  "/registered",
  authMiddleware,
  getRegisteredTournaments
);

// GET /tournaments - Get all tournaments with filtering
tournamentsRoutes.get(
  "/",
  authMiddleware,
  zValidator("query", tournamentQuerySchema),
  getAllTournaments
);

// GET /tournaments/:id - Get individual tournament details
tournamentsRoutes.get(
  "/:id",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  zValidator("query", tournamentQuerySchema.partial()),
  getTournamentById
);

// GET /tournaments/:id/rounds - Get tournament rounds from metadata
tournamentsRoutes.get(
  "/:id/rounds",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  getTournamentRounds
);

// GET /tournaments/:id/round-status - Get current round status
tournamentsRoutes.get(
  "/:id/round-status",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  getTournamentRoundStatus
);

// GET /tournaments/:id/current-round-matches - Get matches for current round
tournamentsRoutes.get(
  "/:id/current-round-matches",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  getCurrentRoundMatches
);

// GET /tournaments/:id/:round - Get tournament round details
tournamentsRoutes.get(
  "/:id/:round",
  authMiddleware,
  zValidator("param", tournamentRoundSchema),
  getTournamentRound
);

// POST /tournaments/:id/join - Join as referee
tournamentsRoutes.post(
  "/:id/join",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  joinAsReferee
);

// GET /tournaments/:id/:round/:match - Get match details
tournamentsRoutes.get(
  "/:id/:round/:match",
  authMiddleware,
  zValidator("param", tournamentMatchSchema),
  getMatchDetails
);

// GET /tournaments/referee/:id/:round/:match - Get match details for referee
tournamentsRoutes.get(
  "/referee/:id/:round/:match",
  authMiddleware,
  zValidator("param", tournamentMatchSchema),
  getRefereeMatchDetails
);

// GET /tournaments/:id/registrations - Get all registrations for a tournament
tournamentsRoutes.get(
  "/:id/registrations",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  getTournamentRegistrations
);

// POST /tournaments/:id/register - Register for a tournament
tournamentsRoutes.post(
  "/:id/register",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  zValidator("json", createRegistrationSchema.partial()),
  registerForTournament
);

// POST /tournaments/:id/referees - Add a referee to a tournament
tournamentsRoutes.post(
  "/:id/referees",
  authMiddleware,
  zValidator("param", tournamentIdSchema),
  zValidator("json", addTournamentRefereeSchema),
  addTournamentReferee
);

// DELETE /tournaments/:id/referees/:playerId - Remove a referee from a tournament
tournamentsRoutes.delete(
  "/:id/referees/:player_id",
  authMiddleware,
  zValidator("param", removeTournamentRefereeSchema),
  removeTournamentReferee
);
