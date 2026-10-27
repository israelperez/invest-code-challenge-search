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
} as const;

export const config = {
  // Base URL of the Search API.
  apiBaseUrl: 'http://localhost:8787',
  // settingDescriptions.documentLimit
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
  // settingDescriptions.suggestionMinChars
  suggestionMinChars: 3,
  // How long typing settles before the suggestion request goes out.
  suggestionDebounceMs: 200,
  // settingDescriptions.suggestionTermLimit
  suggestionTermLimit: 5,
  // Placeholder rows shown in the suggestion list while the first lookup loads.
  suggestionSkeletonRows: 1,
  // settingDescriptions.popularMobile, popularTablet and popularDesktop (the theme's tablet and desktop breakpoints); the request asks for the largest.
  popularShown: { mobile: 6, tablet: 8, desktop: 13 },
  // The most popular pills any size may show: the API seed holds 15 popular searches, so a higher count would show gaps.
  popularMax: 15,
  // settingDescriptions.popularSearchOneLine
  popularSearchOneLine: true,
  // The popular searches listed under the recent ones when the empty search box is focused.
  popularInPopup: 5,
  // Feature flag: remember this user's searches and offer them when the input is focused.
  recentSearches: true,
  // settingDescriptions.recentSearchLimit
  recentSearchLimit: 4,
  // Feature flag: the Insights tab in the gear panel (development only: on under `vite` and Vitest, off in a production build; also needs the API's ENABLE_INSIGHTS).
  insightsEnabled: import.meta.env.DEV,
  // Feature flag: the Settings tab in the gear panel (development only, like insightsEnabled).
  settingsEnabled: import.meta.env.DEV,
  // Feature flag: the Data problems section in the Insights tab (development only, like insightsEnabled).
  dataProblemsEnabled: import.meta.env.DEV,
  // settingDescriptions.showRawData; off by default.
  showRawData: false,
  // Feature flag: send product events and problem reports to analytics (the console, for now); off prints problems as plain console output.
  analytics: true,
  // Betashares ETFs offered as pills when there are no popular searches to show.
  featuredSearches: ['A200', 'NDQ', 'QAU', 'DHHF', 'HQLT', 'BGBL'],
} as const;

// One request serves every size, so resizing never refetches. A function because demo settings change popularShown at startup; at least 1, which the API requires.
export const popularRequestLimit = () => Math.max(1, ...Object.values(config.popularShown));
