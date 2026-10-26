import { Alert, Badge, Box, Flex, HStack, List, Stack, Text } from '@chakra-ui/react';
import { ApiError } from '../api/client';
import { DataProblems } from './DataProblems';
import { useZeroResults } from './queries';

export function InsightsTab() {
  const { data, error, isPending } = useZeroResults();
  return (
    <Stack gap="4">
      <Alert.Root status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Development only</Alert.Title>
          <Alert.Description>These insights are not for users. A real build would put them behind admin access.</Alert.Description>
        </Alert.Content>
      </Alert.Root>
      {data?.includes_seed_data && <Badge alignSelf="start">Demo data</Badge>}
      <Text color="fg.muted">Terms people searched that never returned results, grouped by search key.</Text>
      {isPending && <Text role="status">Loading insights</Text>}
      {error && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              {error instanceof ApiError && error.status === 404
                ? 'The API has insights switched off. Start it with ENABLE_INSIGHTS=true.'
                : 'Could not load insights'}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {data && data.groups.length === 0 && <Text>No zero-result terms yet</Text>}
      {data && data.groups.length > 0 && (
        <List.Root as="ul" listStyle="none" gap="3">
          {data.groups.map((group) => (
            <List.Item key={group.key} borderWidth="1px" borderColor="border" rounded="l2" padding="3">
              <Flex justifyContent="space-between" gap="2" flexWrap="wrap">
                <Text fontWeight="semibold">{group.key}</Text>
                <HStack gap="2" color="fg.muted">
                  <Text>{group.clients} clients</Text>
                  <Text>{group.total} searches</Text>
                </HStack>
              </Flex>
              {(group.spellings.length > 1 || group.spellings[0]?.text.toLowerCase() !== group.key) && (
                <Box marginTop="2">
                  <Text fontSize="sm" color="fg.muted">
                    Searched as
                  </Text>
                  <Box as="ul" listStyle="none">
                    {group.spellings.map((s) => (
                      <Flex as="li" key={s.text} justifyContent="space-between">
                        <Text>{s.text}</Text>
                        <Text color="fg.muted">{s.total}</Text>
                      </Flex>
                    ))}
                  </Box>
                </Box>
              )}
            </List.Item>
          ))}
        </List.Root>
      )}
      <DataProblems />
    </Stack>
  );
}
