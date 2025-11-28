import { Hono } from 'hono';
import { supabase } from './supabase';

const app = new Hono();

// --- CONSTANTS ---
export const POINTS_TO_WIN = 11;
export const WIN_BY = 2;

// --- TYPES ---

// Internal structure to track logical court positions
export interface TeamPositions {
    right_player_id: number; // Even Court
    left_player_id: number;  // Odd Court
}

// Database Metadata Structure
export interface ScoreMetadata {
    team_a_pos: TeamPositions;
    team_b_pos: TeamPositions;
}

// Input Payload Interface
interface StartMatchPayload {
    match_id: number;
    serving_team_id: number;
    positions: {
        pos_1: number; // Team A Right
        pos_2: number; // Team A Left
        pos_3: number; // Team B Right
        pos_4: number; // Team B Left
    }
}

// --- HELPERS ---

// Helper: Verify teams and return IDs strictly (A = Lower ID, B = Higher ID)
export async function getMatchContext(matchId: number) {
    // 1. Get Match Status & Pairing
    const { data: match, error: mErr } = await supabase
        .from('matches')
        .select('id, status, round')
        .eq('id', matchId)
        .single();

    if (mErr || !match) throw new Error("Match not found or invalid ID");

    // 2. Get Pairing
    const { data: pairing, error: pErr } = await supabase
        .from('pairings')
        .select('id')
        .eq('match_id', matchId)
        .single();
    
    if (pErr || !pairing) throw new Error("Pairing configuration missing for this match");

    // 3. Get Teams
    const { data: teams, error: tErr } = await supabase
        .from('pairing_teams')
        .select('team_id')
        .eq('pairing_id', pairing.id)
        .order('team_id', { ascending: true }); // STRICT ORDERING

    if (tErr || !teams || teams.length !== 2) throw new Error("Invalid team configuration in DB");

    return {
        matchStatus: match.status,
        teamA_id: teams[0].team_id,
        teamB_id: teams[1].team_id
    };
}

// Helper: Check if specific players belong to a team
async function validatePlayersInTeam(teamId: number, playerIds: number[]) {
    const { data: members, error } = await supabase
        .from('team_members')
        .select('player_id')
        .eq('team_id', teamId);

    if (error || !members) return false;

    const dbMemberIds = members.map(m => m.player_id);
    // Check if every requested player ID exists in the DB team members list
    return playerIds.every(id => dbMemberIds.includes(id));
}

