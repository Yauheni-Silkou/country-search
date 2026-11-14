import { describe, expect, it, vi } from 'vitest';
import {
  type CountryFetcher,
  createCachedCountrySearch,
} from '../../src/core/cachedCountrySearch.js';
import type { Country } from '../../src/core/mapCountryResponse.js';
import { HttpError } from '../../src/core/searchCountries.js';

const HTTP_STATUS_SERVER_ERROR = 500;

interface DeferredFetch {
  signal: AbortSignal;
  resolve: (countries: Country[]) => void;
  reject: (reason: unknown) => void;
}

function createMockCountry(name: string): Country {
  return {
    name,
    flagUrl: `mock-flag-${name.toLowerCase()}.svg`,
    flagAlt: `Flag of ${name}`,
    capital: 'Madrid',
    region: 'Europe',
    population: 47351567,
    languages: ['Spanish'],
    currencies: ['Euro (EUR, €)'],
    area: 505992,
    borders: ['FRA', 'PRT'],
    description: '',
  };
}

function createDeferredFetcher(): {
  fetcher: ReturnType<typeof vi.fn<CountryFetcher>>;
  calls: DeferredFetch[];
} {
  const calls: DeferredFetch[] = [];
  const fetcher = vi.fn<CountryFetcher>((_query, signal) => {
    return new Promise<Country[]>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const onAbort = (): void => {
        reject(new DOMException('Aborted', 'AbortError'));
      };

      signal.addEventListener('abort', onAbort, { once: true });

      calls.push({
        signal,
        resolve: (countries) => {
          signal.removeEventListener('abort', onAbort);
          resolve(countries);
        },
        reject: (reason) => {
          signal.removeEventListener('abort', onAbort);
          reject(reason);
        },
      });
    });
  });

  return { fetcher, calls };
}

describe('cachedCountrySearch — response cache and in-flight deduplication', () => {
  it('caches successful results by normalized query key and rejects immediately if signal is already aborted', async () => {
    const spain = createMockCountry('Spain');
    const fetcher = vi.fn<CountryFetcher>().mockResolvedValue([spain]);
    const cachedSearch = createCachedCountrySearch(fetcher);

    const firstController = new AbortController();
    const firstResult = await cachedSearch.search('Spain', firstController.signal);

    expect(firstResult).toEqual([spain]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cachedSearch.getCacheSize()).toBe(1);

    const secondController = new AbortController();
    const secondResult = await cachedSearch.search('  spain  ', secondController.signal);

    expect(secondResult).toEqual([spain]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const preAbortedController = new AbortController();
    preAbortedController.abort();

    await expect(cachedSearch.search('spain', preAbortedController.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    cachedSearch.clearCache();
    expect(cachedSearch.getCacheSize()).toBe(0);
  });

  it('does not cache failed responses and retries network request on subsequent search', async () => {
    const spain = createMockCountry('Spain');
    const fetcher = vi
      .fn<CountryFetcher>()
      .mockRejectedValueOnce(new HttpError(HTTP_STATUS_SERVER_ERROR))
      .mockResolvedValueOnce([spain]);

    const cachedSearch = createCachedCountrySearch(fetcher);
    const firstController = new AbortController();

    await expect(cachedSearch.search('spain', firstController.signal)).rejects.toBeInstanceOf(
      HttpError
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cachedSearch.getCacheSize()).toBe(0);

    const secondController = new AbortController();
    const recoveredResult = await cachedSearch.search('spain', secondController.signal);

    expect(recoveredResult).toEqual([spain]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cachedSearch.getCacheSize()).toBe(1);
  });

  it('deduplicates concurrent in-flight requests with the same normalized query', async () => {
    const { fetcher, calls } = createDeferredFetcher();
    const cachedSearch = createCachedCountrySearch(fetcher);

    const firstController = new AbortController();
    const secondController = new AbortController();

    const firstPromise = cachedSearch.search('Spain', firstController.signal);
    const secondPromise = cachedSearch.search('  spain ', secondController.signal);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);

    const spain = createMockCountry('Spain');
    const firstCall = calls[0];
    if (!firstCall) {
      throw new Error('Expected in-flight call to be recorded');
    }

    firstCall.resolve([spain]);

    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(firstResult).toEqual([spain]);
    expect(secondResult).toEqual([spain]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cachedSearch.getCacheSize()).toBe(1);
  });

  it('isolates subscriber AbortSignal during deduplication and aborts underlying fetch only when all subscribers abort', async () => {
    const { fetcher, calls } = createDeferredFetcher();
    const cachedSearch = createCachedCountrySearch(fetcher);

    const subscriberOne = new AbortController();
    const subscriberTwo = new AbortController();

    const promiseOne = cachedSearch.search('spain', subscriberOne.signal);
    const promiseTwo = cachedSearch.search('spain', subscriberTwo.signal);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const underlyingCall = calls[0];
    if (!underlyingCall) {
      throw new Error('Expected underlying fetch call to exist');
    }

    const rejectionAssertionOne = expect(promiseOne).rejects.toMatchObject({
      name: 'AbortError',
    });
    subscriberOne.abort();

    await rejectionAssertionOne;
    expect(underlyingCall.signal.aborted).toBe(false);

    const spain = createMockCountry('Spain');
    underlyingCall.resolve([spain]);

    await expect(promiseTwo).resolves.toEqual([spain]);
    expect(cachedSearch.getCacheSize()).toBe(1);

    const subscriberThree = new AbortController();
    const subscriberFour = new AbortController();

    const promiseThree = cachedSearch.search('germany', subscriberThree.signal);
    const promiseFour = cachedSearch.search('germany', subscriberFour.signal);

    expect(fetcher).toHaveBeenCalledTimes(2);
    const secondUnderlyingCall = calls[1];
    if (!secondUnderlyingCall) {
      throw new Error('Expected second underlying fetch call to exist');
    }

    const rejectionAssertionThree = expect(promiseThree).rejects.toMatchObject({
      name: 'AbortError',
    });
    const rejectionAssertionFour = expect(promiseFour).rejects.toMatchObject({
      name: 'AbortError',
    });

    subscriberThree.abort();
    expect(secondUnderlyingCall.signal.aborted).toBe(false);

    subscriberFour.abort();
    expect(secondUnderlyingCall.signal.aborted).toBe(true);

    await Promise.all([rejectionAssertionThree, rejectionAssertionFour]);
  });
});
