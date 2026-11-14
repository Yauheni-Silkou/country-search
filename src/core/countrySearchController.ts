import type { Country } from './mapCountryResponse.js';

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
  delayMs?: number
): CountrySearchController {
  void onStateChange;
  void delayMs;
  throw new Error('Not implemented');
}
