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
  idLimit: 'The most matching instruments, in sort order, that one search request will list. At 15 results per load, 500 is about 33 loads. It cannot go above 1000, the most the API returns in one request. With more matches than this, the next set is fetched as you keep clicking "Load more".',
  versionStaleTimeMs: 'How long the app trusts its last check of the data timestamp from the API, in milliseconds. It never checks on a timer, only when you return to the page (or the network reconnects), and only if the last check is older than this. Stay on the page and it never asks. Come back after this long and it asks straight away: if the timestamp changed it clears what it kept and loads fresh results, otherwise it keeps what it has.',
  skeletonRows: 'How many grey skeleton rows (placeholders) show in the results while a new search loads.',
  featuredIssuers: 'How many issuers the issuer filter lists before "Show all".',
  suggestionDebounceMs: 'How long typing must pause, in milliseconds, before suggestions are requested. Lower feels faster but sends more requests.',
  suggestionSkeletonRows: 'How many grey skeleton rows (placeholders) show in the suggestion list while the first lookup loads.',
  popularMax: 'The most popular search pills any screen size can show. The three pill counts cannot go higher than this.',
  popularInPopup: 'How many popular searches are listed under your recent ones when you click the empty search box.',
  recentSearches: 'When on, the app remembers your searches and offers them when you click the search box. When off, none are offered.',
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
  // settingDescriptions.idLimit; sent as id_limit. The API's maximum is 1000.
  idLimit: 500,
  // How long a search result stays fresh; Infinity because indexed_at invalidates it instead.
  searchStaleTimeMs: Infinity,
  // settingDescriptions.versionStaleTimeMs
  versionStaleTimeMs: 600_000,
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
  // settingDescriptions.showRawData; off by default.
  showRawData: false,
} as const;

// One request serves every size, so resizing never refetches. A function because demo settings change popularShown at startup; at least 1, which the API requires.
export const popularRequestLimit = () => Math.max(1, ...Object.values(config.popularShown));
