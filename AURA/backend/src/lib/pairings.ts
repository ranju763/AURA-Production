import { supabase } from './supabase';
import { getTournamentRounds } from '../utils/rounds';

// --- CONSTANTS ---
const WIN_POINTS = 1.0;
const LOSS_POINTS = 0.0;
const POINT_SCALE_FACTOR = 100;

// --- TYPES ---
interface Player {
    id: number;
    name: string;
    rating: number;
    points: number;
}

interface PairingConfig {
    ta: Player[];
    tb: Player[];
    real_diff: number;
    sort_metric: number;
}

// --- HELPER: COMBINATIONS ---
function getCombinations<T>(arr: T[], k: number): T[][] {
    const result: T[][] = [];
    function combine(start: number, combo: T[]) {
        if (combo.length === k) { result.push([...combo]); return; }
        for (let i = start; i < arr.length; i++) { combine(i + 1, [...combo, arr[i]]); }
    }
    combine(0, []);
    return result;
}

// --- HELPER: DETERMINISTIC SORT ---
// Matches Code 2 logic but adds ID tie-breaker to handle DB randomness
function deterministicSort(players: Player[]): Player[] {
    return players.sort((a, b) => {
        // 1. Primary: Points (High to Low)
        if (b.points !== a.points) return b.points - a.points;
        // 2. Secondary: Rating (High to Low)
        if (b.rating !== a.rating) return b.rating - a.rating;
        // 3. Tertiary: ID (Low to High) - CRITICAL FOR CONSISTENCY
        return a.id - b.id; 
    });
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * 1. VALIDATION
 */
async function validateTournamentState(tournamentId: number) {
    // Get tournament metadata to determine valid rounds
    const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select(`
            id,
            match_format:match_format (
                id,
                metadata
            )
        `)
        .eq('id', tournamentId)
        .single();

    if (tournamentError || !tournament) {
        throw new Error(`Tournament not found: ${tournamentError?.message || 'Unknown error'}`);
    }

    const matchFormat = Array.isArray(tournament.match_format)
        ? tournament.match_format[0]
        : tournament.match_format;

    // Get valid rounds from metadata (sorted)
    const metadata = matchFormat?.metadata || {};
    const validRounds = getTournamentRounds(metadata);

    if (validRounds.length === 0) {
        throw new Error('No valid rounds found in tournament metadata');
    }

    // Get all matches for this tournament
    const { data: matches, error } = await supabase
        .from('matches')
        .select('round, status, winner_team_id')
        .eq('tournament_id', tournamentId);

    if (error) throw new Error(`DB Error: ${error.message}`);

    let currentRound: string | null = null;
    let nextRoundIndex = 0;

    if (matches && matches.length > 0 && validRounds.length > 0) {
        // Get all unique rounds that have matches
        const roundsWithMatches = new Set(
            matches.map((m: any) => String(m.round))
        );

        // Find the current round (last round in validRounds that has matches)
        for (let i = validRounds.length - 1; i >= 0; i--) {
            if (roundsWithMatches.has(validRounds[i])) {
                currentRound = validRounds[i];
                nextRoundIndex = i + 1;

                // Check if current round is complete
                const currentRoundMatches = matches.filter(
                    (m: any) => String(m.round) === currentRound
                );
                const pendingMatch = currentRoundMatches.find(
                    (m: any) => m.status !== 'completed' || m.winner_team_id === null
                );

                if (pendingMatch) {
                    throw new Error(
                        `Cannot start next round. Round ${currentRound} is incomplete.`
                    );
                }
                break;
            }
        }
    }

    // Check if tournament is complete (no more rounds after final)
    if (nextRoundIndex >= validRounds.length) {
        const lastRound = validRounds[validRounds.length - 1];
        throw new Error(
            `Tournament Complete. The final round (${lastRound}) has been completed. No more rounds can be generated.`
        );
    }

    const nextRound = validRounds[nextRoundIndex];

    return { nextRound };
}

/**
 * 2. DATA FETCHING & POINT CALCULATION
 */
async function fetchTournamentData(tournamentId: number): Promise<Player[]> {
    
    // A. Fetch Registrations
    const { data: regs, error: regError } = await supabase
        .from('registrations')
        .select('player_id, players ( id, username )')
        .eq('tournament_id', tournamentId);

    if (regError) throw new Error(`Registration Fetch Error: ${regError.message}`);
    if (!regs || regs.length === 0) return [];

    // B. Fetch Ratings
    const playerIds = regs.map((r: any) => r.player_id);
    const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('player_id, aura_mu')
        .in('player_id', playerIds);

    if (ratingsError) throw new Error(`Ratings Fetch Error: ${ratingsError.message}`);

    // C. Build Base Player Map
    const playersMap = new Map<number, Player>();
    regs.forEach((r: any) => {
        const pId = r.player_id;
        const ratingObj = ratingsData?.find(rt => rt.player_id === pId);
        const ratingVal = ratingObj ? ratingObj.aura_mu : 1200;

        playersMap.set(pId, {
            id: pId,
            name: r.players?.username || `Player ${pId}`,
            rating: ratingVal,
            points: 0.0
        });
    });

    // D. Fetch Match History for Points
    const { data: matches } = await supabase
        .from('matches')
        .select('id, winner_team_id')
        .eq('tournament_id', tournamentId)
        .eq('status', 'completed')
        .not('winner_team_id', 'is', null);

    if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        
        const { data: pairingRows } = await supabase
            .from('pairings')
            .select('id, match_id')
            .in('match_id', matchIds);

        if (pairingRows && pairingRows.length > 0) {
            const pairingIds = pairingRows.map(p => p.id);
            const { data: ptRows } = await supabase
                .from('pairing_teams')
                .select('pairing_id, team_id')
                .in('pairing_id', pairingIds);

            if (ptRows && ptRows.length > 0) {
                const teamIds = ptRows.map(pt => pt.team_id);
                const { data: teamMembers } = await supabase
                    .from('team_members')
                    .select('team_id, player_id')
                    .in('team_id', teamIds);

                matches.forEach(match => {
                    const pairing = pairingRows.find(p => p.match_id === match.id);
                    if (!pairing) return;

                    const teamsInMatch = ptRows.filter(pt => pt.pairing_id === pairing.id);

                    teamsInMatch.forEach(pt => {
                        const members = teamMembers?.filter(tm => tm.team_id === pt.team_id) || [];
                        members.forEach(member => {
                            const player = playersMap.get(member.player_id);
                            if (player) {
                                if (pt.team_id === match.winner_team_id) {
                                    player.points += WIN_POINTS;
                                } else {
                                    player.points += LOSS_POINTS;
                                }
                            }
                        });
                    });
                });
            }
        }
    }

    // E. Sort Deterministically
    const playerArray = Array.from(playersMap.values());
    return deterministicSort(playerArray);
}

