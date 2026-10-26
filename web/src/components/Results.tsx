import { Alert, Box, Button, Flex, Heading, Skeleton, Text } from '@chakra-ui/react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SearchIndexResponse } from '../api/types';
import { config } from '../config';
import { ResultRow } from './ResultRow';

const List = ({ children }: { children: React.ReactNode }) => (
  <Box as="ul" listStyleType="none" margin="0" padding="0">
    {children}
  </Box>
);

export function Results({ query }: { query: UseQueryResult<SearchIndexResponse> }) {
  if (query.isError) {
    return (
      <Alert.Root status="error" marginTop="6">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Something went wrong</Alert.Title>
          <Alert.Description>We could not load results. Check your connection and try again.</Alert.Description>
        </Alert.Content>
        <Button onClick={() => void query.refetch()} minWidth="24">
          Retry
        </Button>
      </Alert.Root>
    );
  }

  if (query.isPending) {
    return (
      <Box marginTop="6" aria-busy="true" aria-label="Loading results">
        <List>
          {Array.from({ length: config.skeletonRows }, (_, i) => (
            <Flex as="li" key={i} gap="4" alignItems="center" paddingY="3">
              <Skeleton boxSize="10" flexShrink={0} />
              <Skeleton height="10" flex="1" />
            </Flex>
          ))}
        </List>
      </Box>
    );
  }

  const count = query.data.count ?? 0;
  const documents = query.data.documents ?? [];
  return (
    <Box marginTop="6">
      <Heading as="h2" size="md" aria-live="polite">
        {count === 1 ? '1 result' : `${count} results`}
      </Heading>
      {count === 0 ? (
        <Text marginTop="4" color="fg.muted">
          No instruments match that search. Try a different ticker or name.
        </Text>
      ) : (
        <List>
          {documents.map((doc) => (
            <ResultRow key={doc.symbol_openfigi} instrument={doc} />
          ))}
        </List>
      )}
    </Box>
  );
}
