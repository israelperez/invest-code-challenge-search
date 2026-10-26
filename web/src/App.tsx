import { Container, Heading } from '@chakra-ui/react';
import { useState } from 'react';
import { Results } from './components/Results';
import { SearchForm } from './components/SearchForm';
import { useSearchIndex } from './search/queries';

export function App() {
  const [term, setTerm] = useState<string | null>(null);
  const query = useSearchIndex(term === null ? null : { term, filters: {} });

  return (
    <Container maxWidth="4xl" paddingY="8">
      <Heading as="h1" size="2xl" marginBottom="6">
        Instrument search
      </Heading>
      <SearchForm onSearch={setTerm} />
      {term !== null && <Results query={query} />}
    </Container>
  );
}
