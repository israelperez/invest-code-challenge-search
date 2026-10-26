# Mock Search API

A local, read-only mock of the Betashares Search API. It searches the 834 ASX-listed ETFs and shares in [`data/instruments.json`](data/instruments.json). Build your search page against it.

## Running it

From the repository root (Node 20+):

```bash
npm run api:install
npm run api        # http://localhost:8787
```

It accepts requests from any origin, so a frontend on `http://localhost:3000` can call it directly.

## Endpoints

| Method | Path | Use it for |
| --- | --- | --- |
| POST | `/search` | Search results: free text, filters, ordering and pages |
| POST | `/search/index` | ID-first search: count, an ordered window of IDs and the first documents |
| POST | `/searches` | Record an explicit search in the search log (fire-and-forget, `202`) |
| GET | `/version` | The current `indexed_at`, to spot a restarted API |
| POST | `/facets/:key` | Filter options with counts, e.g. `/facets/kind` |
| GET | `/facets/keys` | The facet keys you can request |
| GET | `/instruments/:symbol_openfigi` | One instrument, e.g. `/instruments/A200:AU` |

## Searching

Send a JSON body to `POST /search`. Every key is optional, so `{}` returns the first page of everything.

```json
{
  "search_text": "bank",
  "kind": ["etf"],
  "is_betashares": { "value": true },
  "order_by": "symbol.asc",
  "from": 1,
  "size": 15
}
```

The response:

```json
{
  "results": [
    {
      "symbol": "A200",
      "symbol_openfigi": "A200:AU",
      "display_name": "Betashares Australia 200 ETF",
      "kind": "etf",
      "currency": "AUD",
      "logo": "https://instruments.wealth.betashares.com.au/logos-etf/betashares.png",
      "issuer": "betashares",
      "is_betashares": true,
      "is_flagship_fund": true,
      "is_portfolio_excluded": false,
      "is_auto_invest_included": true,
      "units_circulating": null
    }
  ],
  "count": 102,
  "indexed_at": 1790908072598
}
```

`count` is the total number of matches across all pages. Add `?fields=symbol,display_name` to return only those fields, which suits lightweight suggestions.

### Free text

`search_text` matches `symbol`, `symbol_openfigi`, `display_name` and `issuer`, ignoring case. Every word must appear in the same field, and `OR` between words searches for either side, e.g. `"bank OR mining"`.

Results are ranked: exact ticker first, then the start of a ticker, then name matches, then other matches. With no `search_text`, Betashares instruments come first, then everything else A–Z by symbol.

### Filters

| Filter | Format | Example |
| --- | --- | --- |
| `kind` | list of values | `["etf", "equity"]` |
| `issuer` | list of values | `["vanguard", "blackrock"]` |
| `symbol_openfigi` | list of values | `["A200:AU"]` |
| `is_betashares` | `{ value: boolean }` | `{ "value": true }` |
| `is_flagship_fund` | `{ value: boolean }` | `{ "value": true }` |
| `is_portfolio_excluded` | `{ value: boolean }` | `{ "value": false }` |
| `is_auto_invest_included` | `{ value: boolean }` | `{ "value": true }` |
| `units_circulating` | `{ min, max }` as numeric strings, inclusive | `{ "min": "1000000000" }` |

A list filter matches any of its values. Different filters combine, so a result must match all of them.

Some fields are only set on some instruments. `issuer` is set on every ETF but on only a few shares. `units_circulating` is only set on shares, so a `units_circulating` filter excludes every ETF.

### Ordering and pages

- `order_by`: any result field, with an optional direction: `"symbol.asc"` or `"units_circulating.desc"`. The direction defaults to `desc`, and missing values always sort last.
- `from`: the page number, starting at 1.
- `size`: the page size, 15 by default.

## ID-first search

