import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type {
  teamIdSchema,
  createTeamSchema,
  addTeamMemberSchema,
  removeTeamMemberSchema,
} from "@/utils/validation";

// GET /teams - Get all teams
export async function getAllTeams(c: Context<AuthContext>) {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("team_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    // Get team members for each team
    const teamIds = teams?.map((t: any) => t.team_id) || [];
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select(
        `
        team_id,
        player_id,
        players (
          id,
          username,
          photo_url
        )
      `
      )
      .in("team_id", teamIds);

    const teamsWithMembers = teams?.map((team: any) => {
      const members =
        teamMembers?.filter((tm: any) => tm.team_id === team.team_id) || [];
      return {
        ...team,
        members: members.map((m: any) => {
          const player = Array.isArray(m.players) ? m.players[0] : m.players;
          return {
            player_id: m.player_id,
            ...player,
          };
        }),
      };
    });

    return c.json({ data: { teams: teamsWithMembers } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /teams/:id - Get team by ID
export async function getTeamById(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof teamIdSchema>;
    const teamId = parseInt(params.id);

    if (isNaN(teamId)) {
      throw new HTTPException(400, { message: "Invalid team ID" });
    }

    const { data: team, error } = await supabase
      .from("teams")
      .select("team_id, created_at")
      .eq("team_id", teamId)
      .single();

    if (error || !team) {
      throw new HTTPException(404, { message: "Team not found" });
    }

    // Get team members
    const { data: teamMembers, error: membersError } = await supabase
      .from("team_members")
      .select(
        `
        id,
        player_id,
        created_at,
        players (
          id,
          username,
          photo_url,
          gender
        )
      `
      )
      .eq("team_id", teamId);

    if (membersError) {
      throw new HTTPException(500, { message: membersError.message });
    }

    // Get ratings for players
    const playerIds = teamMembers?.map((tm: any) => tm.player_id).filter(Boolean) || [];
    const { data: ratings } = await supabase
      .from("ratings")
      .select("player_id, aura_mu, aura_sigma")
      .in("player_id", playerIds);

    const ratingsMap = new Map(
      ratings?.map((r: any) => [r.player_id, { mu: r.aura_mu, sigma: r.aura_sigma }]) || []
    );

    const members = teamMembers?.map((tm: any) => {
      const player = Array.isArray(tm.players) ? tm.players[0] : tm.players;
      const rating = ratingsMap.get(tm.player_id);
      return {
        id: tm.id,
        player_id: tm.player_id,
        username: player?.username,
        photo_url: player?.photo_url,
        gender: player?.gender,
        rating: rating || null,
        created_at: tm.created_at,
      };
    });

    return c.json({
      data: {
        ...team,
        members: members || [],
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /teams - Create a new team
export async function createTeam(c: Context<AuthContext>) {
  try {
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof createTeamSchema>;

    if (!body.player_ids || body.player_ids.length === 0) {
      throw new HTTPException(400, { message: "At least one player is required" });
    }

    // Verify all players exist
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id")
      .in("id", body.player_ids);

    if (playersError || !players || players.length !== body.player_ids.length) {
      throw new HTTPException(400, { message: "One or more players not found" });
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({})
      .select()
      .single();

    if (teamError || !team) {
      throw new HTTPException(500, { message: "Failed to create team" });
    }

    // Add team members
    const teamMembers = body.player_ids.map((playerId: number) => ({
      team_id: team.team_id,
      player_id: playerId,
      created_at: new Date().toISOString(),
    }));

    const { error: membersError } = await supabase
      .from("team_members")
      .insert(teamMembers);

    if (membersError) {
      // Rollback team creation
      await supabase.from("teams").delete().eq("team_id", team.team_id);
      throw new HTTPException(500, { message: "Failed to add team members" });
    }

    return c.json({ data: team }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /teams/:id/members - Add member to team
export async function addTeamMember(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof teamIdSchema>;
    const teamId = parseInt(params.id);
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof addTeamMemberSchema>;

    if (isNaN(teamId)) {
      throw new HTTPException(400, { message: "Invalid team ID" });
    }

    // Verify team exists
    const { data: team } = await supabase
      .from("teams")
      .select("team_id")
      .eq("team_id", teamId)
      .single();

    if (!team) {
      throw new HTTPException(404, { message: "Team not found" });
    }

    // Verify player exists
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("id", body.player_id)
      .single();

    if (!player) {
      throw new HTTPException(404, { message: "Player not found" });
    }

    // Check if player is already in team
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("player_id", body.player_id)
      .single();

    if (existingMember) {
      throw new HTTPException(409, { message: "Player already in team" });
    }

    // Add member
    const { data: teamMember, error } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        player_id: body.player_id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: teamMember }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /teams/:id/members/:playerId - Remove member from team
export async function removeTeamMember(c: Context<AuthContext>) {
  try {
    const params = (c.req.param() as any);
    const teamId = parseInt(params.id);
    const playerId = parseInt(params.playerId);

    if (isNaN(teamId) || isNaN(playerId)) {
      throw new HTTPException(400, { message: "Invalid team ID or player ID" });
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("player_id", playerId);

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /teams/:id - Delete team
export async function deleteTeam(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof teamIdSchema>;
    const teamId = parseInt(params.id);

    if (isNaN(teamId)) {
      throw new HTTPException(400, { message: "Invalid team ID" });
    }

    // Check if team is used in matches
    const { data: pairings } = await supabase
      .from("pairing_teams")
      .select("id")
      .eq("team_id", teamId)
      .limit(1);

    if (pairings && pairings.length > 0) {
      throw new HTTPException(400, {
        message: "Cannot delete team that is used in matches",
      });
    }

    // Delete team members first
    await supabase.from("team_members").delete().eq("team_id", teamId);

    // Delete team
    const { error } = await supabase.from("teams").delete().eq("team_id", teamId);

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

