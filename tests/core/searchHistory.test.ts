import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SEARCH_HISTORY_ITEMS, SEARCH_HISTORY_STORAGE_KEY } from '../../src/core/constants.js';
import { createSearchHistoryManager, type KeyValueStorage } from '../../src/core/searchHistory.js';

function createMemoryStorage(): KeyValueStorage {
  const store = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

describe('searchHistoryManager', () => {
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('returns an empty array when storage is empty, contains invalid JSON, or holds a non-array value', () => {
    const manager = createSearchHistoryManager(storage);

    expect(manager.getHistory()).toEqual([]);

    storage.setItem(SEARCH_HISTORY_STORAGE_KEY, '{corrupted_json');
    expect(manager.getHistory()).toEqual([]);

    storage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify({ query: 'Spain' }));
    expect(manager.getHistory()).toEqual([]);
  });

  it('adds trimmed queries in LIFO order and ignores empty or whitespace-only inputs', () => {
    const manager = createSearchHistoryManager(storage);

    expect(manager.addQuery('')).toEqual([]);
    expect(manager.addQuery('   ')).toEqual([]);

    expect(manager.addQuery('  Spain  ')).toEqual(['Spain']);
    expect(manager.addQuery('Japan')).toEqual(['Japan', 'Spain']);
    expect(manager.getHistory()).toEqual(['Japan', 'Spain']);
  });

  it('deduplicates queries case-insensitively and moves the latest entry to the top', () => {
    const manager = createSearchHistoryManager(storage);

    manager.addQuery('Spain');
    manager.addQuery('Germany');
    const updated = manager.addQuery('  spain  ');

    expect(updated).toEqual(['spain', 'Germany']);
    expect(manager.getHistory()).toEqual(['spain', 'Germany']);
  });

  it('caps stored history at MAX_SEARCH_HISTORY_ITEMS keeping the most recent queries', () => {
    const manager = createSearchHistoryManager(storage);
    const totalInputs = MAX_SEARCH_HISTORY_ITEMS + 3;

    for (let index = 1; index <= totalInputs; index += 1) {
      manager.addQuery(`Country ${String(index)}`);
    }

    const history = manager.getHistory();

    expect(history).toHaveLength(MAX_SEARCH_HISTORY_ITEMS);
    expect(history[0]).toBe(`Country ${String(totalInputs)}`);
    expect(history.at(-1)).toBe(`Country ${String(totalInputs - MAX_SEARCH_HISTORY_ITEMS + 1)}`);
  });

  it('clears stored history from storage and returns an empty list afterwards', () => {
    const manager = createSearchHistoryManager(storage);

    manager.addQuery('France');
    manager.addQuery('Italy');
    manager.clearHistory();

    expect(manager.getHistory()).toEqual([]);
    expect(storage.getItem(SEARCH_HISTORY_STORAGE_KEY)).toBeNull();
  });
});
