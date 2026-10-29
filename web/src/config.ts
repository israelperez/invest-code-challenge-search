import { breakpoints } from './theme';

// Help text for the demo settings: the Settings tab shows these sentences under each field.
export const settingDescriptions = {
  documentLimit: 'How many results load at a time: the first batch and each "Load more". Higher means fewer clicks but a bigger request.',
  suggestionMinChars: 'How many characters must be typed before suggestions appear. At 3, typing "gl" shows nothing and "glo" shows suggestions. Lower values suggest sooner, on vaguer text.',
  suggestionTermLimit: 'The most issuer searches listed in the suggestions (for example "Global X" or "Vanguard"), above the matching instruments. The instrument matches are always up to 5.',
  popularMobile: `How many popular search pills appear under the search box on phones, screens narrower than ${breakpoints.tablet}. Pills that do not fit on one line stay hidden.`,
  popularTablet: `How many popular search pills appear under the search box on tablets, screens from ${breakpoints.tablet} up to ${breakpoints.desktop} wide.`,
  popularDesktop: `How many popular search pills appear under the search box on desktops, screens ${breakpoints.desktop} wide and up.`,
  popularSearchOneLine: 'When on, popular pills that do not fit on one line stay hidden, so the pills never wrap. When off, they wrap onto more lines and all the chosen pills show.',
  recentSearchLimit: 'How many of your latest searches are remembered and offered when you click the search box, newest first. When full, the oldest drops off.',
  showRawData: 'Shows the values exactly as the API sends them (issuer, type, units on issue and instrument ID) in small text beside each label. Use it to tell apart issuers that share a label, such as "investors mutual" and "investors_mutual".',
  apiBaseUrl: 'The address of the Search API the app talks to. It must start with http:// or https://. A wrong address leaves the app with no results.',
  apiRetries: 'How many times a failed request is tried again before the app gives up. Only network errors, timeouts and server errors are retried. At 0, nothing is retried.',
  apiRetryBaseMs: 'How long to wait before the first retry, in milliseconds. The wait doubles after each retry, so 250 means 250, 500, then 1000.',
  apiTimeoutMs: 'The longest one request may take, in milliseconds. A request that takes longer counts as failed and is retried.',
  orphanSize: 'A last page this small is joined to the page before it, so results never end on a tiny page. At 0, pages are never joined. It must be lower than Results per load.',
  idLimit: 'How many matching instrument IDs each search request asks for ahead of the results (the API allows up to 1000). Lower means more, smaller requests as you keep clicking "Load more".',
  versionStaleTimeMs: 'How long the app trusts its last check of the API data version, in milliseconds, before it checks again when you return to the page. A newer version reloads the results.',
  countsDebounceMs: 'How long the filter counts wait after your last tick, in milliseconds, before they update. Higher means fewer requests while you tick several filters.',
  skeletonRows: 'How many grey placeholder rows show in the results while a new search loads.',
  featuredIssuers: 'How many issuers the issuer filter lists before "Show all".',
  suggestionDebounceMs: 'How long typing must pause, in milliseconds, before suggestions are requested. Lower feels faster but sends more requests.',
  suggestionSkeletonRows: 'How many grey placeholder rows show in the suggestion list while the first lookup loads.',
  popularMax: 'The most popular search pills any screen size can show. The three pill counts cannot go higher than this.',
  popularInPopup: 'How many popular searches are listed under your recent ones when you click the empty search box.',
  recentSearches: 'When on, the app remembers your searches and offers them when you click the search box. When off, none are offered.',
  insightsEnabled: 'Shows the Insights tab in this panel. It also needs the API started with ENABLE_INSIGHTS=true.',
  dataProblemsEnabled: 'Shows the Data problems section in the Insights tab.',
  analytics: 'When on, product events and problem reports go to analytics (the console, for now). When off, problems print as plain console output.',
  featuredSearches: 'The Betashares ETFs shown as pills when there are no popular searches yet. Separate the symbols with commas.',
} as const;

export const config = {
  // settingDescriptions.apiBaseUrl
  apiBaseUrl: 'http://localhost:8787',
  // settingDescriptions.apiRetries; only network errors, timeouts and 5xx are retried; total attempts are this plus one.
  apiRetries: 3,
  // settingDescriptions.apiRetryBaseMs
  apiRetryBaseMs: 250,
  // settingDescriptions.apiTimeoutMs
  apiTimeoutMs: 5000,
  // settingDescriptions.documentLimit
  documentLimit: 15,
  // settingDescriptions.orphanSize; merged into the page before it; the first request asks for documentLimit + orphanSize.
  orphanSize: 3,
  // settingDescriptions.idLimit; sent as id_limit.
  idLimit: 1000,
  // How long a search result stays fresh; Infinity because indexed_at invalidates it instead.
  searchStaleTimeMs: Infinity,
  // settingDescriptions.versionStaleTimeMs
  versionStaleTimeMs: 60_000,
  // settingDescriptions.countsDebounceMs
  countsDebounceMs: 150,
  // settingDescriptions.skeletonRows
  skeletonRows: 5,
  // settingDescriptions.featuredIssuers
  featuredIssuers: 8,
  // settingDescriptions.suggestionMinChars
  suggestionMinChars: 3,
  // settingDescriptions.suggestionDebounceMs
  suggestionDebounceMs: 200,
  // settingDescriptions.suggestionTermLimit
  suggestionTermLimit: 5,
  // settingDescriptions.suggestionSkeletonRows
  suggestionSkeletonRows: 1,
  // settingDescriptions.popularMobile, popularTablet and popularDesktop (the theme's tablet and desktop breakpoints); the request asks for the largest.
  popularShown: { mobile: 6, tablet: 8, desktop: 13 },
  // settingDescriptions.popularMax; a display cap; the API seed holds 43 popular searches.
  popularMax: 15,
  // settingDescriptions.popularSearchOneLine
  popularSearchOneLine: true,
  // settingDescriptions.popularInPopup
  popularInPopup: 5,
  // settingDescriptions.recentSearches; a feature flag.
  recentSearches: true,
  // settingDescriptions.recentSearchLimit
  recentSearchLimit: 4,
  // settingDescriptions.insightsEnabled; a development-only feature flag: on under `vite` and Vitest, off in a production build.
  insightsEnabled: import.meta.env.DEV,
  // Feature flag: the Settings tab in the gear panel (development only, like insightsEnabled).
  settingsEnabled: import.meta.env.DEV,
  // settingDescriptions.dataProblemsEnabled; a development-only feature flag, like insightsEnabled.
  dataProblemsEnabled: import.meta.env.DEV,
  // settingDescriptions.showRawData; off by default.
  showRawData: false,
  // settingDescriptions.analytics; a feature flag.
  analytics: true,
  // settingDescriptions.featuredSearches
  featuredSearches: ['A200', 'NDQ', 'QAU', 'DHHF', 'HQLT', 'BGBL'],
} as const;

// One request serves every size, so resizing never refetches. A function because demo settings change popularShown at startup; at least 1, which the API requires.
export const popularRequestLimit = () => Math.max(1, ...Object.values(config.popularShown));
