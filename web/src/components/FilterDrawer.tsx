import { Button, CloseButton, Drawer, Portal } from '@chakra-ui/react';
import { useState } from 'react';
import type { Filters } from '../search/build-search-request';
import { appliedCount, applyLabel } from '../search/filter-options';
import { useFacetCounts } from '../search/queries';
import { FilterPanel } from './FilterRail';

// Below the tablet breakpoint. Ticks stay pending until "Show N results"; closing any other way discards them.
export function FilterDrawer({
  term,
  applied,
  pending,
  onPendingChange,
  onApply,
  onDiscard,
}: {
  term: string;
  applied: Filters;
  pending: Filters;
  onPendingChange: (filters: Filters) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [open, setOpen] = useState(false);
  const counts = useFacetCounts(term, pending);
  const selected = appliedCount(applied);

  return (
    <Drawer.Root
      open={open}
      placement="start"
      lazyMount
      unmountOnExit
      onOpenChange={({ open: next }) => {
        setOpen(next);
        if (!next) onDiscard();
      }}
    >
      <Drawer.Trigger asChild>
        {/* Fixed width, so the label growing to "Filters (n)" never resizes it. */}
        <Button variant="outline" width="28" flexShrink={0}>
          {selected ? `Filters (${selected})` : 'Filters'}
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content width="full" maxWidth="full" height="full" maxHeight="full">
            <Drawer.Header>
              <Drawer.Title>Filters</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <FilterPanel counts={counts} pending={pending} onPendingChange={onPendingChange} />
            </Drawer.Body>
            <Drawer.Footer>
              <Button
                width="56"
                maxWidth="full"
                loading={counts.loading}
                loadingText="Counting results"
                disabled={counts.count === 0}
                onClick={() => {
                  onApply();
                  setOpen(false);
                }}
              >
                {counts.count === undefined ? 'Show results' : applyLabel(counts.count)}
              </Button>
            </Drawer.Footer>
            <Drawer.CloseTrigger asChild>
              <CloseButton aria-label="Close filters" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
