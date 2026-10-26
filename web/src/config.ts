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
  // Placeholder rows shown in the suggestion list while the first lookup loads.
  suggestionSkeletonRows: 1,
  // Popular pills shown at each size (the theme's tablet and desktop breakpoints); the request asks for the largest.
  popularShown: { mobile: 6, tablet: 8, desktop: 13 },
  // The most popular pills any size may show: the API seed holds 15 popular searches, so a higher count would show gaps.
  popularMax: 15,
  // Keeps the popular pills on one line, hiding those that don't fit, instead of wrapping.
  popularSearchOneLine: true,
  // Feature flag: remember this user's searches and offer them when the input is focused.
  recentSearches: true,
  // Recent searches kept, newest first.
  recentSearchLimit: 5,
  // Feature flag: send product events and problem reports to analytics (the console, for now); off prints problems as plain console output.
  analytics: true,
  // Betashares ETFs offered as pills when there are no popular searches to show.
  featuredSearches: ['A200', 'NDQ', 'QAU', 'DHHF', 'HQLT', 'BGBL'],
} as const;

// One request serves every size, so resizing never refetches.
export const popularRequestLimit = Math.max(...Object.values(config.popularShown));
