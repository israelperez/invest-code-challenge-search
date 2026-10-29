import { Box, Button, Flex, Heading, Skeleton, VisuallyHidden, useBreakpointValue } from '@chakra-ui/react';
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { config } from '../config';
import { hiddenAfterFirstRow } from '../search/hidden-pills';
import { useSearchBackend } from '../search/search-source-context';

// Varied so the placeholder row reads as pills, not a bar.
// Spacing tokens only: a width that isn't one (e.g. '18') is dropped and the skeleton collapses to nothing.
const SKELETON_WIDTHS = ['16', '20', '14', '24', '20', '16'];

// An empty or failed fetch (no message; the API client reports the failure) falls back to the featured Betashares ETFs under their own
// heading, since nobody searched those.
export function PopularPills({ onPick }: { onPick: (term: string) => void }) {
  const { popular } = useSearchBackend();
  // Changes when the search log is reset, which refetches the terms.
  const version = useSyncExternalStore(popular.subscribe, popular.version);
  const [labels, setLabels] = useState<{ heading: string; terms: readonly string[] } | null>(null);
  const headingId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<boolean[]>([]);
  const oneLine = config.popularSearchOneLine;
  // Same cast as App.tsx: the generated breakpoint names still say sm..2xl.
  const shown =
    useBreakpointValue(
      { base: config.popularShown.mobile, tablet: config.popularShown.tablet, desktop: config.popularShown.desktop } as Parameters<typeof useBreakpointValue<number>>[0],
      { ssr: false },
    ) ?? config.popularShown.mobile;

  useEffect(() => {
    let current = true;
    const featured = { heading: 'Featured Betashares ETFs', terms: config.featuredSearches };
    popular
      .terms()
      .then((found) => found.map((term) => term.label))
      .then((terms) => (terms.length ? { heading: 'Popular searches', terms } : featured))
      .catch(() => featured)
      .then((next) => current && setLabels(next));
    return () => {
      current = false;
    };
  }, [popular, version]);

  // In one-line mode pills that wrap are clipped from view; they also leave the focus order and the accessibility tree.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!oneLine || !labels || !row) return;
    const measure = () => {
      const next = hiddenAfterFirstRow(Array.from(row.children, (child) => (child as HTMLElement).offsetTop));
      // Focus never stays on a pill that is about to become inert.
      const focused = Array.from(row.children).indexOf(document.activeElement as Element);
      if (next[focused]) (row.children[next.lastIndexOf(false)] as HTMLElement | undefined)?.focus();
      setHidden(next);
    };
    measure();
    // The row's own size is fixed, so pills are observed too: a font loading or any width change re-measures.
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const pill of row.children) observer.observe(pill);
    return () => observer.disconnect();
  }, [oneLine, labels, shown]);

  // While loading the section is already there, with skeletons where the pills will be, so the pills land
  // without moving anything.
  return (
    <Box as="section" aria-labelledby={headingId} aria-busy={!labels} marginTop="3">
      <Heading as="h2" id={headingId} size="sm" marginBottom="2">
        {labels?.heading ?? 'Popular searches'}
      </Heading>
      {/* One-line mode clips the row to one pill. The 4px padding (cancelled by the negative margin) keeps focus rings from
          being cut, in every browser; the clip ends at 44px and the second row starts at 48px, so it never shows. */}
      <Flex ref={rowRef} gap="2" flexWrap="wrap" {...(oneLine && { padding: '1', margin: '-1', height: '11', overflow: 'hidden' })}>
        {labels ? (
          labels.terms.slice(0, shown).map((term, i) => (
            <Button key={term} type="button" variant="outline" size="sm" inert={hidden[i]} aria-hidden={hidden[i] || undefined} onClick={() => onPick(term)}>
              {term}
            </Button>
          ))
        ) : (
          <>
            <VisuallyHidden>Loading popular searches</VisuallyHidden>
            {Array.from({ length: shown }, (_, i) => (
              <Skeleton key={i} aria-hidden data-testid="popular-skeleton-pill" height="8" rounded="button" width={SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]} />
            ))}
          </>
        )}
      </Flex>
    </Box>
  );
}
