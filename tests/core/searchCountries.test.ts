import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCountrySearchUrl,
  HTTP_STATUS_NOT_FOUND,
  REQUEST_TIMEOUT_MS,
} from '../../src/core/constants.js';
import type { RawCountryResponse } from '../../src/core/mapCountryResponse.js';
import { HttpError, searchCountries } from '../../src/core/searchCountries.js';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_INTERNAL_ERROR = 500;
const TEST_SHORT_TIMEOUT_MS = 1000;

describe('HttpError', () => {
  it('creates an Error instance with status, name "HttpError", and readable message', () => {
    const error = new HttpError(HTTP_STATUS_INTERNAL_ERROR);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(HTTP_STATUS_INTERNAL_ERROR);
    expect(error.message).toContain(String(HTTP_STATUS_INTERNAL_ERROR));
  });
});

describe('searchCountries', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches encoded URL via buildCountrySearchUrl with signal and returns mapped countries on 200 OK', async () => {
    const controller = new AbortController();
    const query = 'united states';
    const rawPayload: RawCountryResponse[] = [
      {
        name: 'United States',
        capital: 'Washington, D.C.',
        region: 'Americas',
        population: 331002651,
        flags: {
          svg: 'mock-flag-us.svg',
          alt: 'Flag of the United States',
        },
        languages: [{ name: 'English', code: 'en' }],
        currencies: [{ name: 'United States dollar', code: 'USD', symbol: '$' }],
        area: 9372610,
        borders: ['CAN', 'MEX'],
        description: 'Country in North America',
      },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(rawPayload), {
        status: HTTP_STATUS_OK,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await searchCountries(query, controller.signal);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const firstCall = mockFetch.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected fetch to be called at least once');
    }

    const [calledUrl, calledInit] = firstCall;
    expect(calledUrl).toBe(buildCountrySearchUrl(query));
    expect(calledInit?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'United States',
      capital: 'Washington, D.C.',
      region: 'Americas',
    });
  });

  it('returns an empty array without throwing when API responds with 404 Not Found', async () => {
    const controller = new AbortController();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not Found' }), {
        status: HTTP_STATUS_NOT_FOUND,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await searchCountries('unknownland', controller.signal);

    expect(result).toEqual([]);
  });

  it('throws HttpError with status code on non-404 HTTP errors (e.g. 500)', async () => {
    const controller = new AbortController();

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: HTTP_STATUS_INTERNAL_ERROR,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const promise = searchCountries('spain', controller.signal);

    await expect(promise).rejects.toBeInstanceOf(HttpError);
    await expect(promise).rejects.toMatchObject({
      name: 'HttpError',
      status: HTTP_STATUS_INTERNAL_ERROR,
    });
  });

  it('aborts the composed signal passed to fetch when external controller aborts', async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;

    mockFetch.mockImplementationOnce((_input, init) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const pending = searchCountries('spain', controller.signal, REQUEST_TIMEOUT_MS);
    const assertion = expect(pending).rejects.toThrow();
    controller.abort();

    await assertion;
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('aborts the composed signal passed to fetch when timeoutMs elapses', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;

    mockFetch.mockImplementationOnce((_input, init) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(
            init.signal?.reason ??
              new DOMException('The operation was aborted due to timeout', 'TimeoutError')
          );
        });
      });
    });

    const pending = searchCountries('spain', controller.signal, TEST_SHORT_TIMEOUT_MS);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(TEST_SHORT_TIMEOUT_MS);

    await assertion;
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(true);
  });
});
