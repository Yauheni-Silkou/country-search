import { DEBOUNCE_DELAY_MS } from './constants.js';
import { debounce } from './debounce.js';
import { classifySearchError } from './errorClassifier.js';
import { createCachedCountrySearch } from './cachedCountrySearch.js';
export function createCountrySearchController(onStateChange, delayMs = DEBOUNCE_DELAY_MS, cachedSearch = createCachedCountrySearch()) {
    let currentController = null;
    let latestQuery = '';
    let isDisposed = false;
    const cancelActiveRequest = () => {
        if (currentController !== null) {
            currentController.abort();
            currentController = null;
        }
    };
    const executeSearch = async (query) => {
        if (isDisposed || query !== latestQuery || query === '') {
            return;
        }
        cancelActiveRequest();
        const controller = new AbortController();
        currentController = controller;
        onStateChange({ status: 'loading', query });
        try {
            const countries = await cachedSearch.search(query, controller.signal);
            if (controller !== currentController || isDisposed) {
                return;
            }
            currentController = null;
            onStateChange(countries.length === 0
                ? { status: 'empty', query }
                : { status: 'success', query, countries });
        }
        catch (error) {
            if (controller === currentController) {
                currentController = null;
            }
            const classified = classifySearchError(error);
            if (classified.kind === 'abort') {
                return;
            }
            if (!isDisposed && query === latestQuery) {
                onStateChange({
                    status: 'error',
                    query,
                    message: classified.message,
                });
            }
        }
    };
    const debouncedSearch = debounce((query) => {
        void executeSearch(query);
    }, delayMs);
    const handleInput = (rawQuery) => {
        cancelActiveRequest();
        const trimmed = rawQuery.trim();
        latestQuery = trimmed;
        if (trimmed === '') {
            onStateChange({ status: 'idle', query: '' });
            return;
        }
        debouncedSearch(trimmed);
    };
    const retry = () => {
        if (latestQuery !== '' && !isDisposed) {
            void executeSearch(latestQuery);
        }
    };
    const dispose = () => {
        isDisposed = true;
        latestQuery = '';
        cancelActiveRequest();
    };
    return {
        handleInput,
        retry,
        dispose,
    };
}
