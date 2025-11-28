import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/lib/api';

// Get user details
export function useUser() {
  return useQuery({
    queryKey: ['user', 'details'],
    queryFn: async () => {
      const response = await userApi.getDetails();
      return response.data.data;
    },
  });
}

