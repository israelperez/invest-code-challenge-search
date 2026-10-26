import { Box, Button, CloseButton, Combobox, Field, Flex, Input, Skeleton, Text, VisuallyHidden, createListCollection, useBreakpointValue } from '@chakra-ui/react';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { SearchTrigger } from '../analytics/analytics';
import { config } from '../config';
import { PopularPills } from './PopularPills';
import { useSearchBackend } from '../search/search-source-context';
import type { Suggestions } from '../search/suggestion-source';

type Suggestion = { value: string; group: 'Suggested searches' | 'Matching shares and ETFs' | 'Recent searches'; fill: string; name?: string };
// `for` is the text the items answer; while it differs from what is typed they are not shown.
type Lookup = { status: 'idle' | 'loading' | 'done' | 'failed'; items: Suggestion[]; for: string };

function toItems({ terms, instruments }: Suggestions): Suggestion[] {
  return [
    ...terms.map((term): Suggestion => ({ value: `term:${term}`, group: 'Suggested searches', fill: term })),
    ...instruments.map((i): Suggestion => ({ value: `instrument:${i.symbol_openfigi}`, group: 'Matching shares and ETFs', fill: i.symbol, name: i.display_name })),
  ];
}

function announcement({ status, items }: Lookup) {
  if (status === 'loading') return 'Loading suggestions';
  if (status === 'failed') return 'Suggestions unavailable';
  if (status === 'done') return items.length ? `${items.length} suggestion${items.length === 1 ? '' : 's'}` : 'No suggestions';
  return '';
}

const noSubscribe = () => () => {};
const noTerms: readonly string[] = [];

