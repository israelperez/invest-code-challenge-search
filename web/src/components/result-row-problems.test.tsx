// @vitest-environment jsdom
import '../../tests/component/jsdom-setup';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { doc, problemsWrapper } from '../../tests/component/app-harness';
import { createProblemCounter } from '../insights/problem-counter';
import { ResultRow } from './ResultRow';

afterEach(cleanup);

const setup = () => {
  const report = vi.fn();
  const problems = createProblemCounter();
  return { report, wrapper: problemsWrapper({ report, problems }) };
};

describe('ResultRow problem reports', () => {
  it('reports a failing real logo once, with the instrument ID', () => {
    const { report, wrapper } = setup();
    const { container } = render(<ResultRow instrument={{ ...doc('A:AU'), logo: 'https://example.test/a.png' }} />, { wrapper });
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    fireEvent.error(img);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('logo_failed', expect.objectContaining({ level: 'warn', detail: 'A:AU', entries: ['A (https://example.test/a.png)'] }));
  });

  it('does not report a row that has no logo at all', () => {
    const { report, wrapper } = setup();
    const { container } = render(<ResultRow instrument={doc('A:AU')} />, { wrapper });
    fireEvent.error(container.querySelector('img')!);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports an empty display name once, even across re-renders and remounts', () => {
    const { report, wrapper } = setup();
    const instrument = { ...doc('A:AU'), display_name: '' };
    const view = render(<ResultRow instrument={instrument} />, { wrapper });
    view.rerender(<ResultRow instrument={{ ...instrument }} />);
    view.unmount();
    render(<ResultRow instrument={instrument} />, { wrapper });
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('no_display_name', expect.objectContaining({ level: 'warn', detail: 'A:AU', entries: ['A:AU (A)'] }));
  });

  it('names symbol and ID when they differ, so the nameless instrument can be found', () => {
    const { report, wrapper } = setup();
    render(<ResultRow instrument={{ ...doc('ACME:AU'), symbol: 'ACME', display_name: '' }} />, { wrapper });
    expect(report).toHaveBeenCalledWith('no_display_name', expect.objectContaining({ entries: ['ACME:AU (ACME)'] }));
  });

  it('does not report a row with a display name', () => {
    const { report, wrapper } = setup();
    render(<ResultRow instrument={doc('A:AU')} />, { wrapper });
    expect(report).not.toHaveBeenCalled();
  });
});
