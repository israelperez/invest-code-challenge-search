import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs before each test file, so each gets its own log file and never touches data/search-log.json.
process.env.SEARCH_LOG_FILE = join(mkdtempSync(join(tmpdir(), 'search-log-test-')), 'search-log.json');
