export const API_BASE_URL = 'https://countries.dev';
export const SEARCH_BY_NAME_PATH = '/name';
export const DEBOUNCE_DELAY_MS = 300;
export const REQUEST_TIMEOUT_MS = 5000;
export const HTTP_STATUS_NOT_FOUND = 404;
export const SEARCH_HISTORY_STORAGE_KEY = 'country_search_history';
export const MAX_SEARCH_HISTORY_ITEMS = 10;
export function buildCountrySearchUrl(query) {
    return `${API_BASE_URL}${SEARCH_BY_NAME_PATH}/${encodeURIComponent(query)}`;
}
