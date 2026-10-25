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
