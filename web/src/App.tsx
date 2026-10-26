import { Box, Container, Flex, Heading, useBreakpointValue } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type { OrderBy } from './api/types';
import { AppliedFilters } from './components/AppliedFilters';
import { FilterDrawer } from './components/FilterDrawer';
import { FilterRail } from './components/FilterRail';
import { Results } from './components/Results';
import { SearchForm } from './components/SearchForm';
import { config } from './config';
import type { Filters } from './search/build-search-request';
import { appliedCount } from './search/filter-options';
import { useFacetCounts, useSearchIndex } from './search/queries';
import { useSearchBackend } from './search/search-source-context';

export function App() {
  const { logSearch } = useSearchBackend();
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

  function search(next: string) {
    // Every explicit search is logged, even one superseded before its results land.
    logSearch(next);
    setTerm(next);
    setPending(applied);
  }

  return (
    <Container maxWidth="1030px" paddingX="4" paddingY="8">
      <Heading as="h1" size="2xl" marginBottom="6">
        ASX-listed instrument search
      </Heading>
      <SearchForm onSearch={search} />
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
  );
}

function Rail({ term, pending, onPendingChange }: { term: string; pending: Filters; onPendingChange: (filters: Filters) => void }) {
  return <FilterRail counts={useFacetCounts(term, pending)} pending={pending} onPendingChange={onPendingChange} />;
}