// ============================================================================
// 1. START MATCH
// ============================================================================
app.post('/api/match/start', async (c) => {
    try {
        const body = await c.req.json() as StartMatchPayload;
        const { match_id, serving_team_id, positions } = body; 

        // 1. Validate Input Existence
        if (!match_id || !serving_team_id || !positions) {
            return c.json({ error: "Missing required fields (match_id, serving_team_id, positions)" }, 400);
        }

        // 2. Validate Match Context (Check Match ID validity & Fetch Teams)
        const ctx = await getMatchContext(match_id);

        // 3. Validate Serving Team belongs to Match
        if (serving_team_id !== ctx.teamA_id && serving_team_id !== ctx.teamB_id) {
            return c.json({ error: `Serving Team ID ${serving_team_id} does not belong to match ${match_id}.` }, 400);
        }

        // 4. Validate Match Status
        if (ctx.matchStatus === 'completed') {
            return c.json({ error: "Match is already completed." }, 400);
        }
        if (ctx.matchStatus === 'in_progress') {
            return c.json({ error: "Match is already in progress. Cannot restart." }, 400);
        }

        // 5. Validate Player Positions (Check if players match their teams)
        // Team A: pos_1 & pos_2
        const isTeamAValid = await validatePlayersInTeam(ctx.teamA_id, [positions.pos_1, positions.pos_2]);
        if (!isTeamAValid) {
            return c.json({ error: `Players ${positions.pos_1} and/or ${positions.pos_2} do not belong to Team A (ID: ${ctx.teamA_id})` }, 400);
        }

        // Team B: pos_3 & pos_4
        const isTeamBValid = await validatePlayersInTeam(ctx.teamB_id, [positions.pos_3, positions.pos_4]);
        if (!isTeamBValid) {
            return c.json({ error: `Players ${positions.pos_3} and/or ${positions.pos_4} do not belong to Team B (ID: ${ctx.teamB_id})` }, 400);
        }

        // 6. SANITIZATION: Delete any existing scores for this match (clean slate)
        const { error: delError } = await supabase.from('scores').delete().eq('match_id', match_id);
        if (delError) throw delError;

        // 7. Map Input "pos_1...4" to Internal Logic (Right/Left)
        // Pos 1/3 = Right (Even), Pos 2/4 = Left (Odd)
        const metadata: ScoreMetadata = {
            team_a_pos: { right_player_id: positions.pos_1, left_player_id: positions.pos_2 },
            team_b_pos: { right_player_id: positions.pos_3, left_player_id: positions.pos_4 }
        };

        // 8. Insert Start Record (0-0-2)
        const { data, error } = await supabase
            .from('scores')
            .insert({
                match_id: match_id,
                team_a_score: 0,
                team_b_score: 0,
                serving_team_id: serving_team_id,
                server_sequence: 2, 
                metadata: metadata
            })
            .select()
            .single();

        if (error) throw error;

        // 9. Update Match Status to In Progress
        await supabase
            .from('matches')
            .update({ status: 'in_progress', start_time: new Date().toISOString() })
            .eq('id', match_id);

        return c.json({ 
            success: true, 
            message: "Match Started", 
            score_1_2: 0,
            score_3_4: 0,
            state: data 
        });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ============================================================================
// 2. RECORD POINT (Logic + Win Check)
// ============================================================================
app.post('/api/match/point', async (c) => {
    try {
        const { match_id, rally_winner_team_id } = await c.req.json();

        if (!match_id || !rally_winner_team_id) {
            return c.json({ error: "Missing match_id or rally_winner_team_id" }, 400);
        }

        // 1. Get Context & Validate Match ID / Status
        const ctx = await getMatchContext(match_id);
        
        if (ctx.matchStatus === 'completed') {
            return c.json({ error: "Match is finished. Cannot add points." }, 400);
        }
        
        // 2. Validate Winner Team belongs to Match
        if (rally_winner_team_id !== ctx.teamA_id && rally_winner_team_id !== ctx.teamB_id) {
            return c.json({ error: `Rally Winner Team ID ${rally_winner_team_id} does not belong to this match.` }, 400);
        }

        // 3. Fetch Current State
        const { data: current, error } = await supabase
            .from('scores')
            .select('*')
            .eq('match_id', match_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !current) throw new Error("Match not started (No score history found)");

        // Unpack State
        let newScoreA = current.team_a_score;
        let newScoreB = current.team_b_score;
        let servingTeam = current.serving_team_id;
        let sequence = current.server_sequence;
        let metadata = current.metadata as ScoreMetadata;

        const isServerWinner = (servingTeam === rally_winner_team_id);

        // --- SCENARIO 1: SERVING TEAM WINS RALLY ---
        if (isServerWinner) {
            
            // Increment Score & Swap Positions
            if (servingTeam === ctx.teamA_id) {
                newScoreA++;
                // Swap Team A (Right <-> Left)
                const temp = metadata.team_a_pos.right_player_id;
                metadata.team_a_pos.right_player_id = metadata.team_a_pos.left_player_id;
                metadata.team_a_pos.left_player_id = temp;
            } else {
                newScoreB++;
                // Swap Team B (Right <-> Left)
                const temp = metadata.team_b_pos.right_player_id;
                metadata.team_b_pos.right_player_id = metadata.team_b_pos.left_player_id;
                metadata.team_b_pos.left_player_id = temp;
            }
            // Sequence remains same
        } 
        
        // --- SCENARIO 2: SIDE OUT ---
        else {
            if (sequence === 1) {
                sequence = 2; // Second server
            } else {
                sequence = 1; // Hand over
                servingTeam = (servingTeam === ctx.teamA_id) ? ctx.teamB_id : ctx.teamA_id;
            }
            // No score change, No position swap
        }

        // 4. INSERT NEW STATE
        const { data: newState, error: insertErr } = await supabase
            .from('scores')
            .insert({
                match_id: match_id,
                team_a_score: newScoreA,
                team_b_score: newScoreB,
                serving_team_id: servingTeam,
                server_sequence: sequence,
                metadata: metadata
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        // 5. CHECK WIN CONDITION (Standard: 11 points, Win by 2)
        let matchComplete = false;
        let winnerId = null;

        if (newScoreA >= POINTS_TO_WIN && (newScoreA - newScoreB) >= WIN_BY) {
            matchComplete = true;
            winnerId = ctx.teamA_id;
        } else if (newScoreB >= POINTS_TO_WIN && (newScoreB - newScoreA) >= WIN_BY) {
            matchComplete = true;
            winnerId = ctx.teamB_id;
        }

        if (matchComplete) {
            // Mark Completed and Set End Time
            await supabase
                .from('matches')
                .update({ 
                    status: 'completed', 
                    winner_team_id: winnerId,
                    end_time: new Date().toISOString() 
                })
                .eq('id', match_id);
        }

        return c.json({ 
            success: true, 
            score_1_2: newScoreA, // Integer score for Team A
            score_3_4: newScoreB, // Integer score for Team B
            server_seq: sequence,
            is_match_over: matchComplete,
            winner_team_id: winnerId,
            positions: {
                pos_1: metadata.team_a_pos.right_player_id,
                pos_2: metadata.team_a_pos.left_player_id,
                pos_3: metadata.team_b_pos.right_player_id,
                pos_4: metadata.team_b_pos.left_player_id
            }
        });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ============================================================================
// 3. UNDO (With Status Revert)
// ============================================================================
app.post('/api/match/undo', async (c) => {
    try {
        const { match_id } = await c.req.json();

        if (!match_id) return c.json({ error: "Missing match_id" }, 400);

        // 1. Check Record Count
        const { count } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', match_id);

        if (count !== null && count <= 1) {
            return c.json({ error: "Cannot undo. Match is at start state." }, 400);
        }

        // 2. Get Latest ID to Delete
        const { data: latest } = await supabase
            .from('scores')
            .select('id')
            .eq('match_id', match_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!latest) {
            return c.json({ error: "No score found to undo" }, 404);
        }

        // 3. Delete Latest
        await supabase.from('scores').delete().eq('id', latest.id);

        // 4. Fetch NEW Current State
        const { data: current } = await supabase
            .from('scores')
            .select('*')
            .eq('match_id', match_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 5. REVERT MATCH STATUS LOGIC
        const scoreA = current.team_a_score;
        const scoreB = current.team_b_score;
        
        const isWinA = scoreA >= POINTS_TO_WIN && (scoreA - scoreB) >= WIN_BY;
        const isWinB = scoreB >= POINTS_TO_WIN && (scoreB - scoreA) >= WIN_BY;

        // If neither is a win now, force status to in_progress and clear winner
        if (!isWinA && !isWinB) {
             await supabase
                .from('matches')
                .update({ 
                    status: 'in_progress', 
                    winner_team_id: null,
                    end_time: null 
                })
                .eq('id', match_id);
        }

        return c.json({ 
            success: true, 
            message: "Undo successful", 
            score_1_2: scoreA, // Integer score for Team A
            score_3_4: scoreB, // Integer score for Team B
            server_seq: current.server_sequence
        });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ============================================================================
// 4. GET MATCH STATE
// ============================================================================
app.get('/api/match/:id', async (c) => {
    const match_id = c.req.param('id');
    try {
        const { data: current } = await supabase
            .from('scores')
            .select('*')
            .eq('match_id', match_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (!current) return c.json({ error: "No match data found" }, 404);

        // Map back to flat positions for frontend convenience
        const meta = current.metadata as ScoreMetadata;
        
        return c.json({
            ...current,
            score_1_2: current.team_a_score, // Added these for consistency
            score_3_4: current.team_b_score,
            display_positions: {
                pos_1: meta.team_a_pos.right_player_id,
                pos_2: meta.team_a_pos.left_player_id,
                pos_3: meta.team_b_pos.right_player_id,
                pos_4: meta.team_b_pos.left_player_id
            }
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

