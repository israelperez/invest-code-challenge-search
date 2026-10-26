// Plain word first, precise term in brackets. [singular, plural]
const LABELS: Record<string, [string, string]> = {
  equity: ['Share (equity)', 'Shares (equities)'],
  etf: ['ETF', 'ETFs'],
};

// Plural for the filter and chip, singular for a result row; an unknown kind shows as given.
export const kindLabel = (kind: string, plural = false): string => LABELS[kind]?.[plural ? 1 : 0] ?? kind;
