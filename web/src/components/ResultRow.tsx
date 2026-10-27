import { Badge, Box, Flex, Image, Text } from '@chakra-ui/react';
import { Fragment, useEffect, useState } from 'react';
import type { InstrumentDocument } from '../api/types';
import defaultLogo from '../assets/default-logo.svg';
import { issuerLabel } from '../format/issuer-label';
import { kindLabel } from '../format/kind-label';
import { useSearchBackend } from '../search/search-source-context';
import { RawHint } from '../settings/RawHint';

const unitsFormat = new Intl.NumberFormat('en-AU');

function Logo({ src, id, symbol }: { src: string | null; id: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const { report, problems } = useSearchBackend();
  return (
    <Image
      src={failed || !src ? defaultLogo : src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
        // The fallback image failing is not the logo's fault; only a real logo counts.
        if (src && !failed && problems.firstTime('logo_failed', id)) report('logo_failed', { level: 'warn', message: 'Logo failed to load, showing the default', detail: id, entries: [`${symbol} (${src})`] });
      }}
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
  const { report, problems } = useSearchBackend();
  const id = instrument.symbol_openfigi;
  useEffect(() => {
    if (!instrument.display_name?.trim() && problems.firstTime('no_display_name', id)) report('no_display_name', { level: 'warn', message: 'Instrument has no display name', detail: id, entries: [instrument.symbol === id ? id : `${id} (${instrument.symbol})`] });
  }, [instrument.display_name, instrument.symbol, id, report, problems]);
  const issuer = issuerLabel(instrument.issuer);
  const units = instrument.kind === 'equity' && instrument.units_circulating;
  return (
    <Flex
      as="li"
      ref={focusTarget}
      tabIndex={focusTarget ? -1 : undefined}
      columnGap="4"
      rowGap="2"
      alignItems="flex-start"
      wrap="wrap"
      paddingY="3"
      borderBottomWidth="1px"
      borderColor="divider.canvas"
      _last={{ borderBottomWidth: 0 }}
    >
      <Logo src={instrument.logo} id={id} symbol={instrument.symbol} />
      <Box flex="1" minWidth="0">
        <Flex gap="2" alignItems="baseline" wrap="wrap">
          <Text bg="pill.bg" color="pill.fg" textStyle="bodySm" rounded="full" paddingX="2.5" height="pill" display="inline-flex" alignItems="center">
            {instrument.symbol}
          </Text>
          <Text>{instrument.display_name}</Text>
        </Flex>
        <Text color="fg.muted" fontSize="sm">
          {[
            ['kind', <>
              {kindLabel(instrument.kind)}
              <RawHint value={instrument.kind} />
            </>],
            ['issuer', issuer && (
              <>
                {issuer}
                <RawHint value={instrument.issuer!} />
              </>
            )],
            ['units', units && (
              <>
                {unitsFormat.format(Number(units))} units on issue
                <RawHint value={units} />
              </>
            )],
          ]
            .filter(([, part]) => part)
            .map(([key, part], i) => (
              <Fragment key={key as string}>
                {i > 0 && ' · '}
                {part}
              </Fragment>
            ))}
          <RawHint value={instrument.symbol_openfigi} />
        </Text>
      </Box>
      {/* On mobile the badges take their own line, indented past the logo (boxSize 10 plus the 4 gap) to line up with the text. */}
      {(instrument.is_betashares || instrument.is_flagship_fund || instrument.is_auto_invest_included) && (
        <Flex gap="1" wrap="wrap" flexBasis={{ base: 'full', tablet: 'auto' }} paddingStart={{ base: '14', tablet: '0' }} justifyContent={{ base: 'flex-start', tablet: 'flex-end' }}>
          {instrument.is_betashares && <Badge variant="outline">Betashares</Badge>}
          {instrument.is_flagship_fund && <Badge variant="outline">Flagship</Badge>}
          {instrument.is_auto_invest_included && <Badge variant="outline">Auto Invest</Badge>}
        </Flex>
      )}
    </Flex>
  );
}
