"use client";

import { useState, useMemo } from "react";
import { useTournaments } from "@/hooks/useTournaments";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Menu, Users, Activity } from "lucide-react";
import { ScrollablePage, ScrollablePageHeader, ScrollablePageContent } from "@/components/layout/ScrollablePage";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  const { data: tournamentsData, isLoading, error } = useTournaments(filters);

  const allTournaments = tournamentsData?.tournaments || [];

  // Helper function to check if tournament is live
  const isTournamentLive = (tournament) => {
    if (!tournament.start_date || !tournament.end_date) return false;
    const now = new Date();
    const startTime = new Date(tournament.start_date);
    const endTime = new Date(tournament.end_date);
    return now >= startTime && now <= endTime;
  };

  // Filter tournaments based on live filter and search query
  const tournaments = useMemo(() => {
    let filtered = allTournaments;

    // Apply live filter
    if (showLiveOnly) {
      filtered = filtered.filter(isTournamentLive);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tournament) =>
        tournament.name?.toLowerCase().includes(query) ||
        tournament.venue?.name?.toLowerCase().includes(query) ||
        tournament.venue?.address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allTournaments, showLiveOnly, searchQuery]);

  const handleFilterClick = (gender) => {
    setFilters((prev) => ({
      ...prev,
      eligible_gender: prev.eligible_gender === gender ? undefined : gender,
    }));
  };

  return (
    <ScrollablePage>
      <ScrollablePageHeader className="mb-4">
        {/* Header */}
        <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-center px-4 py-3">
            <h1 className="text-lg font-bold">Tournaments</h1>
            <div className="w-6" /> {/* Spacer */}
          </div>
        </header>

        {/* Search Bar */}
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="p-2 bg-white border-b border-gray-200">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleFilterClick("male")}
              variant={filters.eligible_gender === "male" ? "default" : "outline"}
            >
              <Users className="size-4 mr-1" />
              MD
            </Button>
            <Button
              variant={
                filters.eligible_gender === "female" ? "default" : "outline"
              }
              size="sm"
              onClick={() => handleFilterClick("female")}
            >
              <Users className="size-4 mr-1" />
              WD
            </Button>
            <Button
              variant={showLiveOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowLiveOnly(!showLiveOnly)}
            >
              <Activity className="size-4 mr-1" />
              Live
            </Button>
          </div>
        </div>
      </ScrollablePageHeader>

      <ScrollablePageContent className="px-4">
        {/* Tournament List */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500">
            Loading tournaments...
          </div>
        )}
        {error && (
          <div className="text-center py-8 text-red-500">
            Error loading tournaments
          </div>
        )}
        {!isLoading && !error && tournaments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No tournaments found
          </div>
        )}
        {tournaments.map((tournament, index) => (
          <TournamentCard key={tournament.id} tournament={tournament} index={index} />
        ))}
      </ScrollablePageContent>
    </ScrollablePage>
  );
}
