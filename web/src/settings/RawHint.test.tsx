// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { ChakraProvider } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../config';
import { system } from '../theme';
import { RawHint } from './RawHint';

const wrapper = ({ children }: { children: React.ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;
const flags = config as { showRawData: boolean };
afterEach(() => void (flags.showRawData = false));

describe('RawHint', () => {
  it('shows a string or number value when raw data is on', () => {
    flags.showRawData = true;
    const { container } = render(
      <>
        <RawHint value="investors_mutual" />
        <RawHint value={1500000} />
      </>,
      { wrapper },
    );
    expect(container.textContent).toBe(' investors_mutual 1500000');
  });

  it('renders no DOM when raw data is off', () => {
    const { container } = render(<RawHint value="investors_mutual" />, { wrapper });
    expect(container.innerHTML).toBe('');
  });
});
