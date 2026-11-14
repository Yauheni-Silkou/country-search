export const API_BASE_URL = 'https://countries.dev';
export const SEARCH_BY_NAME_PATH = '/name';
export const DEBOUNCE_DELAY_MS = 350;
export const REQUEST_TIMEOUT_MS = 5000;
export const HTTP_STATUS_NOT_FOUND = 404;

export function buildCountrySearchUrl(query: string): string {
  return `${API_BASE_URL}${SEARCH_BY_NAME_PATH}/${encodeURIComponent(query)}`;
}
