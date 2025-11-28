"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useTournament } from "@/hooks/useTournament";
import { useTournamentRound } from "@/hooks/useTournamentRound";
import { useTournamentRounds } from "@/hooks/useTournamentRounds";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TournamentStatsHeader } from "@/components/tournaments/TournamentStatsHeader";
import { RoundNavigation } from "@/components/tournaments/RoundNavigation";
import { PairingsTab } from "@/components/tournaments/PairingsTab";
import { LeaderboardTab } from "@/components/tournaments/LeaderboardTab";
import { ScrollablePage, ScrollablePageHeader, ScrollablePageContent } from "@/components/layout/ScrollablePage";

export default function TournamentStatsPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [selectedRound, setSelectedRound] = useState("1");

  const { data: tournament, isLoading: tournamentLoading } = useTournament(
    params.id
  );
  const { data: roundsData, isLoading: roundsLoading } = useTournamentRounds(
    params.id
  );
  const { data: roundData, isLoading: roundLoading } = useTournamentRound(
    params.id,
    selectedRound
  );

  if (tournamentLoading) {
    return (
      <div className="pb-20">
        <div className="p-4 text-center">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="pb-20">
        <div className="p-4 text-center">Tournament not found</div>
      </div>
    );
  }

  const category =
    tournament.match_format?.eligible_gender === "M"
      ? "Men's Doubles"
      : tournament.match_format?.eligible_gender === "W"
      ? "Women's Doubles"
      : "Mixed Doubles";

  const pairings = roundData?.round?.pairings || [];
  const leaderboard = roundData?.round?.leaderboard || [];

  console.log(leaderboard);

  // Group pairings by court
  const pairingsByCourt = pairings.reduce((acc, pairing) => {
    const court = pairing.court || "Unknown";
    if (!acc[court]) acc[court] = [];
    acc[court].push(pairing);
    return acc;
  }, {});

  // Get top 3 and remaining players
  const topThree = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  // Get rounds from API endpoint (parsed from metadata)
  const rounds = roundsData?.rounds || [];
  
  // Fallback: Generate rounds based on total_rounds if API data not available
  const fallbackRounds = [];
  if (rounds.length === 0 && !roundsLoading) {
    const totalRounds = tournament.match_format?.total_rounds || 7;
    // Add numbered rounds (1-4)
    for (let i = 1; i <= Math.min(totalRounds, 4); i++) {
      fallbackRounds.push(String(i));
    }
    // Add special rounds only if they don't conflict with numbered rounds
    if (totalRounds >= 5 && !fallbackRounds.includes("4")) fallbackRounds.push("4");
    if (totalRounds >= 6) fallbackRounds.push("8");
    if (totalRounds >= 7) fallbackRounds.push("16");
  }
  
  const displayRounds = rounds.length > 0 ? rounds : fallbackRounds;

  return (
    <ScrollablePage>
      <ScrollablePageHeader>
        <TournamentStatsHeader
          tournamentName={tournament.name}
          category={category}
        />
        <RoundNavigation
          rounds={displayRounds}
          selectedRound={selectedRound}
          onRoundChange={setSelectedRound}
        />
      </ScrollablePageHeader>

      <ScrollablePageContent>
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full overflow-hidden">
          <TabsList className="w-full p-2 h-auto rounded-none shrink-0 *:data-[slot='tabs-trigger']:font-medium *:data-[slot='tabs-trigger']:text-gray-500 *:data-[slot='tabs-trigger']:py-2 *:data-[slot='tabs-trigger']:data-[state=active]:text-purple-600">
            <TabsTrigger value="pairings">
              Pairings
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <TabsContent value="pairings" className="mt-0">
              <PairingsTab
                pairingsByCourt={pairingsByCourt}
                selectedRound={selectedRound}
                isLoading={roundLoading}
              />
            </TabsContent>
            <TabsContent value="leaderboard" className="mt-0">
              <LeaderboardTab
                topThree={topThree}
                remaining={remaining}
                isLoading={roundLoading}
              />
            </TabsContent>
          </div>
        </Tabs>
      </ScrollablePageContent>
    </ScrollablePage>
  );
}
