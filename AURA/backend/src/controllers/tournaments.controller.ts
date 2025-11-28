import { HTTPException } from "hono/http-exception";
import { supabase } from "@/lib/supabase";
import type { Context } from "hono";
import type { AuthContext } from "@/middleware/auth";
import type { z } from "zod";
import type {
  tournamentQuerySchema,
  tournamentIdSchema,
  tournamentRoundSchema,
  tournamentMatchSchema,
  createTournamentSchema,
  addTournamentRefereeSchema,
  removeTournamentRefereeSchema,
} from "@/utils/validation";
import { getTournamentRounds as getSortedRounds, parseRoundsFromMetadata } from "@/utils/rounds";
import { POINTS_TO_WIN, type ScoreMetadata } from "@/lib/scoring";
import { blended_point_prob, match_prob_with_beta_uncertainty } from "@/lib/ratingWinprobLogic";

// GET /tournaments - Get all tournaments with filtering
export async function getAllTournaments(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const queryParams = ((c.req as any).valid("query") as any) as z.infer<typeof tournamentQuerySchema>;
    const maxAge = queryParams.max_age;
    const eligibleGender = queryParams.eligible_gender;

    // Get player info for eligibility calculation
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, dob, gender")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      throw new HTTPException(404, { message: "Player not found" });
    }

    const today = new Date();
    const birthDate = new Date(player.dob);
    const age = today.getFullYear() - birthDate.getFullYear();
    const gender = player.gender?.toLowerCase() || "";

    // Build query for tournaments
    let query = supabase.from("tournaments").select(`
      id,
      name,
      venue:venue (
        id,
        name,
        address
      ),
      image_url,
      start_time,
      end_time,
      registration_fee,
      capacity,
      match_format:match_format (
        id,
        max_age,
        eligible_gender
      ),
      metadata,
      registrations!left (
        player_id
      )
    `);

    // Apply filters if provided
    if (maxAge) {
      query = query.eq("match_format.max_age", maxAge);
    }
    if (eligibleGender) {
      const genderUpper = eligibleGender.toUpperCase();
      if (genderUpper === "MALE") {
        query = query.eq("match_format.eligible_gender", "M");
      } else if (genderUpper === "FEMALE") {
        query = query.eq("match_format.eligible_gender", "W");
      } else {
        query = query.eq("match_format.eligible_gender", genderUpper);
      }
    }

    const { data: tournaments, error: tourError } = await query;

    if (tourError) {
      throw new HTTPException(500, { message: tourError.message });
    }

    // Format tournaments with registration status and eligibility
    const formatted =
      tournaments?.map((t: any) => {
        const matchFormat = Array.isArray(t.match_format)
          ? t.match_format[0]
          : t.match_format;

        const maxAgeLimit = matchFormat?.max_age ?? 100;
        const eligibleGenderValue = matchFormat?.eligible_gender ?? "MW";

        // Eligibility logic
        const isAgeEligible = age <= maxAgeLimit;
        const isGenderEligible =
          eligibleGenderValue === "MW" ||
          (eligibleGenderValue === "M" && gender === "male") ||
          (eligibleGenderValue === "W" && gender === "female");

        const eligible = isAgeEligible && isGenderEligible;

        // Check if this player is registered
        const registrations = Array.isArray(t.registrations)
          ? t.registrations
          : [];
        const registered = registrations.some(
          (r: any) => r.player_id === playerId
        );
        const registered_count = registrations.length;

        // Get venue data (handle both object and array formats)
        const venue = Array.isArray(t.venue) ? t.venue[0] : t.venue;

        return {
          id: t.id,
          name: t.name,
          venue: {
            name: venue?.name || "",
            address: venue?.address || "",
            geocoords: venue?.metadata?.geocoords || null,
          },
          registration_fee: t.registration_fee || 0,
          registered,
          registered_count,
          image_url: t.image_url,
          start_date: t.start_time,
          end_date: t.end_time,
          capacity: t.capacity,
          match_format: {
            max_age: matchFormat?.max_age || null,
            eligible_gender: matchFormat?.eligible_gender || "MW",
          },
        };
      }) || [];

    return c.json({ data: { tournaments: formatted } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id - Get individual tournament details
export async function getTournamentById(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const queryParams = ((c.req as any).valid("query") as any) as Partial<z.infer<typeof tournamentQuerySchema>>;
    const tournamentId = parseInt(params.id);
    const mini = queryParams.mini === "true";

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, dob, gender")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      throw new HTTPException(404, { message: "Player not found" });
    }

    const today = new Date();
    const birthDate = new Date(player.dob);
    const age = today.getFullYear() - birthDate.getFullYear();
    const gender = player.gender?.toLowerCase() || "";

    // Fetch tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        `
      id,
      name,
      description,
      image_url,
      start_time,
      end_time,
      capacity,
      registration_fee,
      venue:venue (
        id,
        name,
        address,
        metadata
      ),
      match_format:match_format (
        id,
        max_age,
        eligible_gender
      ),
      host_id,
      metadata
    `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      console.log(tournamentError, tournament);
      throw new HTTPException(404, { message: tournamentError?.message || "Tournament not found" });
    }

    // Mini mode - return minimal data
    if (mini) {
      const matchFormat = Array.isArray(tournament.match_format)
        ? tournament.match_format[0]
        : tournament.match_format;

      return c.json({
        data: {
          id: tournament.id,
          name: tournament.name,
          match_format: {
            max_age: matchFormat?.max_age || null,
            eligible_gender: matchFormat?.eligible_gender || "MW",
          },
        },
      });
    }

    // Full mode - get all details
    // Get host info
    const { data: host } = await supabase
      .from("players")
      .select("id, username, user_id, photo_url")
      .eq("id", tournament.host_id)
      .single();

    // Get registered players with their details
    const { data: registrations } = await supabase
      .from("registrations")
      .select(
        `
        player_id,
        players!inner (
          id,
          username,
          photo_url
        )
      `
      )
      .eq("tournament_id", tournament.id);

    // Check if player is registered
    const registered = registrations?.some((r: any) => {
      const player = Array.isArray(r.players) ? r.players[0] : r.players;
      return player?.id === playerId;
    }) || false;

    // Get total registration count from registrations array length
    const registeredCount = registrations?.length || 0;

    // Get player IDs
    const playerIds =
      registrations
        ?.map((r: any) => {
          const player = Array.isArray(r.players) ? r.players[0] : r.players;
          return player?.id;
        })
        .filter((id: any) => id != null) || [];

    // Get ratings for registered players (only if there are players)
    let ratingsMap = new Map();
    if (playerIds.length > 0) {
      const { data: ratings } = await supabase
        .from("ratings")
        .select("player_id, aura_mu")
        .in("player_id", playerIds);

      ratingsMap = new Map(
        ratings?.map((r: any) => [r.player_id, r.aura_mu]) || []
      );
    }

    // Format registered players
    const registeredPlayers = (registrations || []).map((r: any) => {
      const player = Array.isArray(r.players) ? r.players[0] : r.players;
      return {
        id: player?.id,
        username: player?.username,
        name: player?.username,
        photo_url: player?.photo_url,
        aura: ratingsMap.get(player?.id) || null,
      };
    });

    // Calculate eligibility
    const matchFormat = Array.isArray(tournament.match_format)
      ? tournament.match_format[0]
      : tournament.match_format;

    const eligibleGenderValue = matchFormat?.eligible_gender ?? "MW";
    const isAgeEligible = age <= (matchFormat?.max_age ?? 100);
    const isGenderEligible =
      eligibleGenderValue === "MW" ||
      (eligibleGenderValue === "M" && gender === "male") ||
      (eligibleGenderValue === "W" && gender === "female");
    const eligible = isAgeEligible && isGenderEligible;

    // Fetch referees
    const { data: referees } = await supabase
      .from("tournaments_referee")
      .select(
        `
      player_id,
      players!inner (
        id,
        username,
        user_id,
        photo_url
      )
    `
      )
      .eq("tournament_id", tournament.id);

    // Get referee details
    // Note: Phone would need to be added to players table or fetched via service role client
    const refereeDetails = (referees || []).map((ref: any) => {
      const player = Array.isArray(ref.players) ? ref.players[0] : ref.players;
      return {
        player_id: ref.player_id,
        id: player?.id,
        name: player?.username || null,
        username: player?.username || null,
        photo_url: player?.photo_url || null,
        phone: null, // Phone not available in current schema - would need players.phone column
      };
    });

    // Get venue data
    const venue = Array.isArray(tournament.venue)
      ? tournament.venue[0]
      : tournament.venue;

    return c.json({
      data: {
        id: tournament.id,
        name: tournament.name,
        description: tournament.description || "",
        venue: {
          name: venue?.name || "",
          address: venue?.address || "",
          geocoords: venue?.metadata?.geocoords || null,
        },
        registration_fee: tournament.registration_fee || 0,
        registered,
        registered_count: registeredCount || 0,
        image_url: tournament.image_url,
        start_date: tournament.start_time,
        end_date: tournament.end_time,
        capacity: tournament.capacity,
        match_format: {
          max_age: matchFormat?.max_age || null,
          eligible_gender: matchFormat?.eligible_gender || "MW",
        },
        hosted_by: host
          ? {
              id: host.id,
              name: host.username,
              username: host.username,
              photo_url: host.photo_url,
              phone: null, // Would need to fetch from user metadata
            }
          : null,
        referee: refereeDetails,
        registered_players: registeredPlayers,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id/:round - Get tournament round details
export async function getTournamentRound(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentRoundSchema>;
    const tournamentId = parseInt(params.id);
    const round = params.round;

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Get tournament info with metadata
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        `
      id,
      name,
      match_format:match_format (
        id,
        max_age,
        eligible_gender,
        metadata
      )
    `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    const tournamentMatchFormat = Array.isArray(tournament.match_format)
      ? tournament.match_format[0]
      : tournament.match_format;

    // Validate that the requested round exists in the tournament
    const roundMetadata = tournamentMatchFormat?.metadata || {};
    const validRounds = parseRoundsFromMetadata(roundMetadata);

    if (!validRounds.includes(round)) {
      throw new HTTPException(400, {
        message: `Invalid round "${round}". Valid rounds are: ${validRounds.join(", ")}`,
      });
    }

    // Get all matches for this round (round can be numeric like "1" or string like "SF", "F")
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select(
        `
      id,
      status,
      court_id,
      round,
      winner_team_id,
      start_time,
      end_time,
      courts (
        court_number
      )
    `
      )
      .eq("tournament_id", tournamentId)
      .eq("round", round);

    if (matchesError) {
      throw new HTTPException(500, { message: matchesError.message });
    }

    // Get pairings for these matches
    const matchIds = matches?.map((m: any) => m.id) || [];
    const { data: pairings, error: pairingsError } = await supabase
      .from("pairings")
      .select(
        `
      id,
      match_id,
      tournament_id
    `
      )
      .in("match_id", matchIds);

    if (pairingsError) {
      throw new HTTPException(500, { message: pairingsError.message });
    }

    // Get pairing teams
    const pairingIds = pairings?.map((p: any) => p.id) || [];
    const { data: pairingTeams, error: pairingTeamsError } = await supabase
      .from("pairing_teams")
      .select(
        `
      pairing_id,
      team_id,
      teams (
        team_id
      )
    `
      )
      .in("pairing_id", pairingIds);

    if (pairingTeamsError) {
      throw new HTTPException(500, { message: pairingTeamsError.message });
    }

    // Get team members
    const teamIds = pairingTeams?.map((pt: any) => pt.team_id).filter(Boolean) || [];
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select(
        `
      team_id,
      player_id,
      created_at,
      players (
        id,
        username,
        photo_url
      )
    `
      )
      .in("team_id", teamIds);

    if (teamMembersError) {
      throw new HTTPException(500, { message: teamMembersError.message });
    }

    // Get scores for matches
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
      id,
      match_id,
      team_a_score,
      team_b_score,
      created_at
    `
      )
      .in("match_id", matchIds);

    if (scoresError) {
      throw new HTTPException(500, { message: scoresError.message });
    }

    // Get ratings for players
    const playerIds =
      teamMembers?.map((tm: any) => tm.player_id).filter(Boolean) || [];
    const { data: ratings } = await supabase
      .from("ratings")
      .select("player_id, aura_mu")
      .in("player_id", playerIds);

    const ratingsMap = new Map(
      ratings?.map((r: any) => [r.player_id, r.aura_mu]) || []
    );

    // Build pairings structure
    const pairingsMap = new Map();
    matches?.forEach((match: any) => {
      // Get pairing for this match (typically one pairing per match)
      const matchPairing = pairings?.find((p: any) => p.match_id === match.id);
      
      if (!matchPairing) {
        // No pairing found for this match
        pairingsMap.set(match.id, {
          id: match.id,
          tournament_id: tournamentId,
          status: match.status,
          court: null,
          match_id: match.id,
          players: [],
          scores: {
            teamA: 0,
            teamB: 0,
          },
        });
        return;
      }

      // Get all teams for this pairing (typically 2 teams)
      const pairingTeamIds = pairingTeams
        ?.filter((pt: any) => pt.pairing_id === matchPairing.id)
        .map((pt: any) => pt.team_id) || [];
      
      // Build players array with correct team assignments (A/B)
      const allPlayers = pairingTeamIds.flatMap((teamId: number, teamIndex: number) => {
        return teamMembers
          ?.filter((tm: any) => tm.team_id === teamId)
          .map((tm: any) => {
            const player = Array.isArray(tm.players)
              ? tm.players[0]
              : tm.players;
            return {
              id: player?.id,
              name: player?.username,
              username: player?.username,
              photo_url: player?.photo_url,
              team_id: teamId,
              team: teamIndex === 0 ? "A" : "B",
              aura: ratingsMap.get(player?.id) || null,
              created_at: tm.created_at,
            };
          }) || [];
      }) || [];

      const matchScores =
        scores?.filter((s: any) => s.match_id === match.id) || [];
      const latestScore = matchScores[matchScores.length - 1] || null;

      const court = Array.isArray(match.courts)
        ? match.courts[0]
        : match.courts;

      pairingsMap.set(match.id, {
        id: match.id,
        tournament_id: tournamentId,
        status: match.status,
        court: court?.court_number || null,
        match_id: match.id,
        players: allPlayers,
        scores: {
          teamA: latestScore?.team_a_score || 0,
          teamB: latestScore?.team_b_score || 0,
        },
      });
    });

    // Build leaderboard (sort by wins)
    const playerWins = new Map();
    matches?.forEach((match: any) => {
      if (match.winner_team_id) {
        const winnerPlayers =
          teamMembers?.filter(
            (tm: any) => tm.team_id === match.winner_team_id
          ) || [];
        winnerPlayers.forEach((tm: any) => {
          const currentWins = playerWins.get(tm.player_id) || 0;
          playerWins.set(tm.player_id, currentWins + 1);
        });
      }
    });

    const leaderboard = Array.from(playerWins.entries())
      .map(([playerId, wins]) => {
        const tm = teamMembers?.find((tm: any) => tm.player_id === playerId);
        const player = tm
          ? Array.isArray(tm.players)
            ? tm.players[0]
            : tm.players
          : null;
        return {
          id: player?.id,
          name: player?.username,
          username: player?.username,
          photo_url: player?.photo_url,
          aura: ratingsMap.get(playerId) || null,
          wins: wins,
        };
      })
      .sort((a, b) => b.wins - a.wins);

    return c.json({
      data: {
        id: tournament.id,
        name: tournament.name,
        match_format: {
          max_age: tournamentMatchFormat?.max_age || null,
          eligible_gender: tournamentMatchFormat?.eligible_gender || "MW",
        },
        round: {
          pairings: Array.from(pairingsMap.values()),
          leaderboard,
        },
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id/rounds - Get tournament rounds from metadata
export async function getTournamentRounds(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Get tournament with match_format metadata
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        `
      id,
      match_format:match_format (
        id,
        metadata
      )
    `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    const matchFormat = Array.isArray(tournament.match_format)
      ? tournament.match_format[0]
      : tournament.match_format;

    // Use utility function to parse rounds from metadata
    const metadata = matchFormat?.metadata || {};
    const sortedRounds = parseRoundsFromMetadata(metadata);

    return c.json({
      data: {
        tournament_id: tournamentId,
        rounds: sortedRounds,
        metadata: metadata,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /tournaments/:id/join - Join as referee
export async function joinAsReferee(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Check if user is already a referee for this tournament
    const { data: existingReferee } = await supabase
      .from("tournaments_referee")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .single();

    if (existingReferee) {
      return c.json({ data: { access: true } });
    }

    // Check if user can join as referee (basic validation - can be enhanced)
    // For now, we'll allow any authenticated user to join as referee
    // You can add additional checks here (e.g., referee certification, etc.)

    // Add referee
    const { error: insertError } = await supabase
      .from("tournaments_referee")
      .insert({
        tournament_id: tournamentId,
        player_id: playerId,
      });

    if (insertError) {
      throw new HTTPException(500, { message: insertError.message });
    }

    return c.json({ data: { access: true } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id/:round/:match - Get match details
export async function getMatchDetails(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentMatchSchema>;
    const tournamentId = parseInt(params.id);
    const round = params.round;
    const matchId = parseInt(params.match);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }
    if (isNaN(matchId)) {
      throw new HTTPException(400, { message: "Invalid match ID" });
    }

    // Get tournament info
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        `
      id,
      name,
      match_format:match_format (
        id,
        max_age,
        eligible_gender
      )
    `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    // Get match details
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select(
        `
      id,
      status,
      court_id,
      round,
      winner_team_id,
      start_time,
      end_time,
      courts (
        court_number
      )
    `
      )
      .eq("id", matchId)
      .eq("tournament_id", tournamentId)
      .eq("round", round)
      .single();

    if (matchError || !match) {
      throw new HTTPException(404, { message: "Match not found" });
    }

    // Get pairings
    const { data: pairings, error: pairingsError } = await supabase
      .from("pairings")
      .select("id, match_id, tournament_id")
      .eq("match_id", matchId);

    if (pairingsError) {
      throw new HTTPException(500, { message: pairingsError.message });
    }

    // Get pairing teams
    const pairingIds = pairings?.map((p: any) => p.id) || [];
    const { data: pairingTeams, error: pairingTeamsError } = await supabase
      .from("pairing_teams")
      .select("pairing_id, team_id")
      .in("pairing_id", pairingIds);

    if (pairingTeamsError) {
      throw new HTTPException(500, { message: pairingTeamsError.message });
    }

    // Get team members
    const teamIds = pairingTeams?.map((pt: any) => pt.team_id).filter(Boolean) || [];
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select(
        `
      team_id,
      player_id,
      created_at,
      players (
        id,
        username,
        photo_url
      )
    `
      )
      .in("team_id", teamIds);

    if (teamMembersError) {
      throw new HTTPException(500, { message: teamMembersError.message });
    }

    // Get all scores for this match
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
      id,
      team_a_score,
      team_b_score,
      created_at
    `
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (scoresError) {
      throw new HTTPException(500, { message: scoresError.message });
    }

    // Get latest score with metadata for win probability calculation
    const { data: latestScore } = await supabase
      .from("scores")
      .select("team_a_score, team_b_score, metadata")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get ratings (need both mu and sigma for win probability calculation)
    const playerIds =
      teamMembers?.map((tm: any) => tm.player_id).filter(Boolean) || [];
    const { data: ratings } = await supabase
      .from("ratings")
      .select("player_id, aura_mu, aura_sigma")
      .in("player_id", playerIds);

    const ratingsMap = new Map(
      ratings?.map((r: any) => [r.player_id, r.aura_mu]) || []
    );

    // Calculate win probability if match has started (has scores with metadata)
    let win_prob_A: number | null = null;
    if (latestScore && latestScore.metadata) {
      const metadata = latestScore.metadata as ScoreMetadata;
      const scoreA = latestScore.team_a_score || 0;
      const scoreB = latestScore.team_b_score || 0;

      // Get player IDs from metadata positions
      const tA_ids = [
        Number(metadata.team_a_pos.right_player_id),
        Number(metadata.team_a_pos.left_player_id)
      ];
      const tB_ids = [
        Number(metadata.team_b_pos.right_player_id),
        Number(metadata.team_b_pos.left_player_id)
      ];
      const allIds = [...tA_ids, ...tB_ids];

      // Get rating data for all players
      const { data: ratingData } = await supabase
        .from('ratings')
        .select('player_id, aura_mu, aura_sigma')
        .in('player_id', allIds);

      const getStat = (id: number) => {
        const r = ratingData?.find((x: any) => x.player_id === id);
        return { 
          id, 
          mu: r?.aura_mu ?? 25.0, 
          sigma: r?.aura_sigma ?? 8.33 
        };
      };

      const teamA_stats = tA_ids.map(getStat);
      const teamB_stats = tB_ids.map(getStat);

      const muA = (teamA_stats[0].mu + teamA_stats[1].mu) / 2;
      const sigmaA = Math.sqrt((Math.pow(teamA_stats[0].sigma, 2) + Math.pow(teamA_stats[1].sigma, 2)) / 2);
      const muB = (teamB_stats[0].mu + teamB_stats[1].mu) / 2;
      const sigmaB = Math.sqrt((Math.pow(teamB_stats[0].sigma, 2) + Math.pow(teamB_stats[1].sigma, 2)) / 2);

      const p_blend = blended_point_prob(
        muA, sigmaA, muB, sigmaB,
        scoreA, scoreB, POINTS_TO_WIN
      );

      win_prob_A = match_prob_with_beta_uncertainty(
        p_blend, scoreA, scoreB, POINTS_TO_WIN
      );
    }

    // Build players array with team assignments
    // Get the pairing for this match (typically one pairing per match)
    const matchPairing = pairings?.find((p: any) => p.match_id === matchId);
    
    let allPlayers: any[] = [];
    if (matchPairing) {
      // Get all teams for this pairing (typically 2 teams)
      const pairingTeamIds = pairingTeams
        ?.filter((pt: any) => pt.pairing_id === matchPairing.id)
        .map((pt: any) => pt.team_id) || [];
      
      // Build players array with correct team assignments (A/B)
      allPlayers = pairingTeamIds.flatMap((teamId: number, teamIndex: number) => {
        return teamMembers
          ?.filter((tm: any) => tm.team_id === teamId)
          .map((tm: any) => {
            const player = Array.isArray(tm.players)
              ? tm.players[0]
              : tm.players;
            return {
              id: player?.id,
              name: player?.username,
              username: player?.username,
              photo_url: player?.photo_url,
              team_id: teamId,
              team: teamIndex === 0 ? "A" : "B",
              aura: ratingsMap.get(player?.id) || null,
              created_at: tm.created_at,
            };
          }) || [];
      }) || [];
    }

    // Calculate win rate for team A
    const teamAScore =
      scores && scores.length > 0 ? scores[scores.length - 1].team_a_score : 0;
    const teamBScore =
      scores && scores.length > 0 ? scores[scores.length - 1].team_b_score : 0;
    const totalScore = teamAScore + teamBScore;
    const winRate =
      totalScore > 0
        ? ((teamAScore / totalScore) * 100).toFixed(1) + "%"
        : "0%";

    const court = Array.isArray(match.courts) ? match.courts[0] : match.courts;
    const matchFormat = Array.isArray(tournament.match_format)
      ? tournament.match_format[0]
      : tournament.match_format;

    return c.json({
      data: {
        match_id: match.id,
        tournament_name: tournament.name,
        round: match.round,
        status: match.status,
        winner_team_id: match.winner_team_id,
        court: court?.court_number || null,
        win_rate: winRate,
        win_prob_A: win_prob_A !== null ? Number((win_prob_A * 100).toFixed(1)) : null,
        match_format: {
          max_age: matchFormat?.max_age || null,
          eligible_gender: matchFormat?.eligible_gender || "MW",
        },
        scores:
          scores?.map((s: any) => ({
            id: s.id,
            team_a: s.team_a_score,
            team_b: s.team_b_score,
            created_at: s.created_at,
          })) || [],
        players: allPlayers,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/referee/:id/:round/:match - Get match details for referee
export async function getRefereeMatchDetails(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentMatchSchema>;
    const tournamentId = parseInt(params.id);
    const round = params.round;
    const matchId = parseInt(params.match);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }
    if (isNaN(matchId)) {
      throw new HTTPException(400, { message: "Invalid match ID" });
    }

    // Verify referee access
    const { data: referee } = await supabase
      .from("tournaments_referee")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("player_id", playerId)
      .single();

    if (!referee) {
      throw new HTTPException(403, { message: "Not authorized as referee" });
    }

    // Get tournament info
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        `
      id,
      name,
      match_format:match_format (
        id,
        max_age,
        eligible_gender
      )
    `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    // Get match details
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select(
        `
      id,
      status,
      court_id,
      round,
      winner_team_id,
      courts (
        court_number
      )
    `
      )
      .eq("id", matchId)
      .eq("tournament_id", tournamentId)
      .eq("round", round)
      .single();


    if (matchError || !match) {
      console.error(matchError);
      throw new HTTPException(404, { message: "Match not found" });
    }

    // Get pairings
    const { data: pairings, error: pairingsError } = await supabase
      .from("pairings")
      .select("id, match_id, tournament_id")
      .eq("match_id", matchId);

    if (pairingsError) {
      console.error(pairingsError);
      throw new HTTPException(500, { message: pairingsError.message });
    }

    // Get pairing teams
    const pairingIds = pairings?.map((p: any) => p.id) || [];
    const { data: pairingTeams, error: pairingTeamsError } = await supabase
      .from("pairing_teams")
      .select("pairing_id, team_id")
      .in("pairing_id", pairingIds);

    if (pairingTeamsError) {
      throw new HTTPException(500, { message: pairingTeamsError.message });
    }

    // Get team members
    const teamIds = pairingTeams?.map((pt: any) => pt.team_id).filter(Boolean) || [];
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select(
        `
      team_id,
      player_id,
      created_at,
      players (
        id,
        username,
        photo_url
      )
    `
      )
      .in("team_id", teamIds);

    if (teamMembersError) {
      throw new HTTPException(500, { message: teamMembersError.message });
    }

    // Get latest score with metadata
    const { data: latestScore, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
      id,
      team_a_score,
      team_b_score,
      metadata
    `
      )
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (scoresError && scoresError.code !== "PGRST116") {
      // PGRST116 is "not found" which is okay
      throw new HTTPException(500, { message: scoresError.message });
    }

    // Get ratings
    const playerIds =
      teamMembers?.map((tm: any) => tm.player_id).filter(Boolean) || [];
    const { data: ratings } = await supabase
      .from("ratings")
      .select("player_id, aura_mu")
      .in("player_id", playerIds);

    const ratingsMap = new Map(
      ratings?.map((r: any) => [r.player_id, r.aura_mu]) || []
    );

    // Build players array
    // Get the pairing for this match (typically one pairing per match)
    const matchPairing = pairings?.find((p: any) => p.match_id === matchId);
    
    let allPlayers: any[] = [];
    if (matchPairing) {
      // Get all teams for this pairing (typically 2 teams)
      const pairingTeamIds = pairingTeams
        ?.filter((pt: any) => pt.pairing_id === matchPairing.id)
        .map((pt: any) => pt.team_id) || [];
      
      // Build players array
      allPlayers = pairingTeamIds.flatMap((teamId: number) => {
        return teamMembers
          ?.filter((tm: any) => tm.team_id === teamId)
          .map((tm: any) => {
            const player = Array.isArray(tm.players)
              ? tm.players[0]
              : tm.players;
            return {
              id: player?.id,
              name: player?.username,
              username: player?.username,
              photo_url: player?.photo_url,
              team_id: teamId,
              created_at: tm.created_at,
            };
          }) || [];
      }) || [];
    }

    const court = Array.isArray(match.courts) ? match.courts[0] : match.courts;
    const matchFormat = Array.isArray(tournament.match_format)
      ? tournament.match_format[0]
      : tournament.match_format;

    return c.json({
      data: {
        match_id: match.id,
        tournament_name: tournament.name,
        round: match.round,
        status: match.status,
        winner_team_id: match.winner_team_id,
        court: court?.court_number || null,
        match_format: {
          max_age: matchFormat?.max_age || null,
          eligible_gender: matchFormat?.eligible_gender || "MW",
        },
        scores: {
          teamA: latestScore?.team_a_score || 0,
          teamB: latestScore?.team_b_score || 0,
        },
        metadata: latestScore?.metadata || null,
        players: allPlayers,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /tournaments - Create a new tournament
export async function createTournament(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof createTournamentSchema>;
    console.log(body)

    // Validate that end_time is after start_time
    const startTime = new Date(body.start_time);
    const endTime = new Date(body.end_time);
    if (endTime <= startTime) {
      throw new HTTPException(400, { message: "End time must be after start time" });
    }

    // Verify venue exists
    const { data: venue, error: venueError } = await supabase
      .from("venue")
      .select("id")
      .eq("id", body.venue_id)
      .single();

    if (venueError || !venue) {
      throw new HTTPException(404, { message: "Venue not found" });
    }

    // Auto-generate type based on eligible_gender
    let matchFormatType: string;
    switch (body.match_format.eligible_gender) {
      case "M":
        matchFormatType = "mens_doubles";
        break;
      case "W":
        matchFormatType = "womens_doubles";
        break;
      case "MW":
        matchFormatType = "mixed_doubles";
        break;
      default:
        throw new HTTPException(400, { message: "Invalid eligible_gender" });
    }

    // Create match format first
    const { data: matchFormat, error: matchFormatError } = await supabase
      .from("match_format")
      .insert({
        type: matchFormatType,
        min_age: body.match_format.min_age || null,
        max_age: body.match_format.max_age || null,
        eligible_gender: body.match_format.eligible_gender,
        metadata: body.match_format.metadata || null,
      })
      .select()
      .single();

    if (matchFormatError || !matchFormat) {
      throw new HTTPException(500, { message: matchFormatError?.message || "Failed to create match format" });
    }

    // Create tournament with the newly created match format ID
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .insert({
        host_id: playerId,
        name: body.name,
        description: body.description,
        venue_id: body.venue_id,
        match_format_id: matchFormat.id,
        start_time: body.start_time,
        end_time: body.end_time,
        capacity: body.capacity,
        registration_fee: body.registration_fee || 0,
        image_url: body.image_url || null,
        metadata: body.metadata || null,
      })
      .select()
      .single();

    if (tournamentError) {
      throw new HTTPException(500, { message: tournamentError.message });
    }

    return c.json({ data: { tournament } }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id/current-round-matches - Get matches for current round with referee info
export async function getCurrentRoundMatches(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Verify user is the host
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, host_id")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    if (tournament.host_id !== playerId) {
      throw new HTTPException(403, {
        message: "Only the tournament host can view match management",
      });
    }

    // Get tournament metadata to determine valid rounds
    const { data: tournamentWithMetadata, error: tournamentMetadataError } = await supabase
      .from("tournaments")
      .select(
        `
        id,
        match_format:match_format (
          id,
          metadata
        )
      `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentMetadataError || !tournamentWithMetadata) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    const matchFormat = Array.isArray(tournamentWithMetadata.match_format)
      ? tournamentWithMetadata.match_format[0]
      : tournamentWithMetadata.match_format;

    // Get valid rounds from metadata (sorted)
    const metadata = matchFormat?.metadata || {};
    const validRounds = getSortedRounds(metadata);

    // Get round status to find current round
    const { data: matches } = await supabase
      .from("matches")
      .select("round")
      .eq("tournament_id", tournamentId);

    let currentRound: string | null = null;
    if (matches && matches.length > 0 && validRounds.length > 0) {
      // Get all unique rounds that have matches
      const roundsWithMatches = new Set(
        matches.map((m: any) => String(m.round))
      );

      // Find the current round (last round in validRounds that has matches)
      for (let i = validRounds.length - 1; i >= 0; i--) {
        if (roundsWithMatches.has(validRounds[i])) {
          currentRound = validRounds[i];
          break;
        }
      }
    }

    if (!currentRound) {
      return c.json({
        data: {
          round: null,
          matches: [],
        },
      });
    }

    // Get matches for current round
    const { data: roundMatches, error: matchesError } = await supabase
      .from("matches")
      .select(
        `
        id,
        status,
        court_id,
        round,
        refree_id,
        winner_team_id,
        start_time,
        end_time,
        courts (
          court_number
        )
      `
      )
      .eq("tournament_id", tournamentId)
      .eq("round", currentRound);

    if (matchesError) {
      throw new HTTPException(500, { message: matchesError.message });
    }

    // Get pairings and players for these matches
    const matchIds = roundMatches?.map((m: any) => m.id) || [];
    const { data: pairings } = await supabase
      .from("pairings")
      .select("id, match_id")
      .in("match_id", matchIds);

    const pairingIds = pairings?.map((p: any) => p.id) || [];
    const { data: pairingTeams } = await supabase
      .from("pairing_teams")
      .select("pairing_id, team_id")
      .in("pairing_id", pairingIds);

    const teamIds = pairingTeams?.map((pt: any) => pt.team_id).filter(Boolean) || [];
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select(
        `
        team_id,
        player_id,
        players (
          id,
          username
        )
      `
      )
      .in("team_id", teamIds);

    // Build match details with players
    const matchesWithDetails = roundMatches?.map((match: any) => {
      const matchPairing = pairings?.find((p: any) => p.match_id === match.id);
      const pairingTeamIds = pairingTeams
        ?.filter((pt: any) => pt.pairing_id === matchPairing?.id)
        .map((pt: any) => pt.team_id) || [];

      const players = pairingTeamIds.flatMap((teamId: number) => {
        return teamMembers
          ?.filter((tm: any) => tm.team_id === teamId)
          .map((tm: any) => {
            const player = Array.isArray(tm.players) ? tm.players[0] : tm.players;
            return {
              id: player?.id,
              username: player?.username,
              team_id: teamId,
            };
          }) || [];
      });

      // Get winner players if match is completed
      const winnerPlayers = match.winner_team_id
        ? players.filter((p: any) => p.team_id === match.winner_team_id)
        : [];

      return {
        id: match.id,
        status: match.status,
        court: match.courts?.court_number || null,
        round: match.round,
        referee_id: match.refree_id,
        winner_team_id: match.winner_team_id,
        start_time: match.start_time,
        end_time: match.end_time,
        players,
        winner_players: winnerPlayers,
      };
    }) || [];

    return c.json({
      data: {
        round: currentRound,
        matches: matchesWithDetails,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/:id/round-status - Get current round status
export async function getTournamentRoundStatus(c: Context<AuthContext>) {
  try {
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Get tournament metadata to determine valid rounds
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        `
        id,
        match_format:match_format (
          id,
          metadata
        )
      `
      )
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    const matchFormat = Array.isArray(tournament.match_format)
      ? tournament.match_format[0]
      : tournament.match_format;

    // Get valid rounds from metadata (sorted)
    const metadata = matchFormat?.metadata || {};
    const validRounds = getSortedRounds(metadata);

    // Get all matches for this tournament
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("round, status, winner_team_id")
      .eq("tournament_id", tournamentId);

    if (matchesError) {
      throw new HTTPException(500, { message: matchesError.message });
    }

    let currentRound: string | null = null;
    let nextRound: string | null = null;
    let isCurrentRoundComplete = true;

    if (matches && matches.length > 0 && validRounds.length > 0) {
      // Get all unique rounds that have matches
      const roundsWithMatches = new Set(
        matches.map((m: any) => String(m.round))
      );

      // Find the current round (last round in validRounds that has matches)
      let currentRoundIndex = -1;
      for (let i = validRounds.length - 1; i >= 0; i--) {
        if (roundsWithMatches.has(validRounds[i])) {
          currentRound = validRounds[i];
          currentRoundIndex = i;
          break;
        }
      }

      if (currentRound !== null) {
        // Check if current round is complete
        const currentRoundMatches = matches.filter(
          (m: any) => String(m.round) === currentRound
        );
        const incompleteMatch = currentRoundMatches.find(
          (m: any) => m.status !== "completed" || m.winner_team_id === null
        );

        isCurrentRoundComplete = !incompleteMatch;

        // Determine next round
        if (currentRoundIndex < validRounds.length - 1) {
          nextRound = validRounds[currentRoundIndex + 1];
        }
      }
    }

    // If no matches exist, next round is the first valid round
    if (currentRound === null && validRounds.length > 0) {
      nextRound = validRounds[0];
    }

    return c.json({
      data: {
        currentRound,
        nextRound,
        isCurrentRoundComplete,
        canStartNextRound: (isCurrentRoundComplete || currentRound === null) && nextRound !== null,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/hosted - Get tournaments hosted by current player
export async function getHostedTournaments(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");

    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select(
        `
        id,
        name,
        description,
        image_url,
        start_time,
        end_time,
        capacity,
        registration_fee,
        venue:venue (
          id,
          name,
          address
        ),
        match_format:match_format (
          id,
          max_age,
          eligible_gender
        ),
        registrations (
          id
        )
      `
      )
      .eq("host_id", playerId)
      .order("start_time", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    // Format tournaments with registration count
    const formatted =
      tournaments?.map((t: any) => {
        const venue = Array.isArray(t.venue) ? t.venue[0] : t.venue;
        const matchFormat = Array.isArray(t.match_format)
          ? t.match_format[0]
          : t.match_format;
        const registrations = Array.isArray(t.registrations)
          ? t.registrations
          : [];

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          image_url: t.image_url,
          start_date: t.start_time,
          end_date: t.end_time,
          capacity: t.capacity,
          registration_fee: t.registration_fee || 0,
          registered_count: registrations.length,
          venue: {
            name: venue?.name || "",
            address: venue?.address || "",
          },
          match_format: {
            max_age: matchFormat?.max_age || null,
            eligible_gender: matchFormat?.eligible_gender || "MW",
          },
        };
      }) || [];

    return c.json({ data: { tournaments: formatted } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/referee - Get tournaments where current player is a referee
export async function getRefereeTournaments(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");

    // Get tournament IDs where user is referee
    const { data: refereeTournaments, error: refereeError } = await supabase
      .from("tournaments_referee")
      .select("tournament_id")
      .eq("player_id", playerId);

    if (refereeError) {
      throw new HTTPException(500, { message: refereeError.message });
    }

    const tournamentIds =
      refereeTournaments?.map((r: any) => r.tournament_id) || [];

    if (tournamentIds.length === 0) {
      return c.json({ data: { tournaments: [] } });
    }

    // Get tournament details
    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select(
        `
        id,
        name,
        description,
        image_url,
        start_time,
        end_time,
        capacity,
        registration_fee,
        venue:venue (
          id,
          name,
          address
        ),
        match_format:match_format (
          id,
          max_age,
          eligible_gender
        ),
        registrations (
          id
        )
      `
      )
      .in("id", tournamentIds)
      .order("start_time", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    // Format tournaments with registration count
    const formatted =
      tournaments?.map((t: any) => {
        const venue = Array.isArray(t.venue) ? t.venue[0] : t.venue;
        const matchFormat = Array.isArray(t.match_format)
          ? t.match_format[0]
          : t.match_format;
        const registrations = Array.isArray(t.registrations)
          ? t.registrations
          : [];

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          image_url: t.image_url,
          start_date: t.start_time,
          end_date: t.end_time,
          capacity: t.capacity,
          registration_fee: t.registration_fee || 0,
          registered_count: registrations.length,
          venue: {
            name: venue?.name || "",
            address: venue?.address || "",
          },
          match_format: {
            max_age: matchFormat?.max_age || null,
            eligible_gender: matchFormat?.eligible_gender || "MW",
          },
        };
      }) || [];

    return c.json({ data: { tournaments: formatted } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// GET /tournaments/registered - Get tournaments where current player is registered
export async function getRegisteredTournaments(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");

    // Get tournament IDs where user is registered
    const { data: registrations, error: registrationError } = await supabase
      .from("registrations")
      .select("tournament_id")
      .eq("player_id", playerId);

    if (registrationError) {
      throw new HTTPException(500, { message: registrationError.message });
    }

    const tournamentIds =
      registrations?.map((r: any) => r.tournament_id) || [];

    if (tournamentIds.length === 0) {
      return c.json({ data: { tournaments: [] } });
    }

    // Get tournament details
    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select(
        `
        id,
        name,
        description,
        image_url,
        start_time,
        end_time,
        capacity,
        registration_fee,
        venue:venue (
          id,
          name,
          address
        ),
        match_format:match_format (
          id,
          max_age,
          eligible_gender
        ),
        registrations (
          id
        )
      `
      )
      .in("id", tournamentIds)
      .order("start_time", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    // Format tournaments with registration count
    const formatted =
      tournaments?.map((t: any) => {
        const venue = Array.isArray(t.venue) ? t.venue[0] : t.venue;
        const matchFormat = Array.isArray(t.match_format)
          ? t.match_format[0]
          : t.match_format;
        const registrations = Array.isArray(t.registrations)
          ? t.registrations
          : [];

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          image_url: t.image_url,
          start_date: t.start_time,
          end_date: t.end_time,
          capacity: t.capacity,
          registration_fee: t.registration_fee || 0,
          registered_count: registrations.length,
          venue: {
            name: venue?.name || "",
            address: venue?.address || "",
          },
          match_format: {
            max_age: matchFormat?.max_age || null,
            eligible_gender: matchFormat?.eligible_gender || "MW",
          },
        };
      }) || [];

    return c.json({ data: { tournaments: formatted } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// POST /tournaments/:id/referees - Add a referee to a tournament
export async function addTournamentReferee(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof tournamentIdSchema>;
    const body = ((c.req as any).valid("json") as any) as z.infer<typeof addTournamentRefereeSchema>;
    const tournamentId = parseInt(params.id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }

    // Verify user is the host
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, host_id")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    if (tournament.host_id !== playerId) {
      throw new HTTPException(403, {
        message: "Only the tournament host can add referees",
      });
    }

    // Check if referee already exists
    const { data: existingReferee } = await supabase
      .from("tournaments_referee")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("player_id", body.player_id)
      .single();

    if (existingReferee) {
      throw new HTTPException(409, {
        message: "Player is already a referee for this tournament",
      });
    }

    // Verify player exists
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, username")
      .eq("id", body.player_id)
      .single();

    if (playerError || !player) {
      throw new HTTPException(404, { message: "Player not found" });
    }

    // Add referee
    const { data: referee, error: insertError } = await supabase
      .from("tournaments_referee")
      .insert({
        tournament_id: tournamentId,
        player_id: body.player_id,
      })
      .select()
      .single();

    if (insertError) {
      throw new HTTPException(500, { message: insertError.message });
    }

    return c.json(
      {
        data: {
          id: referee.id,
          tournament_id: tournamentId,
          player_id: body.player_id,
          player: {
            id: player.id,
            username: player.username,
          },
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}

// DELETE /tournaments/:id/referees/:playerId - Remove a referee from a tournament
export async function removeTournamentReferee(c: Context<AuthContext>) {
  try {
    const playerId = c.get("playerId");
    const params = ((c.req as any).valid("param") as any) as z.infer<typeof removeTournamentRefereeSchema> & z.infer<typeof tournamentIdSchema>;
    const tournamentId = parseInt(params.id);
    const refereePlayerId = parseInt(params.player_id);

    if (isNaN(tournamentId)) {
      throw new HTTPException(400, { message: "Invalid tournament ID" });
    }
    if (isNaN(refereePlayerId)) {
      throw new HTTPException(400, { message: "Invalid player ID" });
    }

    // Verify user is the host
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, host_id")
      .eq("id", tournamentId)
      .single();

    if (tournamentError || !tournament) {
      throw new HTTPException(404, { message: "Tournament not found" });
    }

    if (tournament.host_id !== playerId) {
      throw new HTTPException(403, {
        message: "Only the tournament host can remove referees",
      });
    }

    // Remove referee
    const { error: deleteError } = await supabase
      .from("tournaments_referee")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("player_id", refereePlayerId);

    if (deleteError) {
      throw new HTTPException(500, { message: deleteError.message });
    }

    return c.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: (error as Error).message });
  }
}
