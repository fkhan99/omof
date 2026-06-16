import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
    },
  },
});

export function clearUserPostQueries(): void {
  queryClient.removeQueries({ queryKey: ['myPosts'] });
  queryClient.removeQueries({ queryKey: ['authorPosts'] });
  queryClient.removeQueries({ queryKey: ['userPosts'] });
  queryClient.removeQueries({ queryKey: ['feed'] });
}
