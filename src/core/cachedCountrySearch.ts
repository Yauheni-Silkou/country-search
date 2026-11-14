import type { Country } from './mapCountryResponse.js';

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

export function createCachedCountrySearch(fetcher?: CountryFetcher): CachedCountrySearch {
  void fetcher;
  throw new Error('Not implemented');
}
