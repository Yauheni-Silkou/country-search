import { DEBOUNCE_DELAY_MS } from './constants.js';
import { debounce } from './debounce.js';
import { classifySearchError } from './errorClassifier.js';
import type { Country } from './mapCountryResponse.js';
import { type CachedCountrySearch, createCachedCountrySearch } from './cachedCountrySearch.js';

export type SearchState =
  | { status: 'idle'; query: string }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; countries: Country[] }
  | { status: 'empty'; query: string }
  | { status: 'error'; query: string; message: string };

export interface CountrySearchController {
  handleInput(rawQuery: string): void;
  retry(): void;
  dispose(): void;
}

export function createCountrySearchController(
  onStateChange: (state: SearchState) => void,
  delayMs = DEBOUNCE_DELAY_MS,
  cachedSearch: CachedCountrySearch = createCachedCountrySearch()
): CountrySearchController {
  let currentController: AbortController | null = null;
  let latestQuery = '';
  let isDisposed = false;

  const cancelActiveRequest = (): void => {
    if (currentController !== null) {
      currentController.abort();
      currentController = null;
    }
  };

  const executeSearch = async (query: string): Promise<void> => {
    if (isDisposed || query !== latestQuery || query === '') {
      return;
    }

    cancelActiveRequest();

    const controller = new AbortController();
    currentController = controller;

    onStateChange({ status: 'loading', query });

    try {
      const countries = await cachedSearch.search(query, controller.signal);

      if (controller !== currentController || isDisposed) {
        return;
      }

      currentController = null;
      onStateChange(
        countries.length === 0
          ? { status: 'empty', query }
          : { status: 'success', query, countries }
      );
    } catch (error: unknown) {
      if (controller === currentController) {
        currentController = null;
      }

      const classified = classifySearchError(error);
      if (classified.kind === 'abort') {
        return;
      }

      if (!isDisposed && query === latestQuery) {
        onStateChange({
          status: 'error',
          query,
          message: classified.message,
        });
      }
    }
  };

  const debouncedSearch = debounce((query: string) => {
    void executeSearch(query);
  }, delayMs);

  const handleInput = (rawQuery: string): void => {
    cancelActiveRequest();

    const trimmed = rawQuery.trim();
    latestQuery = trimmed;

    if (trimmed === '') {
      onStateChange({ status: 'idle', query: '' });
      return;
    }

    debouncedSearch(trimmed);
  };

  const retry = (): void => {
    if (latestQuery !== '' && !isDisposed) {
      void executeSearch(latestQuery);
    }
  };

  const dispose = (): void => {
    isDisposed = true;
    latestQuery = '';
    cancelActiveRequest();
  };

  return {
    handleInput,
    retry,
    dispose,
  };
}
