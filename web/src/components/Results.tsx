import { Alert, Box, Button, Flex, Heading, Skeleton, Text, VisuallyHidden } from '@chakra-ui/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { InstrumentDocument, SearchIndexResponse } from '../api/types';
import { config } from '../config';
import type { SearchState } from '../search/build-search-request';
import { useRestartSearch } from '../search/queries';
import { SnapshotStaleError } from '../search/search-source';
import { useSearchBackend } from '../search/search-source-context';
import { ResultRow } from './ResultRow';

const List = ({ children }: { children: React.ReactNode }) => (
  <Box as="ul" listStyleType="none" margin="0" padding="0">
    {children}
  </Box>
);

const SkeletonRows = () =>
  Array.from({ length: config.skeletonRows }, (_, i) => (
    <Flex as="li" key={i} data-testid="skeleton-row" gap="4" alignItems="center" paddingY="3">
      <Skeleton boxSize="10" flexShrink={0} />
      <Skeleton height="10" flex="1" />
    </Flex>
  ));

export function Results({ state, query }: { state: SearchState; query: UseQueryResult<SearchIndexResponse> }) {
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
          <SkeletonRows />
        </List>
      </Box>
    );
  }

  return <LoadedResults state={state} data={query.data} />;
}

// Load-more progress. It belongs to one first batch (`base`) and starts over when that changes.
type Progress = {
  base: SearchIndexResponse;
  documents: InstrumentDocument[];
  // IDs passed so far, which can exceed documents.length when the API reported some missing.
  consumed: number;
  status: 'idle' | 'loading' | 'error';
  firstNewId: string | null;
};

const startProgress = (base: SearchIndexResponse): Progress => ({
  base,
  documents: base.documents ?? [],
  consumed: base.documents?.length ?? 0,
  status: 'idle',
  firstNewId: null,
});

function LoadedResults({ state, data }: { state: SearchState; data: SearchIndexResponse }) {
  const { source } = useSearchBackend();
  const restart = useRestartSearch(state);
  const [stored, setProgress] = useState(() => startProgress(data));
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstNewRef = useRef<HTMLDivElement>(null);

  // A new first batch (new search, refinement or restart) discards the progress made on the old one.
  const progress = stored.base === data ? stored : startProgress(data);
  if (stored.base !== data) setProgress(progress);

  // Abort the in-flight load more when the first batch changes or the results unmount.
  useEffect(() => () => abortRef.current?.abort(), [data]);
  useEffect(() => firstNewRef.current?.focus({ preventScroll: true }), [progress.firstNewId]);

  const count = data.count ?? 0;
  const { documents } = progress;

  async function loadMore() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    setProgress({ ...progress, status: 'loading' });
    try {
      const batch = await source.loadMore(state, progress.consumed, signal);
      if (signal.aborted) return;
      const shown = documents.length + batch.documents.length;
      setProgress({
        ...progress,
        documents: [...documents, ...batch.documents],
        consumed: batch.consumed,
        status: 'idle',
        firstNewId: batch.documents[0]?.symbol_openfigi ?? null,
      });
      setAnnouncement(`${batch.documents.length} more loaded, showing ${shown} of ${count}`);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof SnapshotStaleError) {
        console.warn('Snapshot is stale, restarting from the first batch');
        try {
          await restart(signal);
          if (signal.aborted) return;
          setAnnouncement('Results were refreshed');
          headingRef.current?.focus();
          return;
        } catch (restartError) {
          if (signal.aborted) return;
          console.error('Restarting after a stale snapshot failed', restartError);
        }
      } else {
        console.error('Loading more results failed', error);
      }
      setProgress({ ...progress, status: 'error' });
    }
  }

  const hasMore = progress.consumed < count;
  return (
    <Box marginTop="6">
      <Heading as="h2" size="md" aria-live="polite" tabIndex={-1} ref={headingRef}>
        {count === 1 ? '1 result' : `${count} results`}
      </Heading>
      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>
      {count === 0 ? (
        <Text marginTop="4" color="fg.muted">
          No instruments match that search. Try a different ticker or name.
        </Text>
      ) : (
        <>
          <List>
            {documents.map((doc) => (
              <ResultRow
                key={doc.symbol_openfigi}
                instrument={doc}
                focusTarget={doc.symbol_openfigi === progress.firstNewId ? firstNewRef : undefined}
              />
            ))}
            {progress.status === 'loading' && <SkeletonRows />}
          </List>
          <Box marginTop="4">
            {progress.status === 'error' ? (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Something went wrong</Alert.Title>
                  <Alert.Description>We could not load more results. Check your connection and try again.</Alert.Description>
                </Alert.Content>
                <Button onClick={() => void loadMore()} minWidth="24">
                  Retry
                </Button>
              </Alert.Root>
            ) : hasMore ? (
              <Button onClick={() => void loadMore()} loading={progress.status === 'loading'} width="40">
                Load more
              </Button>
            ) : (
              count > config.documentLimit + config.orphanSize && <Text color="fg.muted">You have reached the end of the results.</Text>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
