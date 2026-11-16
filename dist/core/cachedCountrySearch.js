import { searchCountries } from './searchCountries.js';
function createAbortError() {
    return new DOMException('The operation was aborted', 'AbortError');
}
export function createCachedCountrySearch(fetcher = searchCountries) {
    const cache = new Map();
    const inFlight = new Map();
    const getOrCreateInFlight = (key, trimmedQuery, timeoutMs) => {
        const existing = inFlight.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const internalController = new AbortController();
        const sharedPromise = fetcher(trimmedQuery, internalController.signal, timeoutMs).then((countries) => {
            cache.set(key, [...countries]);
            return countries;
        });
        const entry = {
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
    const search = (query, signal, timeoutMs) => {
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
        return new Promise((resolve, reject) => {
            const onSubscriberAbort = () => {
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
            entry.promise.then((countries) => {
                signal.removeEventListener('abort', onSubscriberAbort);
                if (!signal.aborted) {
                    resolve([...countries]);
                }
            }, (error) => {
                signal.removeEventListener('abort', onSubscriberAbort);
                if (!signal.aborted) {
                    reject(error);
                }
            });
        });
    };
    const clearCache = () => {
        cache.clear();
    };
    const getCacheSize = () => {
        return cache.size;
    };
    return {
        search,
        clearCache,
        getCacheSize,
    };
}
