import { QueryClient } from '@tanstack/react-query';

// No query retries: the API client's request() is the only retry layer, so attempts never multiply.
export const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
