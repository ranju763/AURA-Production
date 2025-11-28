"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { tournamentsApi, matchesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { ArrowLeft, Plus } from "lucide-react";
import {
  ScrollablePage,
  ScrollablePageHeader,
  ScrollablePageContent,
} from "@/components/layout/ScrollablePage";

export default function HostedTournamentsPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["hosted-tournaments"],
    queryFn: async () => {
      const response = await tournamentsApi.getHosted();
      return response.data.data;
    },
  });

  // Fetch referee matches
  const { data: refereeMatchesData, isLoading: isLoadingRefereeMatches } = useQuery({
    queryKey: ["referee-matches"],
    queryFn: async () => {
      const response = await matchesApi.getRefereeMatches();
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <ScrollablePage>
        <ScrollablePageHeader>
          <header className="sticky top-0 bg-white border-b z-10">
            <div className="flex items-center justify-between px-4 py-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="size-5" />
              </Button>
              <h1 className="text-lg font-bold">My Tournaments</h1>
              <div className="size-10" />
            </div>
          </header>
        </ScrollablePageHeader>
        <ScrollablePageContent>
          <div className="p-4 text-center">Loading...</div>
        </ScrollablePageContent>
      </ScrollablePage>
    );
  }

  const tournaments = data?.tournaments || [];
  const allMatches = refereeMatchesData?.matches || [];
  
  // Filter matches by status
  const activeMatches = allMatches.filter(
    (match) => match.status === "in_progress" || match.status === "scheduled"
  );
  const completedMatches = allMatches.filter(
    (match) => match.status === "completed"
  );

  // Helper function to render a match card
  const renderMatchCard = (match) => {
    // Group players by team_id
    const teams = {};
    if (match.players && match.players.length > 0) {
      match.players.forEach((player) => {
        if (!teams[player.team_id]) {
          teams[player.team_id] = [];
        }
        teams[player.team_id].push(player);
      });
    }
    const teamIds = Object.keys(teams);
    const teamA = teamIds.length > 0 ? teams[teamIds[0]] : [];
    const teamB = teamIds.length > 1 ? teams[teamIds[1]] : [];

    return (
      <div
        key={match.id}
        className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
        onClick={() =>
          router.push(
            `/tournaments/referee/${match.tournament_id}/${match.round}/${match.id}`
          )
        }
      >
        {/* Header */}
        <div className="p-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {match.tournament && (
                <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                  {match.tournament.name}
                </h3>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Round {match.round}</span>
                {match.court && (
                  <>
                    <span>·</span>
                    <span>Court {match.court}</span>
                  </>
                )}
              </div>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                match.status === "in_progress"
                  ? "bg-green-100 text-green-700"
                  : match.status === "completed"
                  ? "bg-gray-100 text-gray-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {match.status === "in_progress"
                ? "LIVE"
                : match.status === "completed"
                ? "COMPLETED"
                : "SCHEDULED"}
            </span>
          </div>
        </div>

        {/* Teams & Score */}
        <div className="p-4">
          {(teamA.length > 0 || teamB.length > 0) && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Team A */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Team A
                </div>
                <div className="space-y-1">
                  {teamA.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="size-6 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-purple-700">
                          {p.username?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900 truncate">
                        {p.username || "Player"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team B */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Team B
                </div>
                <div className="space-y-1">
                  {teamB.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="size-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700">
                          {p.username?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900 truncate">
                        {p.username || "Player"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Score Display */}
          {match.scores && (
            <div className="flex items-center justify-center gap-4 pt-3 border-t border-gray-100">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {match.scores.teamA}
                </div>
                <div className="text-xs text-gray-500 mt-1">Team A</div>
              </div>
              <div className="text-xl text-gray-300 font-light">-</div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {match.scores.teamB}
                </div>
                <div className="text-xs text-gray-500 mt-1">Team B</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ScrollablePage>
      <ScrollablePageHeader>
        <header className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-bold">My Tournaments</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/tournaments/new")}
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </header>
      </ScrollablePageHeader>

      <ScrollablePageContent className="p-4">
        {/* Active Referee Matches Section (in_progress and scheduled only) */}
        {isLoadingRefereeMatches ? (
          <div className="mb-8 text-sm text-gray-500 text-center py-4">Loading matches...</div>
        ) : activeMatches.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Referee Matches</h2>
            <div className="space-y-3">
              {activeMatches.map(renderMatchCard)}
            </div>
          </div>
        ) : null}

        {/* Hosted Tournaments Section */}
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">My Tournaments</h2>
          {tournaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">You haven't hosted any tournaments yet.</p>
              {/* <Button onClick={() => router.push("/tournaments/new")}>
                Create Tournament
              </Button> */}
            </div>
          ) : (
            <div>
              {tournaments.map((tournament, index) => (
                <div
                  key={tournament.id}
                  onClick={() => router.push(`/tournaments/${tournament.id}/manage`)}
                >
                  <TournamentCard tournament={tournament} index={index} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Referee Matches Section */}
        {!isLoadingRefereeMatches && completedMatches.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Completed Matches</h2>
            <div className="space-y-3">
              {completedMatches.map(renderMatchCard)}
            </div>
          </div>
        )}
      </ScrollablePageContent>
    </ScrollablePage>
  );
}

