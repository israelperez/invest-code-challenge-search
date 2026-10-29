import { Button, CloseButton, Drawer, Flex, IconButton, chakra, Image, Portal, Tabs, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { InsightsTab } from '../insights/InsightsTab';
import { SETTINGS_FORM_ID, SettingsTab } from '../settings/SettingsTab';
import logo from '../assets/betashares-logo.svg';

// Inline so it follows `color`. Path from assets/gear-solid-full.svg (Font Awesome Free, CC BY 4.0).
const GearIcon = () => (
  <chakra.svg viewBox="0 0 640 640" boxSize="4" fill="currentColor" aria-hidden>
    <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
  </chakra.svg>
);

// Scrolls with the page. The gear (development builds only) opens the panel that the Insights and Settings tabs fill.
export function Header() {
  const [tab, setTab] = useState('insights');
  return (
    <>
      <Flex bg="bar.bg" color="bar.fg" paddingX="gutter" height="11" alignItems="center">
        <Text fontSize="sm" fontWeight="medium" truncate>
          Israel Perez - Assessment
        </Text>
      </Flex>
      <Flex as="header" padding="4" borderBottomWidth="1px" borderColor="divider.canvas" justifyContent="space-between" alignItems="center">
        <Image src={logo} alt="Betashares" height="10" />
        {import.meta.env.DEV && (
          <Drawer.Root placement="end" size="lg" lazyMount unmountOnExit>
            <Drawer.Trigger asChild>
              <IconButton aria-label="Open settings" variant="ghost" rounded="full" boxSize="10" bg="bg.panel" color="ink" borderColor="muted" _hover={{ bg: 'brand.subtle' }}>
                <GearIcon />
              </IconButton>
            </Drawer.Trigger>
            <Portal>
              <Drawer.Backdrop />
              <Drawer.Positioner>
                <Drawer.Content>
                  <Drawer.Header>
                    <Drawer.Title>Settings</Drawer.Title>
                  </Drawer.Header>
                  <Drawer.Body>
                    <Tabs.Root lazyMount unmountOnExit value={tab} onValueChange={(e) => setTab(e.value)}>
                      <Tabs.List>
                        <Tabs.Trigger value="insights">Insights</Tabs.Trigger>
                        <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
                      </Tabs.List>
                      <Tabs.Content value="insights">
                        <InsightsTab />
                      </Tabs.Content>
                      <Tabs.Content value="settings">
                        <SettingsTab />
                      </Tabs.Content>
                    </Tabs.Root>
                  </Drawer.Body>
                  {/* The form lives in the Settings tab; the button submits it from here, so it is only present on that tab. */}
                  {tab === 'settings' && (
                    <Drawer.Footer>
                      <Button type="submit" form={SETTINGS_FORM_ID}>
                        Save and reload
                      </Button>
                    </Drawer.Footer>
                  )}
                  <Drawer.CloseTrigger asChild>
                    <CloseButton aria-label="Close settings" />
                  </Drawer.CloseTrigger>
                </Drawer.Content>
              </Drawer.Positioner>
            </Portal>
          </Drawer.Root>
        )}
      </Flex>
    </>
  );
}
