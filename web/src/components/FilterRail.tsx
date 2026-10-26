import { Box, Button, Checkbox, Fieldset, Flex, RadioGroup, Skeleton, Text } from '@chakra-ui/react';
import { buildSearchRequest, type Filters } from '../search/build-search-request';
import { applyLabel, filterSections, type FilterOption, type FilterSection } from '../search/filter-options';
import { useFacetCounts } from '../search/queries';

// Fixed-width slot, so a count loading in never moves the label.
const Count = ({ option, loading }: { option: FilterOption; loading: boolean }) => (
  <Box minWidth="10" textAlign="end" color="fg.muted" fontSize="sm">
    {loading ? <Skeleton height="4" /> : option.count}
  </Box>
);

function Section({ section, loading, onChange }: { section: FilterSection; loading: boolean; onChange: (next: Filters) => void }) {
  // A lone checkbox is labelled by its own text, so its legend is for assistive tech only.
  const lone = section.control === 'checkbox' && section.options.length === 1;
  return (
    <Fieldset.Root>
      <Fieldset.Legend srOnly={lone}>{section.legend}</Fieldset.Legend>
      <Fieldset.Content gap="2">
        {section.control === 'radio' ? (
          <RadioGroup.Root
            value={section.options.find((o) => o.selected)?.id}
            onValueChange={({ value }) => onChange(section.options.find((o) => o.id === value)!.next)}
          >
            <Flex direction="column" gap="2">
              {section.options.map((o) => (
                <RadioGroup.Item key={o.id} value={o.id} disabled={o.disabled} width="full" minHeight="6" aria-hidden={o.placeholder || undefined}>
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  {o.placeholder ? (
                    <Skeleton height="4" flex="1" />
                  ) : (
                    <RadioGroup.ItemText flex="1">{o.label}</RadioGroup.ItemText>
                  )}
                  {o.id !== 'any' && <Count option={o} loading={loading || !!o.placeholder} />}
                </RadioGroup.Item>
              ))}
            </Flex>
          </RadioGroup.Root>
        ) : (
          section.options.map((o) => (
            <Checkbox.Root key={o.id} checked={o.selected} disabled={o.disabled} onCheckedChange={() => onChange(o.next)} width="full">
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label flex="1">{o.label}</Checkbox.Label>
              <Count option={o} loading={loading} />
            </Checkbox.Root>
          ))
        )}
      </Fieldset.Content>
    </Fieldset.Root>
  );
}

export function FilterRail({
  term,
  applied,
  pending,
  onPendingChange,
  onApply,
}: {
  term: string;
  applied: Filters;
  pending: Filters;
  onPendingChange: (filters: Filters) => void;
  onApply: () => void;
}) {
  const { facets, known, count, loading, error, retry } = useFacetCounts(term, pending);
  const key = (filters: Filters) => JSON.stringify(buildSearchRequest({ term: '', filters }));
  const changed = key(pending) !== key(applied);

  return (
    <Flex
      as="aside"
      aria-label="Filters"
      direction="column"
      gap="5"
      width={{ base: 'full', md: '72' }}
      flexShrink={0}
      marginTop="6"
      padding="4"
      bg="bg.muted"
      borderRadius="lg"
    >
      <Button variant="outline" size="sm" alignSelf="flex-start" disabled={key(pending) === key({})} onClick={() => onPendingChange({})}>
        Clear filters
      </Button>
      {error && (
        <Flex alignItems="center" gap="2" wrap="wrap">
          <Text fontSize="sm">Couldn't update the counts.</Text>
          <Button variant="outline" size="xs" onClick={retry}>
            Retry
          </Button>
        </Flex>
      )}
      {filterSections(facets, pending, known).map((section) => (
        <Section key={section.id} section={section} loading={loading} onChange={onPendingChange} />
      ))}
      {/* The slot keeps its height when the button is hidden, so the page below never shifts. */}
      <Box position="sticky" bottom="0" bg="bg.muted" paddingY="2" minHeight="14">
        {changed && (
          <Button
            width="56"
            maxWidth="full"
            loading={loading}
            loadingText="Counting results"
            disabled={count === 0}
            onClick={onApply}
          >
            {count === undefined ? 'Show results' : applyLabel(count)}
          </Button>
        )}
      </Box>
    </Flex>
  );
}
