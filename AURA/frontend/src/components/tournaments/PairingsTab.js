"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createWebSocketConnection } from "@/lib/websocket";

// Format player name with dot (e.g., "Hugh . Saturation")
function formatPlayerName(player) {
  const name = player.name || player.username || "Player";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} . ${parts.slice(1).join(" ")}`;
  }
  return name;
}

// Format scores for display - show only latest score
function formatScores(pairing, realtimeScores = null) {
  // Use realtime scores if available, otherwise use pairing scores
  const scores = realtimeScores || pairing.scores;
  if (!scores) return null;
  
  const { teamA, teamB } = scores;

  // Get the latest score (single value, not array)
  const getLatestScore = (score) => {
    if (score === null || score === undefined || score === "") return null;
    if (Array.isArray(score)) {
      // Get the last non-null score from array
      const validScores = score.filter(
        (s) => s !== null && s !== undefined && s !== ""
      );
      return validScores.length > 0 ? validScores[validScores.length - 1] : null;
    }
    // Single score value
    return score;
  };

  return {
    teamA: getLatestScore(teamA),
    teamB: getLatestScore(teamB),
  };
}

// Skeleton loader for pairings
function PairingsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6].map((pairing) => (
        <div key={pairing} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            {/* Team A - always shown */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="flex flex-col gap-0.5">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-6" />
              </div>
            </div>
            {/* Team B - only show for some pairings to match real data */}
            {pairing % 2 === 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-4 w-6" />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PairingsTab({ pairingsByCourt, selectedRound, isLoading }) {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id;
  
  // State to store real-time scores for each match
  const [realtimeScores, setRealtimeScores] = useState({});
  const wsConnectionsRef = useRef({});

  // Flatten pairingsByCourt into a single array of pairings with court info
  const allPairings = useMemo(() => {
    return Object.entries(pairingsByCourt).flatMap(([court, courtPairings]) =>
      courtPairings.map((pairing) => ({
        ...pairing,
        court: court,
      }))
    );
  }, [pairingsByCourt]);

  // Get match IDs for dependency tracking
  const matchIds = useMemo(() => {
    return allPairings.map(p => p.match_id || p.id).filter(Boolean).sort().join(',');
  }, [allPairings]);

  // Set up WebSocket connections for all matches
  useEffect(() => {
    if (isLoading || allPairings.length === 0) {
      // Clear scores when loading or no pairings
      setRealtimeScores({});
      return;
    }

    // Clean up existing connections
    Object.values(wsConnectionsRef.current).forEach((ws) => {
      if (ws && ws.close) ws.close();
    });
    wsConnectionsRef.current = {};
    // Clear previous scores when round changes
    setRealtimeScores({});

    // Create WebSocket connection for each match
    allPairings.forEach((pairing) => {
      const matchId = pairing.match_id || pairing.id;
      if (!matchId) return;

      const ws = createWebSocketConnection(`/ws/match/${matchId}/score`, {
        onOpen: (event, wsInstance) => {
          console.log(`WebSocket connected for match ${matchId}`);
          // Initialize with current score from pairing
          if (pairing.scores) {
            const { teamA, teamB } = pairing.scores;
            const latestTeamA = Array.isArray(teamA) 
              ? teamA[teamA.length - 1] 
              : teamA;
            const latestTeamB = Array.isArray(teamB) 
              ? teamB[teamB.length - 1] 
              : teamB;
            
            if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
              wsInstance.send(
                JSON.stringify({
                  type: "init",
                  teamA: latestTeamA || 0,
                  teamB: latestTeamB || 0,
                })
              );
            }
          }
        },
        onClose: () => {
          console.log(`WebSocket disconnected for match ${matchId}`);
        },
        onError: (error) => {
          console.error(`WebSocket error for match ${matchId}:`, error);
        },
        onMessage: (data) => {
          if (data.type === "score_update") {
            setRealtimeScores((prev) => ({
              ...prev,
              [matchId]: {
                teamA: data.teamA,
                teamB: data.teamB,
              },
            }));
          }
        },
        reconnect: true,
      });

      wsConnectionsRef.current[matchId] = ws;
    });

    // Cleanup on unmount or when pairings change
    return () => {
      Object.values(wsConnectionsRef.current).forEach((ws) => {
        if (ws && ws.close) ws.close();
      });
      wsConnectionsRef.current = {};
    };
  }, [matchIds, isLoading]);

  if (isLoading) {
    return <PairingsSkeleton />;
  }

  if (allPairings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-gray-500 py-8"
      >
        No pairings available for this round
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {allPairings.map((pairing) => {
        const teamA =
          pairing.players?.filter((p) => p.team === "A") || [];
        const teamB =
          pairing.players?.filter((p) => p.team === "B") || [];
        const matchId = pairing.match_id || pairing.id;
        const realtimeScore = realtimeScores[matchId];
        const scores = formatScores(pairing, realtimeScore);
        const hasTeamB = teamB.length > 0;
        const isLive = pairing.status === "live" || pairing.status === "in_progress";
        const isComplete = pairing.status === "complete" || pairing.status === "completed";

        return (
          <div 
            key={pairing.id} 
            className="bg-white rounded-lg border cursor-pointer hover:border-purple-300 transition-colors"
            onClick={() => {
              if (matchId && tournamentId) {
                router.push(`/tournaments/${tournamentId}/${selectedRound}/${matchId}`);
              }
            }}
          >
            <div className="flex items-center justify-between rounded-t-lg p-4 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-purple-600">
                {selectedRound} Round • Court {pairing.court}
              </h3>
              {isLive && (
                <div className="flex items-center gap-1 text-green-600">
                  <span className="size-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium">LIVE</span>
                </div>
              )}
              {isComplete && (
                <span className="text-sm text-purple-600 font-medium">
                  Complete
                </span>
              )}
            </div>
            <div className="space-y-2 px-4 py-2">
              {/* Team A */}
              {teamA.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 bg-linear-to-b from-white to-gray-300 rounded-full" />
                    <span className="text-sm capitalize">
                      {teamA.map((p) => formatPlayerName(p)).join(" & ")}
                    </span>
                  </div>
                  {scores && scores.teamA !== null && scores.teamA !== undefined && (
                    <div className="text-sm font-semibold text-purple-600">
                      {scores.teamA}
                    </div>
                  )}
                </div>
              )}
              {/* Team B - only show if team B exists */}
              {hasTeamB && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 bg-linear-to-b from-white to-gray-300 rounded-full" />
                    <span className="text-sm capitalize">
                      {teamB.map((p) => formatPlayerName(p)).join(" & ")}
                    </span>
                  </div>
                  {scores && scores.teamB !== null && scores.teamB !== undefined && (
                    <div className="text-sm font-semibold text-purple-600">
                      {scores.teamB}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

