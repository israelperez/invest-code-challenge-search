import { Box, Container, Flex, Heading } from '@chakra-ui/react';
import { useState } from 'react';
import type { OrderBy } from './api/types';
import { FilterRail } from './components/FilterRail';
import { Results } from './components/Results';
import { SearchForm } from './components/SearchForm';
import type { Filters } from './search/build-search-request';
import { useSearchIndex } from './search/queries';

export function App() {
  const [term, setTerm] = useState<string | null>(null);
  // Sort is independent of the term, so a new search keeps it.
  const [orderBy, setOrderBy] = useState<OrderBy>();
  // Ticks edit `pending`; only the button copies them to `applied`, which the results use.
  const [applied, setApplied] = useState<Filters>({});
  const [pending, setPending] = useState<Filters>({});
  const state = term === null ? null : { term, filters: applied, order_by: orderBy };
  const query = useSearchIndex(state);

  function search(next: string) {
    setTerm(next);
    setPending(applied);
  }

  return (
    <Container maxWidth="4xl" paddingY="8">
      <Heading as="h1" size="2xl" marginBottom="6">
        ASX-listed instrument search
      </Heading>
      <SearchForm onSearch={search} />
      {state && (
        <Flex direction={{ base: 'column', md: 'row' }} gap="6" alignItems="stretch">
          <FilterRail term={state.term} applied={applied} pending={pending} onPendingChange={setPending} onApply={() => setApplied(pending)} />
          <Box flex="1" minWidth="0">
            <Results state={state} query={query} onSortChange={setOrderBy} />
          </Box>
        </Flex>
      )}
    </Container>
  );
}
