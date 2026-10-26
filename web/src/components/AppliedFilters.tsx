import { Box, Button, Flex, Tag } from '@chakra-ui/react';
import { useRef } from 'react';
import type { Filters } from '../search/build-search-request';
import { appliedChips } from '../search/filter-options';
import { useFacetCounts } from '../search/queries';

// Below the tablet breakpoint it stays one line that scrolls sideways; from there up it wraps. Removing a chip or clearing applies at once.
export function AppliedFilters({
  term,
  applied,
  onChange,
  headingRef,
}: {
  term: string;
  applied: Filters;
  onChange: (filters: Filters) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { known } = useFacetCounts(term, applied);
  const chips = appliedChips(applied, known);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  function remove(index: number) {
    // The neighbour's button stays mounted through the change, so focus can move now.
    const neighbour = chips[index + 1] ?? chips[index - 1];
    if (neighbour) buttons.current.get(neighbour.id)?.focus();
    else headingRef.current?.focus();
    onChange(chips[index].next);
  }

  return (
    <Flex
      as="ul"
      aria-label="Applied filters"
      listStyleType="none"
      margin="0"
      marginTop="4"
      padding="0"
      gap="2"
      alignItems="center"
      overflowX={{ base: 'auto', tablet: 'visible' }}
      flexWrap={{ base: 'nowrap', tablet: 'wrap' }}
    >
      {chips.map((chip, i) => (
        <Box as="li" key={chip.id} flexShrink={0}>
          <Tag.Root size="lg" whiteSpace="nowrap">
            <Tag.Label>{chip.label}</Tag.Label>
            <Tag.EndElement>
              <Tag.CloseTrigger
                aria-label={`Remove ${chip.label}`}
                ref={(el: HTMLButtonElement | null) => void (el ? buttons.current.set(chip.id, el) : buttons.current.delete(chip.id))}
                onClick={() => remove(i)}
              />
            </Tag.EndElement>
          </Tag.Root>
        </Box>
      ))}
      <Box as="li" flexShrink={0}>
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            headingRef.current?.focus();
            onChange({});
          }}
        >
          Clear filters
        </Button>
      </Box>
    </Flex>
  );
}
