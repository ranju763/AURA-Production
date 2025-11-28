"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useMatch } from "@/hooks/useMatch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createWebSocketConnection } from "@/lib/websocket";
import { toast } from "sonner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

export default function MatchDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [currentSet, setCurrentSet] = useState(1);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [winRate, setWinRate] = useState(50);
  const [matchEnded, setMatchEnded] = useState(false);
  const [winnerTeamId, setWinnerTeamId] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null); // null, "A", or "B"
  const [scoreAnimation, setScoreAnimation] = useState({
    teamA: false,
    teamB: false,
  });
  const prevScoreA = useRef(0);
  const prevScoreB = useRef(0);
  const wsConnectionRef = useRef(null);

  const { data: matchData, isLoading } = useMatch(
    params.id,
    params.round,
    params.match
  );

  // Update match ended state when matchData changes
  useEffect(() => {
    if (matchData?.status === "completed") {
      setMatchEnded(true);
      setWinnerTeamId(matchData?.winner_team_id || null);
    }
  }, [matchData?.status, matchData?.winner_team_id]);

  // Initialize score from DB and connect to WebSocket
  useEffect(() => {
    if (!matchData) return;

    // Initialize score from latest DB score
    const latestScore =
      matchData.scores && matchData.scores.length > 0
        ? matchData.scores[matchData.scores.length - 1]
        : null;

    if (latestScore) {
      const teamA = latestScore.team_a || 0;
      const teamB = latestScore.team_b || 0;
      setScoreA(teamA);
      setScoreB(teamB);

      // Initialize score history from DB scores
      if (matchData.scores && matchData.scores.length > 0) {
        const sortedScores = [...matchData.scores].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        setScoreHistory(
          sortedScores.map((score, index) => ({
            rally: index,
            teamA: score.team_a || 0,
            teamB: score.team_b || 0,
          }))
        );
      } else {
        setScoreHistory([{ rally: 0, teamA: 0, teamB: 0 }]);
      }

      // Use win_prob_A from backend if available, otherwise calculate fallback
      if (matchData.win_prob_A !== null && matchData.win_prob_A !== undefined) {
        setWinRate(matchData.win_prob_A);
      } else {
        // Fallback: calculate from score ratio
        const total = teamA + teamB;
        const initialWinRate =
          total > 0 ? Math.round((teamA / total) * 100) : 50;
        setWinRate(initialWinRate);
      }
    } else {
      // No scores yet, use win_prob_A if available or default to 50
      if (matchData.win_prob_A !== null && matchData.win_prob_A !== undefined) {
        setWinRate(matchData.win_prob_A);
      } else {
        setWinRate(50);
      }
      setScoreHistory([{ rally: 0, teamA: 0, teamB: 0 }]);
    }

    // Connect to WebSocket for real-time updates
    const matchId = matchData.match_id;
    if (matchId) {
      // Get initial score from DB data
      const initialTeamA = latestScore?.team_a || 0;
      const initialTeamB = latestScore?.team_b || 0;

      const ws = createWebSocketConnection(`/ws/match/${matchId}/score`, {
        onOpen: (event, wsInstance) => {
          console.log("WebSocket connected for match", matchId);
          // Send initial score data to server
          if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(
              JSON.stringify({
                type: "init",
                teamA: initialTeamA,
                teamB: initialTeamB,
              })
            );
          }
        },
        onClose: () => {
          console.log("WebSocket disconnected for match", matchId);
        },
        onError: (error) => {
          console.error("WebSocket error:", error);
        },
        onMessage: (data) => {
          if (data.type === "score_update") {
            setScoreA(data.teamA);
            setScoreB(data.teamB);
            // Update score history for real-time chart updates
            setScoreHistory((prev) => {
              const newRally = prev.length;
              return [
                ...prev,
                {
                  rally: newRally,
                  teamA: data.teamA,
                  teamB: data.teamB,
                },
              ];
            });
            // winRate from WebSocket is the win probability percentage
            if (data.winRate !== undefined && data.winRate !== null) {
              setWinRate(data.winRate);
            }
          } else if (data.type === "match_end") {
            setMatchEnded(true);
            setWinnerTeamId(data.winnerTeamId || null);
            toast.success("Match completed!");
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
    }
  }, [matchData]);

  // Detect score changes and trigger animations
  useEffect(() => {
    if (scoreA !== prevScoreA.current && prevScoreA.current !== 0) {
      setScoreAnimation((prev) => ({ ...prev, teamA: true }));
      setTimeout(
        () => setScoreAnimation((prev) => ({ ...prev, teamA: false })),
        600
      );
    }
    if (scoreB !== prevScoreB.current && prevScoreB.current !== 0) {
      setScoreAnimation((prev) => ({ ...prev, teamB: true }));
      setTimeout(
        () => setScoreAnimation((prev) => ({ ...prev, teamB: false })),
        600
      );
    }
    prevScoreA.current = scoreA;
    prevScoreB.current = scoreB;
  }, [scoreA, scoreB]);

  const handleIncrement = (team) => {
    if (matchEnded) {
      toast.error("Match has ended. Cannot add more points.");
      return;
    }
    if (wsConnectionRef.current) {
      wsConnectionRef.current.send({
        type: "increment",
        team: team,
      });
    }
  };

  // Prepare chart data from scores history (combines DB scores and real-time updates)
  // This hook must be called before any conditional returns
  const chartData = useMemo(() => {
    if (scoreHistory.length > 0) {
      return scoreHistory;
    }
    // Fallback to DB scores if no real-time history yet
    if (!matchData?.scores || matchData.scores.length === 0) {
      return [{ rally: 0, teamA: 0, teamB: 0 }];
    }

    // Sort scores by created_at to ensure chronological order
    const sortedScores = [...matchData.scores].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    // Create data points for the chart
    // Each score update represents a rally/point
    return sortedScores.map((score, index) => ({
      rally: index,
      teamA: score.team_a || 0,
      teamB: score.team_b || 0,
    }));
  }, [scoreHistory, matchData?.scores]);

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!matchData) {
    return <div className="p-4 text-center">Match not found</div>;
  }

  const { players, round, court, match_format, tournament_name } = matchData;

  // Group players into teams
  const teamA = players?.filter((p) => p.team === "A") || [];
  const teamB = players?.filter((p) => p.team === "B") || [];

  // Get team IDs to determine winner
  const teamAId = teamA.length > 0 ? teamA[0]?.team_id : null;
  const teamBId = teamB.length > 0 ? teamB[0]?.team_id : null;
  const winnerTeamIdFromData = matchData?.winner_team_id || winnerTeamId;
  const isTeamAWinner =
    winnerTeamIdFromData &&
    teamAId &&
    String(winnerTeamIdFromData) === String(teamAId);
  const isTeamBWinner =
    winnerTeamIdFromData &&
    teamBId &&
    String(winnerTeamIdFromData) === String(teamBId);

  // Use WebSocket score state
  const currentScore = `${scoreA} - ${scoreB}`;

  // Calculate total sets (assuming best of 3)
  const totalSets = match_format?.total_rounds || 3;

  // Calculate max values for axes
  const maxRally = Math.max(chartData.length - 1, 0);
  const maxScore = Math.max(
    ...chartData.map((d) => Math.max(d.teamA, d.teamB)),
    25
  );

  // Round up to nearest 5 for Y-axis
  const yAxisMax = Math.ceil(maxScore / 5) * 5;
  const xAxisMax = Math.max(Math.ceil(maxRally / 5) * 5, 5);

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-bold">{tournament_name}</h1>
          <Button variant="ghost" size="icon" className="invisible">
            <MoreVertical className="size-5" />
          </Button>
        </div>
      </header>

      {/* Court and Round Info */}
      <div className="px-4 py-2">
        <div className="text-sm text-gray-600">
          <span>COURT {court}</span>
          <span className="mx-2">·</span>
          <span className="text-blue-600">Round {round}</span>
        </div>
      </div>

      {/* Players Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* Team A - Left Column */}
          <motion.div
            className="flex flex-col items-center gap-4"
            animate={{
              scale: scoreAnimation.teamA ? 1.05 : 1,
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {teamA.map((player, index) => (
              <motion.div
                key={player.id}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="relative mb-2">
                  <motion.div
                    className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    whileHover={{
                      scale: 1.1,
                      boxShadow: "0 10px 25px rgba(147, 51, 234, 0.4)",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {player.aura.toFixed(1) || "5.0"}
                  </motion.div>
                </div>
                <motion.p
                  className="text-xs text-gray-600 text-center"
                  whileHover={{ color: "#9333ea" }}
                  transition={{ duration: 0.2 }}
                >
                  {player.name || player.username || "Player"}
                </motion.p>
              </motion.div>
            ))}
          </motion.div>

          {/* Score - Middle Column */}
          <div className="flex flex-col items-center">
            <motion.div
              className="text-center text-3xl font-bold mb-1"
              key={currentScore}
              initial={{ scale: 1 }}
              animate={{
                scale: scoreAnimation.teamA || scoreAnimation.teamB ? 1.2 : 1,
              }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              {currentScore}
            </motion.div>
            {/* Match Completed Indicator */}
            {matchEnded && (
              <motion.div
                className="mt-2 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div className="px-4 py-2 bg-green-100 border-2 border-green-500 rounded-lg">
                  <div className="text-sm font-semibold text-green-800 text-center">
                    🏆 Match Completed
                  </div>
                  {winnerTeamIdFromData && (
                    <div className="text-xs text-green-700 text-center mt-1">
                      {isTeamAWinner
                        ? "Team A Wins!"
                        : isTeamBWinner
                        ? "Team B Wins!"
                        : "Match Finished"}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Team B - Right Column */}
          <motion.div
            className="flex flex-col items-center gap-4"
            animate={{
              scale: scoreAnimation.teamB ? 1.05 : 1,
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {teamB.map((player, index) => (
              <motion.div
                key={player.id}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="relative mb-2">
                  <motion.div
                    className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    whileHover={{
                      scale: 1.1,
                      boxShadow: "0 10px 25px rgba(147, 51, 234, 0.4)",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {player.aura.toFixed(1) || "5.0"}
                  </motion.div>
                </div>
                <motion.p
                  className="text-xs text-gray-600 text-center"
                  whileHover={{ color: "#9333ea" }}
                  transition={{ duration: 0.2 }}
                >
                  {player.name || player.username || "Player"}
                </motion.p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Team Selection Buttons */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={selectedTeam === "A" ? "default" : "outline"}
            size="sm"
            className={
              selectedTeam === "A" ? "bg-purple-600 hover:bg-purple-700" : ""
            }
            onClick={() => setSelectedTeam(selectedTeam === "A" ? null : "A")}
          >
            Team A
          </Button>
          <Button
            variant={selectedTeam === "B" ? "default" : "outline"}
            size="sm"
            className={
              selectedTeam === "B" ? "bg-orange-600 hover:bg-orange-700" : ""
            }
            onClick={() => setSelectedTeam(selectedTeam === "B" ? null : "B")}
          >
            Team B
          </Button>
        </div>
      </div>

      {/* Win Probability - Live from WebSocket */}
      <div className="px-4 py-4">
        <div className="text-sm text-gray-600 mb-2">WIN PROBABILITY</div>
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              selectedTeam === "A"
                ? "bg-purple-600"
                : selectedTeam === "B"
                ? "bg-orange-600"
                : "bg-purple-600"
            }`}
            style={{
              width: `${selectedTeam === "B" ? 100 - winRate : winRate}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span
            className={`font-semibold ${
              selectedTeam === "A"
                ? "text-purple-600"
                : selectedTeam === "B"
                ? "text-gray-400"
                : "text-purple-600"
            }`}
          >
            {winRate.toFixed(1)}%
          </span>
          <span
            className={`font-semibold ${
              selectedTeam === "A"
                ? "text-gray-400"
                : selectedTeam === "B"
                ? "text-orange-600"
                : "text-orange-600"
            }`}
          >
            {(100 - winRate).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Graph Section */}
      <Card className="mx-4 p-4 bg-white">
        <div className="h-64 relative bg-gray-50 rounded">
          <ChartContainer
            config={{
              teamA: {
                label: "Team A",
                color: selectedTeam === "B" ? "#d1d5db" : "#9333ea", // Gray when B selected, Purple otherwise
              },
              teamB: {
                label: "Team B",
                color: selectedTeam === "A" ? "#d1d5db" : "#f97316", // Gray when A selected, Orange otherwise
              },
            }}
            className="size-full"
          >
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                opacity={0.5}
              />
              <XAxis
                dataKey="rally"
                stroke="#9ca3af"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                domain={[0, xAxisMax]}
                ticks={Array.from(
                  { length: Math.floor(xAxisMax / 5) + 1 },
                  (_, i) => i * 5
                )}
              />
              <YAxis
                stroke="#9ca3af"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                domain={[0, 8]}
                ticks={[0, 2, 4, 6, 8]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="bg-white border-gray-200 text-gray-800 shadow-lg"
                    labelFormatter={(value) => `Rally ${value}`}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="teamB"
                stroke={selectedTeam === "A" ? "#d1d5db" : "#f97316"}
                strokeWidth={2}
                dot={false}
                name="teamB"
              />
              <Line
                type="monotone"
                dataKey="teamA"
                stroke={selectedTeam === "B" ? "#d1d5db" : "#9333ea"}
                strokeWidth={2}
                dot={false}
                name="teamA"
              />
            </LineChart>
          </ChartContainer>
        </div>
      </Card>
    </div>
  );
}