`POST /search/index` returns the matching `symbol_openfigi` IDs in order, with the first few documents inlined, so a client can page through IDs and hydrate documents separately (see [ADR 0001](../docs/adr/0001-id-first-search-with-hydration.md)). It is strict: unknown fields, including `from`, `size` and `symbol_openfigi`, return `400`. Every key is optional.

```json
{
  "search_text": "bank",
  "kind": ["etf"],
  "is_betashares": { "value": true },
  "units_circulating": { "min": "1000" },
  "order_by": "symbol.asc",
  "include": ["count", "ids", "documents"],
  "id_offset": 0,
  "id_limit": 1000,
  "document_limit": 15
}
```

```json
{
  "indexed_at": 1790908072598,
  "count": 102,
  "ids": ["A200:AU", "BNKS:AU"],
  "next_id_offset": null,
  "documents": [{ "symbol": "A200", "symbol_openfigi": "A200:AU", "...": "as in /search" }]
}
```

- Filters are those of `/search`, except `symbol_openfigi`. Boolean filters are exactly `{ "value": boolean }` and `units_circulating` takes only `min` and `max` as numeric strings.
- `order_by` is one of `symbol`, `display_name` or `units_circulating`, then `.asc` or `.desc`. Omitted, the default order applies. Ties are broken by `symbol_openfigi`, so the order is fully determined (`/search` is unchanged).
- `include` lists what to return, from `count`, `facets`, `ids` and `documents`. It defaults to all, repeats are ignored and `documents` needs `ids` (else `400`). `facets` returns the options and counts described below. `indexed_at` is always returned.
- `facets` holds all seven keys from `GET /facets/keys`, each a list of `{ "value", "count" }` in the same value format as `POST /facets/:key`. The options are every value across all instruments, not only the matches, so an option with no matches shows `count: 0`. `is_*` keys always list both `"true"` and `"false"`, where `/facets` drops a value absent from the data.
- A facet count is the result count if that option alone were selected in its section, with every other filter and `search_text` applied, so a section's own filter never hides its other options. `units_circulating` buckets include both edges, like the range filter, so a value on an edge counts in both buckets.
- Facets are only computed when `include` has `facets`: one search pass plus one more for each facet the request filters on.
- The ID window: `ids` starts at `id_offset` (default 0) and holds at most `id_limit` IDs (default 1000, 1 to 1000). `next_id_offset` is where the next window starts, or `null` when no IDs remain. An offset past the end gives `ids: []`.
- `documents` holds the full documents of the first `document_limit` IDs of the window (default 15, 0 to 100), in the same order. When `ids` is not included, `id_offset`, `id_limit` and `document_limit` are ignored.
- Bounds: `search_text` 0 to 100 characters; `kind` and `issuer` up to 100 values of up to 100 characters; `id_offset` up to 1,000,000.
- `X-Client-Id` is accepted and ignored for now.

To continue, send the next window with the `indexed_at` from the first response as `snapshot`:

```json
{ "search_text": "bank", "include": ["ids", "documents"], "id_offset": 15, "id_limit": 15, "snapshot": 1790908072598 }
```

`snapshot` is required when `id_offset` is above 0. If it no longer matches the current `indexed_at` (the API restarted on new data), the response is `409` with the current value, and the client should start again from the first window:

```json
{ "message": "The snapshot is stale, restart from the first window", "indexed_at": 1790908099999 }
```

`GET /version` returns `{ "indexed_at": 1790908072598 }`.

Request bodies are limited to 32KB on every endpoint; larger ones return `413`.

## Instruments batch

`POST /instruments/batch` returns the full documents for a list of IDs, so a client that already has the IDs from `/search/index` can fetch only the ones it is missing. It is strict: unknown fields return `400`.

```json
{ "ids": ["A200:AU", "BNKS:AU", "NOPE:AU"], "snapshot": 1790908072598 }
```

```json
{
  "documents": [{ "symbol": "A200", "symbol_openfigi": "A200:AU", "...": "as in /search" }],
  "missing": ["NOPE:AU"],
  "indexed_at": 1790908072598
}
```

