import { useQuery } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api';

// Get tournament round details (pairings and leaderboard)
export function useTournamentRound(tournamentId, round) {
  return useQuery({
    queryKey: ['tournament-round', tournamentId, round],
    queryFn: async () => {
      const response = await tournamentsApi.getRound(tournamentId, round);
      return response.data.data;
    },
    enabled: !!tournamentId && !!round,
  });
}

