export const config = {
  // Base URL of the Search API.
  apiBaseUrl: 'http://localhost:8787',
  // Instruments shown per batch; sent as document_limit.
  documentLimit: 15,
  // A last page this small is merged into the page before it, so results never end on a tiny page.
  orphanSize: 3,
  // Size of the ordered id window requested with each search; sent as id_limit.
  idLimit: 1000,
  // How long a search result stays fresh; Infinity because indexed_at invalidates it instead.
  searchStaleTimeMs: Infinity,
  // How long GET /version stays fresh before a mount, focus or reconnect refetches it.
  versionStaleTimeMs: 60_000,
  // How long filter ticks settle before the counts-only request goes out.
  countsDebounceMs: 150,
  // Placeholder rows shown while a new search loads.
  skeletonRows: 5,
  // Issuers shown before "Show all"; the rest are one click away.
  featuredIssuers: 8,
  // Characters typed before suggestions are fetched.
  suggestionMinChars: 3,
  // How long typing settles before the suggestion request goes out.
  suggestionDebounceMs: 200,
  // Searches (issuer terms) shown in the suggestion list.
  suggestionTermLimit: 5,
} as const;
