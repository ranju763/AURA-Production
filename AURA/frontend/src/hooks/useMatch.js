import { useQuery } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api';

// Get match details
export function useMatch(tournamentId, round, matchId) {
  return useQuery({
    queryKey: ['match', tournamentId, round, matchId],
    queryFn: async () => {
      const response = await tournamentsApi.getMatch(tournamentId, round, matchId);
      return response.data.data;
    },
    enabled: !!tournamentId && !!round && !!matchId,
  });
}

