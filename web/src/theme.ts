import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// The one place the breakpoint scale is defined (DESIGN.md "Layout"). Replaces Chakra's sm/md/lg/xl/2xl.
// Passed as one config, not merged over `defaultConfig`: merging would keep Chakra's own breakpoints beside ours.
export const breakpoints = {
  mobileLarge: '560px',
  tablet: '760px',
  tabletLarge: '895px',
  desktop: '1030px',
  desktopLarge: '1200px',
  desktopXLarge: '1400px',
};

export const system = createSystem(
  { ...defaultConfig, theme: { ...defaultConfig.theme, breakpoints } },
  // Chakra defaults (the 10px inset and the l3 overlay radius) standing in until #21 sets them from DESIGN.md.
  defineConfig({
    theme: {
      slotRecipes: {
        drawer: { slots: defaultConfig.theme?.slotRecipes?.drawer?.slots ?? [], base: { positioner: { padding: '2.5' }, content: { borderRadius: 'l3' } } },
        // Chakra sets `user-select: none` on these labels, which stops people selecting and copying the text.
        field: { slots: defaultConfig.theme?.slotRecipes?.field?.slots ?? [], base: { label: { userSelect: 'text' } } },
        checkbox: { slots: defaultConfig.theme?.slotRecipes?.checkbox?.slots ?? [], base: { label: { userSelect: 'text' } } },
        switch: { slots: defaultConfig.theme?.slotRecipes?.switch?.slots ?? [], base: { label: { userSelect: 'text' } } },
      },
    },
  }),
);

// Chakra's `typegen` CLI would write these names into node_modules; this makes the type-check see them without it.
declare module '../node_modules/@chakra-ui/react/dist/types/styled-system/generated/conditions.gen' {
  interface Conditions {
    mobileLarge: string;
    tablet: string;
    tabletLarge: string;
    desktop: string;
    desktopLarge: string;
    desktopXLarge: string;
  }
}