/**
 * 3. CONSTRAINT BUILDER
 */
async function buildTeammateHistory(tournamentId: number): Promise<Map<number, Set<number>>> {
    const history = new Map<number, Set<number>>();

    // Fetch ALL pairings (completed or scheduled) to prevent repeats
    const { data: pairingRows } = await supabase
        .from('pairings')
        .select('id')
        .eq('tournament_id', tournamentId);
    
    if (!pairingRows || pairingRows.length === 0) return history;
    const pairingIds = pairingRows.map(p => p.id);

    const { data: ptRows } = await supabase
        .from('pairing_teams')
        .select('team_id')
        .in('pairing_id', pairingIds);

    if (!ptRows || ptRows.length === 0) return history;
    const teamIds = ptRows.map(pt => pt.team_id);

    const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id, player_id')
        .in('team_id', teamIds);

    if (!teamMembers) return history;

    teamMembers.forEach(tm => {
        if (!history.has(tm.player_id)) history.set(tm.player_id, new Set());
    });

    const teamMap = new Map<number, number[]>();
    teamMembers.forEach(tm => {
        if (!teamMap.has(tm.team_id)) teamMap.set(tm.team_id, []);
        teamMap.get(tm.team_id)?.push(tm.player_id);
    });

    for (const [_, members] of teamMap) {
        if (members.length >= 2) {
            const [p1, p2] = members;
            history.get(p1)?.add(p2);
            history.get(p2)?.add(p1);
        }
    }

    return history;
}

