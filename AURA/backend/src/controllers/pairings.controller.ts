import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type { generateRoundSchema } from "@/utils/validation";
import {
  validateTournamentState,
  fetchTournamentData,
  buildTeammateHistory,
  generatePairingsRecursive,
  processAndPersistRound,
} from "@/lib/pairings";

// POST /pairings/generate-round - Generate pairings for the next round
export async function generateRound(c: Context<AuthContext>) {
  try {
    const body = (c.req as any).valid("json") as z.infer<typeof generateRoundSchema>;
    const tournamentId = body.tournamentId;

    if (!tournamentId || isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Valid Tournament ID required" });
    }

    const { nextRound } = await validateTournamentState(tournamentId);
    const players = await fetchTournamentData(tournamentId);

    console.log("Players:", players);

    if (players.length < 4) {
      throw new HTTPException(400, { message: "Not enough players" });
    }

    const history = await buildTeammateHistory(tournamentId);

    // NOTE: `players` is already deterministically sorted by fetchTournamentData,
    // but generatePairingsRecursive will sort it again to be safe.
    const finalPairings = generatePairingsRecursive([...players], history);


    if (!finalPairings) {
      throw new HTTPException(500, {
        message: "CRITICAL: No valid pairing configuration found.",
      });
    }

    const savedMatches = await processAndPersistRound(tournamentId, nextRound, finalPairings);

    return c.json({ success: true, round: nextRound, matches: savedMatches });
  } catch (e: any) {
    if (e instanceof HTTPException) {
      throw e;
    }
    console.error("Round Gen Error:", e);
    throw new HTTPException(500, { message: e.message || "Internal server error" });
  }
}

