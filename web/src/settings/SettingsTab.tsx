import { Alert, Button, Flex, Checkbox, Dialog, Field, Heading, Input, Portal, Stack, Text } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useId, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { config, settingDescriptions } from '../config';
import { useSearchBackend } from '../search/search-source-context';
import { BOOLEAN_KEYS, NUMBER_FIELDS, effective, loadOverrides, overridesFromForm, resetOverrides, saveOverrides, type BooleanKey, type NumberKey } from './settings';

type Message = { status: 'success' | 'error'; text: string };

// Saving or resetting reloads the page: config is read once at startup, so the new values land everywhere at once.
export function SettingsTab() {
  const [initial] = useState(loadOverrides);
  // Saved overrides, so a leftover one is never a hidden state.
  const active = Object.keys(initial).length;
  const [values, setValues] = useState(() => Object.fromEntries((Object.keys(NUMBER_FIELDS) as NumberKey[]).map((key) => [key, String(initial[key] ?? effective(key))])) as Record<NumberKey, string>);
  const [flags, setFlags] = useState(() => Object.fromEntries(BOOLEAN_KEYS.map((key) => [key, initial[key] ?? config[key]])) as Record<BooleanKey, boolean>);
  const [message, setMessage] = useState<Message | null>(null);

  const toggle = (key: BooleanKey, label: string) => (
    <Field.Root>
      <Checkbox.Root checked={flags[key]} onCheckedChange={(e) => setFlags({ ...flags, [key]: e.checked === true })}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>{label}</Checkbox.Label>
      </Checkbox.Root>
      <Field.HelperText>{settingDescriptions[key]}</Field.HelperText>
    </Field.Root>
  );

  return (
    <Stack gap="6">
      <Alert.Root status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Development only</Alert.Title>
          <Alert.Description>These are system settings for the demo. Saving reloads the page.</Alert.Description>
        </Alert.Content>
      </Alert.Root>

      {/* Only on while overrides are saved; saving or resetting reloads the page, so it never appears live and needs no reserved space. */}
      {active > 0 && (
        <Flex alignItems="center" justifyContent="space-between" gap="2">
          <Text role="status">Custom settings active ({active})</Text>
          <Button type="button" variant="outline" size="sm" onClick={() => (resetOverrides() ? location.reload() : setMessage({ status: 'error', text: 'Could not reset the settings: this browser is blocking local storage.' }))}>
            Reset to defaults
          </Button>
        </Flex>
      )}

      {/* noValidate: out-of-range numbers are clamped on save, not blocked by the browser. */}
      <Stack asChild gap="4">
      <form noValidate onSubmit={(e) => {
        e.preventDefault();
        if (saveOverrides(overridesFromForm(values, flags))) location.reload();
        else setMessage({ status: 'error', text: 'Could not save the settings: this browser is blocking local storage.' });
      }}>
        {(Object.keys(NUMBER_FIELDS) as NumberKey[]).map((key) => (
          <Fragment key={key}>
            <Field.Root>
              <Field.Label>{NUMBER_FIELDS[key].label}</Field.Label>
              <Input type="number" inputMode="numeric" fontSize="md" min={NUMBER_FIELDS[key].min} max={NUMBER_FIELDS[key].max} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
              <Field.HelperText>{settingDescriptions[key]}</Field.HelperText>
            </Field.Root>
            {key === 'popularDesktop' && toggle('popularSearchOneLine', 'Keep popular pills on one line')}
          </Fragment>
        ))}
        {toggle('showRawData', 'Show raw data')}
        <Stack gap="2">
          <Button type="submit">Save and reload</Button>
        </Stack>
      </form>
      </Stack>

      <ResetPopularSearches onDone={setMessage} />

      {/* Always rendered with a minimum height, so a message appearing moves nothing. */}
      <Text role="status" minHeight="6" color={message?.status === 'error' ? 'fg.error' : 'fg.muted'}>
        {message?.text}
      </Text>
    </Stack>
  );
}

function ResetPopularSearches({ onDone }: { onDone: (message: Message) => void }) {
  const { api, popular } = useSearchBackend();
  const queryClient = useQueryClient();
  const run = (action: () => Promise<void>, done: string) => async () => {
    try {
      await action();
      // The pills and the Insights tab read the search log, so both refetch.
      popular.refresh();
      await queryClient.invalidateQueries({ queryKey: ['insights'] });
      onDone({ status: 'success', text: done });
    } catch (error) {
      onDone({
        status: 'error',
        text: error instanceof ApiError && error.status === 404 ? 'The API has its development routes off. Start it with ENABLE_INSIGHTS=true.' : 'Could not reset popular searches.',
      });
    }
  };

  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        Reset popular searches
      </Heading>
      <Text color="fg.muted">These buttons change the shared search log that feeds the popular pills and the Insights tab. Clearing it makes the pills fall back to the featured Betashares ETFs and empties Insights.</Text>
      <Confirm
        trigger="Clear popular searches"
        help="Empties the search log. The popular pills fall back to the featured Betashares ETFs."
        title="Clear popular searches?"
        body="Every recorded search is deleted for everyone using this API."
        onConfirm={run(api.clearSearchLog, 'Popular searches cleared.')}
      />
      <Confirm
        trigger="Restore demo popular searches"
        help="Replaces the search log with the demo history, including the zero-result terms in Insights. Anything searched since is lost."
        title="Restore demo popular searches?"
        body="Anything searched since the demo history was loaded is lost."
        onConfirm={run(api.restoreSeed, 'Demo popular searches restored.')}
      />
    </Stack>
  );
}

// The confirm button repeats the trigger's wording, so the question and its answer match what was clicked.
function Confirm({ trigger, help, title, body, onConfirm }: { trigger: string; help: string; title: string; body: ReactNode; onConfirm: () => Promise<void> }) {
  const helpId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog.Root role="alertdialog" open={open} onOpenChange={(e) => setOpen(e.open)} lazyMount unmountOnExit>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" aria-describedby={helpId}>
          {trigger}
        </Button>
      </Dialog.Trigger>
      <Text id={helpId} color="fg.muted" fontSize="sm">
        {help}
      </Text>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>{body}</Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                type="button"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  await onConfirm();
                  setBusy(false);
                  setOpen(false);
                }}
              >
                {trigger}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