/**
 * 4. METRIC CALCULATOR
 * Exactly matches Code 2's `get_best_split_for_group` logic
 */
function calculateSplitMetric(quad: Player[], history: Map<number, Set<number>>): PairingConfig | null {
    // Quad input order depends on `getCombinations` which depends on `availablePlayers` sort order
    const [p1, p2, p3, p4] = quad;
    const scenarios = [
        { a: [p1, p2], b: [p3, p4] },
        { a: [p1, p3], b: [p2, p4] },
        { a: [p1, p4], b: [p2, p3] }
    ];

    let bestConfig: PairingConfig | null = null;
    let minMetric = Infinity;

    for (const scen of scenarios) {
        const tA1 = scen.a[0], tA2 = scen.a[1];
        const tB1 = scen.b[0], tB2 = scen.b[1];

        // Logic: Check History (Hard Constraint)
        const tA_bad = history.get(tA1.id)?.has(tA2.id);
        const tB_bad = history.get(tB1.id)?.has(tB2.id);

        if (!tA_bad && !tB_bad) {
            // Logic: Composite Score (Same as Code 2)
            const scoreA = (tA1.rating + tA1.points * POINT_SCALE_FACTOR) + (tA2.rating + tA2.points * POINT_SCALE_FACTOR);
            const scoreB = (tB1.rating + tB1.points * POINT_SCALE_FACTOR) + (tB2.rating + tB2.points * POINT_SCALE_FACTOR);
            
            const compositeDiff = Math.abs(scoreA - scoreB);
            const realDiff = Math.abs(((tA1.rating + tA2.rating) / 2) - ((tB1.rating + tB2.rating) / 2));

            // Optimization: strictly strictly less than (<) preserves first found if equal
            if (compositeDiff < minMetric) {
                minMetric = compositeDiff;
                bestConfig = { 
                    ta: [tA1, tA2], 
                    tb: [tB1, tB2], 
                    real_diff: realDiff, 
                    sort_metric: compositeDiff 
                };
            }
        }
    }
    return bestConfig;
}

/**
 * 5. RECURSIVE SOLVER
 * Matches Code 2's `solve_round_globally_balanced` structure
 */
function generatePairingsRecursive(
    availablePlayers: Player[], 
    history: Map<number, Set<number>>,
    currentMatches: PairingConfig[] = []
): PairingConfig[] | null {
    if (availablePlayers.length === 0) return currentMatches;

    // 1. CRITICAL: Sort players deterministically before combination generation
    // This ensures `getCombinations` produces quads in the EXACT same order as Code 2
    deterministicSort(availablePlayers);

    // 2. Generate Combinations
    const allQuads = getCombinations(availablePlayers, 4);
    const candidateMatches: { config: PairingConfig, players: Player[] }[] = [];

    for (const quad of allQuads) {
        const config = calculateSplitMetric(quad, history);
        if (config) candidateMatches.push({ config, players: quad });
    }

    // 3. Sort Candidates by Metric (Ascending)
    // Javascript sort is stable, so ties preserve the `allQuads` generation order
    candidateMatches.sort((a, b) => a.config.sort_metric - b.config.sort_metric);

    // 4. Backtracking
    for (const match of candidateMatches) {
        // Create next pool excluding current 4 players
        const idsToRemove = match.players.map(x => x.id);
        const nextPool = availablePlayers.filter(p => !idsToRemove.includes(p.id));

        const result = generatePairingsRecursive(nextPool, history, [...currentMatches, match.config]);
        if (result) return result;
    }

    return null;
}

/**
 * 6. PROCESSING & PERSISTENCE
 */
