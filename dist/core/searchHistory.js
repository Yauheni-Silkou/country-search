import { MAX_SEARCH_HISTORY_ITEMS, SEARCH_HISTORY_STORAGE_KEY } from './constants.js';
export function createSearchHistoryManager(storage, maxItems = MAX_SEARCH_HISTORY_ITEMS, storageKey = SEARCH_HISTORY_STORAGE_KEY) {
    const safeLimit = Math.max(0, maxItems);
    const getHistory = () => {
        try {
            const raw = storage.getItem(storageKey);
            if (raw === null) {
                return [];
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .filter((item) => typeof item === 'string' && item.trim() !== '')
                .slice(0, safeLimit);
        }
        catch {
            return [];
        }
    };
    const addQuery = (rawQuery) => {
        const trimmed = rawQuery.trim();
        if (trimmed === '') {
            return getHistory();
        }
        const current = getHistory();
        const filtered = current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
        const next = [trimmed, ...filtered].slice(0, safeLimit);
        try {
            storage.setItem(storageKey, JSON.stringify(next));
        }
        catch {
            // Ignore storage quota or access errors while returning the updated list
        }
        return [...next];
    };
    const clearHistory = () => {
        try {
            storage.removeItem(storageKey);
        }
        catch {
            // Ignore storage access errors
        }
    };
    return {
        getHistory,
        addQuery,
        clearHistory,
    };
}
