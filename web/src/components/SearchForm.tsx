import { Button, CloseButton, Combobox, Field, Flex, Input, Text, VisuallyHidden, createListCollection } from '@chakra-ui/react';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { config } from '../config';
import { useSearchBackend } from '../search/search-source-context';
import type { Suggestions } from '../search/suggestion-source';

type Suggestion = { value: string; group: 'Searches' | 'Instruments'; fill: string; name?: string; disabled?: boolean };
// `for` is the text the items answer; while it differs from what is typed they are stale.
type Lookup = { status: 'idle' | 'loading' | 'done' | 'failed'; items: Suggestion[]; for: string };

function toItems({ terms, instruments }: Suggestions): Suggestion[] {
  return [
    ...terms.map((term): Suggestion => ({ value: `term:${term}`, group: 'Searches', fill: term })),
    ...instruments.map((i): Suggestion => ({ value: `instrument:${i.symbol_openfigi}`, group: 'Instruments', fill: i.symbol, name: i.display_name })),
  ];
}

function announcement({ status, items }: Lookup) {
  if (status === 'loading') return 'Loading suggestions';
  if (status === 'failed') return 'Suggestions unavailable';
  if (status === 'done') return items.length ? `${items.length} suggestion${items.length === 1 ? '' : 's'}` : 'No suggestions';
  return '';
}

// Fixed-size controls: the clear button is hidden, never removed, so nothing reflows while typing.
// The list is a popover over the page, so opening it moves nothing either.
export function SearchForm({ onSearch }: { onSearch: (term: string) => void }) {
  const { suggestions } = useSearchBackend();
  const inputId = useId();
  const listLabelId = `${inputId}-suggestions`;
  const [value, setValue] = useState('');
  // The text the suggestions answer: typed, or filled by a pick. After a pick the old items go stale until the lookup for the filled text lands.
  const [typed, setTyped] = useState('');
  const [wantOpen, setWantOpen] = useState(false);
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle', items: [], for: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const enabled = typed.trim().length >= config.suggestionMinChars;
  const open = wantOpen && enabled;

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

  // The previous answer stays rendered while the next loads (no flicker, no resize) but cannot be picked.
  const stale = lookup.for !== typed.trim();
  const collection = useMemo(
    () =>
      createListCollection({
        items: lookup.items.map((item) => ({ ...item, disabled: stale })),
        groupBy: (item) => item.group,
        itemToString: (item) => item.fill,
        isItemDisabled: (item) => !!item.disabled,
      }),
    [lookup.items, stale],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setWantOpen(false);
    onSearch(value);
  }

  function change(text: string) {
    setValue(text);
    setTyped(text);
  }

  return (
    <form onSubmit={submit} role="search">
      <Field.Root id={inputId}>
        <Field.Label>Search shares and ETFs</Field.Label>
        <Flex gap="2" width="full">
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
              const picked = lookup.items.find((item) => item.value === itemValue);
              if (!picked) return;
              change(picked.fill);
              setWantOpen(false);
              onSearch(picked.fill);
            }}
            positioning={{ sameWidth: true }}
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
                  onBlur={() => setWantOpen(false)}
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
                <VisuallyHidden id={listLabelId}>Suggestions</VisuallyHidden>
                {collection.size === 0 && (
                  <Text paddingX="3" paddingY="2" color="fg.muted" aria-hidden>
                    {lookup.status === 'failed' ? 'Suggestions unavailable' : lookup.status === 'done' ? 'No suggestions' : 'Loading suggestions'}
                  </Text>
                )}
                {collection.group().map(([group, items]) => (
                  <Combobox.ItemGroup key={group}>
                    <Combobox.ItemGroupLabel>{group}</Combobox.ItemGroupLabel>
                    {items.map((item) => (
                      <Combobox.Item key={item.value} item={item}>
                        <Combobox.ItemText>
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
          {announcement(lookup)}
        </VisuallyHidden>
        {/* Helper text, not a placeholder: it stays visible while typing and wraps on narrow phones. */}
        <Field.HelperText>Search by ASX code (ticker) or name</Field.HelperText>
      </Field.Root>
    </form>
  );
}
