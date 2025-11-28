import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type { getRatingSchema } from "@/utils/validation";

// GET /ratings/:player_id - Get player rating
export async function getPlayerRating(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof getRatingSchema>;
    const playerId = parseInt(params.player_id);

    if (isNaN(playerId)) {
      throw new HTTPException(400, { message: "Invalid player ID" });
    }

    const { data: rating, error } = await supabase
      .from("ratings")
      .select("id, player_id, aura_mu, aura_sigma, last_updated")
      .eq("player_id", playerId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      throw new HTTPException(500, { message: error.message });
    }

    if (!rating) {
      return c.json({
        data: {
          player_id: playerId,
          aura_mu: null,
          aura_sigma: null,
          last_updated: null,
        },
      });
    }

    return c.json({ data: rating });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /ratings/:player_id/history - Get player rating history
export async function getPlayerRatingHistory(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof getRatingSchema>;
    const playerId = parseInt(params.player_id);

    if (isNaN(playerId)) {
      throw new HTTPException(400, { message: "Invalid player ID" });
    }

    const { data: history, error } = await supabase
      .from("rating_history")
      .select(
        `
        id,
        match_id,
        old_mu,
        old_sigma,
        new_mu,
        new_sigma,
        created_at,
        matches (
          id,
          tournament_id,
          round,
          tournaments (
            id,
            name
          )
        )
      `
      )
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    const formattedHistory = history?.map((h: any) => {
      const match = Array.isArray(h.matches) ? h.matches[0] : h.matches;
      const tournament = match
        ? Array.isArray(match.tournaments)
          ? match.tournaments[0]
          : match.tournaments
        : null;

      return {
        id: h.id,
        match_id: h.match_id,
        match: match
          ? {
              id: match.id,
              round: match.round,
              tournament: tournament
                ? {
                    id: tournament.id,
                    name: tournament.name,
                  }
                : null,
            }
          : null,
        old_rating: {
          mu: h.old_mu,
          sigma: h.old_sigma,
        },
        new_rating: {
          mu: h.new_mu,
          sigma: h.new_sigma,
        },
        created_at: h.created_at,
      };
    });

    return c.json({ data: { history: formattedHistory || [] } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /ratings/leaderboard - Get leaderboard
export async function getLeaderboard(c: Context<AuthContext>) {
  try {
    const { data: ratings, error } = await supabase
      .from("ratings")
      .select(
        `
        player_id,
        aura_mu,
        aura_sigma,
        last_updated,
        players (
          id,
          username,
          photo_url
        )
      `
      )
      .order("aura_mu", { ascending: false })
      .limit(100);

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    const leaderboard = ratings?.map((r: any) => {
      const player = Array.isArray(r.players) ? r.players[0] : r.players;
      return {
        player_id: r.player_id,
        username: player?.username,
        photo_url: player?.photo_url,
        aura_mu: r.aura_mu,
        aura_sigma: r.aura_sigma,
        last_updated: r.last_updated,
      };
    });

    return c.json({ data: { leaderboard: leaderboard || [] } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