- `ids` holds 1 to 100 IDs. Each is uppercased, then must match `/^[A-Z0-9.]+:[A-Z]{2}$/` (at most 30 characters before that check). Any bad ID returns `400`.
- Duplicates are collapsed after uppercasing, keeping the first occurrence.
- `documents` and `missing` follow request order. `missing` holds the uppercased IDs with no instrument.
- `snapshot` is required: the `indexed_at` from an earlier response. If it no longer matches, the response is `409` with the current value, the same as `/search/index`. It is checked after the body is validated.

## Facets

Facets give you filter options with counts. `GET /facets/keys` lists the facet keys: `kind`, `issuer`, the four `is_*` flags and `units_circulating`.

`POST /facets/:key` takes the same body as `/search` and returns the count for each value of that key:

```bash
curl -X POST localhost:8787/facets/kind -d '{ "search_text": "bank" }'
# [{ "value": "equity", "count": 5 }, { "value": "etf", "count": 6 }]
```

- Each count is how many results `/search` would return with that value selected. The facet's own filter in the body is replaced, so other options still show their counts.
- `units_circulating` values are ranges such as `"1000000000,5000000000"`.
- `is_*` values are `"true"` and `"false"`.
- Add `?omit_empty_counts=true` to leave out values with a count of 0.

## Search log

`POST /searches` records one explicit search (a typed submit, a suggestion pick) so popular searches and zero-result insights can be built on server-computed numbers. Refinements are never sent. It is strict: unknown fields return `400`. It sits beside `/search/index` so results stay cacheable.

```bash
curl -X POST localhost:8787/searches \
  -H 'X-Client-Id: 3f2b8c1e-5d4a-4e6b-9a7c-1d2e3f4a5b6c' \
  -d '{ "term": "global x", "submission_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" }'
# 202, empty body
```

- `term` is 1 to 100 characters. `submission_id` is a UUID. The `X-Client-Id` header is a required UUID the client keeps in localStorage. Anyone can fake it, so it raises the cost of poisoning rather than preventing it. Anything invalid returns `400`.
- Otherwise the answer is always `202`, including when the search is not recorded: the request is rate limited (token buckets per IP, 60 a minute with a burst of 20, and per client ID, 20 a minute with a burst of 10), the dedupe key is empty (blank, only stop words, or a leading, trailing or repeated `OR`), or the `submission_id` was seen in the last 10 minutes (retries are idempotent).
- The server counts the matches itself, without filters, for the trimmed, lowercased spelling (`OR` stays uppercase), and records the key, spelling, client, count and submission.
- The log is in memory and bounded: 5,000 keys, 1,000 distinct clients per key, 10 spellings per key, 10,000 remembered submission IDs. All limits live in `src/search-log/search-log.config.ts`. It resets on restart.
- Validation rejects, rate-limit drops and evictions print one JSON line to the console, never the term.

## Errors

An invalid body returns `400` with a reason, e.g. `{ "message": "kind must be an array of strings" }`. An unknown instrument returns `404 { "message": "Instrument not found: XYZ:AU" }`.

## Working on the mock

You don't need to change the mock for the challenge. If you do, run it from this folder with `npm start`, which restarts the server when `src/` or `data/` change.

| To | Edit |
| --- | --- |
| Add a field to results | `InstrumentDocument` in `src/models/instrument.model.ts`, and the mapper in `src/repositories/instruments-json.repository.ts` |
| Make a field searchable, filterable or a facet | The lists in `src/models/search-fields.config.ts` |
| Change ranking or the default order | `scoreTextMatch` and `applyDefaultOrder` in `src/services/search.service.ts` |
| Change the data | `data/instruments.json` |

The app follows a controller → service → repository structure:

- `src/controllers/` handles HTTP.
- `src/services/` holds the search and facet logic.
- `src/repositories/` reads the JSON file.
- `src/app.ts` wires everything together, and `src/main.ts` starts the server.
