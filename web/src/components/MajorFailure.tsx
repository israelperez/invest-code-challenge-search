import { Alert, Button } from '@chakra-ui/react';

// The one message for a major API failure (ADR 0007), used for the results area, under the rows, and in the filter rail and drawer.
// Its owner keeps it mounted while `retrying`, so the button spins in place instead of the message swapping out mid-flight.
export function MajorFailure({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Alert.Root status="error" flexDirection="column" alignItems="flex-start" gap="3">
      <Alert.Content>
        <Alert.Title>The app seems to be experiencing issues</Alert.Title>
        <Alert.Description>Try again in a moment.</Alert.Description>
      </Alert.Content>
      <Button onClick={onRetry} loading={retrying} width="24">
        Retry
      </Button>
    </Alert.Root>
  );
}
