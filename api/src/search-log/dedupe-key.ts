const STOP_WORDS = new Set(['and', 'the', 'of', 'for', 'asx']);

/**
 * Groups spellings of one search under a key, or returns '' when the term isn't logged: blank, a
 * malformed OR (leading, trailing, repeated) or only stop words. Uppercase OR separates clauses.
 */
export function dedupeKey(term: string): string {
  const words = term.trim().split(/\s+/);
  const clauses: string[][] = [[]];
  for (const word of words) {
    if (word === 'OR') {
      clauses.push([]);
    } else {
      clauses[clauses.length - 1].push(word);
    }
  }

  if (clauses.some((clause) => clause.join('') === '')) {
    return '';
  }

  return clauses
    .map((clause) =>
      [
        ...new Set(
          clause
            .map((word) => word.toLowerCase())
            .filter((word) => !STOP_WORDS.has(word)),
        ),
      ]
        .sort()
        .join(' '),
    )
    .filter(Boolean)
    .sort()
    .join(' OR ');
}

/**
 * The text the search actually runs: trimmed, whitespace collapsed, lowercase except the OR operator.
 */
export function executableSpelling(term: string): string {
  return term
    .trim()
    .split(/\s+/)
    .map((word) => (word === 'OR' ? word : word.toLowerCase()))
    .join(' ');
}
