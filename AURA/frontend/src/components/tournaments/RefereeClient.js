"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useRefereeMatch } from "@/hooks/useRefereeMatch";
import { matchesApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  MoreVertical,
  Plus,
  Undo2,
  User,
  ArrowUpDown,
  ArrowLeftRight,
  Play,
} from "lucide-react";
import AddTeamDialog from "@/components/tournaments/AddTeamDialog";
import ScoreDrawer from "@/components/tournaments/ScoreDrawer";
import { faker } from "@faker-js/faker";
import { cn } from "@/lib/utils";
import { createWebSocketConnection } from "@/lib/websocket";

export default function RefereeClient() {
  const params = useParams();
  const router = useRouter();
  const [positions, setPositions] = useState({
    pos1: null,
    pos2: null,
    pos3: null,
    pos4: null,
  });

  const queryClient = useQueryClient();
  const { data: matchData, isLoading } = useRefereeMatch(
    params.id,
    params.round,
    params.match
  );

  // Check if match is already started (safe to call even if matchData is null)
  const matchStatus = matchData?.status;
  const isMatchStarted = matchStatus === "in_progress" || matchStatus === "completed";
  const isMatchCompleted = matchStatus === "completed";
  
  // Track match completion state (can be updated via websocket)
  const [matchEnded, setMatchEnded] = useState(isMatchCompleted);
  const [winnerTeamId, setWinnerTeamId] = useState(matchData?.winner_team_id || null);
  const wsConnectionRef = useRef(null);

  // Fetch match state to get current positions (must be before conditional returns)
  const { data: matchState } = useQuery({
    queryKey: ["match-state", params.match],
    queryFn: async () => {
      try {
        const response = await matchesApi.getState(params.match);
        return response.data.data;
      } catch (error) {
        // Match might not be started yet, return null
        return null;
      }
    },
    enabled: !!params.match && !!matchData && isMatchStarted,
  });

  const startMatchMutation = useMutation({
    mutationFn: ({ matchId, servingTeamId, positions }) =>
      matchesApi.start(matchId, {
        serving_team_id: servingTeamId,
        positions: {
          pos_1: positions.pos1,
          pos_2: positions.pos2,
          pos_3: positions.pos3,
          pos_4: positions.pos4,
        },
      }),
    onSuccess: () => {
      toast.success("Match started successfully!");
      // Invalidate queries to refetch match state with positions
      queryClient.invalidateQueries({
        queryKey: ["referee-match", params.id, params.round, params.match],
      });
      queryClient.invalidateQueries({
        queryKey: ["match-state", params.match],
      });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to start match";
      toast.error(errorMessage);
    },
  });

  const recordPointMutation = useMutation({
    mutationFn: ({ matchId, rallyWinnerTeamId }) =>
      matchesApi.recordPoint(matchId, {
        rally_winner_team_id: rallyWinnerTeamId,
      }),
    onSuccess: (response) => {
      // Optimistically update the scores if available in response
      const updatedScores = response?.data?.data;
      if (updatedScores) {
        queryClient.setQueryData(
          ["referee-match", params.id, params.round, params.match],
          (oldData) => {
            if (oldData) {
              return {
                ...oldData,
                scores: {
                  teamA: updatedScores.teamA ?? updatedScores.team_a_score ?? oldData.scores?.teamA ?? 0,
                  teamB: updatedScores.teamB ?? updatedScores.team_b_score ?? oldData.scores?.teamB ?? 0,
                },
              };
            }
            return oldData;
          }
        );
      }
      
      // Invalidate queries to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: ["referee-match", params.id, params.round, params.match],
      });
      queryClient.invalidateQueries({
        queryKey: ["match-state", params.match],
      });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to record point";
      toast.error(errorMessage);
    },
  });

  const undoMutation = useMutation({
    mutationFn: (matchId) => matchesApi.undo(matchId),
    onSuccess: () => {
      toast.success("Point undone");
      queryClient.invalidateQueries({
        queryKey: ["referee-match", params.id, params.round, params.match],
      });
      queryClient.invalidateQueries({
        queryKey: ["match-state", params.match],
      });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to undo point";
      toast.error(errorMessage);
    },
  });

  // Update matchEnded state when matchData status changes
  useEffect(() => {
    if (matchData?.status === "completed") {
      setMatchEnded(true);
      setWinnerTeamId(matchData?.winner_team_id || null);
    }
  }, [matchData?.status, matchData?.winner_team_id]);

  // Connect to WebSocket to listen for match_end events
  useEffect(() => {
    if (!params.match || !isMatchStarted) return;

    const matchId = params.match;
    const ws = createWebSocketConnection(`/ws/match/${matchId}/score`, {
      onOpen: (event, wsInstance) => {
        console.log("WebSocket connected for referee match", matchId);
      },
      onClose: () => {
        console.log("WebSocket disconnected for referee match", matchId);
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
      },
      onMessage: (data) => {
        if (data.type === "match_end") {
          setMatchEnded(true);
          setWinnerTeamId(data.winnerTeamId || null);
          toast.success("Match completed!");
          // Invalidate queries to get updated match data with winner
          queryClient.invalidateQueries({
            queryKey: ["referee-match", params.id, params.round, params.match],
          });
        }
      },
      reconnect: true,
    });

    wsConnectionRef.current = ws;

    return () => {
      if (wsConnectionRef.current) {
        wsConnectionRef.current.close();
      }
    };
  }, [params.match, isMatchStarted]);

  // Load positions from metadata when match state is available (must be before conditional returns)
  useEffect(() => {
    // Only load positions if match is started and positions exist in metadata
    if (isMatchStarted && matchData) {
      if (matchState?.metadata) {
        const meta = matchState.metadata;
        setPositions({
          pos1: meta.team_a_pos?.right_player_id || null,
          pos2: meta.team_a_pos?.left_player_id || null,
          pos3: meta.team_b_pos?.right_player_id || null,
          pos4: meta.team_b_pos?.left_player_id || null,
        });
      } else if (matchData.metadata) {
        // Fallback to metadata from matchData if available
        const meta = matchData.metadata;
        setPositions({
          pos1: meta.team_a_pos?.right_player_id || null,
          pos2: meta.team_a_pos?.left_player_id || null,
          pos3: meta.team_b_pos?.right_player_id || null,
          pos4: meta.team_b_pos?.left_player_id || null,
        });
      }
    }
  }, [matchState, matchData, isMatchStarted]);

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!matchData) {
    return <div className="p-4 text-center">Match not found</div>;
  }

  const { tournament_name, players, scores, round, court, metadata } = matchData;

  // Group players into teams by team_id
  // Sort team IDs in ascending order to match backend's teamA_id (lower) and teamB_id (higher) assignment
  const teamIds = [
    ...new Set(players?.map((p) => p.team_id).filter(Boolean) || []),
  ].sort((a, b) => a - b);
  const teamA =
    players
      ?.filter((p) => p.team_id === teamIds[0])
      .map((p) => ({ ...p, photo_url: faker.image.avatarGitHub() })) || [];
  const teamB =
    players
      ?.filter((p) => p.team_id === teamIds[1])
      .map((p) => ({ ...p, photo_url: faker.image.avatarGitHub() })) || [];

  // Get serving team information from match state
  const servingTeamId = matchState?.serving_team_id;
  const serverSequence = matchState?.server_sequence;
  
  const teamAScore = scores?.teamA || 0;
  const teamBScore = scores?.teamB || 0;
  const teamAId = teamIds[0] ? String(teamIds[0]) : null;
  const teamBId = teamIds[1] ? String(teamIds[1]) : null;
  
  // Get winner team information
  const winnerTeamIdFromData = matchData?.winner_team_id || winnerTeamId;
  const isTeamAWinner = winnerTeamIdFromData && String(winnerTeamIdFromData) === teamAId;
  const isTeamBWinner = winnerTeamIdFromData && String(winnerTeamIdFromData) === teamBId;
  
  // Format score with serverSequence if available (pickleball format: X - Y - Z)
  const currentScore = scores 
    ? (serverSequence !== null && serverSequence !== undefined 
        ? `${scores.teamA} - ${scores.teamB} - ${serverSequence}` 
        : `${scores.teamA} - ${scores.teamB}`)
    : (serverSequence !== null && serverSequence !== undefined 
        ? `0 - 0 - ${serverSequence}` 
        : "0 - 0");
  const isTeamAServing = servingTeamId && String(servingTeamId) === teamAId;
  const isTeamBServing = servingTeamId && String(servingTeamId) === teamBId;

  // Check if all positions are assigned
  const allPositionsAssigned =
    positions.pos1 &&
    positions.pos2 &&
    positions.pos3 &&
    positions.pos4;

  // Handle start match
  const handleStartMatch = () => {
    if (!allPositionsAssigned) {
      toast.error("Please assign all positions before starting the match");
      return;
    }

    // Default to team A serving first (can be made configurable)
    const servingTeamId = parseInt(teamAId);
    if (!servingTeamId) {
      toast.error("Invalid team configuration");
      return;
    }

    startMatchMutation.mutate({
      matchId: parseInt(params.match),
      servingTeamId,
      positions,
    });
  };

  const handleScoreUpdate = (teamId) => {
    if (matchEnded) {
      toast.error("Match has ended. Cannot add more points.");
      return;
    }
    const rallyWinnerTeamId = parseInt(teamId);
    if (!rallyWinnerTeamId) {
      toast.error("Invalid team ID");
      return;
    }
    recordPointMutation.mutate({
      matchId: parseInt(params.match),
      rallyWinnerTeamId,
    });
  };

  const handleStepBack = () => {
    undoMutation.mutate(parseInt(params.match));
  };

  // Get player by ID
  const getPlayerById = (playerId) => {
    return players?.find((p) => p.id === playerId);
  };

  // Check if team is assigned
  const isTeamAssigned = (side) => {
    if (side === "left") {
      return positions.pos1 && positions.pos2;
    } else {
      return positions.pos3 && positions.pos4;
    }
  };

  // Get which team is assigned to a side
  const getAssignedTeam = (side) => {
    if (side === "left" && positions.pos1) {
      const player = getPlayerById(positions.pos1);
      if (teamA.some((p) => p.id === player?.id)) return "teamA";
      if (teamB.some((p) => p.id === player?.id)) return "teamB";
    } else if (side === "right" && positions.pos3) {
      const player = getPlayerById(positions.pos3);
      if (teamA.some((p) => p.id === player?.id)) return "teamA";
      if (teamB.some((p) => p.id === player?.id)) return "teamB";
    }
    return null;
  };

  // Check if the other team (not assigned to the given side) has enough players
  const hasOtherTeamEnoughPlayers = (side) => {
    const assignedTeam = getAssignedTeam(side);
    if (!assignedTeam) return true; // If no team assigned on this side, show button

    // Get the other team (the one NOT assigned to this side)
    const otherTeam = assignedTeam === "teamA" ? teamB : teamA;
    return otherTeam && otherTeam.length >= 2;
  };

  // Handle team assignment with auto-fill
  const handleTeamAssign = (side, team) => {
    const newPositions = { ...positions };

    // Determine which team this is (Team A or Team B)
    const isTeamA = teamA.some((p) => p.id === team[0]?.id);
    const otherTeam = isTeamA ? teamB : teamA;

    if (side === "left" && team.length >= 2) {
      // Assign selected team to left side (pos1 and pos2)
      newPositions.pos1 = team[0].id;
      newPositions.pos2 = team[1].id;

      // Auto-fill the other team to the right side if not already assigned
      if (otherTeam && otherTeam.length >= 2 && !isTeamAssigned("right")) {
        newPositions.pos3 = otherTeam[0].id;
        newPositions.pos4 = otherTeam[1].id;
      }
    } else if (side === "right" && team.length >= 2) {
      // Assign selected team to right side (pos3 and pos4)
      newPositions.pos3 = team[0].id;
      newPositions.pos4 = team[1].id;

      // Auto-fill the other team to the left side if not already assigned
      if (otherTeam && otherTeam.length >= 2 && !isTeamAssigned("left")) {
        newPositions.pos1 = otherTeam[0].id;
        newPositions.pos2 = otherTeam[1].id;
      }
    }

    setPositions(newPositions);
  };

  // Handle team removal
  const handleTeamRemove = (side) => {
    const newPositions = { ...positions };

    if (side === "left") {
      newPositions.pos1 = null;
      newPositions.pos2 = null;
    } else {
      newPositions.pos3 = null;
      newPositions.pos4 = null;
    }

    setPositions(newPositions);
  };

  // Handle swap positions within a team
  const handleSwap = (side) => {
    const newPositions = { ...positions };

    if (side === "left") {
      // Swap pos1 and pos2
      const temp = newPositions.pos1;
      newPositions.pos1 = newPositions.pos2;
      newPositions.pos2 = temp;
    } else {
      // Swap pos3 and pos4
      const temp = newPositions.pos3;
      newPositions.pos3 = newPositions.pos4;
      newPositions.pos4 = temp;
    }

    setPositions(newPositions);
  };

  // Handle team swap (swap entire teams between left and right)
  const handleTeamSwap = () => {
    const newPositions = { ...positions };

    // Swap left team (pos1, pos2) with right team (pos3, pos4)
    const tempPos1 = newPositions.pos1;
    const tempPos2 = newPositions.pos2;
    newPositions.pos1 = newPositions.pos3;
    newPositions.pos2 = newPositions.pos4;
    newPositions.pos3 = tempPos1;
    newPositions.pos4 = tempPos2;

    setPositions(newPositions);
  };

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg max-w-[256px] truncate font-bold">
            {tournament_name}
          </h1>
          <Button variant="ghost" size="icon">
            <MoreVertical className="size-5" />
          </Button>
        </div>
      </header>

      {/* Score Section */}
      <div className="p-4">
        <div className=" flex items-center justify-center gap-3 mb-4">
          <div className="relative bg-[#2ABF93] text-4xl font-bold py-4 px-12 rounded-lg text-center">
            <span className="text-white">{currentScore}</span>
            {isMatchStarted && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleStepBack}
                disabled={undoMutation.isPending}
                className="absolute top-1/2 -translate-y-1/2 -left-12"
              >
                <Undo2 className="size-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Match Completed Indicator */}
        {matchEnded && (
          <div className="mb-4 flex items-center justify-center">
            <div className="px-4 py-2 bg-green-100 border-2 border-green-500 rounded-lg">
              <div className="text-sm font-semibold text-green-800 text-center">
                🏆 Match Completed
              </div>
              {winnerTeamIdFromData && (
                <div className="text-xs text-green-700 text-center mt-1">
                  {isTeamAWinner ? "Team A Wins!" : isTeamBWinner ? "Team B Wins!" : "Match Finished"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Serving Team Indicator */}
        {isMatchStarted && servingTeamId && !matchEnded && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <div className="text-sm text-gray-600">Serving:</div>
            <div
              className={cn(
                "px-3 py-1 rounded-full text-sm font-semibold",
                isTeamAServing
                  ? "bg-blue-100 text-blue-700"
                  : isTeamBServing
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {isTeamAServing
                ? `Team A (Server ${serverSequence || ""})`
                : isTeamBServing
                ? `Team B (Server ${serverSequence || ""})`
                : "Unknown"}
            </div>
          </div>
        )}

        {/* Start Match Button - Show when all positions assigned but match not started */}
        {allPositionsAssigned && !isMatchStarted && (
          <div className="mb-4 flex justify-center">
            <Button
              onClick={handleStartMatch}
              disabled={startMatchMutation.isPending}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Play className="size-5 mr-2" />
              {startMatchMutation.isPending ? "Starting Match..." : "Start Match"}
            </Button>
          </div>
        )}

        {/* Court Layout - Complex Grid */}
        <div className="mb-4">
          <div
            className={cn(
              "grid gap-0.5 border",
              teamAId &&
                teamBId &&
                teamA.length > 0 &&
                teamB.length > 0 &&
                isTeamAssigned("left") &&
                isTeamAssigned("right")
                ? "grid-cols-5"
                : "grid-cols-3"
            )}
          >
            {/* Left Dark Green Rectangle */}
            {teamAId &&
              teamBId &&
              teamA.length > 0 &&
              teamB.length > 0 &&
              isTeamAssigned("left") &&
              isTeamAssigned("right") && (
                <div className="col-span-1 bg-[#3E7D68] flex flex-col items-center justify-center min-h-[200px] gap-2">
                  {matchEnded ? (
                    // Show winner information when match is completed
                    <div className="flex flex-col items-center gap-2 px-4">
                      {isTeamAWinner ? (
                        <>
                          <div className="text-white text-lg font-bold bg-yellow-500 px-3 py-1 rounded">
                            🏆 WINNER
                          </div>
                          <div className="text-white text-sm font-semibold text-center">
                            Team A
                          </div>
                        </>
                      ) : (
                        <div className="text-white text-sm text-center opacity-75">
                          Team A
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {isTeamAServing && (
                        <div className="text-white text-xs font-semibold bg-blue-600 px-2 py-1 rounded">
                          SERVING
                        </div>
                      )}
                      {teamAId ? (
                        <ScoreDrawer
                          isLoading={recordPointMutation.isPending}
                          teamId={teamAId}
                          teamName="Team A"
                          currentScore={teamAScore}
                          onConfirm={handleScoreUpdate}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={matchEnded}
                              className={cn(
                                "text-white bg-[#ABD1C4] rounded-full",
                                isTeamAServing && "ring-2 ring-blue-500 ring-offset-2",
                                matchEnded && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <Plus className="size-6 text-gray-800" />
                            </Button>
                          }
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white bg-[#ABD1C4] rounded-full"
                          disabled
                        >
                          <Plus className="size-6 text-gray-800" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

            {/* Center Grid */}
            <div className="col-span-3 relative">
              {/* Team Swap Button - Only enabled before match starts */}
              {(isTeamAssigned("left") || isTeamAssigned("right")) && !isMatchStarted && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleTeamSwap}
                    title="Swap Teams"
                    className="bg-gray-200 hover:bg-gray-300"
                  >
                    <ArrowLeftRight className="text-gray-600" />
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-0.5 bg-white min-h-[200px]">
                {/* Left Side - Team A */}
                <div className="flex flex-col border-r">
                  {!isTeamAssigned("left") ? (
                    // Show single tile for team selection
                    <div className="flex items-center justify-center min-h-[200px] p-2">
                      {isTeamAssigned("right") &&
                      !hasOtherTeamEnoughPlayers("right") ? (
                        <div className="text-center text-sm text-gray-500 px-4">
                          No players yet
                        </div>
                      ) : (
                        <AddTeamDialog
                          teamA={teamA}
                          teamB={teamB}
                          onSelectTeam={handleTeamAssign}
                          side="left"
                          currentPositions={positions}
                        />
                      )}
                    </div>
                  ) : (
                    // Show 2 tiles with swap button
                    <>
                      {/* Top - pos1 */}
                      <div className="py-8 flex flex-col items-center justify-center min-h-[100px] border-b p-2 relative">
                        {!isMatchStarted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="z-10 absolute -bottom-5 left-1/2 -translate-x-1/2 bg-gray-200 hover:bg-gray-300 rounded-full"
                            onClick={() => handleSwap("left")}
                            title="Swap positions within team"
                          >
                            <ArrowUpDown className="text-gray-600" />
                          </Button>
                        )}
                        <div className="flex flex-col items-center gap-1 w-full">
                          <div className="relative group">
                            <div className="size-12 bg-[#DBEAE5] rounded-full flex items-center justify-center">
                              <User className="size-6 text-gray-600" />
                            </div>
                          </div>
                          <span className="text-xs font-medium text-center truncate w-full">
                            {getPlayerById(positions.pos1)?.name ||
                              getPlayerById(positions.pos1)?.username ||
                              "Player"}
                          </span>
                        </div>
                      </div>
                      {/* Bottom - pos2 */}
                      <div className="py-8 flex flex-col items-center justify-center min-h-[100px] p-2 relative">
                        <div className="flex flex-col items-center gap-1 w-full">
                          <div className="relative group">
                            <div className="size-12 bg-[#DBEAE5] rounded-full flex items-center justify-center">
                              <User className="size-6 text-gray-600" />
                            </div>
                          </div>
                          <span className="text-xs font-medium text-center truncate w-full">
                            {getPlayerById(positions.pos2)?.name ||
                              getPlayerById(positions.pos2)?.username ||
                              "Player"}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Side - Team B */}
                <div className="flex flex-col">
                  {!isTeamAssigned("right") ? (
                    // Show single tile for team selection
                    <div className="flex items-center justify-center min-h-[200px] p-2">
                      {isTeamAssigned("left") &&
                      !hasOtherTeamEnoughPlayers("left") ? (
                        <div className="text-center text-sm text-gray-500 px-4">
                          No players yet
                        </div>
                      ) : (
                        <AddTeamDialog
                          teamA={teamA}
                          teamB={teamB}
                          onSelectTeam={handleTeamAssign}
                          side="right"
                          currentPositions={positions}
                        />
                      )}
                    </div>
                  ) : (
                    // Show 2 tiles with swap button
                    <>
                      {/* Top - pos3 */}
                      <div className="py-8 flex flex-col items-center justify-center min-h-[100px] border-b p-2 relative">
                        {!isMatchStarted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="z-10 absolute -bottom-5 left-1/2 -translate-x-1/2 bg-gray-200 hover:bg-gray-300 rounded-full"
                            onClick={() => handleSwap("right")}
                            title="Swap positions within team"
                          >
                            <ArrowUpDown className="text-gray-600" />
                          </Button>
                        )}
                        <div className="flex flex-col items-center gap-1 w-full">
                          <div className="relative group">
                            <div className="size-12 bg-[#DBEAE5] rounded-full flex items-center justify-center">
                              <User className="size-6 text-gray-600" />
                            </div>
                          </div>
                          <span className="text-xs font-medium text-center truncate w-full">
                            {getPlayerById(positions.pos3)?.name ||
                              getPlayerById(positions.pos3)?.username ||
                              "Player"}
                          </span>
                        </div>
                      </div>
                      {/* Bottom - pos4 */}
                      <div className="py-8 flex flex-col items-center justify-center min-h-[100px] p-2 relative">
                        <div className="flex flex-col items-center gap-1 w-full">
                          <div className="relative group">
                            <div className="size-12 bg-[#DBEAE5] rounded-full flex items-center justify-center">
                              <User className="size-6 text-gray-600" />
                            </div>
                          </div>
                          <span className="text-xs font-medium text-center truncate w-full">
                            {getPlayerById(positions.pos4)?.name ||
                              getPlayerById(positions.pos4)?.username ||
                              "Player"}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Dark Green Rectangle */}
            {teamAId &&
              teamBId &&
              teamA.length > 0 &&
              teamB.length > 0 &&
              isTeamAssigned("left") &&
              isTeamAssigned("right") && (
                <div className="col-span-1 bg-[#3E7D68] flex flex-col items-center justify-center min-h-[200px] gap-2">
                  {matchEnded ? (
                    // Show winner information when match is completed
                    <div className="flex flex-col items-center gap-2 px-4">
                      {isTeamBWinner ? (
                        <>
                          <div className="text-white text-lg font-bold bg-yellow-500 px-3 py-1 rounded">
                            🏆 WINNER
                          </div>
                          <div className="text-white text-sm font-semibold text-center">
                            Team B
                          </div>
                        </>
                      ) : (
                        <div className="text-white text-sm text-center opacity-75">
                          Team B
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {isTeamBServing && (
                        <div className="text-white text-xs font-semibold bg-blue-600 px-2 py-1 rounded">
                          SERVING
                        </div>
                      )}
                      {teamBId ? (
                        <ScoreDrawer
                          isLoading={recordPointMutation.isPending}
                          teamId={teamBId}
                          teamName="Team B"
                          currentScore={teamBScore}
                          onConfirm={handleScoreUpdate}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={matchEnded}
                              className={cn(
                                "text-white bg-[#ABD1C4] rounded-full",
                                isTeamBServing && "ring-2 ring-blue-500 ring-offset-2",
                                matchEnded && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <Plus className="size-6 text-gray-800" />
                            </Button>
                          }
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white bg-[#ABD1C4] rounded-full"
                          disabled
                        >
                          <Plus className="size-6 text-gray-800" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Player Icon */}
        <div className="flex justify-center mb-4">
          <div className="text-center">
            <User className="size-8 text-gray-500" />
            <span className="text-xs font-medium text-center truncate w-full">
              You
            </span>
          </div>
        </div>

        {/* Match Details */}
        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
          <div className="border-r border-gray-200">
            <div className="text-xs text-gray-600 mb-1">ROUND</div>
            <div className="font-semibold">{round}</div>
          </div>
          <div className="border-r border-gray-200">
            <div className="text-xs text-gray-600 mb-1">COURT</div>
            <div className="font-semibold">{court}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">VIEWER</div>
            <div className="font-semibold">3</div>
          </div>
        </div>

        {/* Teams Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Teams</h3>
          </div>

          <Tabs defaultValue="right" className="w-full">
            <TabsList className="mb-3 w-fit rounded-none shrink-0 *:data-[slot='tabs-trigger']:font-medium *:data-[slot='tabs-trigger']:text-gray-500 *:data-[slot='tabs-trigger']:py-2 *:data-[slot='tabs-trigger']:data-[state=active]:text-purple-600">
              <TabsTrigger value="left" className="px-4">Left</TabsTrigger>
              <TabsTrigger value="right" className="px-4">Right</TabsTrigger>
            </TabsList>

            <TabsContent value="left" className="space-y-2 mt-0 capitalize">
              {isTeamAssigned("left") ? (
                <>
                  {positions.pos1 && (
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-green-200 rounded-full" />
                      <span className="font-medium">
                        {getPlayerById(positions.pos1)?.name ||
                          getPlayerById(positions.pos1)?.username ||
                          "Player"}
                      </span>
                    </div>
                  )}
                  {positions.pos2 && (
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-green-200 rounded-full" />
                      <span className="font-medium">
                        {getPlayerById(positions.pos2)?.name ||
                          getPlayerById(positions.pos2)?.username ||
                          "Player"}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No team assigned to left side
                </div>
              )}
            </TabsContent>

            <TabsContent value="right" className="space-y-2 mt-0 capitalize">
              {isTeamAssigned("right") ? (
                <>
                  {positions.pos3 && (
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-green-200 rounded-full" />
                      <span className="font-medium">
                        {getPlayerById(positions.pos3)?.name ||
                          getPlayerById(positions.pos3)?.username ||
                          "Player"}
                      </span>
                    </div>
                  )}
                  {positions.pos4 && (
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-green-200 rounded-full" />
                      <span className="font-medium">
                        {getPlayerById(positions.pos4)?.name ||
                          getPlayerById(positions.pos4)?.username ||
                          "Player"}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No team assigned to right side
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
