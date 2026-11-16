import { buildCountrySearchUrl, HTTP_STATUS_NOT_FOUND, REQUEST_TIMEOUT_MS } from './constants.js';
import { mapCountryResponse } from './mapCountryResponse.js';
export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message ?? `HTTP Error: ${status}`);
        this.name = 'HttpError';
        this.status = status;
    }
}
export async function searchCountries(query, signal, timeoutMs = REQUEST_TIMEOUT_MS) {
    const url = buildCountrySearchUrl(query);
    const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    const response = await fetch(url, { signal: combinedSignal });
    if (response.status === HTTP_STATUS_NOT_FOUND) {
        return [];
    }
    if (!response.ok) {
        throw new HttpError(response.status);
    }
    const data = (await response.json());
    return data.map(mapCountryResponse);
}
