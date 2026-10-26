import { Badge, Box, Flex, Image, Text } from '@chakra-ui/react';
import { useState } from 'react';
import type { InstrumentDocument } from '../api/types';
import defaultLogo from '../assets/default-logo.svg';
import { issuerLabel } from '../format/issuer-label';

const unitsFormat = new Intl.NumberFormat('en-AU');

function Logo({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed || !src ? defaultLogo : src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      boxSize="10"
      flexShrink={0}
      objectFit="contain"
    />
  );
}

type ResultRowProps = {
  instrument: InstrumentDocument;
  // Set on the first row of an appended batch so focus can land on it.
  focusTarget?: React.Ref<HTMLDivElement>;
};

export function ResultRow({ instrument, focusTarget }: ResultRowProps) {
  const issuer = issuerLabel(instrument.issuer);
  const units = instrument.kind === 'equity' && instrument.units_circulating;
  return (
    <Flex
      as="li"
      ref={focusTarget}
      tabIndex={focusTarget ? -1 : undefined}
      columnGap="4"
      rowGap="2"
      alignItems="center"
      wrap="wrap"
      paddingY="3"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Logo src={instrument.logo} />
      <Box flex="1" minWidth="0">
        <Flex gap="2" alignItems="baseline" wrap="wrap">
          <Text fontWeight="semibold">{instrument.symbol}</Text>
          <Text>{instrument.display_name}</Text>
        </Flex>
        <Text color="fg.muted" fontSize="sm">
          {[instrument.kind.toUpperCase(), issuer, units && `${unitsFormat.format(Number(units))} units on issue`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
      {/* On mobile the badges take their own line, indented past the logo (boxSize 10 plus the 4 gap) to line up with the text. */}
      {(instrument.is_betashares || instrument.is_flagship_fund || instrument.is_auto_invest_included) && (
        <Flex gap="1" wrap="wrap" flexBasis={{ base: 'full', tablet: 'auto' }} paddingStart={{ base: '14', tablet: '0' }} justifyContent={{ base: 'flex-start', tablet: 'flex-end' }}>
          {instrument.is_betashares && <Badge>Betashares</Badge>}
          {instrument.is_flagship_fund && <Badge>Flagship</Badge>}
          {instrument.is_auto_invest_included && <Badge>Auto Invest</Badge>}
        </Flex>
      )}
    </Flex>
  );
}