async function processAndPersistRound(tournamentId: number, roundIdentifier: string, pairings: PairingConfig[]) {
    const outputMatches: any[] = [];

    for (const p of pairings) {
        
        // Create Match
        const { data: matchData, error: matchError } = await supabase
            .from('matches')
            .insert({
                tournament_id: tournamentId,
                round: roundIdentifier,
                status: 'scheduled',
                start_time: new Date().toISOString()
            })
            .select('id')
            .single();

        if (matchError) throw new Error(`Match Create Failed: ${matchError.message}`);
        const matchId = matchData.id;

        // Create Teams & Rosters
        // Note: We must insert Team A then Team B to ensure Team B has higher ID (usually)
        // for the deterministic winner simulation later
        
        // Team A
        const { data: teamA } = await supabase.from('teams').insert({}).select('team_id').single();
        if(!teamA) throw new Error("Team A failed");
        await supabase.from('team_members').insert([
            { team_id: teamA.team_id, player_id: p.ta[0].id },
            { team_id: teamA.team_id, player_id: p.ta[1].id }
        ]);

        // Team B
        const { data: teamB } = await supabase.from('teams').insert({}).select('team_id').single();
        if(!teamB) throw new Error("Team B failed");
        await supabase.from('team_members').insert([
            { team_id: teamB.team_id, player_id: p.tb[0].id },
            { team_id: teamB.team_id, player_id: p.tb[1].id }
        ]);

        // Pairing Header
        const { data: pairingHeader } = await supabase
            .from('pairings')
            .insert({ tournament_id: tournamentId, match_id: matchId })
            .select('id')
            .single();

        if(!pairingHeader) throw new Error("Pairing failed");

        // Pairing Teams
        await supabase.from('pairing_teams').insert([
            { pairing_id: pairingHeader.id, team_id: teamA.team_id },
            { pairing_id: pairingHeader.id, team_id: teamB.team_id }
        ]);

        outputMatches.push({
            match_id: matchId,
            t1: [p.ta[0].name, p.ta[1].name],
            t2: [p.tb[0].name, p.tb[1].name],
            diff: p.real_diff
        });
    }

    return outputMatches;
}

/**
 * HELPER: SIMULATE MATCHES
 * Matches Code 2's "Winner Index = 1" (Team B wins) logic
 */
/**
 * HELPER: SIMULATE MATCHES (Extended)
 * - Plays out the round (Team B always wins, per Code 2 logic).
 * - Returns detailed pairing info.
 * - Returns the updated Leaderboard.
 */
/**
 * HELPER: SIMULATE MATCHES & GENERATE PARTNER HISTORY
 */
