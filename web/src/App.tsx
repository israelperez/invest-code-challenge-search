import { Box, Container, Flex, Heading, useBreakpointValue } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type { SearchTrigger } from './analytics/analytics';
import type { OrderBy } from './api/types';
import { AppliedFilters } from './components/AppliedFilters';
import { FilterDrawer } from './components/FilterDrawer';
import { FilterRail } from './components/FilterRail';
import { Header } from './components/Header';
import { Results } from './components/Results';
import { SearchForm } from './components/SearchForm';
import { config } from './config';
import { buildSearchRequest, type Filters } from './search/build-search-request';
import { appliedCount } from './search/filter-options';
import { useFacetCounts, useSearchIndex } from './search/queries';
import { useSearchBackend } from './search/search-source-context';

export function App() {
  const { logSearch, recent, analytics } = useSearchBackend();
  const [term, setTerm] = useState<string | null>(null);
  // Sort is independent of the term, so a new search keeps it.
  const [orderBy, setOrderBy] = useState<OrderBy>();
  // Ticks edit `pending`; `applied` is what the results use. Beside the results (tablet and up) it follows
  // `pending` after the debounce; on mobile only the button copies it.
  const [applied, setApplied] = useState<Filters>({});
  const [pending, setPending] = useState<Filters>({});
  // shortcut: cast because Chakra's generated breakpoint names still say sm..2xl here, switch to `chakra typegen` if more hooks need them.
  const live = useBreakpointValue({ base: false, tablet: true } as Parameters<typeof useBreakpointValue<boolean>>[0], { ssr: false }) ?? false;
  // Ticks left pending in the drawer are discarded when the viewport grows into live mode, not applied.
  useEffect(() => {
    if (live) setPending(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a change of `live` resets
  }, [live]);
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => setApplied(pending), config.countsDebounceMs);
    return () => clearTimeout(timer);
  }, [live, pending]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const state = term === null ? null : { term, filters: applied, order_by: orderBy };
  const query = useSearchIndex(state);
  // The search awaiting its first response, bound to the exact request it sent; a new object per search, so repeating a term re-arms it.
  const [submission, setSubmission] = useState<{ term: string; request: string } | null>(null);
  const request = state && JSON.stringify(buildSearchRequest(state));
  // A recent search is saved when its first response has results. A failed or superseded search is dropped, and so is one
  // refined before its response lands (the response then belongs to the refinement), so refinements never re-add it or count as a search.
  useEffect(() => {
    if (!submission) return;
    if (submission.request !== request || query.isError) return setSubmission(null);
    if (!query.data || query.isPlaceholderData) return;
    if ((query.data.count ?? 0) > 0) recent?.add(submission.term);
    else analytics.track('search_zero_results', { term: submission.term });
    setSubmission(null);
  }, [submission, request, query.data, query.isError, query.isPlaceholderData, recent, analytics]);

  function search(next: string, source: SearchTrigger) {
    // Every explicit search is logged, even one superseded before its results land.
    logSearch(next);
    analytics.track('search_submitted', { term: next, source });
    setTerm(next);
    setSubmission({ term: next, request: JSON.stringify(buildSearchRequest({ term: next, filters: {}, order_by: orderBy })) });
    // A new term starts unfiltered, since the issuer and units options depend on it; the sort carries over.
    setApplied({});
    setPending({});
  }

  return (
    <>
    <Header />
    <Container maxWidth="1030px" paddingX="4" paddingY="8">
      <Heading as="h1" size="2xl" marginBottom="6">
        ASX-listed instrument search
      </Heading>
      <SearchForm onSearch={search} showPopular={term === null} />
      {state && (
        <Flex gap="6" alignItems="flex-start">
          {live && <Rail term={state.term} pending={pending} onPendingChange={setPending} />}
          <Box flex="1" minWidth="0">
            <Results
              state={state}
              query={query}
              onSortChange={setOrderBy}
              headingRef={headingRef}
              appliedFilters={
                appliedCount(applied) > 0 && (
                  <AppliedFilters
                    term={state.term}
                    applied={applied}
                    onChange={(filters) => {
                      setApplied(filters);
                      setPending(filters);
                    }}
                    headingRef={headingRef}
                  />
                )
              }
              filtersButton={
                live ? undefined : (
                  <FilterDrawer
                    term={state.term}
                    applied={applied}
                    pending={pending}
                    onPendingChange={setPending}
                    onApply={() => setApplied(pending)}
                    onDiscard={() => setPending(applied)}
                  />
                )
              }
            />
          </Box>
        </Flex>
      )}
    </Container>
    </>
  );
}

function Rail({ term, pending, onPendingChange }: { term: string; pending: Filters; onPendingChange: (filters: Filters) => void }) {
  return <FilterRail counts={useFacetCounts(term, pending)} pending={pending} onPendingChange={onPendingChange} />;
}
