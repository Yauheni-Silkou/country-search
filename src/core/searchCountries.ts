import { buildCountrySearchUrl, HTTP_STATUS_NOT_FOUND, REQUEST_TIMEOUT_MS } from './constants.js';
import { mapCountryResponse, type Country, type RawCountryResponse } from './mapCountryResponse.js';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `HTTP Error: ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function searchCountries(
  query: string,
  signal: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Country[]> {
  const url = buildCountrySearchUrl(query);
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

  const response = await fetch(url, { signal: combinedSignal });

  if (response.status === HTTP_STATUS_NOT_FOUND) {
    return [];
  }

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  const data = (await response.json()) as RawCountryResponse[];
  return data.map(mapCountryResponse);
}
