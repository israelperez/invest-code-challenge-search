import { Alert, Box, Flex, Heading, Text } from '@chakra-ui/react';
import { useId, useSyncExternalStore } from 'react';
import { config } from '../config';
import { DISTINCT_CAP } from './problem-counter';
import type { ProblemEvent } from '../search/report';
import { useSearchBackend } from '../search/search-source-context';

// snapshot_stale (a normal reload) and late_response_discarded are counted but not shown.
const ROWS: [ProblemEvent, string][] = [
  ['batch_ids_missing', 'Batches that reported missing IDs'],
  ['batch_incomplete', 'Incomplete batch responses'],
  ['first_batch_failed', 'First batch failed to load'],
  ['load_more_failed', 'Load more failed'],
  ['restart_failed', 'Restart after a stale snapshot failed'],
  ['logo_failed', 'Logos that failed to load'],
  ['no_display_name', 'Instruments with no display name'],
];

export function DataProblems() {
  const { problems } = useSearchBackend();
  const counts = useSyncExternalStore(problems.subscribe, problems.getSnapshot);
  const headingId = useId();
  if (!config.dataProblemsEnabled) return null;
  return (
    <Box as="section" aria-labelledby={headingId}>
      <Heading as="h3" id={headingId} size="md" marginBottom="3">
        Data problems (this session, demo)
      </Heading>
      <Alert.Root status="warning" marginBottom="3">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>Demo data, development only. A real build would report these to an error-reporting service.</Alert.Description>
        </Alert.Content>
      </Alert.Root>
      <Box as="ul" listStyle="none">
        {ROWS.map(([event, label]) => {
          const { count = 0, entries = [], distinct = 0 } = counts[event] ?? {};
          const line = (
            <Flex justifyContent="space-between" alignItems="baseline" gap="3" paddingY="1">
              <Text textDecoration={count > 0 ? 'underline dotted' : undefined}>{label}</Text>
              {/* Fixed-width, right-aligned, tabular: a changing count never moves the label. */}
              <Text minWidth="10" textAlign="end" fontVariantNumeric="tabular-nums" color="fg.muted">
                {count}
              </Text>
            </Flex>
          );
          return (
            <Box as="li" key={event}>
              {entries.length === 0 ? (
                line
              ) : (
                // Native details: keyboard operable, and its open state survives count updates because the element stays mounted.
                <details>
                  <Box as="summary" cursor="pointer" listStyle="none">
                    {line}
                  </Box>
                  <Box as="ul" listStyle="none" paddingBottom="2" fontSize="sm" color="fg.muted">
                    {entries.map((entry) => (
                      <Box as="li" key={entry} overflowWrap="anywhere" userSelect="text">
                        {entry}
                      </Box>
                    ))}
                    {distinct > entries.length && <Box as="li">and {distinct - entries.length}{distinct >= DISTINCT_CAP && '+'} more</Box>}
                  </Box>
                </details>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
