// In-memory store for match scores (simple counter)
const matchScores = new Map<number, { teamA: number; teamB: number }>();
// Store WebSocket connections per match
const matchConnections = new Map<number, Set<any>>();

/**
 * Get or create the score store for a match
 */
export function getMatchScore(matchId: number): { teamA: number; teamB: number } {
  if (!matchScores.has(matchId)) {
    matchScores.set(matchId, { teamA: 0, teamB: 0 });
  }
  return matchScores.get(matchId)!;
}

/**
 * Get or create the connections set for a match
 */
export function getMatchConnections(matchId: number): Set<any> {
  if (!matchConnections.has(matchId)) {
    matchConnections.set(matchId, new Set());
  }
  return matchConnections.get(matchId)!;
}

/**
 * Add a WebSocket connection for a match
 */
export function addConnection(matchId: number, ws: any) {
  const connections = getMatchConnections(matchId);
  connections.add(ws);
}

/**
 * Remove a WebSocket connection for a match
 */
export function removeConnection(matchId: number, ws: any) {
  const connections = matchConnections.get(matchId);
  if (connections) {
    connections.delete(ws);
    
    // Clean up if no connections left
    if (connections.size === 0) {
      matchConnections.delete(matchId);
    }
  }
}

/**
 * Calculate win rate for Team A based on scores
 * @param teamA - Team A score
 * @param teamB - Team B score
 * @returns Win rate percentage (0-100)
 */
export function calculateWinRate(teamA: number, teamB: number): number {
  const totalScore = teamA + teamB;
  if (totalScore === 0) {
    return 50; // Default to 50% if no points scored
  }
  return Math.round((teamA / totalScore) * 100);
}

/**
 * Broadcast score update to all connected WebSocket clients for a match
 * @param matchId - The match ID
 * @param teamA - Team A score
 * @param teamB - Team B score
 * @param winRate - Win rate percentage (0-100)
 */
export function broadcastMatchScore(matchId: number, teamA: number, teamB: number, winRate: number) {
  // Update the in-memory score
  const currentScore = getMatchScore(matchId);
  currentScore.teamA = teamA;
  currentScore.teamB = teamB;

  // Get connections for this match
  const connections = matchConnections.get(matchId);
  
  if (!connections || connections.size === 0) {
    // No connections, just update the score in memory
    return;
  }

  // Broadcast to all connected clients
  const updateMessage = JSON.stringify({
    type: "score_update",
    matchId,
    teamA: currentScore.teamA,
    teamB: currentScore.teamB,
    winRate: winRate,
  });

  connections.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(updateMessage);
      } catch (error) {
        console.error(`❌ Error sending WebSocket message to client for match ${matchId}:`, error);
      }
    }
  });

  console.log(`📡 Broadcasted match ${matchId} score: ${teamA} - ${teamB} to ${connections.size} client(s)`);
}

/**
 * Broadcast match_end event to all connected WebSocket clients for a match
 * @param matchId - The match ID
 * @param winnerTeamId - The winning team ID
 */
export function broadcastMatchEnd(matchId: number, winnerTeamId: number | null) {
  // Get connections for this match
  const connections = matchConnections.get(matchId);
  
  if (!connections || connections.size === 0) {
    // No connections, nothing to broadcast
    return;
  }

  // Broadcast match_end event to all connected clients
  const endMessage = JSON.stringify({
    type: "match_end",
    matchId,
    winnerTeamId,
  });

  connections.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(endMessage);
      } catch (error) {
        console.error(`❌ Error sending match_end WebSocket message to client for match ${matchId}:`, error);
      }
    }
  });
}

