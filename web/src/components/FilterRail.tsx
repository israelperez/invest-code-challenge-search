import { Box, Button, Checkbox, Fieldset, Flex, Input, RadioGroup, Skeleton, Text } from '@chakra-ui/react';
import { useId, useState } from 'react';
import { buildSearchRequest, type Filters } from '../search/build-search-request';
import { filterSections, type FilterOption, type FilterSection } from '../search/filter-options';
import type { useFacetCounts } from '../search/queries';
import { RawHint } from '../settings/RawHint';

// Same height as a label line, so a row never changes height between loading and loaded.
const ROW_HEIGHT = '6';

// Fixed size, with tabular digits, so a count loading in or changing never moves the label.
const Count = ({ option, loading }: { option: FilterOption; loading: boolean }) => (
  <Box
    width="3ch"
    height={ROW_HEIGHT}
    lineHeight="1.5rem"
    flexShrink={0}
    textAlign="center"
    whiteSpace="nowrap"
    fontVariantNumeric="tabular-nums"
    color="fg.muted"
    fontSize="sm"
  >
    {loading ? <Skeleton height="full" width="2ch" marginX="auto" /> : option.count}
  </Box>
);

// `raw` is the API value to show under Show raw data; the flag checkboxes have none.
// `lone` is a top-level flag option: its label is ink, like the group legends beside it, not the muted label of an option inside a list.
const CheckboxRow = ({ option: o, raw, lone, loading, onChange }: { option: FilterOption; raw?: boolean; lone?: boolean; loading: boolean; onChange: (next: Filters) => void }) => (
  <Checkbox.Root checked={o.selected} disabled={o.disabled} onCheckedChange={() => onChange(o.next)} width="full">
    <Checkbox.HiddenInput />
    <Checkbox.Control />
    <Checkbox.Label flex="1" color={lone ? 'fg' : undefined}>
      {o.label}
      {raw && <RawHint value={o.id} />}
    </Checkbox.Label>
    <Count option={o} loading={loading} />
  </Checkbox.Root>
);

// The busiest issuers first; Show all expands inline (no nested scroll) to every issuer, with a filter box.
function IssuerSection({ section, loading, onChange }: { section: FilterSection; loading: boolean; onChange: (next: Filters) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const listId = useId();
  const placeholders = section.options[0]?.placeholder;
  const needle = text.trim().toLowerCase();
  const shown = expanded
    ? section.options.filter((o) => o.label.toLowerCase().includes(needle) || o.id.toLowerCase().includes(needle))
    : section.featured!.map((id) => section.options.find((o) => o.id === id)!);
  return (
    <Fieldset.Root>
      <Fieldset.Legend>{section.legend}</Fieldset.Legend>
      <Fieldset.Content gap="2" paddingStart="4">
        {expanded && <Input size="sm" aria-label="Filter issuers" value={text} onChange={(e) => setText(e.target.value)} />}
        <Flex direction="column" gap="2" id={listId}>
          {shown.map((o) =>
            o.placeholder ? (
              <Skeleton key={o.id} height={ROW_HEIGHT} aria-hidden />
            ) : (
              <CheckboxRow key={o.id} option={o} raw loading={loading} onChange={onChange} />
            ),
          )}
          {expanded && shown.length === 0 && <Text fontSize="sm" color="fg.muted">No issuers match</Text>}
        </Flex>
        {!placeholders && (
          // Fixed width, so the label change never resizes it.
          <Button
            variant="outline"
            size="sm"
            width="32"
            alignSelf="flex-start"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => {
              setExpanded(!expanded);
              setText('');
            }}
          >
            {expanded ? 'Show fewer' : `Show all ${section.options.length}`}
          </Button>
        )}
      </Fieldset.Content>
    </Fieldset.Root>
  );
}

function Section({ section, loading, onChange }: { section: FilterSection; loading: boolean; onChange: (next: Filters) => void }) {
  // A lone checkbox is labelled by its own text, so its legend is for assistive tech only.
  const lone = section.control === 'checkbox' && section.options.length === 1;
  return (
    <Fieldset.Root>
      <Fieldset.Legend srOnly={lone}>{section.legend}</Fieldset.Legend>
      {/* Options sit indented under a visible legend, so they read as its children. */}
      <Fieldset.Content gap="2" paddingStart={lone ? undefined : '4'}>
        {section.control === 'radio' ? (
          <RadioGroup.Root
            value={section.options.find((o) => o.selected)?.id}
            onValueChange={({ value }) => onChange(section.options.find((o) => o.id === value)!.next)}
          >
            <Flex direction="column" gap="2">
              {section.options.map((o) => (
                <RadioGroup.Item key={o.id} value={o.id} disabled={o.disabled} width="full" height={ROW_HEIGHT} aria-hidden={o.placeholder || undefined}>
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  {o.placeholder ? (
                    <Skeleton height="full" flex="1" />
                  ) : (
                    <RadioGroup.ItemText flex="1">
                      {o.label}
                      {o.id !== 'any' && <RawHint value={o.id} />}
                    </RadioGroup.ItemText>
                  )}
                  {o.id !== 'any' && <Count option={o} loading={loading || !!o.placeholder} />}
                </RadioGroup.Item>
              ))}
            </Flex>
          </RadioGroup.Root>
        ) : (
          section.options.map((o) => <CheckboxRow key={o.id} option={o} raw={section.id === 'kind'} lone={lone} loading={loading} onChange={onChange} />)
        )}
      </Fieldset.Content>
    </Fieldset.Root>
  );
}

// The sections and their controls, shared by the rail beside the results and the mobile drawer.
export function FilterPanel({
  counts: { facets, known, loading, error, retry },
  pending,
  onPendingChange,
}: {
  counts: ReturnType<typeof useFacetCounts>;
  pending: Filters;
  onPendingChange: (filters: Filters) => void;
}) {
  const key = (filters: Filters) => JSON.stringify(buildSearchRequest({ term: '', filters }));

  return (
    <Flex direction="column" gap="5">
      <Button variant="outline" size="sm" width="28" alignSelf="flex-start" disabled={key(pending) === key({})} onClick={() => onPendingChange({})}>
        Clear filters
      </Button>
      {error && (
        <Flex alignItems="center" gap="2" wrap="wrap">
          <Text fontSize="sm">Couldn't update the counts.</Text>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </Flex>
      )}
      {filterSections(facets, pending, known).map((section) =>
        section.featured ? (
          <IssuerSection key={section.id} section={section} loading={loading} onChange={onPendingChange} />
        ) : (
          <Section key={section.id} section={section} loading={loading} onChange={onPendingChange} />
        ),
      )}
    </Flex>
  );
}

// Tablet and up. Ticks apply on their own, so there is no apply button.
export function FilterRail({ counts, pending, onPendingChange }: { counts: ReturnType<typeof useFacetCounts>; pending: Filters; onPendingChange: (filters: Filters) => void }) {
  return (
    <Box as="aside" aria-label="Filters" width="260px" flexShrink={0} marginTop="6" padding="4" bg="bg.muted" borderRadius="lg">
      <FilterPanel counts={counts} pending={pending} onPendingChange={onPendingChange} />
    </Box>
  );
}
