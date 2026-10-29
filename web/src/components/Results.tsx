import { Box, Button, Field, Flex, Heading, NativeSelect, Skeleton, Text, VisuallyHidden } from '@chakra-ui/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { InstrumentDocument, OrderBy, SearchIndexResponse } from '../api/types';
import { config } from '../config';
import { buildSearchRequest, type SearchState } from '../search/build-search-request';
import { useRestartSearch } from '../search/queries';
import { SnapshotStaleError } from '../search/search-source';
import { useSearchBackend } from '../search/search-source-context';
import { useRetry } from '../search/use-retry';
import { MajorFailure } from './MajorFailure';
import { ResultRow } from './ResultRow';

const List = ({ children }: { children: React.ReactNode }) => (
  <Box as="ul" listStyleType="none" margin="0" marginTop="4" paddingTop="6" paddingX={{ base: '4', desktop: '8' }} bg="results" rounded={{ base: 'card', desktop: 'cardLarge' }}>
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

// Best match is the API default, so it has no order_by.
const SORT_OPTIONS: { label: string; value: OrderBy | undefined }[] = [
  { label: 'Best match', value: undefined },
  { label: 'ASX code (ticker) A – Z', value: 'symbol.asc' },
  { label: 'ASX code (ticker) Z – A', value: 'symbol.desc' },
  { label: 'Investment name A – Z', value: 'display_name.asc' },
  { label: 'Investment name Z – A', value: 'display_name.desc' },
  { label: 'Shares issued high – low', value: 'units_circulating.desc' },
  { label: 'Shares issued low – high', value: 'units_circulating.asc' },
];

export function Results({
  state,
  query,
  onSortChange,
  filtersButton,
  appliedFilters,
  headingRef,
}: {
  state: SearchState;
  query: UseQueryResult<SearchIndexResponse>;
  onSortChange: (orderBy: OrderBy | undefined) => void;
  // The mobile drawer trigger, beside the sort.
  filtersButton?: React.ReactNode;
  // The applied-filter chips, between the header and the list.
  appliedFilters?: React.ReactNode;
  // Owned by App so the chips can move focus here when the last one goes.
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const count = query.data?.count ?? 0;
  const { retrying, retry } = useRetry(() => query.refetch(), JSON.stringify(buildSearchRequest(state)));

  // The header stays mounted through error, loading and loaded, so the select keeps focus and never moves.
  return (
    <Box marginTop="6">
      <Flex justifyContent="space-between" alignItems="center" gap="3" wrap="wrap">
        {filtersButton}
        {/* Always present, so wrapping depends on container width alone, not on whether the heading has loaded. On mobile it sits under the filters and sort row. */}
        <Box minWidth="40" minHeight="8" display="flex" alignItems="center" order={{ base: 1, tablet: 0 }} flexBasis={{ base: 'full', tablet: 'auto' }}>
          {query.data && (
            <Heading as="h2" size="md" aria-live="polite" tabIndex={-1} ref={headingRef}>
              {count === 1 ? '1 result' : `${count} results`}
            </Heading>
          )}
        </Box>
        <Field.Root orientation="horizontal" width="auto" minWidth="0" maxWidth="full" flex={{ base: '1', tablet: 'none' }} marginStart={{ tablet: 'auto' }}>
          {/* Still the select's accessible name on mobile, where the row has no room for it. */}
          <Field.Label flex="none" whiteSpace="nowrap" srOnly={{ base: true, tablet: false }}>
            Sort by
          </Field.Label>
          {/* Fixed width, sized for the longest label, so the select never resizes with the chosen option. */}
          <NativeSelect.Root width={{ base: 'full', tablet: '72' }} maxWidth="full">
            <NativeSelect.Field value={state.order_by ?? ''} onChange={(e) => onSortChange((e.target.value || undefined) as OrderBy | undefined)}>
              {SORT_OPTIONS.map(({ label, value }) => (
                <option key={label} value={value ?? ''}>
                  {label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Flex>
      {appliedFilters}
      {query.isError || retrying ? (
        <Box marginTop="6">
          <MajorFailure retrying={retrying} onRetry={() => void retry()} />
        </Box>
      ) : query.isPending ? (
        <Box aria-busy="true" aria-label="Loading results">
          <List>
            <SkeletonRows />
          </List>
        </Box>
      ) : (
        <LoadedResults state={state} data={query.data} stale={query.isPlaceholderData} headingRef={headingRef} />
      )}
    </Box>
  );
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

function LoadedResults({
  state,
  data,
  stale,
  headingRef,
}: {
  state: SearchState;
  data: SearchIndexResponse;
  // `data` belongs to the previous filters and the new ones are loading.
  stale: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { source, report } = useSearchBackend();
  const restart = useRestartSearch(state);
  const [stored, setProgress] = useState(() => startProgress(data));
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const firstNewRef = useRef<HTMLDivElement>(null);
  const { retrying, retry } = useRetry(() => loadMore(), data);

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
    // A Retry keeps the message mounted (its button spins), so only a fresh load more starts the skeleton rows.
    if (progress.status !== 'error') setProgress({ ...progress, status: 'loading' });
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
        report('snapshot_stale', { level: 'warn', message: 'Snapshot is stale, restarting from the first batch' });
        try {
          await restart(signal);
          if (signal.aborted) return;
          setAnnouncement('Results were refreshed');
          headingRef.current?.focus();
          return;
        } catch {
          if (signal.aborted) return;
        }
      }
      setProgress({ ...progress, status: 'error' });
    }
  }

  const hasMore = progress.consumed < count;
  return (
    <Box opacity={stale ? '0.6' : undefined} aria-busy={stale || undefined}>
      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>
      {count === 0 ? (
        <Text marginTop="4" color="fg.muted">
          No shares or ETFs match that search. Try a different ticker or name.
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
              <MajorFailure retrying={retrying} onRetry={() => void retry()} />
            ) : hasMore ? (
              <Button onClick={() => void loadMore()} loading={progress.status === 'loading'} disabled={stale} width="40">
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
