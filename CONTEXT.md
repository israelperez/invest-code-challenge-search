# Instrument Search

Finding ASX-listed investments on the Betashares website: typing a query, being guided towards likely terms, then narrowing and ordering the matching instruments.

## Language

### Catalogue

**Instrument**:
A single ASX-listed investment a user can find, either an ETF or an equity.
The UI labels the two types "Shares (equities)" and "ETFs" (a row says "Share (equity)" or "ETF"), plain word first, so people new to investing learn the term.
_Avoid_: Product, fund, security, stock

**Ticker**:
The short exchange code that identifies an instrument, e.g. `A200`.
The UI labels it "ASX code (ticker)" so people who don't know the word understand it.
_Avoid_: symbol (in user-facing copy)

**Issuer**:
The company that manages an instrument, e.g. Betashares or Vanguard.
_Avoid_: Provider, manager, fund house

### Guiding the query

**Search**:
A term the user submits (typed, or picked from a suggestion, popular search or recent search). Only searches count towards popular searches and become recent searches.
_Avoid_: Lookup, find, query (for the submitted act)

**Refinement**:
A change to the filters or ordering of the current search. It changes the results but is not a new search.
_Avoid_: Re-search, new search

**Suggestion**:
A term or instrument offered while the user is still typing, drawn from live catalogue data.
_Avoid_: Autocomplete, prediction, hint

**Popular search**:
A term ranked among the most searched across all users of the platform.
_Avoid_: Trending, top search, common search

**Recent search**:
A search this user has previously submitted on this device, shown newest first.
_Avoid_: Past search, history, saved search