async function simulateRoundMatches(tournamentId: number) {
    const updates: any[] = [];
    const matchReports: string[] = [];
    
    // ==============================================================
    // PHASE 1: SIMULATE THE CURRENT ROUND
    // ==============================================================
    
    // 1. Get all SCHEDULED matches
    const { data: matches } = await supabase
        .from('matches')
        .select('id, round')
        .eq('tournament_id', tournamentId)
        .eq('status', 'scheduled');

    if (!matches || matches.length === 0) return { message: "No scheduled matches found." };

    for (const match of matches) {
        // A. Get Pairing Header
        const { data: pairing } = await supabase
            .from('pairings')
            .select('id')
            .eq('match_id', match.id)
            .single();

        if (!pairing) continue;

        // B. Get Teams
        const { data: teams } = await supabase
            .from('pairing_teams')
            .select('team_id')
            .eq('pairing_id', pairing.id);

        if (!teams || teams.length !== 2) continue;

        // C. STRICT SORT (Consistency Check)
        // Team A (created 1st) = Lower ID. Team B (created 2nd) = Higher ID.
        teams.sort((a, b) => a.team_id - b.team_id);
        
        const teamA = teams[0];
        const teamB = teams[1]; // Winner (Logic Code 2)

        // D. UPDATE DB (Set Winner)
        await supabase
            .from('matches')
            .update({
                status: 'completed',
                winner_team_id: teamB.team_id,
                end_time: new Date().toISOString()
            })
            .eq('id', match.id);

        updates.push({ match_id: match.id, winner_team_id: teamB.team_id });

        // E. Fetch Names for Instant Log
        const { data: membersA } = await supabase.from('team_members').select('players(username)').eq('team_id', teamA.team_id);
        const { data: membersB } = await supabase.from('team_members').select('players(username)').eq('team_id', teamB.team_id);

        const namesA = membersA?.map((m: any) => m.players?.username).join(" & ") || "Unknown";
        const namesB = membersB?.map((m: any) => m.players?.username).join(" & ") || "Unknown";
        
        matchReports.push(`Match ${match.id}: [${namesA}] vs [${namesB}] -> Winner: ${namesB}`);
    }

    // ==============================================================
    // PHASE 2: GENERATE ALL-TIME TEAMMATE HISTORY
    // ==============================================================

    // 1. Fetch ALL Matches in the tournament (Completed or Scheduled)
    const { data: allMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId);

    const teammateMap = new Map<string, Set<string>>(); // Map<Username, Set<TeammateUsername>>

    if (allMatches && allMatches.length > 0) {
        const allMatchIds = allMatches.map(m => m.id);

        // 2. Get Pairings
        const { data: allPairings } = await supabase
            .from('pairings')
            .select('id')
            .in('match_id', allMatchIds);

        if (allPairings && allPairings.length > 0) {
            const allPairingIds = allPairings.map(p => p.id);

            // 3. Get Pairing Teams
            const { data: allPairingTeams } = await supabase
                .from('pairing_teams')
                .select('team_id')
                .in('pairing_id', allPairingIds);

            if (allPairingTeams && allPairingTeams.length > 0) {
                const allTeamIds = allPairingTeams.map(t => t.team_id);

                // 4. Get Team Members with Names
                const { data: allMembers } = await supabase
                    .from('team_members')
                    .select('team_id, players(username)')
                    .in('team_id', allTeamIds);

                // 5. Process Logic: Group by Team -> Link Partners
                if (allMembers) {
                    // Group by Team ID
                    const teamsMap = new Map<number, string[]>();
                    
                    allMembers.forEach((m: any) => {
                        const tId = m.team_id;
                        const pName = m.players?.username || "Unknown";
                        if (!teamsMap.has(tId)) teamsMap.set(tId, []);
                        teamsMap.get(tId)?.push(pName);
                    });

                    // Build Connections
                    for (const [_, members] of teamsMap) {
                        // If it's doubles (2 players)
                        if (members.length === 2) {
                            const [p1, p2] = members;

                            if (!teammateMap.has(p1)) teammateMap.set(p1, new Set());
                            if (!teammateMap.has(p2)) teammateMap.set(p2, new Set());

                            teammateMap.get(p1)?.add(p2);
                            teammateMap.get(p2)?.add(p1);
                        }
                    }
                }
            }
        }
    }

    // ==============================================================
    // PHASE 3: FORMAT REPORTS
    // ==============================================================

    const historyReport: string[] = [];
    
    // Sort players alphabetically for clean output
    const sortedPlayers = Array.from(teammateMap.keys()).sort();

    sortedPlayers.forEach(player => {
        const partners = Array.from(teammateMap.get(player) || []).join(", ");
        historyReport.push(`${player} has partnered with: [ ${partners} ]`);
    });

    // --- GENERATE LEADERBOARD ---
    const leaderboardRaw = await fetchTournamentData(tournamentId);
    const leaderboard = leaderboardRaw.map((p, index) => ({
        rank: index + 1,
        name: p.name,
        rating: p.rating,
        points: p.points
    }));

    return {
        success: true,
        matches_processed: updates.length,
        match_results_log: matchReports,
        teammate_history_log: historyReport, // <--- requested output
        leaderboard: leaderboard
    };
}

// Export all functions for use in controllers
export {
    validateTournamentState,
    fetchTournamentData,
    buildTeammateHistory,
    generatePairingsRecursive,
    processAndPersistRound,
};