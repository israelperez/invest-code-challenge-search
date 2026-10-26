import { CloseButton, Drawer, Flex, IconButton, Image, Portal, Tabs, Text } from '@chakra-ui/react';
import { config } from '../config';
import { InsightsTab } from '../insights/InsightsTab';
import { SettingsTab } from '../settings/SettingsTab';
import gearIcon from '../assets/gear-solid-full.svg';
import logo from '../assets/betashares-logo.svg';

// Scrolls with the page. The gear opens the panel that the Insights and Settings tabs fill.
export function Header() {
  return (
    <Flex as="header" padding="4" borderBottomWidth="1px" borderColor="border" justifyContent="space-between" alignItems="center">
      <Image src={logo} alt="Betashares" height="10" />
      <Text hideBelow="tablet" fontSize="xl">
        Israel Perez - Assessment
      </Text>
      <Drawer.Root placement="end" lazyMount unmountOnExit>
        <Drawer.Trigger asChild>
          <IconButton aria-label="Open settings" variant="ghost" rounded="full">
            <Image src={gearIcon} alt="" width="4" />
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
                <Tabs.Root lazyMount unmountOnExit defaultValue={config.insightsEnabled ? 'insights' : 'settings'}>
                  <Tabs.List>
                    {config.insightsEnabled && <Tabs.Trigger value="insights">Insights</Tabs.Trigger>}
                    {config.settingsEnabled && <Tabs.Trigger value="settings">Settings</Tabs.Trigger>}
                  </Tabs.List>
                  {config.insightsEnabled && (
                    <Tabs.Content value="insights">
                      <InsightsTab />
                    </Tabs.Content>
                  )}
                  {config.settingsEnabled && (
                    <Tabs.Content value="settings">
                      <SettingsTab />
                    </Tabs.Content>
                  )}
                </Tabs.Root>
              </Drawer.Body>
              <Drawer.CloseTrigger asChild>
                <CloseButton aria-label="Close settings" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Flex>
  );
}
