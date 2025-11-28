import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type {
  tournamentIdSchema,
  registrationIdSchema,
  createRegistrationSchema,
} from "@/utils/validation";

// GET /registrations - Get all registrations for current player
export async function getMyRegistrations(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");

    const { data: registrations, error } = await supabase
      .from("registrations")
      .select(
        `
        id,
        tournament_id,
        txn_id,
        created_at,
        tournaments (
          id,
          name,
          start_time,
          end_time,
          registration_fee,
          image_url
        )
      `
      )
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { registrations } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id/registrations - Get all registrations for a tournament
export async function getTournamentRegistrations(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Verify tournament exists
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, host_id")
      .eq("id", tournamentId)
      .single();

    if (!tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    const playerId = c.get("playerId");
    // Only host can view registrations
    if (tournament.host_id !== playerId) {
      throw new HTTPException(403, { message: "Not authorized to view registrations" });
    }

    const { data: registrations, error } = await supabase
      .from("registrations")
      .select(
        `
        id,
        player_id,
        txn_id,
        created_at,
        players (
          id,
          username,
          photo_url
        )
      `
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    return c.json({ data: { registrations } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /tournaments/:id/register - Register for a tournament
export async function registerForTournament(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);
    const body = ((c.req as any).valid("json") as any) as Partial<z.infer<typeof createRegistrationSchema>>;

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Get tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, capacity, registration_fee, host_id")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    // Check if already registered
    const { data: existingRegistration } = await supabase
      .from("registrations")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .single();

    if (existingRegistration) {
      throw new HTTPException(409, { message: "Already registered for this tournament" });
    }

    // Check capacity
    const { count } = await supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    if (count !== null && count >= tournament.capacity) {
      throw new HTTPException(400, { message: "Tournament is full" });
    }

    // No payment processing - txn_id is always null for now
    // Create registration without transaction
    const { data: registration, error: registrationError } = await supabase
      .from("registrations")
      .insert({
        tournament_id: tournamentId,
        player_id: playerId,
        txn_id: null,
      })
      .select()
      .single();

    if (registrationError) {
      throw new HTTPException(500, { message: registrationError.message });
    }

    return c.json({ data: registration }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /registrations/:id - Unregister from tournament
export async function unregisterFromTournament(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof registrationIdSchema>;
    const registrationId = parseInt(params.id);

    if (isNaN(registrationId)) {
      throw new HTTPException(400, { message: "Invalid registration ID" });
    }

    // Verify registration belongs to player
    const { data: registration } = await supabase
      .from("registrations")
      .select("id, player_id")
      .eq("id", registrationId)
      .single();

    if (!registration) {
      throw new HTTPException(404, { message: "Registration not found" });
    }

    if (registration.player_id !== playerId) {
      throw new HTTPException(403, { message: "Not authorized to delete this registration" });
    }

    const { error } = await supabase
      .from("registrations")
      .delete()
      .eq("id", registrationId);

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

