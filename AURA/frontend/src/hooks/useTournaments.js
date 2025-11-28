import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api';

// Get all tournaments with optional filters
export function useTournaments(filters = {}) {
  return useQuery({
    queryKey: ['tournaments', filters],
    queryFn: async () => {
      const response = await tournamentsApi.getAll(filters);
      return response.data.data;
    },
  });
}

// Join tournament as referee
export function useJoinTournament() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tournamentId) => {
      const response = await tournamentsApi.joinAsReferee(tournamentId);
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate tournaments query to refetch
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

