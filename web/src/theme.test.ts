import { expect, it } from 'vitest';
import { system } from './theme';

// DESIGN.md "Layout": the scale replaces Chakra's sm..2xl, and `base` is implied.
it('has exactly the DESIGN.md breakpoint scale', () => {
  expect(system._config.theme?.breakpoints).toEqual({
    mobileLarge: '560px',
    tablet: '760px',
    tabletLarge: '895px',
    desktop: '1030px',
    desktopLarge: '1200px',
    desktopXLarge: '1400px',
  });
  expect(Object.keys(system.breakpoints.values)).not.toContain('md');
});