// Fixed-size controls: the clear button is hidden, never removed, so nothing reflows while typing.
// The list is a popover over the page, so opening it moves nothing either.
// The popular searches show only before the first search; the results take their place.
export function SearchForm({ onSearch, showPopular }: { onSearch: (term: string, source: SearchTrigger) => void; showPopular: boolean }) {
  const { suggestions, recent, analytics } = useSearchBackend();
  const inputId = useId();
  const listLabelId = `${inputId}-suggestions`;
  const [value, setValue] = useState('');
  // The text the suggestions answer: typed, or filled by a pick. After a pick the old items go stale until the lookup for the filled text lands.
  const [typed, setTyped] = useState('');
  const [wantOpen, setWantOpen] = useState(false);
  const recentTerms = useSyncExternalStore(recent?.subscribe ?? noSubscribe, recent?.list ?? (() => noTerms));
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle', items: [], for: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // Same cast as App.tsx: the generated breakpoint names still say sm..2xl.
  const tablet = useBreakpointValue({ base: false, tablet: true } as Parameters<typeof useBreakpointValue<boolean>>[0], { ssr: false }) ?? false;
  const enabled = typed.trim().length >= config.suggestionMinChars;
  // Under the suggestion minimum the popup offers recent searches starting with the typed text; from it, suggestions only.
  const recentMode = recent !== null && !enabled;
  const recentItems = useMemo(() => {
    const prefix = typed.trim().toLowerCase();
    return recentMode
      ? recentTerms.filter((t) => t.toLowerCase().startsWith(prefix)).map((t): Suggestion => ({ value: `recent:${t}`, group: 'Recent searches', fill: t }))
      : [];
  }, [recentMode, recentTerms, typed]);
  const open = wantOpen && (enabled || (recentMode && (typed.trim() === '' || recentItems.length > 0)));

  // Each keystroke restarts the debounce and aborts whatever is in flight.
  useEffect(() => {
    if (!enabled) {
      setLookup({ status: 'idle', items: [], for: '' });
      return;
    }
    const controller = new AbortController();
    const text = typed.trim();
    setLookup((previous) => ({ ...previous, status: 'loading' }));
    const timer = setTimeout(() => {
      suggestions
        .suggest(text, controller.signal)
        .then((found) => {
          if (!controller.signal.aborted) setLookup({ status: 'done', items: toItems(found), for: text });
        })
        .catch((error) => {
          // An aborted lookup is superseded: no state change, no log.
          if (controller.signal.aborted) return;
          console.error('Loading suggestions failed', error);
          setLookup({ status: 'failed', items: [], for: text });
        });
    }, config.suggestionDebounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed, enabled, suggestions]);

  // Items answer `lookup.for`; while the typed text has moved on they are not rendered, so they cannot be picked.
  const fresh = lookup.for === typed.trim();
  const collection = useMemo(
    () => createListCollection({ items: recentMode ? recentItems : fresh ? lookup.items : [], groupBy: (item) => item.group, itemToString: (item) => item.fill }),
    [lookup.items, fresh, recentMode, recentItems],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setWantOpen(false);
    onSearch(value, 'typed');
  }

  function change(text: string) {
    setValue(text);
    setTyped(text);
  }

  return (
    <form onSubmit={submit} role="search">
      <Field.Root id={inputId}>
        <Field.Label>Search shares and ETFs</Field.Label>
        <Flex ref={rowRef} gap="2" width="full">
          <Combobox.Root
            collection={collection}
            ids={{ input: inputId, label: listLabelId }}
            inputValue={value}
            onInputValueChange={({ inputValue }) => setValue(inputValue)}
            value={[]}
            selectionBehavior="preserve"
            allowCustomValue
            open={open}
            onOpenChange={({ open }) => setWantOpen(open)}
            onSelect={({ itemValue }) => {
              const picked = collection.find(itemValue);
              if (!picked) return;
              change(picked.fill);
              setWantOpen(false);
              // A recent pick re-runs a past search; it is not a suggestion.
              if (picked.value.startsWith('recent:')) return onSearch(picked.fill, 'recent');
              analytics.track('suggestion_selected', { query: typed, value: picked.fill, kind: picked.value.startsWith('term:') ? 'term' : 'instrument' });
              onSearch(picked.fill, 'suggestion');
            }}
            // Below tablet the list spans the whole row (input and Search button); from tablet up it matches the input.
            positioning={{ sameWidth: true, getAnchorRect: tablet ? undefined : () => rowRef.current?.getBoundingClientRect() ?? null }}
            flex="1"
            minWidth="0"
          >
            <Combobox.Control>
              <Combobox.Input asChild>
                <Input
                  ref={inputRef}
                  placeholder="e.g. A200 or Australia 200"
                  fontSize="md"
                  paddingEnd="10"
                  maxLength={100}
                  // The combobox reports its value a tick late; a submit or the debounce must not wait for it.
                  onChange={(e) => change(e.target.value)}
                  onFocus={() => recent && setWantOpen(true)}
                  onKeyDown={(e) => {
                    // A second Escape, with the list already closed, clears the input.
                    if (e.key === 'Escape' && !open) change('');
                  }}
                />
              </Combobox.Input>
              <CloseButton
                aria-label="Clear search"
                size="xs"
                position="absolute"
                insetEnd="2"
                top="50%"
                transform="translateY(-50%)"
                visibility={value ? 'visible' : 'hidden'}
                onClick={() => {
                  change('');
                  inputRef.current?.focus();
                }}
              />
            </Combobox.Control>
            <Combobox.Positioner>
              <Combobox.Content>
                {/* Names the listbox; the visible label belongs to the input. */}
                <VisuallyHidden id={listLabelId}>{recentMode ? 'Recent searches' : 'Suggestions'}</VisuallyHidden>
                {/* Combobox.Empty, not plain text: Chakra hides an open list with no items unless it holds one. */}
                <Combobox.Empty paddingX="3" paddingY="2" color="fg.muted">
                  {recentMode ? (
                    'No recent searches yet'
                  ) : fresh && lookup.status === 'failed' ? (
                    'Suggestions unavailable'
                  ) : fresh && lookup.status === 'done' ? (
                    'No suggestions'
                  ) : (
                    <Box aria-hidden>
                      {Array.from({ length: config.suggestionSkeletonRows }, (_, i) => (
                        <Skeleton key={i} data-testid="suggestion-skeleton-row" height="5" marginY="2" />
                      ))}
                    </Box>
                  )}
                </Combobox.Empty>
                {collection.group().map(([group, items]) => (
                  <Combobox.ItemGroup key={group}>
                    <Combobox.ItemGroupLabel>{group}</Combobox.ItemGroupLabel>
                    {items.map((item) => (
                      <Combobox.Item key={item.value} item={item}>
                        <Combobox.ItemText flex="1">
                          {item.fill}
                          {item.name && (
                            <Text as="span" color="fg.muted" marginStart="2">
                              {item.name}
                            </Text>
                          )}
                        </Combobox.ItemText>
                      </Combobox.Item>
                    ))}
                  </Combobox.ItemGroup>
                ))}
              </Combobox.Content>
            </Combobox.Positioner>
          </Combobox.Root>
          <Button type="submit" minWidth="24">
            Search
          </Button>
        </Flex>
        {/* aria-live rather than role=status: the results already own the page's one status role. Polite, so typing is never interrupted; always mounted so a screen reader picks up the change. */}
        <VisuallyHidden aria-live="polite" data-testid="suggestion-status">
          {recentMode && open ? (recentItems.length ? `${recentItems.length} recent search${recentItems.length === 1 ? '' : 'es'}` : 'No recent searches yet') : announcement(lookup)}
        </VisuallyHidden>
        {/* Helper text, not a placeholder: it stays visible while typing and wraps on narrow phones. */}
        <Field.HelperText>Search by ASX code (ticker) or name</Field.HelperText>
      </Field.Root>
      {showPopular && (
        <PopularPills
          onPick={(term) => {
            change(term);
            setWantOpen(false);
            onSearch(term, 'popular');
          }}
        />
      )}
    </form>
  );
}
