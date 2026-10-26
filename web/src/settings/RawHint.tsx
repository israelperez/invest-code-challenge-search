import { Text } from '@chakra-ui/react';
import { config } from '../config';

// The API's raw value beside its label; nothing at all unless the Show raw data setting is on.
export function RawHint({ value }: { value: string | number }) {
  if (!config.showRawData) return null;
  return (
    <Text as="span" fontSize="xs" color="fg.muted" overflowWrap="anywhere">
      {' '}
      {value}
    </Text>
  );
}
