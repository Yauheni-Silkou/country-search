import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCountrySearchUrl, DEBOUNCE_DELAY_MS } from '../../src/core/constants.js';
import {
  createCountrySearchController,
  type SearchState,
} from '../../src/core/countrySearchController.js';
import type { RawCountryResponse } from '../../src/core/mapCountryResponse.js';

const HTTP_STATUS_OK = 200;

interface DeferredFetchCall {
  url: string;
  signal: AbortSignal | undefined;
  resolveWithCountries: (payload: RawCountryResponse[]) => void;
  rejectWithError: (reason: unknown) => void;
}

function createJsonResponse(payload: RawCountryResponse[]): Response {
  return new Response(JSON.stringify(payload), {
    status: HTTP_STATUS_OK,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('countrySearchController — race condition and request cancellation', () => {
  const deferredCalls = new Map<string, DeferredFetchCall>();
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    deferredCalls.clear();
    mockFetch.mockReset();

    mockFetch.mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : String(input);
      const signal = init?.signal ?? undefined;

      return new Promise<Response>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        const onAbort = (): void => {
          reject(new DOMException('Aborted', 'AbortError'));
        };

        signal?.addEventListener('abort', onAbort, { once: true });

        deferredCalls.set(url, {
          url,
          signal,
          resolveWithCountries: (payload) => {
            signal?.removeEventListener('abort', onAbort);
            resolve(createJsonResponse(payload));
          },
          rejectWithError: (reason) => {
            signal?.removeEventListener('abort', onAbort);
            reject(reason);
          },
        });
      });
    });

    vi.useFakeTimers();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('aborts outdated in-flight request immediately on new input and ignores late responses', async () => {
    const states: SearchState[] = [];
    const onStateChange = vi.fn<(state: SearchState) => void>((state) => {
      states.push(state);
    });

    const controller = createCountrySearchController(onStateChange, DEBOUNCE_DELAY_MS);

    const firstQuery = 'sp';
    const secondQuery = 'spain';
    const firstUrl = buildCountrySearchUrl(firstQuery);
    const secondUrl = buildCountrySearchUrl(secondQuery);

    controller.handleInput(firstQuery);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_DELAY_MS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const firstRequest = deferredCalls.get(firstUrl);
    expect(firstRequest).toBeDefined();
    expect(firstRequest?.signal?.aborted).toBe(false);

    controller.handleInput(secondQuery);
    expect(firstRequest?.signal?.aborted).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DEBOUNCE_DELAY_MS);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondRequest = deferredCalls.get(secondUrl);
    expect(secondRequest).toBeDefined();
    expect(secondRequest?.signal?.aborted).toBe(false);

    vi.useRealTimers();

    secondRequest?.resolveWithCountries([
      {
        name: 'Spain',
        capital: 'Madrid',
        region: 'Europe',
        population: 47351567,
      },
    ]);

    await vi.waitFor(() => {
      expect(states.at(-1)?.status).toBe('success');
    });

    firstRequest?.resolveWithCountries([
      {
        name: 'Singapore',
        capital: 'Singapore',
        region: 'Asia',
        population: 5685807,
      },
    ]);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(states.at(-1)).toEqual({
      status: 'success',
      query: secondQuery,
      countries: [
        expect.objectContaining({
          name: 'Spain',
          capital: 'Madrid',
          region: 'Europe',
        }),
      ],
    });

    const hasErrorState = states.some((state) => state.status === 'error');
    expect(hasErrorState).toBe(false);

    controller.dispose();
  });

  it('aborts active request, sends no new network request, and resets to idle when input is cleared', async () => {
    const states: SearchState[] = [];
    const controller = createCountrySearchController((state) => {
      states.push(state);
    }, DEBOUNCE_DELAY_MS);

    const query = 'germany';
    const url = buildCountrySearchUrl(query);

    controller.handleInput(query);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_DELAY_MS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const activeRequest = deferredCalls.get(url);
    expect(activeRequest?.signal?.aborted).toBe(false);

    controller.handleInput('   ');
    await vi.advanceTimersByTimeAsync(DEBOUNCE_DELAY_MS);

    expect(activeRequest?.signal?.aborted).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toEqual({ status: 'idle', query: '' });

    controller.dispose();
  });

  it('transitions to error state on failure and retries the last entered query on retry()', async () => {
    const states: SearchState[] = [];
    const controller = createCountrySearchController((state) => {
      states.push(state);
    }, DEBOUNCE_DELAY_MS);

    const query = 'japan';
    const url = buildCountrySearchUrl(query);

    controller.handleInput(query);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_DELAY_MS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const failedAttempt = deferredCalls.get(url);
    failedAttempt?.rejectWithError(new TypeError('Failed to fetch'));

    vi.useRealTimers();

    await vi.waitFor(() => {
      expect(states.at(-1)?.status).toBe('error');
    });

    const errorState = states.at(-1);
    expect(errorState).toMatchObject({
      status: 'error',
      query,
    });
    if (errorState?.status === 'error') {
      expect(errorState.message.trim().length).toBeGreaterThan(0);
    }

    controller.retry();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const retryAttempt = deferredCalls.get(url);
    expect(retryAttempt).toBeDefined();
    retryAttempt?.resolveWithCountries([
      {
        name: 'Japan',
        capital: 'Tokyo',
        region: 'Asia',
        population: 125836021,
      },
    ]);

    await vi.waitFor(() => {
      expect(states.at(-1)?.status).toBe('success');
    });

    expect(states.at(-1)).toEqual({
      status: 'success',
      query,
      countries: [
        expect.objectContaining({
          name: 'Japan',
          capital: 'Tokyo',
        }),
      ],
    });

    controller.dispose();
  });
});
