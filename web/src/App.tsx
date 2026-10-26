import { Container, Heading } from '@chakra-ui/react';
import { useState } from 'react';
import type { OrderBy } from './api/types';
import { Results } from './components/Results';
import { SearchForm } from './components/SearchForm';
import { useSearchIndex } from './search/queries';

export function App() {
  const [term, setTerm] = useState<string | null>(null);
  // Sort is independent of the term, so a new search keeps it.
  const [orderBy, setOrderBy] = useState<OrderBy>();
  const state = term === null ? null : { term, filters: {}, order_by: orderBy };
  const query = useSearchIndex(state);

  return (
    <Container maxWidth="4xl" paddingY="8">
      <Heading as="h1" size="2xl" marginBottom="6">
        ASX-listed instrument search
      </Heading>
      <SearchForm onSearch={setTerm} />
      {state && <Results state={state} query={query} onSortChange={setOrderBy} />}
    </Container>
  );
}
