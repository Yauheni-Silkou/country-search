import type { Country } from './mapCountryResponse.js';
import { searchCountries } from './searchCountries.js';

export type CountryFetcher = (
  query: string,
  signal: AbortSignal,
  timeoutMs?: number
) => Promise<Country[]>;

export interface CachedCountrySearch {
  search(query: string, signal: AbortSignal, timeoutMs?: number): Promise<Country[]>;
  clearCache(): void;
  getCacheSize(): number;
}

interface InFlightEntry {
  readonly promise: Promise<Country[]>;
  readonly controller: AbortController;
  subscribers: number;
}

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError');
}

export function createCachedCountrySearch(
  fetcher: CountryFetcher = searchCountries
): CachedCountrySearch {
  const cache = new Map<string, Country[]>();
  const inFlight = new Map<string, InFlightEntry>();

  const getOrCreateInFlight = (
    key: string,
    trimmedQuery: string,
    timeoutMs?: number
  ): InFlightEntry => {
    const existing = inFlight.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const internalController = new AbortController();
    const sharedPromise = fetcher(trimmedQuery, internalController.signal, timeoutMs).then(
      (countries) => {
        cache.set(key, [...countries]);
        return countries;
      }
    );

    const entry: InFlightEntry = {
      promise: sharedPromise,
      controller: internalController,
      subscribers: 0,
    };

    inFlight.set(key, entry);

    void sharedPromise
      .finally(() => {
        if (inFlight.get(key) === entry) {
          inFlight.delete(key);
        }
      })
      .catch(() => undefined);

    return entry;
  };

  const search = (query: string, signal: AbortSignal, timeoutMs?: number): Promise<Country[]> => {
    if (signal.aborted) {
      return Promise.reject(createAbortError());
    }

    const trimmedQuery = query.trim();
    const key = trimmedQuery.toLowerCase();

    const cached = cache.get(key);
    if (cached !== undefined) {
      return Promise.resolve([...cached]);
    }

    const entry = getOrCreateInFlight(key, trimmedQuery, timeoutMs);
    entry.subscribers += 1;

    return new Promise<Country[]>((resolve, reject) => {
      const onSubscriberAbort = (): void => {
        entry.subscribers -= 1;

        if (entry.subscribers <= 0) {
          entry.controller.abort();
          if (inFlight.get(key) === entry) {
            inFlight.delete(key);
          }
        }

        reject(createAbortError());
      };

      signal.addEventListener('abort', onSubscriberAbort, { once: true });

      entry.promise.then(
        (countries) => {
          signal.removeEventListener('abort', onSubscriberAbort);
          if (!signal.aborted) {
            resolve([...countries]);
          }
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onSubscriberAbort);
          if (!signal.aborted) {
            reject(error);
          }
        }
      );
    });
  };

  const clearCache = (): void => {
    cache.clear();
  };

  const getCacheSize = (): number => {
    return cache.size;
  };

  return {
    search,
    clearCache,
    getCacheSize,
  };
}
