import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "@/middleware/auth";
import { zValidator } from "@/middleware/zodValidator";
import {
  teamIdSchema,
  createTeamSchema,
  addTeamMemberSchema,
} from "@/utils/validation";
import {
  getAllTeams,
  getTeamById,
  createTeam,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
} from "@/controllers/teams.controller";

export const teamsRoutes = new Hono<AuthContext>();

// GET /teams - Get all teams
teamsRoutes.get("/", authMiddleware, getAllTeams);

// GET /teams/:id - Get team by ID
teamsRoutes.get(
  "/:id",
  authMiddleware,
  zValidator("param", teamIdSchema),
  getTeamById
);

// POST /teams - Create a new team
teamsRoutes.post(
  "/",
  authMiddleware,
  zValidator("json", createTeamSchema),
  createTeam
);

// POST /teams/:id/members - Add member to team
teamsRoutes.post(
  "/:id/members",
  authMiddleware,
  zValidator("param", teamIdSchema),
  zValidator("json", addTeamMemberSchema),
  addTeamMember
);

// DELETE /teams/:id/members/:playerId - Remove member from team
teamsRoutes.delete(
  "/:id/members/:playerId",
  authMiddleware,
  removeTeamMember
);

// DELETE /teams/:id - Delete team
teamsRoutes.delete(
  "/:id",
  authMiddleware,
  zValidator("param", teamIdSchema),
  deleteTeam
);

