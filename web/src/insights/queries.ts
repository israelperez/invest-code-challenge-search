import { useQuery } from '@tanstack/react-query';
import { useSearchBackend } from '../search/search-source-context';

// Dev-only panel: a failed fetch (e.g. 404, insights off) is shown as it is, not retried.
export function useZeroResults() {
  const { api } = useSearchBackend();
  return useQuery({ queryKey: ['insights', 'zero-results'], queryFn: ({ signal }) => api.zeroResults(signal) });
}
