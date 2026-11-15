import { MAX_SEARCH_HISTORY_ITEMS, SEARCH_HISTORY_STORAGE_KEY } from './constants.js';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SearchHistoryManager {
  getHistory(): string[];
  addQuery(rawQuery: string): string[];
  clearHistory(): void;
}

export function createSearchHistoryManager(
  storage: KeyValueStorage,
  maxItems = MAX_SEARCH_HISTORY_ITEMS,
  storageKey = SEARCH_HISTORY_STORAGE_KEY
): SearchHistoryManager {
  const safeLimit = Math.max(0, maxItems);

  const getHistory = (): string[] => {
    try {
      const raw = storage.getItem(storageKey);
      if (raw === null) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .slice(0, safeLimit);
    } catch {
      return [];
    }
  };

  const addQuery = (rawQuery: string): string[] => {
    const trimmed = rawQuery.trim();
    if (trimmed === '') {
      return getHistory();
    }

    const current = getHistory();
    const filtered = current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...filtered].slice(0, safeLimit);

    try {
      storage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage quota or access errors while returning the updated list
    }

    return [...next];
  };

  const clearHistory = (): void => {
    try {
      storage.removeItem(storageKey);
    } catch {
      // Ignore storage access errors
    }
  };

  return {
    getHistory,
    addQuery,
    clearHistory,
  };
}
