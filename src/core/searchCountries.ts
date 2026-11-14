import { REQUEST_TIMEOUT_MS } from './constants.js';
import type { Country } from './mapCountryResponse.js';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `HTTP Error: ${status}`);
    void status;
    throw new Error('Not implemented');
  }
}

export async function searchCountries(
  query: string,
  signal: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Country[]> {
  void query;
  void signal;
  void timeoutMs;
  throw new Error('Not implemented');
}
