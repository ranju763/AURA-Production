"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/contexts/AuthContext";
import { tournamentsApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { ScrollablePage, ScrollablePageHeader, ScrollablePageContent } from "@/components/layout/ScrollablePage";

export default function ProfilePage() {
  const router = useRouter();
  const { data: userData, isLoading } = useUser();
  const { signOut } = useAuth();
  
  // Fetch referee tournaments
  const { data: refereeData, isLoading: isLoadingReferee } = useQuery({
    queryKey: ["referee-tournaments"],
    queryFn: async () => {
      const response = await tournamentsApi.getReferee();
      return response.data.data;
    },
  });

  // Fetch registered tournaments
  const { data: registeredData, isLoading: isLoadingRegistered } = useQuery({
    queryKey: ["registered-tournaments"],
    queryFn: async () => {
      const response = await tournamentsApi.getRegistered();
      return response.data.data;
    },
  });

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!userData) {
    return <div className="p-4 text-center">User not found</div>;
  }

  const { name, username, aura, age, gender, photo_url, tournaments } = userData;
  console.log(tournaments);

  // Helper function to check if tournament is live (started but not ended)
  const isTournamentLive = (tournament) => {
    if (!tournament.start_date || !tournament.end_date) return false;
    const now = new Date();
    const startTime = new Date(tournament.start_date);
    const endTime = new Date(tournament.end_date);
    return now >= startTime && now <= endTime;
  };

  // Filter tournaments by status (matches user is playing in)
  const liveMatches = tournaments?.filter((t) => t.status === "live") || [];
  const pastMatches = tournaments?.filter((t) => t.status !== "live") || [];
  
  // Get all referee tournaments
  const allRefereeTournaments = refereeData?.tournaments || [];
  
  // Get all registered tournaments
  const allRegisteredTournaments = registeredData?.tournaments || [];
  
  // Filter live tournaments (registered or referee)
  const liveRegisteredTournaments = allRegisteredTournaments.filter(isTournamentLive);
  const liveRefereeTournaments = allRefereeTournaments.filter(isTournamentLive);
  
  // Combine and deduplicate live tournaments (user might be both registered and referee)
  const liveTournamentMap = new Map();
  [...liveRegisteredTournaments, ...liveRefereeTournaments].forEach((tournament) => {
    if (!liveTournamentMap.has(tournament.id)) {
      liveTournamentMap.set(tournament.id, tournament);
    }
  });
  const liveTournamentsList = Array.from(liveTournamentMap.values());

  return (
    <ScrollablePage>
      <ScrollablePageHeader>
        <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-bold">My AURA</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-gray-700 hover:text-gray-900"
            >
              Logout
            </Button>
          </div>
        </header>
      </ScrollablePageHeader>

      <ScrollablePageContent>

      {/* Profile Section */}
      <div className="flex flex-col items-center py-6">
        {photo_url ? (
          <img
            src={photo_url}
            alt={name || username || "Profile"}
            className="size-24 rounded-full object-cover border-2 border-purple-200 mb-3"
          />
        ) : (
          <div className="size-24 bg-purple-200 rounded-full mb-3 flex items-center justify-center">
            <span className="text-2xl font-bold text-purple-600">
              {(name || username || "U")[0].toUpperCase()}
            </span>
          </div>
        )}
        <h2 className="text-xl font-bold capitalize">{name || username}</h2>
        <p className="text-sm text-gray-600 capitalize">
          {gender || "Other"} · {age} years
        </p>

        {/* Doubles Rating Card */}
        <Card className="mt-4 px-6 py-4 bg-purple-600 text-white">
          <div className="text-center">
            <div className="text-sm mb-1">DOUBLES</div>
            <div className="text-4xl font-bold">
              {aura ? aura.toFixed(2) : "0.00"}
            </div>
          </div>
        </Card>
      </div>

      {/* Tournaments Section */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">TOURNAMENTS</h3>
        </div>

        <Tabs defaultValue="live" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="live">LIVE</TabsTrigger>
            <TabsTrigger value="past">PAST</TabsTrigger>
            <TabsTrigger value="referee">REFEREE</TabsTrigger>
          </TabsList>

          {/* Live Tournaments Tab */}
          <TabsContent value="live" className="space-y-3 mt-0">
            {/* Live Matches (matches user is playing in) */}
            {liveMatches.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Live Matches</h4>
                {liveMatches.map((tournament) => (
                  <Card key={tournament.match_id} className="p-4 mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">
                          {tournament.round} · Court {tournament.court} ·{" "}
                          {tournament.status === "won" ? "Won" : "Lost"} ·{" "}
                          {tournament.round && format(new Date(), "dd MMM yyyy")}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-xs text-green-600 font-semibold">
                            LIVE
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {tournament.players?.slice(0, 2).map((player, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="size-8 bg-purple-200 rounded-full" />
                            <span className="text-sm">
                              {player.name || player.username || "Player"}
                            </span>
                          </div>
                          <div className="flex gap-2 text-sm">
                            <span
                              className={
                                idx === 0 &&
                                tournament.scores?.teamA >
                                  tournament.scores?.teamB
                                  ? "text-green-600 font-semibold"
                                  : ""
                              }
                            >
                              {tournament.scores?.teamA || 0}
                            </span>
                            <span
                              className={
                                idx === 1 &&
                                tournament.scores?.teamB >
                                  tournament.scores?.teamA
                                  ? "text-green-600 font-semibold"
                                  : ""
                              }
                            >
                              {tournament.scores?.teamB || 0}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Live Tournaments (registered or referee) */}
            {isLoadingRegistered || isLoadingReferee ? (
              <div className="text-center py-8 text-gray-500">
                <p>Loading tournaments...</p>
              </div>
            ) : liveTournamentsList.length > 0 ? (
              <div>
                {liveMatches.length > 0 && (
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Live Tournaments</h4>
                )}
                {liveTournamentsList.map((tournament, index) => (
                  <div
                    key={tournament.id}
                    onClick={() => router.push(`/tournaments/${tournament.id}/stats`)}
                    className="mb-3"
                  >
                    <TournamentCard tournament={tournament} index={index} />
                  </div>
                ))}
              </div>
            ) : liveMatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No live tournaments</p>
              </div>
            ) : null}
          </TabsContent>

          {/* Past Tournaments Tab */}
          <TabsContent value="past" className="space-y-3 mt-0">
            {pastMatches.length > 0 ? (
              pastMatches.map((tournament) => (
                <Card key={tournament.match_id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-1">
                        {tournament.round} · Court {tournament.court} ·{" "}
                        {tournament.status === "won" ? "Won" : "Lost"} ·{" "}
                        {tournament.round && format(new Date(), "dd MMM yyyy")}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {tournament.players?.slice(0, 2).map((player, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="size-8 bg-purple-200 rounded-full" />
                          <span className="text-sm">
                            {player.name || player.username || "Player"}
                          </span>
                        </div>
                        <div className="flex gap-2 text-sm">
                          <span
                            className={
                              idx === 0 &&
                              tournament.scores?.teamA >
                                tournament.scores?.teamB
                                ? "text-green-600 font-semibold"
                                : ""
                            }
                          >
                            {tournament.scores?.teamA || 0}
                          </span>
                          <span
                            className={
                              idx === 1 &&
                              tournament.scores?.teamB >
                                tournament.scores?.teamA
                                ? "text-green-600 font-semibold"
                                : ""
                            }
                          >
                            {tournament.scores?.teamB || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No past tournaments</p>
              </div>
            )}
          </TabsContent>

          {/* Referee Tournaments Tab */}
          <TabsContent value="referee" className="space-y-3 mt-0">
            {isLoadingReferee ? (
              <div className="text-center py-8 text-gray-500">
                <p>Loading referee tournaments...</p>
              </div>
            ) : allRefereeTournaments.length > 0 ? (
              allRefereeTournaments.map((tournament, index) => (
                <div
                  key={tournament.id}
                  onClick={() => router.push(`/tournaments/${tournament.id}`)}
                >
                  <TournamentCard tournament={tournament} index={index} />
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No referee tournaments</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      </ScrollablePageContent>
    </ScrollablePage>
  );
}
