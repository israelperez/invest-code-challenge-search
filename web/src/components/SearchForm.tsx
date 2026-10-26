import { Box, Button, CloseButton, Field, Flex, Input } from '@chakra-ui/react';
import { type FormEvent, useRef, useState } from 'react';

// Fixed-size controls: the clear button is hidden, never removed, so nothing reflows while typing.
export function SearchForm({ onSearch }: { onSearch: (term: string) => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(value);
  }

  return (
    <form onSubmit={submit} role="search">
      <Field.Root>
        <Field.Label>Search shares and ETFs</Field.Label>
        <Flex gap="2" width="full">
          <Box position="relative" flex="1">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ticker or name, e.g. A200"
              fontSize="md"
              paddingEnd="10"
              maxLength={100}
              autoComplete="off"
            />
            <CloseButton
              aria-label="Clear search"
              size="xs"
              position="absolute"
              insetEnd="2"
              top="50%"
              transform="translateY(-50%)"
              visibility={value ? 'visible' : 'hidden'}
              onClick={() => {
                setValue('');
                inputRef.current?.focus();
              }}
            />
          </Box>
          <Button type="submit" minWidth="24">
            Search
          </Button>
        </Flex>
      </Field.Root>
    </form>
  );
}
