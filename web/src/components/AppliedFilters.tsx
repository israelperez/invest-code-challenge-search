import { Box, Button, Flex, chakra } from '@chakra-ui/react';
import { useRef } from 'react';
import type { Filters } from '../search/build-search-request';
import { appliedChips } from '../search/filter-options';
import { useFacetCounts } from '../search/queries';
import { RawHint } from '../settings/RawHint';

// The chips wrap onto new lines at every width. Removing a chip or clearing applies at once.
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
      flexWrap="wrap"
    >
      {chips.map((chip, i) => (
        <Box as="li" key={chip.id} minWidth="0" maxWidth="full">
          {/* Fixed 32px height: a long label is cut with an ellipsis, and the aria-label still names it in full. */}
          <Button
            // shortcut: cast because Chakra's generated Button types do not know our `tertiary` variant, switch to `chakra typegen` if more custom variants appear.
            variant={'tertiary' as 'outline'}
            size="sm"
            maxWidth="full"
            aria-label={`Remove ${chip.label}`}
            ref={(el: HTMLButtonElement | null) => void (el ? buttons.current.set(chip.id, el) : buttons.current.delete(chip.id))}
            onClick={() => remove(i)}
          >
            <chakra.span truncate>
              {chip.label}
              {chip.raw && <RawHint value={chip.raw} />}
            </chakra.span>
            <chakra.svg aria-hidden viewBox="0 0 24 24" boxSize="4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" flexShrink={0}>
              <path d="M6 6l12 12M18 6L6 18" />
            </chakra.svg>
          </Button>
        </Box>
      ))}
      <Box as="li" flexShrink={0}>
        <Button
          variant="outline"
          size="sm"
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
