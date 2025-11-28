import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api';

// Get referee match details
export function useRefereeMatch(tournamentId, round, matchId) {
  return useQuery({
    queryKey: ['referee-match', tournamentId, round, matchId],
    queryFn: async () => {
      const response = await tournamentsApi.getRefereeMatch(tournamentId, round, matchId);
      return response.data.data;
    },
    enabled: !!tournamentId && !!round && !!matchId,
  });
}

// Update referee match score
export function useUpdateRefereeMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tournamentId, round, matchId, data }) => {
      const response = await tournamentsApi.updateRefereeMatch(tournamentId, round, matchId, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate referee match query
      queryClient.invalidateQueries({
        queryKey: ['referee-match', variables.tournamentId, variables.round, variables.matchId],
      });
    },
  });
}

