import { useQuery } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api';

// Get tournament rounds from metadata
export function useTournamentRounds(id) {
  return useQuery({
    queryKey: ['tournament-rounds', id],
    queryFn: async () => {
      const response = await tournamentsApi.getRounds(id);
      return response.data.data;
    },
    enabled: !!id,
  });
}

