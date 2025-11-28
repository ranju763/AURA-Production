"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  tournamentsApi,
  playersApi,
  pairingsApi,
  matchesApi,
} from "@/lib/api";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  UserPlus,
  X,
  Search,
  Users,
  Play,
  Clock,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import {
  ScrollablePage,
  ScrollablePageHeader,
  ScrollablePageContent,
} from "@/components/layout/ScrollablePage";
import { toast } from "sonner";

export default function TournamentManagePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", params.id],
    queryFn: async () => {
      const response = await tournamentsApi.getById(params.id);
      return response.data.data;
    },
  });

  const { data: userData, isLoading: isLoadingUser } = useUser();

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["player-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return { players: [] };
      const response = await playersApi.search(searchQuery);
      return response.data.data;
    },
    enabled: searchQuery.length >= 2 && isSearchDialogOpen,
  });

  const addRefereeMutation = useMutation({
    mutationFn: (playerId) => tournamentsApi.addReferee(params.id, playerId),
    onSuccess: () => {
      toast.success("Referee added successfully!");
      setIsSearchDialogOpen(false);
      setSearchQuery("");
      setSelectedPlayer(null);
      queryClient.invalidateQueries({ queryKey: ["tournament", params.id] });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to add referee";
      toast.error(errorMessage);
    },
  });

  const removeRefereeMutation = useMutation({
    mutationFn: (playerId) => tournamentsApi.removeReferee(params.id, playerId),
    onSuccess: () => {
      toast.success("Referee removed successfully!");
      queryClient.invalidateQueries({ queryKey: ["tournament", params.id] });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to remove referee";
      toast.error(errorMessage);
    },
  });

  const { data: roundStatus, isLoading: isLoadingRoundStatus } = useQuery({
    queryKey: ["tournament-round-status", params.id],
    queryFn: async () => {
      const response = await tournamentsApi.getRoundStatus(params.id);
      return response.data.data;
    },
  });

  const generateRoundMutation = useMutation({
    mutationFn: () => pairingsApi.generateRound(parseInt(params.id)),
    onSuccess: () => {
      toast.success("Round started successfully!");
      queryClient.invalidateQueries({
        queryKey: ["tournament-round-status", params.id],
      });
      queryClient.invalidateQueries({ queryKey: ["tournament", params.id] });
      queryClient.invalidateQueries({
        queryKey: ["current-round-matches", params.id],
      });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to start round";
      toast.error(errorMessage);
    },
  });

  const { data: currentRoundMatches, isLoading: isLoadingMatches } = useQuery({
    queryKey: ["current-round-matches", params.id],
    queryFn: async () => {
      const response = await tournamentsApi.getCurrentRoundMatches(params.id);
      return response.data.data;
    },
    enabled: !!roundStatus?.currentRound,
  });

  const assignRefereeMutation = useMutation({
    mutationFn: ({ matchId, refereeId }) =>
      matchesApi.update(matchId, { referee_id: refereeId || null }),
    onSuccess: () => {
      toast.success("Referee assigned successfully!");
      queryClient.invalidateQueries({
        queryKey: ["current-round-matches", params.id],
      });
    },
    onError: (error) => {
      const errorMessage =
        error?.response?.data?.message || "Failed to assign referee";
      toast.error(errorMessage);
    },
  });

  if (isLoading || isLoadingUser) {
    return (
      <ScrollablePage>
        <ScrollablePageHeader>
          <header className="sticky top-0 bg-white border-b z-10">
            <div className="flex items-center justify-between px-4 py-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="size-5" />
              </Button>
              <h1 className="text-lg font-bold">Manage Tournament</h1>
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

  if (!tournament) {
    return (
      <ScrollablePage>
        <ScrollablePageHeader>
          <header className="sticky top-0 bg-white border-b z-10">
            <div className="flex items-center justify-between px-4 py-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="size-5" />
              </Button>
              <h1 className="text-lg font-bold">Manage Tournament</h1>
              <div className="size-10" />
            </div>
          </header>
        </ScrollablePageHeader>
        <ScrollablePageContent>
          <div className="p-4 text-center">Tournament not found</div>
        </ScrollablePageContent>
      </ScrollablePage>
    );
  }

  // Check if user is the host - restrict access if not
  const tournamentId = parseInt(params.id);
  const isHost = userData?.host_for_tournaments?.some(
    (id) => id === tournamentId || id === params.id
  ) || false;

  if (!isHost) {
    return (
      <ScrollablePage>
        <ScrollablePageHeader>
          <header className="sticky top-0 bg-white border-b z-10">
            <div className="flex items-center justify-between px-4 py-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="size-5" />
              </Button>
              <h1 className="text-lg font-bold">Manage Tournament</h1>
              <div className="size-10" />
            </div>
          </header>
        </ScrollablePageHeader>
        <ScrollablePageContent>
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <Card className="p-8 max-w-md w-full text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="size-16 rounded-full bg-red-100 flex items-center justify-center">
                  <ShieldAlert className="size-8 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                  <p className="text-gray-600 text-sm">
                    Only the tournament host can access this page. You don't have permission to manage this tournament.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="mt-4"
                >
                  Go Back
                </Button>
              </div>
            </Card>
          </div>
        </ScrollablePageContent>
      </ScrollablePage>
    );
  }

  const referees = tournament.referee || [];

  return (
    <ScrollablePage>
      <ScrollablePageHeader>
        <header className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-bold">Manage Tournament</h1>
            <div className="size-10" />
          </div>
        </header>
      </ScrollablePageHeader>

      <ScrollablePageContent className="space-y-6">
        {/* Tournament Info */}
        <div className="px-4 pt-4">
          <h2 className="text-2xl font-bold mb-2">{tournament.name}</h2>
          {tournament.description && (
            <p className="text-gray-600 text-sm leading-relaxed">
              {tournament.description}
            </p>
          )}
        </div>

        {/* Round Status Section */}
        <div className="px-4">
          <Card className="p-4 gap-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Clock className="size-5 text-gray-600" />
                Round Status
              </h3>
              {roundStatus?.canStartNextRound && (
                <Button
                  onClick={() => generateRoundMutation.mutate()}
                  disabled={generateRoundMutation.isPending}
                  size="sm"
                  className="gap-2"
                >
                  <Play className="size-4" />
                  {generateRoundMutation.isPending
                    ? "Starting..."
                    : roundStatus?.currentRound === null
                    ? "Start First Round"
                    : roundStatus?.nextRound
                    ? (/^\d+$/.test(roundStatus?.nextRound) 
                        ? `Start Round ${roundStatus?.nextRound}`
                        : `Start ${roundStatus?.nextRound}`)
                    : "Start Next Round"}
                </Button>
              )}
            </div>
            {isLoadingRoundStatus ? (
              <p className="text-gray-500 text-sm">Loading round status...</p>
            ) : (
              <div className="space-y-3">
                {roundStatus?.currentRound === null ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600 text-sm">
                      No rounds have started yet. Click the button above to start
                      the first round.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">Current Round</span>
                      <Badge variant="outline" className="font-semibold">
                        {/^\d+$/.test(roundStatus?.currentRound) 
                          ? `Round ${roundStatus?.currentRound}`
                          : roundStatus?.currentRound || "N/A"}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge
                        variant="outline"
                        className={
                          roundStatus?.isCurrentRoundComplete
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-orange-50 text-orange-700 border-orange-200"
                        }
                      >
                        {roundStatus?.isCurrentRoundComplete
                          ? "Complete"
                          : "In Progress"}
                      </Badge>
                    </div>
                    {roundStatus?.isCurrentRoundComplete && roundStatus?.nextRound && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-600">Next Round</span>
                          <Badge variant="outline" className="font-semibold">
                            {/^\d+$/.test(roundStatus?.nextRound) 
                              ? `Round ${roundStatus?.nextRound}`
                              : roundStatus?.nextRound}
                          </Badge>
                        </div>
                      </>
                    )}
                    {roundStatus?.isCurrentRoundComplete && !roundStatus?.nextRound && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-600">Tournament Status</span>
                          <Badge variant="outline" className="font-semibold bg-green-50 text-green-700 border-green-200">
                            Complete
                          </Badge>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Referees Section */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users className="size-5 text-gray-600" />
              Referees
            </h3>
            <Dialog
              open={isSearchDialogOpen}
              onOpenChange={setIsSearchDialogOpen}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <UserPlus className="size-4" />
                  Add Referee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Referee</DialogTitle>
                  <DialogDescription>
                    Search for a player to add as a referee
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      placeholder="Search by username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {isSearching && (
                    <div className="text-center py-4 text-gray-500">
                      Searching...
                    </div>
                  )}
                  {searchResults?.players &&
                    searchResults.players.length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {searchResults.players.map((player) => (
                          <Card
                            key={player.id}
                            className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setSelectedPlayer(player);
                              addRefereeMutation.mutate(player.id);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {player.photo_url ? (
                                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0" />
                              ) : (
                                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <Users className="size-5 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {player.username}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  {searchQuery.length >= 2 &&
                    !isSearching &&
                    searchResults?.players &&
                    searchResults.players.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        No players found
                      </div>
                    )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSearchDialogOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {referees.length === 0 ? (
            <Card className="p-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Users className="size-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No referees added yet</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {referees.map((referee, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Users className="size-6 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {referee.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500">Referee</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          confirm(
                            `Are you sure you want to remove ${referee.name} as a referee?`
                          )
                        ) {
                          removeRefereeMutation.mutate(referee.player_id);
                        }
                      }}
                      disabled={removeRefereeMutation.isPending}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="size-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Current Round Matches Section */}
        {roundStatus?.currentRound && (
          <div className="px-4 pb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
              <Trophy className="size-5 text-gray-600" />
              {/^\d+$/.test(roundStatus?.currentRound) 
                ? `Round ${roundStatus?.currentRound} Matches`
                : `${roundStatus?.currentRound} Matches`}
            </h3>
            {isLoadingMatches ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500">Loading matches...</p>
              </Card>
            ) : currentRoundMatches?.matches?.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Trophy className="size-8 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    No matches found for this round
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {currentRoundMatches?.matches?.map((match) => (
                  <Card key={match.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Match {match.id}</p>
                          {match.court && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Court {match.court}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            match.status === "completed"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : match.status === "in_progress"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {match.status?.replace("_", " ") || "pending"}
                        </Badge>
                      </div>

                      {/* Players */}
                      {match.players && match.players.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs text-gray-500 mb-2 font-medium">
                              Players
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {match.players.map((player, idx) => {
                                const isWinner = match.winner_players?.some(
                                  (wp) => wp.id === player.id
                                );
                                return (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className={`text-xs ${
                                      isWinner
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-300 font-semibold"
                                        : "bg-gray-50"
                                    }`}
                                  >
                                    {player.username}
                                    {isWinner && (
                                      <Trophy className="size-3 ml-1" />
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Winner Display */}
                      {match.status === "completed" &&
                        match.winner_players &&
                        match.winner_players.length > 0 && (
                          <>
                            <Separator />
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                              <div className="flex items-center gap-2">
                                <Trophy className="size-4 text-yellow-600" />
                                <div>
                                  <p className="text-xs text-yellow-700 font-medium mb-1">
                                    Winner
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {match.winner_players.map((winner, idx) => (
                                      <span
                                        key={idx}
                                        className="text-sm font-semibold text-yellow-800"
                                      >
                                        {winner.username}
                                        {idx < match.winner_players.length - 1 && (
                                          <span className="mx-1">&</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                      {/* Referee Assignment */}
                      <Separator />
                      <div>
                        <label className="text-xs text-gray-500 mb-2 block font-medium">
                          Assign Referee
                        </label>
                        <select
                          value={match.referee_id || ""}
                          onChange={(e) => {
                            const refereeId = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            assignRefereeMutation.mutate({
                              matchId: match.id,
                              refereeId,
                            });
                          }}
                          disabled={assignRefereeMutation.isPending}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">No Referee</option>
                          {referees.map((referee) => (
                            <option
                              key={referee.player_id}
                              value={referee.player_id}
                            >
                              {referee.name || `Referee ${referee.player_id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollablePageContent>
    </ScrollablePage>
  );
}
